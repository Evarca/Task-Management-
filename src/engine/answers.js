/* ════════════════════════════════════════════════════════════════════════════
   SHARED CHECKLIST ANSWERS

   A checklist run is ONE shared thing per (checklist, date). Anyone assigned can
   answer any question; each answer is submitted on its own and carries the name of
   whoever submitted it and the time they did. A submitted answer LOCKS — changing it
   needs a manager to approve an edit request.

   Only when every question has a submitted answer does the checklist itself become
   submittable, which then writes the normal `submissions` row the rest of the app
   (approvals, analytics, exports) already understands.

   Storage: the new tm_answers / tm_answer_edits tables and the tm-answer-photos
   bucket. Nothing here writes to a table that predates this build.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── mappers ── */
function _mAns(rows){return(rows||[]).map(a=>({
  id:a.id, checklistId:a.checklist_id, date:a.run_date, questionId:a.question_id,
  response:(a.response===null||a.response===undefined)?null:a.response,
  comment:a.comment||'', photos:Array.isArray(a.photos)?a.photos:[],
  submittedBy:a.submitted_by||null, submittedAt:a.submitted_at,
  locked:a.locked!==false, editCount:a.edit_count||0, updatedAt:a.updated_at,
}));}
function _ansRow(a){return{
  id:a.id, checklist_id:a.checklistId, run_date:a.date, question_id:a.questionId,
  response:(a.response===null||a.response===undefined)?null:String(a.response),
  comment:a.comment||'', photos:(a.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]'&&!p.startsWith('data:')),
  submitted_by:a.submittedBy||null, submitted_at:a.submittedAt||new Date().toISOString(),
  locked:a.locked!==false, edit_count:a.editCount||0, updated_at:new Date().toISOString(),
};}
function _mAnsEdit(rows){return(rows||[]).map(e=>({
  id:e.id, answerId:e.answer_id, checklistId:e.checklist_id, date:e.run_date, questionId:e.question_id,
  requestedBy:e.requested_by||null, requestedAt:e.requested_at, reason:e.reason||'',
  status:e.status||'Pending', decidedBy:e.decided_by||null, decidedAt:e.decided_at||null,
  decisionNote:e.decision_note||'', oldResponse:e.old_response||null, oldComment:e.old_comment||null,
}));}
function _ansEditRow(e){return{
  id:e.id, answer_id:e.answerId, checklist_id:e.checklistId, run_date:e.date, question_id:e.questionId,
  requested_by:e.requestedBy||null, requested_at:e.requestedAt||new Date().toISOString(), reason:e.reason||'',
  status:e.status||'Pending', decided_by:e.decidedBy||null, decided_at:e.decidedAt||null,
  decision_note:e.decisionNote||'', old_response:e.oldResponse||null, old_comment:e.oldComment||null,
};}

/* ── lookups ──
   The id is deterministic — (checklist, date, question) — so two people submitting at the
   same moment collapse onto one row instead of racing to create duplicates. */
const _ansId=(clId,date,qId)=>'ans_'+clId+'_'+date+'_'+qId;
function _ansFor(clId,date,qId){return(DB.tmAnswers||[]).find(a=>a.checklistId===clId&&a.date===date&&a.questionId===qId)||null;}
function _ansAll(clId,date){return(DB.tmAnswers||[]).filter(a=>a.checklistId===clId&&a.date===date);}
function _clQuestions(c){return((c&&c.questionIds)||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean);}
/* Progress of one run: how many of its questions have a submitted answer. */
function _ansProgress(c,date){
  const qs=_clQuestions(c);
  const done=qs.filter(q=>{const a=_ansFor(c.id,date,q.id);return a&&a.response!==null&&a.response!=='';}).length;
  return{total:qs.length,done,complete:qs.length>0&&done>=qs.length};
}
/* Everyone who has contributed an answer to this run, in the order they first did. */
function _ansContributors(clId,date){
  const seen=new Set();const out=[];
  _ansAll(clId,date).slice().sort((a,b)=>String(a.submittedAt||'').localeCompare(String(b.submittedAt||''))).forEach(a=>{
    if(!a.submittedBy||seen.has(a.submittedBy))return;seen.add(a.submittedBy);
    const u=uById(a.submittedBy);if(u)out.push(u);
  });
  return out;
}

/* ── deadline ──
   Both parts are optional: a checklist can have a due DATE (tm_checklist_meta), a due TIME
   (the existing checklists.schedule_time), both, or neither. With neither it is never late. */
function _clDeadlineDate(clId){const m=(DB.tmMeta||{})[clId];return(m&&m.deadlineDate)||null;}
function _clDeadlineLabel(c){
  if(!c)return'';
  const d=_clDeadlineDate(c.id),t=c.scheduleTime||'';
  if(d&&t)return fmtS(d)+' · '+t;
  if(d)return fmtS(d);
  if(t)return 'daily by '+t;
  return '';
}
/* Has this run passed its deadline? A due DATE fixes the deadline to that calendar day;
   without one the run is due on its own date. No time means end of day. */
function _clOverdue(c,date){
  if(!c)return false;
  const dd=_clDeadlineDate(c.id)||date;
  const today=todayISO();
  if(dd<today)return true;
  if(dd>today)return false;
  return !!(c.scheduleTime&&nowHM()>hm2m(c.scheduleTime));
}

/* ── edit requests ── */
function _ansEditPending(answerId){return(DB.tmAnswerEdits||[]).find(e=>e.answerId===answerId&&e.status==='Pending')||null;}
function _ansEditApproved(answerId){return(DB.tmAnswerEdits||[]).find(e=>e.answerId===answerId&&e.status==='Approved')||null;}
/* Who can decide an edit request: the requester's manager, or anyone holding checklist approval. */
function _ansCanDecide(e){
  if(!e)return false;
  if(can('checklists','approve')||isAdmin())return true;
  const u=uById(e.requestedBy);
  return !!(u&&u.managerId===S.uid);
}

/* ── submit one answer ──
   Reads the in-progress value out of RUN (the same local draft object the inputs already
   write to), then writes the row and locks it. */
App._ansSubmit=async(clId,date,qId)=>{
  const c=clById(clId);if(!c)return;
  const q=(DB.questions||[]).find(x=>x.id===qId);if(!q)return;
  const run=RUN[clId]||{};
  const draft=((run.questionResponses)||[]).find(r=>r.questionId===qId)||{};
  const prev=_ansFor(clId,date,qId);
  if(prev&&prev.locked){toast('That answer is submitted — request an edit to change it','warn');return;}

  const resp=draft.response;
  if(resp===null||resp===undefined||resp===''){toast('Answer the question first','err');return;}
  if(q.photo&&!_qrHasPhoto(draft)){toast('A photo is required for this question','err');return;}
  if(q.comment&&!(draft.comment||'').trim()){toast('A comment is required for this question','err');return;}

  const id=_ansId(clId,date,qId);
  const nowISO=new Date().toISOString();
  const rec={id,checklistId:clId,date,questionId:qId,response:resp,comment:draft.comment||'',
    photos:_qrPhotoList(draft),submittedBy:S.uid,submittedAt:nowISO,
    locked:true,editCount:prev?(prev.editCount||0)+1:0,updatedAt:nowISO};

  // Optimistic local write so the card locks immediately, then persist.
  DB.tmAnswers=(DB.tmAnswers||[]).filter(a=>a.id!==id);DB.tmAnswers.push(rec);
  // An approved edit is spent once the new answer lands.
  const ap=_ansEditApproved(id);
  if(ap){ap.status='Used';ap.oldResponse=prev?prev.response:null;ap.oldComment=prev?prev.comment:null;
    _pushRow('tm_answer_edits',_ansEditRow(ap),'edit request');}
  log(fullName(me()),prev?'Edited answer':'Submitted answer',c.name+' · '+String(q.text).slice(0,60));
  saveDB();toast(prev?'Answer updated':'Answer submitted');_touchAction();rr();

  // Photos taken on the device are base64 — park them in the new bucket and store URLs.
  const durable=await _ansUploadPhotos(rec).catch(()=>rec.photos);
  rec.photos=durable;
  const {error}=await sb.from('tm_answers').upsert(_ansRow(rec),{onConflict:'id'});
  if(error){_syncErr('answer')(error);return;}
  saveDB();rr();
};

/* Upload any inline base64 photos to the answer-photo bucket; anything that fails is dropped
   rather than stored as a placeholder, so a broken image never reaches a teammate's screen. */
async function _ansUploadPhotos(rec){
  const out=[];
  for(const p of(rec.photos||[])){
    if(typeof p!=='string'||!p.startsWith('data:')){if(p&&p!=='[photo]')out.push(p);continue;}
    try{
      const blob=_dataUrlToBlob(p);if(!blob)continue;
      const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');
      const path=rec.checklistId+'/'+rec.date+'/'+rec.questionId+'_'+uid('p')+'.'+ext;
      const {error}=await sb.storage.from('tm-answer-photos').upload(path,blob,{cacheControl:'3600',upsert:true,contentType:blob.type});
      if(error){console.warn('[answer photo]',error.message);continue;}
      const {data}=sb.storage.from('tm-answer-photos').getPublicUrl(path);
      if(data&&data.publicUrl)out.push(data.publicUrl);
    }catch(e){console.warn('[answer photo]',e&&e.message);}
  }
  return out;
}

/* ── request an edit on a submitted answer ── */
App._ansEditAsk=(clId,date,qId)=>{
  const a=_ansFor(clId,date,qId);if(!a)return;
  if(_ansEditPending(a.id)){toast('An edit request is already waiting on this answer','warn');return;}
  const q=(DB.questions||[]).find(x=>x.id===qId);
  const c=clById(clId);
  modalShell({title:'Request an edit',sub:(c?c.name:'')+' · '+fmtD(date),size:'max-w-sm',
    body:`<div>
      <div style="background:var(--c-surface-2);border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--c-text)">${esc(q?q.text:'Question')}</div>
        <div style="font-size:12.5px;color:var(--c-text-2);margin-top:4px">Current answer: <strong>${esc(String(a.response??'—'))}</strong></div>
      </div>
      <label style="display:block;font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Why does it need changing?</label>
      <textarea id="ans-edit-why" rows="3" class="ui-input rf" placeholder="e.g. I entered the wrong reading"></textarea>
      <p style="font-size:11.5px;color:var(--c-text-3);margin-top:8px;line-height:1.5">Your manager gets this in their Approvals inbox. Once they approve it, this one answer unlocks for you to change — the rest of the checklist stays as it is.</p>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Send request',`App._ansEditSend('${esc(clId)}','${esc(date)}','${esc(qId)}')`)});
};
App._ansEditSend=(clId,date,qId)=>{
  const a=_ansFor(clId,date,qId);if(!a)return;
  const reason=($('#ans-edit-why')?.value||'').trim();
  const c=clById(clId);const q=(DB.questions||[]).find(x=>x.id===qId);
  const e={id:uid('ae'),answerId:a.id,checklistId:clId,date,questionId:qId,
    requestedBy:S.uid,requestedAt:new Date().toISOString(),reason,status:'Pending',
    decidedBy:null,decidedAt:null,decisionNote:'',oldResponse:null,oldComment:null};
  DB.tmAnswerEdits=DB.tmAnswerEdits||[];DB.tmAnswerEdits.push(e);
  _pushRow('tm_answer_edits',_ansEditRow(e),'edit request');
  // Tell the people who can actually act on it.
  const me2=me();const txt='✏️ Edit request: '+fullName(me2)+' wants to change an answer in "'+(c?c.name:'a checklist')+'" — '+String(q?q.text:'').slice(0,50);
  const targets=new Set();
  if(me2&&me2.managerId)targets.add(me2.managerId);
  DB.users.filter(u=>u.status==='Active'&&u.id!==S.uid&&(isSuperU(u)||canUser(u,'checklists','approve'))).forEach(u=>targets.add(u.id));
  targets.forEach(t=>_hrmNotify(t,txt,'checklist','approvals'));
  log(fullName(me2),'Requested answer edit',(c?c.name:'')+' · '+String(q?q.text:'').slice(0,60));
  saveDB();closeModal();toast('Edit request sent to your manager');rr();
};

/* ── decide an edit request (Approvals inbox) ── */
App._ansEditDecide=(editId,action)=>{
  const e=(DB.tmAnswerEdits||[]).find(x=>x.id===editId);if(!e)return;
  if(e.status!=='Pending'){toast('Already '+String(e.status).toLowerCase(),'warn');return;}
  if(!_ansCanDecide(e)){toast('Only their manager or a checklist approver can decide this','err');return;}
  const approve=action==='approve';
  e.status=approve?'Approved':'Rejected';
  e.decidedBy=S.uid;e.decidedAt=new Date().toISOString();
  _pushRow('tm_answer_edits',_ansEditRow(e),'edit request');
  if(approve){
    const a=(DB.tmAnswers||[]).find(x=>x.id===e.answerId);
    if(a){a.locked=false;a.updatedAt=new Date().toISOString();
      sb.from('tm_answers').update({locked:false,updated_at:a.updatedAt}).eq('id',a.id)
        .then(({error})=>{if(error)_syncErr('unlock answer')(error);}).catch(_syncErr('unlock answer'));}
  }
  const c=clById(e.checklistId);const q=(DB.questions||[]).find(x=>x.id===e.questionId);
  _hrmNotify(e.requestedBy,(approve?'✅ Edit approved: ':'❌ Edit rejected: ')+'"'+String(q?q.text:'answer').slice(0,40)+'" in '+(c?c.name:'a checklist')+(approve?' — you can change it now':''),'checklist','mychecklists');
  log(fullName(me()),approve?'Approved answer edit':'Rejected answer edit',(c?c.name:'')+' · '+fullName(uById(e.requestedBy)));
  saveDB();toast(approve?'Edit approved — they can change that answer':'Edit rejected','ok');_touchAction();rr();
};
/* An approver can also unlock directly, without the round trip through a request. */
App._ansUnlock=(clId,date,qId)=>{
  if(!(can('checklists','approve')||isAdmin())){toast('You need Checklists → Approve','err');return;}
  const a=_ansFor(clId,date,qId);if(!a||!a.locked)return;
  a.locked=false;a.updatedAt=new Date().toISOString();
  sb.from('tm_answers').update({locked:false,updated_at:a.updatedAt}).eq('id',a.id)
    .then(({error})=>{if(error)_syncErr('unlock answer')(error);}).catch(_syncErr('unlock answer'));
  if(a.submittedBy&&a.submittedBy!==S.uid){
    const q=(DB.questions||[]).find(x=>x.id===qId);
    _hrmNotify(a.submittedBy,'🔓 '+fullName(me())+' unlocked your answer to "'+String(q?q.text:'').slice(0,40)+'" — you can change it','checklist','mychecklists');
  }
  log(fullName(me()),'Unlocked answer',(clById(clId)||{}).name||'');
  saveDB();toast('Answer unlocked');rr();
};

/* ── loading ──
   Answers ride a 7-day hot window at boot, and the day being viewed loads on demand
   (the same shape as the submissions loader). */
async function _ansLoadWindow(fromISO){
  try{
    const [ans,eds,meta]=await Promise.all([
      sb.from('tm_answers').select('*').gte('run_date',fromISO),
      sb.from('tm_answer_edits').select('*').order('requested_at',{ascending:false}),
      sb.from('tm_checklist_meta').select('*'),
    ]);
    if(!ans.error)_applyAnswers(_mAns(ans.data),{replaceFrom:fromISO});
    if(!eds.error)DB.tmAnswerEdits=_mAnsEdit(eds.data);
    if(!meta.error){DB.tmMeta={};(meta.data||[]).forEach(r=>{DB.tmMeta[r.checklist_id]={deadlineDate:r.deadline_date||null};});}
  }catch(e){console.warn('[answers] load skipped:',e&&e.message);}
}
async function _ansLoadDate(dateISO){
  if(!dateISO)return;
  try{
    const {data,error}=await sb.from('tm_answers').select('*').eq('run_date',dateISO);
    if(!error)_applyAnswers(_mAns(data),{replaceDate:dateISO});
  }catch(e){console.warn('[answers] date load skipped:',e&&e.message);}
}
/* Merge server rows over local ones without dropping an answer submitted seconds ago that
   the query window didn't cover. */
function _applyAnswers(rows,opt){
  const o=opt||{};
  const incoming=new Set(rows.map(r=>r.id));
  let keep=(DB.tmAnswers||[]).filter(a=>!incoming.has(a.id));
  if(o.replaceDate)keep=keep.filter(a=>a.date!==o.replaceDate);
  else if(o.replaceFrom)keep=keep.filter(a=>a.date<o.replaceFrom);
  DB.tmAnswers=[...keep,...rows];
}

/* ── checklist meta (the optional deadline date) ── */
function _tmMetaSave(clId,deadlineDate){
  DB.tmMeta=DB.tmMeta||{};
  DB.tmMeta[clId]={deadlineDate:deadlineDate||null};
  sb.from('tm_checklist_meta').upsert({checklist_id:clId,deadline_date:deadlineDate||null,updated_at:new Date().toISOString()},{onConflict:'checklist_id'})
    .then(({error})=>{if(error)_syncErr('checklist deadline')(error);}).catch(_syncErr('checklist deadline'));
}

/* — auto: expose on window (modules resolve cross-file references via window at call time) — */
window._mAns=_mAns;window._ansRow=_ansRow;window._mAnsEdit=_mAnsEdit;window._ansEditRow=_ansEditRow;
window._ansId=_ansId;window._ansFor=_ansFor;window._ansAll=_ansAll;window._clQuestions=_clQuestions;
window._ansProgress=_ansProgress;window._ansContributors=_ansContributors;
window._clDeadlineDate=_clDeadlineDate;window._clDeadlineLabel=_clDeadlineLabel;window._clOverdue=_clOverdue;
window._ansEditPending=_ansEditPending;window._ansEditApproved=_ansEditApproved;window._ansCanDecide=_ansCanDecide;
window._ansUploadPhotos=_ansUploadPhotos;window._ansLoadWindow=_ansLoadWindow;window._ansLoadDate=_ansLoadDate;
window._applyAnswers=_applyAnswers;window._tmMetaSave=_tmMetaSave;
