

/* ===== MY CHECKLISTS — Calendar + Ultra-compact ===== */
window.RUN={};
let COLL={};  // Hierarchy collapse state





/* ════════ MY DAY (role-aware landing) ════════
   "What do I need to do today": the day's checklists, the tickets on me, whatever is
   waiting on my decision, and a 30-day view of how my own submissions have gone.
   Pure composition over the existing data model — no new state. */
function homeDash(){
  const u=me();const today=todayISO();
  if(!u)return''; // hardening: transient render while the session user isn't resolvable yet
  const hr=new Date().getHours();
  const greet=hr<12?'Good morning':hr<18?'Good afternoon':'Good evening';
  // Today's checklist status
  const dayCls=myCls(S.uid,today);
  const doneN=dayCls.filter(c=>subForCl(c,S.uid,today)).length;
  const pendN=dayCls.length-doneN;
  const lateN=dayCls.filter(c=>!subForCl(c,S.uid,today)&&c.scheduleTime&&nowHM()>hm2m(c.scheduleTime)).length;
  // Unread / needs-attention counts
  const notifN=DB.notifications.filter(n=>n.userId===S.uid&&!n.read).length;
  const apprN=_approvalPendingCount();
  const tkN=(DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&!(t.viewedBy||[]).includes(S.uid)).length;
  const myOpenTk=(DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&(t.status==='Open'||t.status==='In Progress'));
  const canApprove=can('approvals','view')&&(isAdmin()||isMgr()||can('checklists','approve'));

  // ── small "attention" tiles row ──
  const attTile=(label,n,route,tone,icon)=>{
    const tones={brand:['var(--c-brand-soft)','var(--c-brand-ink)'],amber:['var(--c-warn-soft)','var(--c-warn-ink)'],rose:['var(--c-danger-soft)','var(--c-danger-ink)'],info:['var(--c-info-soft)','var(--c-info-ink)']};
    const [bg,fg]=tones[tone]||tones.brand;
    return `<button onclick="App.go('${route}')" style="flex:1;min-width:140px;display:flex;align-items:center;gap:11px;padding:14px;border-radius:var(--r-lg);border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;text-align:left;min-height:64px">
      <span style="flex-shrink:0;width:40px;height:40px;border-radius:11px;background:${bg};color:${fg};display:grid;place-items:center">${ic(icon,'w-5 h-5')}</span>
      <span style="min-width:0;flex:1"><span style="display:block;font-size:22px;font-weight:800;line-height:1;color:var(--c-text)" class="fd">${n}</span><span style="display:block;font-size:12px;color:var(--c-text-2);margin-top:3px">${label}</span></span>
      ${ic('chevR','w-4 h-4')}
    </button>`;
  };
  const tiles=[
    pendN?attTile('To do today',pendN,'mychecklists','brand','check'):'',
    canApprove?attTile('To approve',apprN,'approvals','amber','approve'):'',
    attTile('Unread alerts',notifN,'notifications','info','bell'),
    attTile('New tickets for me',tkN,'tickets','rose','ticket'),
  ].filter(Boolean).join('');

  // ── today's checklist summary card ──
  const clCard=`<button onclick="App.go('mychecklists')" class="ui-card" style="width:100%;text-align:left;cursor:pointer;padding:18px;display:flex;align-items:center;gap:14px">
    <span style="flex-shrink:0;width:46px;height:46px;border-radius:13px;background:var(--c-surface-2);color:var(--c-text-2);display:grid;place-items:center">${ic('check','w-6 h-6')}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:15px;font-weight:800;color:var(--c-text)" class="fd">Today's checklists</div>
      <div style="font-size:13px;color:var(--c-text-2);margin-top:3px">${dayCls.length?`${doneN}/${dayCls.length} done${pendN?` · ${pendN} to do`:''}${lateN?` · <span style="color:var(--c-danger-ink);font-weight:700">${lateN} past deadline</span>`:''}`:'Nothing assigned today'}</div>
    </div>
    ${dayCls.length?`<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div style="font-size:20px;font-weight:800;color:${pendN===0?'var(--c-success-ink)':'var(--c-text)'}" class="fd">${dayCls.length?Math.round(doneN/dayCls.length*100):0}%</div>${ic('chevR','w-4 h-4')}</div>`:ic('chevR','w-4 h-4')}
  </button>`;

  // ── my tickets card: the next thing on my plate, or a shortcut to raise one ──
  let tkCard;
  if(myOpenTk.length){
    const t=myOpenTk.slice().sort((a,b)=>{const P={Critical:0,High:1,Medium:2,Low:3};return (P[a.priority]??9)-(P[b.priority]??9)||String(a.createdAt||'').localeCompare(String(b.createdAt||''));})[0];
    tkCard=`<button onclick="App.go('tickets')" class="ui-card" style="width:100%;text-align:left;cursor:pointer;padding:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">
        <div style="font-size:14px;font-weight:800;color:var(--c-text)" class="fd">My tickets</div>
        <span style="font-size:12px;font-weight:700;color:var(--c-brand-ink)">${myOpenTk.length} open ${ic('chevR','w-3 h-3')}</span>
      </div>
      <div style="font-size:13px;font-weight:650;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title||'Ticket')}</div>
      <div style="font-size:12px;color:var(--c-text-2);margin-top:3px">${esc(t.priority||'Medium')} priority · ${esc(t.status||'Open')}${t.createdAt?' · raised '+fmtD(String(t.createdAt).slice(0,10)):''}</div>
    </button>`;
  } else {
    tkCard=`<button onclick="App.newTicket&&App.newTicket()" class="ui-card" style="width:100%;text-align:left;cursor:pointer;padding:18px;display:flex;align-items:center;gap:14px">
      <span style="flex-shrink:0;width:46px;height:46px;border-radius:13px;background:var(--c-surface-2);color:var(--c-text-2);display:grid;place-items:center">${ic('ticket','w-6 h-6')}</span>
      <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:var(--c-text)" class="fd">My tickets</div><div style="font-size:13px;color:var(--c-text-2);margin-top:3px">Nothing open · tap to raise one</div></div>
      ${ic('plus','w-5 h-5')}
    </button>`;
  }

  // ── quick actions ──
  const qa=(label,onclick,icon)=>`<button onclick="${onclick}" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 8px;border-radius:var(--r-lg);border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;min-height:88px">
    <span style="width:38px;height:38px;border-radius:11px;background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center">${ic(icon,'w-5 h-5')}</span>
    <span style="font-size:12px;font-weight:700;color:var(--c-text);text-align:center;line-height:1.2">${esc(label)}</span></button>`;
  const quickActions=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px">
    ${qa('My checklists',"App.go('mychecklists')",'check')}
    ${qa('New ticket','App.newTicket&&App.newTicket()',"ticket")}
    ${can('checklists','create')?qa('Build checklist',"App.go('checklists')",'list'):''}
    ${can('teamview','view')?qa('Team status',"App.go('teamview')",'users'):''}
    ${can('questions','view')?qa('Questions',"App.go('questions')",'help'):''}
    ${qa('My profile',"App.go('profile')",'user')}
  </div>`;

  // ── TODAY'S CHECKLISTS: where each one actually stands, question by question ──
  const myToday=dayCls.map(c=>{
    const prog=_ansProgress(c,today);
    const s2=runSub(c.id,today);
    const submitted=!!s2&&s2.status!=='Editing';
    return{c,prog,submitted,overdue:!submitted&&_clOverdue(c,today),pct:prog.total?Math.round(prog.done/prog.total*100):(submitted?100:0)};
  });
  const myWorkCard=dayCls.length?`<div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Where each one stands</div>
  <div class="ui-card" style="padding:6px 0;margin-bottom:16px">
    ${myToday.map(r=>{
      const tone=r.submitted?['#F0FDF4','#15803D','Submitted']:r.overdue?['#FEF2F2','#DC2626','Overdue']:r.prog.done?['#EFF6FF','#1D4ED8','In progress']:['#F9FAFB','#6B7280','Not started'];
      return `<button onclick="App.go('mychecklists')" style="width:100%;display:flex;align-items:center;gap:12px;padding:11px 16px;background:transparent;border:none;border-bottom:1px solid var(--c-border);cursor:pointer;text-align:left">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.c.name)}</div>
          <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">${r.prog.done}/${r.prog.total} answers in${_clDeadlineLabel(r.c)?' · due '+esc(_clDeadlineLabel(r.c)):''}</div>
        </div>
        <div style="width:64px;height:6px;border-radius:3px;background:#ECEDF0;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${r.pct}%;background:${r.pct>=100?'#0E9F6E':r.pct>0?'#0EA5E9':'#E5E7EB'}"></div></div>
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${tone[0]};color:${tone[1]};flex-shrink:0">${tone[2]}</span>
      </button>`;}).join('')}
  </div>`:'';

  return `<div class="fade">
    <div style="position:relative;overflow:hidden;border-radius:20px;border:1px solid var(--c-border);background:linear-gradient(118deg,#F0FAF5 0%,var(--c-surface) 58%);box-shadow:var(--sh-sm);padding:22px 24px;margin-bottom:16px">
      <div style="position:absolute;right:-70px;top:-80px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(14,159,110,.12),transparent 68%);pointer-events:none"></div>
      <div style="position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div style="min-width:0">
          <h1 class="fd" style="font-size:var(--fs-h1);font-weight:800;letter-spacing:-.6px;color:var(--c-text)">${greet}, ${esc(u.firstName||fullName(u))}</h1>
          <p style="font-size:13.5px;color:var(--c-text-2);margin-top:4px">${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}${dayCls.length?' · '+dayCls.length+' checklist'+(dayCls.length===1?'':'s')+' today':' · nothing scheduled today'}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button onclick="App._howModal()" title="How this tab works" aria-label="How this tab works" class="help-q" style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--c-border);background:var(--c-surface);color:var(--c-text-2);font-size:13px;font-weight:800;cursor:pointer">?</button></div>
      </div>
    </div>
    ${(isMgr()||can('teamview','view'))?_clOverviewWidget(today):''}
    ${tiles?`<div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Needs you</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">${tiles}</div>`:''}
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Today</div>
    <div class="grid md:grid-cols-2 gap-4 items-start" style="margin-bottom:16px">${clCard}${tkCard}</div>
    ${myWorkCard}
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Quick actions</div>
    ${quickActions}
  </div>`;
}

function myClsPage(){
  const today=todayISO();
  const ref=new Date(today+'T00:00:00');
  const dow=ref.getDay();
  ref.setDate(ref.getDate()+(dow===0?-6:1-dow)+S.calWk*7);
  const week=Array.from({length:7},(_,i)=>{const d=new Date(ref);d.setDate(d.getDate()+i);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');});
  // Ensure calDate is within the displayed week; if not, snap to today's weekday in the displayed week
  if(!week.includes(S.calDate)){S.calDate=week.find(d=>d===today)||week[0];}
  const sel=S.calDate;
  const dayCls=myCls(S.uid,sel);
  const doneN=dayCls.filter(c=>subForCl(c,S.uid,sel)).length;
  const lateN=sel>today?0:dayCls.filter(c=>!subForCl(c,S.uid,sel)&&(sel<today||(sel===today&&c.scheduleTime&&nowHM()>hm2m(c.scheduleTime)))).length;
  const pendN=dayCls.filter(c=>!subForCl(c,S.uid,sel)).length-lateN;

  return`<div class="fade">
  <!-- Title row -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
    <div>
      <h1 class="fd" style="font-size:var(--fs-h1);font-weight:800;color:var(--c-text);letter-spacing:-.5px">My Checklists</h1>
      <p style="font-size:13px;color:var(--c-text-2);margin-top:2px">${new Date(sel+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</p>
    </div>
    <div style="display:flex;gap:4px;align-items:center;margin-top:2px">
      <button onclick="App._howModal()" title="How this entire tab works" class="help-q" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;display:grid;place-items:center;color:var(--c-text-2);font-weight:800">?</button>
      <button type="button" aria-label="Previous week" onclick="(()=>{S.calWk--;const ref2=new Date(todayISO()+'T00:00:00');const dow2=ref2.getDay();ref2.setDate(ref2.getDate()+(dow2===0?-6:1-dow2)+S.calWk*7);const oldDow=new Date(S.calDate+'T00:00:00').getDay()||7;const nd=new Date(ref2);nd.setDate(nd.getDate()+oldDow-1);S.calDate=nd.getFullYear()+'-'+String(nd.getMonth()+1).padStart(2,'0')+'-'+String(nd.getDate()).padStart(2,'0');S.expandedCl=null;rr();App._lazyLoadDate('mychecklists')})()" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;display:grid;place-items:center;color:var(--c-text-2)">${ic('back','w-4 h-4')}</button>
      <button type="button" onclick="S.calWk=0;S.calDate='${today}';S.expandedCl=null;rr();App._lazyLoadDate('mychecklists')" style="padding:0 12px;height:32px;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer;background:${S.calWk===0&&sel===today?'var(--c-ink)':'var(--c-surface-2)'};color:${S.calWk===0&&sel===today?'#fff':'var(--c-text-2)'}">Today</button>
      <button type="button" aria-label="Next week" onclick="(()=>{S.calWk++;const ref2=new Date(todayISO()+'T00:00:00');const dow2=ref2.getDay();ref2.setDate(ref2.getDate()+(dow2===0?-6:1-dow2)+S.calWk*7);const oldDow=new Date(S.calDate+'T00:00:00').getDay()||7;const nd=new Date(ref2);nd.setDate(nd.getDate()+oldDow-1);S.calDate=nd.getFullYear()+'-'+String(nd.getMonth()+1).padStart(2,'0')+'-'+String(nd.getDate()).padStart(2,'0');S.expandedCl=null;rr();App._lazyLoadDate('mychecklists')})()" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;display:grid;place-items:center;color:var(--c-text-2)">${ic('chevR','w-4 h-4')}</button>
    </div>
  </div>

  <!-- Calendar strip -->
  <div class="cal-strip" style="margin-bottom:12px">
    ${week.map(d=>{
      const dn=DAYS3[new Date(d+'T00:00:00').getDay()];
      const num=new Date(d+'T00:00:00').getDate();
      const isT=d===today;const isSel=d===sel;
      const dCls=myCls(S.uid,d);
      const hasDone=dCls.some(c=>subForCl(c,S.uid,d));
      const hasPend=dCls.some(c=>!subForCl(c,S.uid,d));
      const hasLate=hasPend&&d<today;
      return`<button class="csd ${isSel?'act':''}" onclick="S.calDate='${d}';S.expandedCl=null;rr();App._lazyLoadDate('mychecklists')">
        <span class="csd-lbl">${dn.slice(0,3)}</span>
        <span class="csd-n ${isT&&!isSel?'now':''}">${num}</span>
        <div class="csd-dots">
          ${hasDone?`<span style="width:4px;height:4px;border-radius:50%;background:${isSel?'rgba(255,255,255,.7)':'#22C55E'}"></span>`:''}
          ${hasLate?`<span style="width:4px;height:4px;border-radius:50%;background:${isSel?'rgba(255,160,160)':'#EF4444'}"></span>`:hasPend?`<span style="width:4px;height:4px;border-radius:50%;background:${isSel?'rgba(255,210,80)':'#F59E0B'}"></span>`:''}
        </div>
      </button>`;
    }).join('')}
  </div>

  <!-- Pills -->
  ${dayCls.length?`<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
    ${doneN?`<span style="padding:4px 12px;border-radius:20px;background:var(--c-success-soft);color:var(--c-success-ink);font-size:12px;font-weight:700">${doneN} submitted</span>`:''}
    ${pendN>0?`<span style="padding:4px 12px;border-radius:20px;background:var(--c-warn-soft);color:var(--c-warn-ink);font-size:12px;font-weight:700">${pendN} pending</span>`:''}
    ${lateN>0?`<span style="padding:4px 12px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink);font-size:12px;font-weight:700">${lateN} late</span>`:''}
  </div>`:''}

  <!-- Cards -->
  <div style="display:flex;flex-direction:column;gap:8px">
    ${dayCls.length
      ?dayCls.map(c=>_clCard(c,sel)).join('')
      :`<div class="ui-card" style="padding:46px 20px;text-align:center">
          <div style="width:58px;height:58px;border-radius:var(--r-lg);background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center;margin:0 auto 14px">${ic('check','w-7 h-7')}</div>
          <div class="fd" style="font-size:16.5px;font-weight:800;color:var(--c-text)">${sel>today?'Nothing scheduled':'All clear'}</div>
          <p style="font-size:13px;color:var(--c-text-3);margin-top:5px;max-width:340px;margin-left:auto;margin-right:auto;line-height:1.55">${sel>today?'No checklists for this date':isAdmin()&&DB.checklists.length?'You are not assigned to any checklist. Go to Checklists → edit → assign yourself.':'No checklists scheduled'}</p>
          ${isAdmin()&&DB.checklists.length?`<div style="margin-top:16px;display:flex;justify-content:center">${btnP('Go to Checklists',"App.go('checklists')")}</div>`:''}
        </div>`}
  </div></div>`;
}


function _clFooter(c,date,sub,isPast,isFuture,u){
  const cid=c.id;
  const prog=_ansProgress(c,date);
  // Already closed: the run is shared, so whoever pressed Submit closed it for everyone.
  if(sub&&sub.status!=='Editing'){
    const by=uById(sub.userId);
    const st=sub.submittedAt?new Date(sub.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    const left='<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#0D7A4E;font-weight:600">'+ic('check','w-3.5 h-3.5')+'Submitted by '+esc(by?fullName(by):'a teammate')+(st?' · '+st:'')+'</span>';
    const right=(sub.status==='Pending Approval'||sub.status==='Pending')
      ?'<span style="font-size:12px;font-weight:600;color:#F97316">Awaiting approval</span>'
      :'';
    return left+right;
  }
  if(isPast&&!u?.rules?.past)return '<span style="font-size:12px;color:#B36A00;font-weight:600">No permission for past dates</span><span></span>';
  if(isFuture&&!u?.rules?.future)return '<span style="font-size:12px;color:#9CA3AF">Scheduled for this date</span><button class="submit-pill no" disabled style="opacity:.4;cursor:not-allowed">Not yet</button>';

  /* The checklist can only be submitted once EVERY question has a submitted answer — that is
     the whole point of answering them one at a time. Until then the button says what is left. */
  if(prog.total&&!prog.complete){
    const left=prog.total-prog.done;
    return '<span style="font-size:12px;color:#B8B5AC">'+prog.done+' of '+prog.total+' answers submitted</span>'
      +'<button class="submit-pill no" disabled title="Submit every question first" style="opacity:.45;cursor:not-allowed">'+left+' question'+(left===1?'':'s')+' left</button>';
  }
  return '<span style="font-size:12px;color:#0D7A4E;font-weight:600">All answers in — ready to submit</span>'
    +'<button onclick="App._submitRun(\''+cid+'\',\''+date+'\')" class="submit-pill go" data-cl="'+cid+'">✓ Submit checklist</button>';
}
/* PHASE4b: save the in-progress run as a server-backed draft (one per checklist+date, own rows only).
   Photos are stripped; everything else (answers, numbers, options) resumes on any device. */
App._saveClDraft=(clId,date)=>{
  const run=RUN[clId];
  if(!run||run.date!==date){toast('Nothing to save yet','warn');return;}
  const answered=(run.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length;
  if(!answered){toast('Answer at least one question before saving a draft','warn');return;}
  _draftSave('checklist',clId,date,{questionResponses:run.questionResponses||[]});
  toast('Draft saved \u2014 it will be here on any of your devices');rr();
};
// ── Multi-photo helpers ──
// A question response may carry photos in r.photos[] (new) and/or r.photo (legacy single).
// This returns a de-duped list of *displayable* photos (drops '[photo]' placeholders).
function _qrPhotoList(qr){
  if(!qr)return[];
  const raw=[];
  if(Array.isArray(qr.photos))raw.push(...qr.photos);
  if(qr.photo)raw.push(qr.photo);
  const seen=new Set();const out=[];
  for(const p of raw){if(!p||p==='[photo]'||typeof p!=='string')continue;if(seen.has(p))continue;seen.add(p);out.push(p);}
  return out;
}
// True if the response has at least one real photo attached.
function _qrHasPhoto(qr){return _qrPhotoList(qr).length>0;}
function _clCard(c,date){
  date=effDate(c,date); // a case is the same run whichever day you view it from
  const sub=subForCl(c,S.uid,date);
  const today=todayISO();
  const isPast=!isCase(c)&&date<today;const isFuture=!isCase(c)&&date>today;const u=me();
  const prog=_ansProgress(c,date);
  const st=sub?sub.status:isFuture?'Upcoming':_clOverdue(c,date)?'Late':prog.done?'In progress':'Pending';
  const exp=S.expandedCl===c.id;
  const isSubmitted=!!sub&&sub.status!=='Editing';
  /* RUN holds only the UNSUBMITTED working values — anything already submitted lives in
     tm_answers, shared with everyone else on this checklist. */
  if(!RUN[c.id]||RUN[c.id].date!==date){
    RUN[c.id]={checklistId:c.id,userId:S.uid,date,tasks:[],questionResponses:[]};
    const _dr=_draftFor('checklist',c.id,date);
    if(_dr&&_dr.payload&&Array.isArray(_dr.payload.questionResponses)&&_dr.payload.questionResponses.length){
      RUN[c.id].questionResponses=JSON.parse(JSON.stringify(_dr.payload.questionResponses));
    }
  }
  const run=RUN[c.id];
  const stCls={'On Time':'st-on','Submitted':'st-sub','Pending':'st-pend','In progress':'st-pend','Late':'st-late','Pending Approval':'st-pa','Rejected':'st-late','Editing':'st-pend','Upcoming':'st-pend'};
  const stBar={'On Time':'#22C55E','Submitted':'#22C55E','Pending':'#F59E0B','In progress':'#0EA5E9','Late':'#EF4444','Pending Approval':'#F97316','Rejected':'#EF4444','Editing':'#0EA5E9','Upcoming':'#A855F7'};
  const contribs=_ansContributors(c.id,date);
  const dl=_clDeadlineLabel(c);

  return`<div class="clc" style="border-top:3px solid ${stBar[st]||'#EEECE8'}">
    <!-- Header -->
    <button class="clc-hdr" onclick="S.expandedCl=S.expandedCl==='${c.id}'?null:'${c.id}';rr()">
      <div style="flex:1;text-align:left;min-width:0">
        <div class="fd" style="font-size:15px;font-weight:800;color:#111110">${esc(c.name)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap">
          ${isCase(c)?`<span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;background:#EEF2FF;color:#4338CA;letter-spacing:.03em" title="A one-time client case — open until every question is answered and it is submitted">CASE</span>`:''}
          ${isCase(c)&&!isSubmitted?`<span style="font-size:11px;color:#B8B5AC">open since ${fmtS(caseDate(c))}</span>`:''}
          ${c.department?`<span style="font-size:12px;color:#B8B5AC">${esc(c.department)}</span>`:''}
          ${dl?`<span title="Deadline" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:${_clOverdue(c,date)&&!isSubmitted?'#DC2626':'#B8B5AC'};flex-shrink:0">${ic('clock','w-3 h-3')}${esc(dl)}</span>`:''}
          ${prog.total?(isSubmitted?_subBadges(c,sub,{small:true})
            :`<span style="font-size:11px;font-weight:700;color:${prog.complete?'#0E9F6E':'#9CA3AF'};flex-shrink:0">${prog.done}/${prog.total} submitted</span>`):''}
          ${contribs.length?`<span style="display:inline-flex;align-items:center;margin-left:2px" title="${esc(contribs.map(fullName).join(', '))}">${contribs.slice(0,4).map(x=>`<span style="margin-right:-6px">${avatar(x,'w-5 h-5','text-[8px]')}</span>`).join('')}${contribs.length>4?`<span style="margin-left:10px;font-size:10px;color:#B8B5AC">+${contribs.length-4}</span>`:''}</span>`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:11px;font-weight:700;padding:4px 11px;border-radius:20px;${stCls[st]?'':'background:#F5F4F0;color:#9CA3AF'}" class="${stCls[st]||''}">${st}</span>
        <span style="color:#C8C5BD;transform:rotate(${exp?90:0}deg);transition:transform .2s">${ic('chevR','w-4 h-4')}</span>
      </div>
    </button>

    <!-- Questions + Footer -->
    ${exp?`<div>
      ${(()=>{
        const qs=_clQuestions(c);
        if(!qs.length)return'';
        return'<div style="padding:12px 16px;border-top:1px solid #F5F4F0;display:flex;flex-direction:column;gap:10px">'
          +qs.map(q=>_qCard(c,q,date,isSubmitted)).join('')+'</div>';
      })()}
      <div class="clc-ft">${_clFooter(c,date,sub,isPast,isFuture,u,false,false)}</div>
      ${sub?DB.feedback.filter(fb=>fb.checklistId===c.id&&fb.userId===S.uid&&fb.date===date).map(fb=>{
        const mgr=uById(fb.managerId);
        return`<div style="background:#EFF6FF;border-top:1px solid #BFDBFE;padding:12px 18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;font-weight:700;color:#1D4ED8">${ic('msg','w-3.5 h-3.5 inline')} From ${mgr?esc(fullName(mgr)):'Manager'}</span>
            ${!fb.acknowledged?`<button onclick="App._ackFb('${fb.id}')" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;background:#1D4ED8;color:#fff;border:none;cursor:pointer">Acknowledge</button>`:`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#1D4ED8">${ic('check','w-3 h-3')}Acknowledged</span>`}
          </div>
          <p style="font-size:13px;color:#1E3A8A;margin:0;line-height:1.5">${esc(fb.text)}</p>
        </div>`;}).join(''):''}
    </div>`:''}
  </div>`;
}

/* ── ONE question inside a run ──
   Three states: unanswered (inputs + Submit), submitted (locked, with who and when), or
   unlocked by an approved edit (inputs again, pre-filled, + Submit). */
function _qCard(c,q,date,runSubmitted){
  const TYPE_LABELS={answer:'Answer',number:'Number',passfail:'Pass/Fail',yesno:'Yes/No',tick:'Tick/Cross'};
  const ans=_ansFor(c.id,date,q.id);
  const locked=!!(ans&&ans.locked);
  const run=RUN[c.id]||{questionResponses:[]};
  // While unlocked for an edit, the inputs start from the submitted values.
  if(ans&&!ans.locked&&!(run.questionResponses||[]).some(r=>r.questionId===q.id)){
    (run.questionResponses=run.questionResponses||[]).push({questionId:q.id,response:ans.response,comment:ans.comment||'',photos:(ans.photos||[]).slice()});
  }
  const qr=(run.questionResponses||[]).find(r=>r.questionId===q.id)||{};
  const resp=locked?(ans.response??null):(qr.response??null);
  const hdr=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:5px;background:${Q_TYPE_BG[q.type]||'#F6F7F8'};color:${Q_TYPE_CLR[q.type]||'#6B7280'}">${TYPE_LABELS[q.type]||q.type}</span>
      <span style="font-size:13px;font-weight:600;color:#15171C">${esc(q.text)}</span>
      ${(()=>{const _fl=(n,t)=>'<span style="display:inline-flex;align-items:center;gap:3px;vertical-align:middle">'+ic(n,'w-3 h-3')+t+'</span>';
        const f=[];if(q.photo)f.push(_fl('cam','Photo'));if(q.comment)f.push(_fl('msg','Comment'));
        return f.length?`<span style="margin-left:auto;font-size:11px;color:#9CA3AF">${f.join(' · ')}</span>`:'';})()}
    </div>`;

  // ── submitted & locked ──
  if(locked){
    const by=uById(ans.submittedBy);
    const pend=_ansEditPending(ans.id);
    const mine=ans.submittedBy===S.uid;
    const canApprove=can('checklists','approve')||isAdmin();
    const photos=_qrPhotoList(ans);
    return`<div style="background:#F7FBF9;border:1px solid #CFEBDF;border-radius:12px;padding:12px 14px">
      ${hdr}
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:800;color:#0B7A55">${ic('check','w-4 h-4')}${esc(String(resp??'—'))}</span>
      </div>
      ${ans.comment?`<div style="margin-top:6px;font-size:12px;color:#6B7280;font-style:italic;padding:5px 8px;background:#fff;border-radius:7px">"${esc(ans.comment)}"</div>`:''}
      ${photos.length?`<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${photos.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Answer photo" onclick="App._bigImg(\''+ph.replace(/'/g,"\\'")+'\')" style="max-width:110px;max-height:80px;border-radius:8px;object-fit:cover;border:1px solid #E5E7EB;cursor:pointer"/>').join('')}</div>`:''}
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px;padding-top:8px;border-top:1px dashed #D7E9E0">
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#5B7F6E">
          ${by?avatar(by,'w-5 h-5','text-[8px]'):''}
          <span><strong style="color:#15171C">${esc(by?fullName(by):'Unknown')}</strong> · ${ans.submittedAt?new Date(ans.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</span>
        </span>
        ${ans.editCount?`<span title="Changed ${ans.editCount} time(s) after the first submission" style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;background:#FEF3C7;color:#92400E">edited ${ans.editCount}×</span>`:''}
        <span style="margin-left:auto;display:inline-flex;gap:6px">
          ${pend?`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;background:#FFFBEB;color:#92400E">${ic('clock','w-3 h-3')}Edit requested</span>`
            :mine?`<button onclick="App._ansEditAsk('${c.id}','${date}','${q.id}')" style="font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;color:#374151;cursor:pointer">${ic('edit','w-3 h-3')} Request edit</button>`:''}
          ${(canApprove&&!pend)?`<button onclick="App._ansUnlock('${c.id}','${date}','${q.id}')" title="Unlock this answer so it can be changed" style="font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;color:#374151;cursor:pointer">Unlock</button>`:''}
        </span>
      </div>
    </div>`;
  }

  // ── open for answering ──
  const unlocked=!!(ans&&!ans.locked);
  let inputHtml='';
  if(q.type==='answer'){
    inputHtml='<div style="display:flex;flex-wrap:wrap;gap:6px">'+(q.options||[]).map((o,oi)=>`<button onclick="App._setQROpt('${c.id}','${q.id}',${oi})" style="padding:6px 14px;border-radius:20px;border:1.5px solid ${resp===o.text?'#15171C':'#E5E7EB'};background:${resp===o.text?'#15171C':'#fff'};color:${resp===o.text?'#fff':'#374151'};font-size:12px;font-weight:600;cursor:pointer">${esc(o.text)}</button>`).join('')+'</div>';
  } else if(q.type==='number'){
    inputHtml=`<input type="number" value="${resp??''}" oninput="App._setQR('${c.id}','${q.id}',this.value,true)" onchange="App._setQR('${c.id}','${q.id}',this.value)" placeholder="Enter number…" style="width:120px;padding:6px 12px;border-radius:9px;border:1.5px solid #E5E7EB;font-size:13px;outline:none"/>`;
  } else if(q.type==='passfail'){
    inputHtml=`<div style="display:flex;gap:8px"><button onclick="App._setQR('${c.id}','${q.id}','Pass')" style="flex:1;min-height:44px;padding:6px 18px;border-radius:9px;border:1.5px solid ${resp==='Pass'?'#16A34A':'#E5E7EB'};background:${resp==='Pass'?'#DCFCE7':'#fff'};color:${resp==='Pass'?'#16A34A':'#374151'};font-weight:700;font-size:13px;cursor:pointer">Pass</button><button onclick="App._setQR('${c.id}','${q.id}','Fail')" style="flex:1;min-height:44px;padding:6px 18px;border-radius:9px;border:1.5px solid ${resp==='Fail'?'#DC2626':'#E5E7EB'};background:${resp==='Fail'?'#FEE2E2':'#fff'};color:${resp==='Fail'?'#DC2626':'#374151'};font-weight:700;font-size:13px;cursor:pointer">Fail</button></div>`;
  } else if(q.type==='yesno'){
    inputHtml=`<div style="display:flex;gap:8px"><button onclick="App._setQR('${c.id}','${q.id}','Yes')" style="flex:1;min-height:44px;padding:6px 18px;border-radius:9px;border:1.5px solid ${resp==='Yes'?'#16A34A':'#E5E7EB'};background:${resp==='Yes'?'#DCFCE7':'#fff'};color:${resp==='Yes'?'#16A34A':'#374151'};font-weight:700;font-size:13px;cursor:pointer">Yes</button><button onclick="App._setQR('${c.id}','${q.id}','No')" style="flex:1;min-height:44px;padding:6px 18px;border-radius:9px;border:1.5px solid ${resp==='No'?'#DC2626':'#E5E7EB'};background:${resp==='No'?'#FEE2E2':'#fff'};color:${resp==='No'?'#DC2626':'#374151'};font-weight:700;font-size:13px;cursor:pointer">No</button></div>`;
  } else if(q.type==='tick'){
    inputHtml=`<div style="display:flex;gap:8px"><button onclick="App._setQR('${c.id}','${q.id}','Done')" style="flex:1;min-height:44px;padding:6px 20px;border-radius:9px;border:1.5px solid ${resp==='Done'?'#16A34A':'#E5E7EB'};background:${resp==='Done'?'#DCFCE7':'#fff'};color:${resp==='Done'?'#16A34A':'#374151'};font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center">${ic('check','w-5 h-5')}</button><button onclick="App._setQR('${c.id}','${q.id}','Not done')" style="flex:1;min-height:44px;padding:6px 20px;border-radius:9px;border:1.5px solid ${resp==='Not done'?'#DC2626':'#E5E7EB'};background:${resp==='Not done'?'#FEE2E2':'#fff'};color:${resp==='Not done'?'#DC2626':'#374151'};font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center">${ic('x','w-5 h-5')}</button></div>`;
  }
  // Photos — always offered; q.photo only makes one mandatory at submit.
  const photos=_qrPhotoList(qr);
  inputHtml+='<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    +photos.map((ph,pi)=>'<div style="position:relative;display:inline-block"><img src="'+esc(ph)+'" alt="Answer photo" onclick="App._bigImg(\''+ph.replace(/'/g,"\\'")+'\')" style="max-width:100px;max-height:72px;border-radius:8px;object-fit:cover;border:1.5px solid #BBF7D0;cursor:pointer"/><button onclick="App._clearQRPhoto(\''+c.id+'\',\''+q.id+'\','+pi+')" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#EF4444;border:1.5px solid #fff;color:#fff;font-size:11px;cursor:pointer;display:grid;place-items:center;font-weight:700">×</button></div>').join('')
    +'<label style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;background:'+(photos.length?'#F0FDF4':'#F3F4F6')+';color:'+(photos.length?'#16A34A':'#374151')+';font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid '+(photos.length?'#BBF7D0':'#E5E7EB')+'">'
    +ic('cam','w-3.5 h-3.5')+(photos.length?'Add more':'Add photo')+(q.photo&&!photos.length?' <span style="color:#EF4444">*</span>':'')
    +'<input type="file" accept="image/*" capture="environment" multiple style="display:none" onchange="App._setQRPhoto(\''+c.id+'\',\''+q.id+'\',this)"/>'
    +'</label></div>';

  const ready=resp!==null&&resp!==undefined&&resp!=='';
  return`<div style="background:#FAFAFA;border:1px solid ${unlocked?'#BFDBFE':'#ECEDF0'};border-radius:12px;padding:12px 14px">
    ${hdr}
    ${unlocked?`<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#1D4ED8;background:#EFF6FF;border-radius:8px;padding:5px 9px;margin-bottom:9px">${ic('edit','w-3 h-3')}Unlocked for editing — submit again when you're done</div>`:''}
    ${inputHtml}
    <textarea oninput="App._setQRComment('${c.id}','${q.id}',this.value)" placeholder="${q.comment?'Comment (required)…':'Add a comment (optional)…'}" style="width:100%;box-sizing:border-box;margin-top:8px;padding:8px 10px;border:1.5px solid ${q.comment?'#FCA5A5':'#E5E7EB'};border-radius:9px;font-size:12px;resize:none;outline:none;font-family:inherit;background:#fff" rows="2">${esc(qr.comment||'')}</textarea>
    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:9px">
      <span style="font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.05em">Status</span>
      ${(()=>{const st=_qStatusOf(c.id,date,q.id);const cur=st&&st.status;
        const chips=[['in_progress','In progress','#1D4ED8','#EFF6FF','#BFDBFE'],['waiting_client','Waiting on client','#92400E','#FFFBEB','#FDE68A'],['waiting_authority','Waiting on authority','#5B21B6','#F5F3FF','#DDD6FE']];
        return chips.map(([k,l,fg,bg,bd])=>`<button type="button" onclick="App._setQStatus('${c.id}','${date}','${q.id}','${k}')" title="${cur===k?'Tap again to clear':'Mark: '+l}" style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;cursor:pointer;border:1.5px solid ${cur===k?fg:'#E5E7EB'};background:${cur===k?bg:'#fff'};color:${cur===k?fg:'#9CA3AF'}">${l}</button>`).join('')
          +(cur&&cur!=='in_progress'?`<span style="font-size:10.5px;color:#92400E;font-weight:700">${_qsDays(_qStatusOf(c.id,date,q.id))}d</span>`:'');})()}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:9px">
      <button ${ready?'':'disabled'} onclick="App._ansSubmit('${c.id}','${date}','${q.id}')" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:9px;border:none;cursor:${ready?'pointer':'not-allowed'};background:${ready?'#0E9F6E':'#E5E7EB'};color:${ready?'#fff':'#9CA3AF'}">${ic('check','w-3.5 h-3.5')}${unlocked?'Submit change':'Submit answer'}</button>
    </div>
  </div>`;
}

App._setQROpt=(clId,qId,optIdx)=>{
  // Resolve the option text by index so the free-form (admin-authored) option
  // text never has to be interpolated into an inline onclick handler (XSS-safe).
  const _q=(DB.questions||[]).find(x=>x.id===qId);
  const _o=_q&&(_q.options||[])[optIdx];
  if(!_o)return;
  App._setQR(clId,qId,_o.text);
};
App._setQR=(clId,qId,val,skipRr)=>{
  if(!RUN[clId])return;
  if(!RUN[clId].questionResponses)RUN[clId].questionResponses=[];
  const existing=RUN[clId].questionResponses.find(r=>r.questionId===qId);
  if(existing){
    // If the answer is changing to a DIFFERENT value, clear any photo/comment that
    // belonged to the previous answer — otherwise a stale photo from the old answer
    // could wrongly satisfy a "photo required" check for the new answer (Fix #1).
    // Only do this for discrete-choice questions (tapping a different option = a real
    // answer switch). Number inputs fire per-keystroke, so we must NOT wipe their photo.
    const _q=(DB.questions||[]).find(x=>x.id===qId);
    const _discrete=_q&&_q.type!=='number';
    // Tapping the already-selected option clears it — you can change your mind before submitting.
    if(_discrete&&String(existing.response??'')===String(val??'')&&val!==null&&val!==''){
      existing.response=null;
      if(!skipRr)rr();
      clearTimeout(App._saveT);App._saveT=setTimeout(()=>saveDB(),2000);
      return;
    }
    const _changed=String(existing.response??'')!==String(val??'');
    existing.response=val;
    if(_discrete&&_changed){existing.photo=null;existing.photos=[];existing.comment='';}
  }
  else{RUN[clId].questionResponses.push({questionId:qId,response:val,comment:''});}
  if(!skipRr)rr();
  clearTimeout(App._saveT);App._saveT=setTimeout(()=>saveDB(),2000);
};
App._clearQRPhoto=(clId,qId,idx)=>{
  if(!RUN[clId])return;
  if(!RUN[clId].questionResponses)RUN[clId].questionResponses=[];
  const existing=RUN[clId].questionResponses.find(r=>r.questionId===qId);
  if(existing){
    // Normalise into photos[] then drop the one at idx
    const list=_qrPhotoList(existing);
    if(typeof idx==='number'&&idx>=0&&idx<list.length)list.splice(idx,1);
    else list.length=0; // no index → clear all (back-compat)
    existing.photos=list;
    existing.photo=null;
  }
  clearTimeout(App._saveT);App._saveT=setTimeout(()=>saveDB(),2000);
  rr();
};
App._setQRPhoto=(clId,qId,input)=>{
  const files=[...(input?.files||[])];if(!files.length)return;
  if(!RUN[clId])return;
  if(!RUN[clId].questionResponses)RUN[clId].questionResponses=[];
  let existing=RUN[clId].questionResponses.find(r=>r.questionId===qId);
  if(!existing){existing={questionId:qId,response:null,comment:'',photos:[]};RUN[clId].questionResponses.push(existing);}
  // Fold any legacy single photo into the array before appending
  if(!Array.isArray(existing.photos))existing.photos=[];
  if(existing.photo&&existing.photo!=='[photo]'){existing.photos.push(existing.photo);existing.photo=null;}
  let pending=files.length;
  files.forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{
      existing.photos.push(e.target.result);
      if(--pending===0){
        clearTimeout(App._saveT);App._saveT=setTimeout(()=>saveDB(),2000);
        rr();
      }
    };
    reader.onerror=()=>{if(--pending===0)rr();};
    reader.readAsDataURL(file);
  });
  // Allow re-selecting the same file again later
  if(input)input.value='';
};

App._setQRComment=(clId,qId,val)=>{
  if(!RUN[clId])return;
  if(!RUN[clId].questionResponses)RUN[clId].questionResponses=[];
  const existing=RUN[clId].questionResponses.find(r=>r.questionId===qId);
  if(existing){existing.comment=val;}
  else{RUN[clId].questionResponses.push({questionId:qId,response:null,comment:val});}
  clearTimeout(App._saveT);App._saveT=setTimeout(()=>saveDB(),2000);
};
App._ackFb=(id)=>{const f=DB.feedback.find(x=>x.id===id);if(f){f.acknowledged=true;f.acknowledgedAt=new Date().toISOString();f.status=f.status==='Sent'?'Acknowledged':f.status;}saveDB();toast('Acknowledged');render();};

// ── Photo persistence (Fix #5) ──
// Uploads any base64 ("data:") question photos to Supabase Storage (reusing the existing
// "documents" bucket, which already works in production) and returns a NEW responses array
// with each uploaded photo replaced by its durable public URL. This is fail-safe: if a
// given upload fails for ANY reason, that photo falls back to '[photo]' and the submission
// still succeeds. Existing http(s) URLs and already-stripped placeholders are left as-is.
// Helper for converting a data URL to a Blob without fetch() (more reliable on mobile).
function _dataUrlToBlob(dataUrl){
  try{
    const [head,b64]=dataUrl.split(',');
    const mime=(head.match(/data:([^;]+)/)||[,'image/jpeg'])[1];
    const bin=atob(b64);const len=bin.length;const arr=new Uint8Array(len);
    for(let i=0;i<len;i++)arr[i]=bin.charCodeAt(i);
    return new Blob([arr],{type:mime});
  }catch(e){return null;}
}
App._submitRun=async(clId,date)=>{
  const c=clById(clId);if(!c)return;
  date=effDate(c,date); // cases close on their one run date
  /* The run is SHARED — one submission per checklist per day, whoever closes it. */
  const existing=runSub(clId,date);
  if(existing&&existing.status!=='Editing'){
    const by=uById(existing.userId);
    toast('Already submitted'+(by&&by.id!==S.uid?' by '+fullName(by):'')+' for this date','warn');
    delete RUN[clId];S.expandedCl=null;render();return;
  }
  // Every question must carry a submitted answer — that gate is the feature.
  const qs=_clQuestions(c);
  const prog=_ansProgress(c,date);
  if(qs.length&&!prog.complete){
    toast('Submit all '+qs.length+' answers first — '+(prog.total-prog.done)+' still open','err');return;
  }
  // Build the submission from the shared answers so the existing approvals, analytics
  // and CSV exports keep reading exactly the shape they always have.
  const responses=qs.map(q=>{
    const a2=_ansFor(clId,date,q.id)||{};
    return{questionId:q.id,response:a2.response??null,comment:a2.comment||'',photos:(a2.photos||[]).slice(),
      answeredBy:a2.submittedBy||null,answeredAt:a2.submittedAt||null};
  });

  const today=todayISO();
  const late=_clOverdue(c,date);
  const _ua=(me()?.approval)||{};
  const _isPast=!isCase(c)&&date<today,_isFut=!isCase(c)&&date>today;
  const needsAppr=(_isPast&&_ua.past)||(_isFut&&_ua.future);
  const u=me();const mgrId=u?.managerId;
  const status=needsAppr?'Pending Approval':late?'Late':'On Time';
  const rec={id:uid('s'),checklistId:clId,userId:S.uid,date,tasks:[],questionResponses:responses,
    status,submittedAt:new Date().toISOString(),editCount:0,editHistory:[]};
  DB.submissions.push(rec);
  if(needsAppr){
    DB.approvals.push({id:uid('a'),type:'Submission',requesterId:S.uid,checklistId:clId,date,status:'Pending',note:'Awaiting approval',createdAt:new Date().toISOString()});
    const apprText='🔔 Approval needed: '+fullName(u)+' submitted "'+c.name+'" — awaiting your review';
    const admin=DB.users.find(x=>isSuperU(x));
    notifyEventAll('approval_requested',[mgrId,admin&&admin.id],apprText,'approvals',{checklist_name:c.name});
  }
  log(fullName(u),'Submitted '+status,c.name);
  _draftDelete('checklist',clId,date);
  toast(needsAppr?'Submitted — pending approval':'Checklist submitted',late||needsAppr?'warn':'ok');
  _processEscalations(clId,date,responses);

  const sr={id:rec.id,checklist_id:clId,user_id:S.uid,date,status,submitted_at:rec.submittedAt,
    tasks:[],question_responses:responses,edit_count:0,edit_history:[]};
  saveDB();
  delete RUN[clId];S.expandedCl=null;_invalidateNotifCache();_touchAction();render();
  sb.from('submissions').upsert(sr,{onConflict:'id'}).then(({error})=>{
    if(error)console.warn('sub upsert:',error.message);
  }).catch(e=>console.warn('sub upsert failed:',e.message));
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.COLL=COLL;window.homeDash=homeDash;window.myClsPage=myClsPage;window._clFooter=_clFooter;window._qrPhotoList=_qrPhotoList;window._qrHasPhoto=_qrHasPhoto;window._clCard=_clCard;window._dataUrlToBlob=_dataUrlToBlob;window._qCard=_qCard;
