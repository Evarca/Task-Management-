

/* ===== QUESTIONS PAGE ===== */
window._QED=null;

// ── Questions CSV template download ──
// Export every question the user can see as a CSV in the SAME column layout as the import
// template, so the file can be edited and re-uploaded. Number questions export their first
// condition (template supports one condition per row).
App._downloadAllQuestions=(...__a)=>{if(!can('questions','export'))return toast('You need Questions → Export','err');return App.__dlAllQ(...__a);};App.__dlAllQ=()=>{
  const qs=visibleQuestions();
  if(!qs.length){toast('No questions to download','err');return;}
  const header=['text','type','option1','option2','option3','option4','option5','photo_required','comment_required','approval_required','number_condition','value','value2'];
  const rows=[header];
  qs.forEach(q=>{
    const opts=Array.isArray(q.options)?q.options:[];
    const o=['','','','',''];let cond='',val='',val2='';
    if(q.type==='answer'){for(let i=0;i<5;i++)o[i]=opts[i]?(opts[i].text||''):'';}
    else if(q.type==='number'){const c=opts[0]||{};cond=c.condition||'';val=(c.value!=null?c.value:'');val2=(c.value2!=null?c.value2:'');}
    rows.push([q.text||'',q.type||'answer',o[0],o[1],o[2],o[3],o[4],
      q.photo?'TRUE':'FALSE',q.comment?'TRUE':'FALSE',q.approval?'TRUE':'FALSE',cond,val,val2]);
  });
  _csvDownload(rows,'evarca_questions');
  toast('Downloaded '+qs.length+' question'+(qs.length!==1?'s':''));
};
App._downloadQTemplate=(...__a)=>{if(!can('questions','export'))return toast('You need Questions → Export','err');return App.__dlQT(...__a);};App.__dlQT=()=>{
  // Clean template — just header + examples (no instruction rows to delete)
  const rows=[
    // header — photo/comment/approval flags, then OPTIONAL number-condition columns
    'text,type,option1,option2,option3,option4,option5,photo_required,comment_required,approval_required,number_condition,value,value2',
    // passfail / yesno / tick — options auto-filled, leave blank
    'Is the area clean?,passfail,,,,,,FALSE,FALSE,FALSE,,,',
    'Was the handover completed?,yesno,,,,,,FALSE,FALSE,FALSE,,,',
    'Were all items checked?,tick,,,,,,FALSE,FALSE,FALSE,,,',
    // answer — fill option1..option5 with your choices
    'What is the shift status?,answer,Normal,Understaffed,Overstaffed,,,FALSE,FALSE,FALSE,,,',
    'Describe any issues found?,answer,None,Minor issue,Major issue,,,TRUE,TRUE,FALSE,,,',
    // number — optional condition (lt/lte/gt/gte/eq/neq/between) + value(s)
    'Record the fridge temperature,number,,,,,,TRUE,FALSE,FALSE,between,2,8',
  ];
  const csv=rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='evarca_questions_template.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast('Template downloaded');
};

// ── Questions CSV import ──
App._importQCSV=(input)=>{
  if(!can('questions','import')){toast('You need Questions → Import','err');input.value='';return;}
  const file=input.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const lines=e.target.result.split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length){toast('Empty file','err');return;}
    // Skip header row
    const start=lines[0].toLowerCase().startsWith('text')?1:0;
    const rows=lines.slice(start);
    if(!rows.length){toast('No data rows found','err');return;}
    let added=0,skipped=0;
    rows.forEach(line=>{
      // Parse CSV properly (handle quoted commas)
      const cols=[];let cur='',inQ=false;
      for(let i=0;i<line.length;i++){
        if(line[i]==='"'){inQ=!inQ;}
        else if(line[i]===','&&!inQ){cols.push(cur.trim());cur='';}
        else cur+=line[i];
      }
      cols.push(cur.trim());
      // N1: column order must match the downloaded template
      // (text,type,option1..5,photo_required,comment_required,approval_required).
      // condition/value/value2 are OPTIONAL trailing columns for number-type conditions.
      const [text,type,o1,o2,o3,o4,o5,photo,comment,approval,condition,cval,cval2]=cols;
      if(!text||!type){skipped++;return;}
      const qtRaw=(type||'').toLowerCase().trim();
      const qtype=['passfail','yesno','tick','number','answer'].includes(qtRaw)?qtRaw:'answer';
      // Build options
      let options=[];
      if(qtype==='passfail'){
        options=[{text:'Pass',escalate:false},{text:'Fail',escalate:false}];
      } else if(qtype==='yesno'){
        options=[{text:'Yes',escalate:false},{text:'No',escalate:false}];
      } else if(qtype==='tick'){
        options=[{text:'Done',escalate:false},{text:'Not done',escalate:false}];
      } else if(qtype==='answer'){
        options=[o1,o2,o3,o4,o5].filter(Boolean).map(t=>({text:t.trim(),escalate:false}));
        if(!options.length){skipped++;return;}
      } else if(qtype==='number'){
        // Parse condition if provided
        const validConds=['lt','lte','gt','gte','eq','neq','between'];
        const cond=(condition||'').toLowerCase().trim();
        if(cond&&validConds.includes(cond)){
          const condObj={condition:cond,value:parseFloat(cval)||0};
          if(cond==='between')condObj.value2=parseFloat(cval2)||condObj.value;
          options=[condObj];
        }
        // number questions can have 0 conditions (manual entry) so don't skip
      }
      const isTrue=s=>(s||'').toLowerCase().trim()==='true'||s==='1';
      const q={
        id:uid('q'),
        text:text.trim(),
        type:qtype,
        options,
        photo:isTrue(photo),
        comment:isTrue(comment),
        approval:isTrue(approval),
        isPublic:false,
        createdBy:S.uid,
        createdAt:new Date().toISOString()
      };
      if(!DB.questions)DB.questions=[];
      DB.questions.push(q);
      added++;
    });
    if(added){
      saveDB();
      sb.from('questions').upsert(DB.questions.filter(q=>q.createdBy===S.uid).map(q=>({id:q.id,text:q.text||'',type:q.type||'answer',options:q.options||[],photo:q.photo||false,approval:q.approval||false,comment:q.comment||false,is_public:q.isPublic!==false,created_by:q.createdBy||null,created_at:q.createdAt||new Date().toISOString()})),{onConflict:'id'}).then(()=>{}).catch(()=>{});
      rr();
      toast(added+' question'+(added===1?'':'s')+' imported'+(skipped?' ('+skipped+' skipped)':'')+'','ok');
    } else {
      toast('No valid questions found'+(skipped?' — '+skipped+' rows skipped':''),'err');
    }
    input.value=''; // Reset so same file can be uploaded again
  };
  reader.readAsText(file);
};


// ── Question visibility ──
// Public (isPublic !== false): visible to everyone with Questions access.
// Private: visible only to the creator (assigned users still see it inside their checklists).
// Admin always sees everything.
function visibleQuestions(){
  const all=DB.questions||[];
  if(isAdmin()||can('questions','edit')||can('questions','delete'))return all; // micro: editors/deleters see the whole bank
  return all.filter(q=>q.isPublic!==false||q.createdBy===S.uid);
}
// Creator (or admin) can manage a question
// perms M1: legacy = Super Admin / SubAdmin / the question's creator. For a user WITH a role profile,
// also honor a profile granting questions.manage (lets a profile widen management beyond own questions).
// Unassigned users hit only the legacy branch (_myProfile() is null), so today's behavior is unchanged.
function canManageQ(q){return isAdmin()||q.createdBy===S.uid||can('questions','edit');} // micro: edit toggle decides
function canDeleteQ(q){return isAdmin()||q.createdBy===S.uid||can('questions','delete');}


function qCard(q){
    const exp=S.filters.expandedQ===q.id;
    const clr=Q_TYPE_CLR[q.type]||'#6B7280';
    const bg=Q_TYPE_BG[q.type]||'#F6F7F8';
    const tl=(Q_TYPES.find(t=>t.id===q.type)||{label:q.type}).label;
    let h=`<div style="background:var(--c-surface);border-radius:var(--r-md);border:1px solid ${exp?'var(--c-brand)':'var(--c-border)'};box-shadow:var(--sh-sm);overflow:hidden">`;
    h+=`<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer" onclick="App._togExpandQ('${q.id}')">`;
    h+=`<span style="color:var(--c-text-3);transition:transform .2s;transform:rotate(${exp?90:0}deg)">${ic('chevR','w-4 h-4')}</span>`;
    h+=`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${bg};color:${clr}">${tl}</span>`;
    h+=`<div style="flex:1;min-width:0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.text)}</div>`;
    const isPub=q.isPublic!==false;
    const mine=canManageQ(q);
    h+=`<div style="display:flex;gap:4px;align-items:center" onclick="event.stopPropagation()">`;
    if(mine){
      h+=`<span title="Change via Edit" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1.5px solid ${isPub?'#A7F3D0':'#FDE68A'};background:${isPub?'#ECFDF5':'#FFFBEB'};font-size:11px;font-weight:700;color:${isPub?'#047857':'#B45309'}">${isPub?ic('globe','w-3 h-3')+'Public':ic('lock','w-3 h-3')+'Private'}</span>`;
      h+=btn('Edit',`App._editQuestion('${q.id}')`,{variant:'ghost',size:'sm'});
      h+=`<button type="button" onclick="App._delQuestion('${q.id}')" aria-label="Delete question" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;color:var(--c-text-3);cursor:pointer" onmouseover="this.style.color='var(--c-danger)'" onmouseout="this.style.color='var(--c-text-3)'">${ic('trash','w-4 h-4')}</button>`;
    } else {
      h+=`<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1.5px solid #E5E7EB;background:#F9FAFB;font-size:11px;font-weight:700;color:#6B7280">${ic('globe','w-3 h-3')}Public</span>`;
    }
    h+=`</div></div>`;
    if(exp){
      h+=`<div style="padding:0 14px 12px 40px;border-top:1px solid #F5F4F0">`;
      const opts=q.options||[];
      if(!opts.length){h+=`<p style="font-size:12px;color:#D1D5DB;font-style:italic;padding:8px 0">No options — click Edit</p>`;}
      else opts.forEach((o,oi)=>{

        let lbl=q.type==='number'
          ?((NUM_CONDITIONS.find(x=>x.id===o.condition)||{label:o.condition}).label+' '+o.value+(o.condition==='between'?' – '+o.value2:''))
          :(o.text||o.label||'');
        h+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F9F8F5">`;
        h+=`<span style="width:20px;height:20px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#1D4ED8">${oi+1}</span>`;
        h+=`<span style="flex:1;font-size:13px;color:#374151">${esc(lbl)}</span>`;

        h+=`</div>`;
      });
      h+=`</div>`;
    }
    h+=`</div>`;
    return h;
  }

// Board view — questions grouped by Department › Sub-department (requirement #3).
// Collapse state for the Questions board (transient UI state on S.filters).
function _qColl(){return S.filters.qCollapsed||(S.filters.qCollapsed=[]);}
function _qIsColl(key){return _qColl().includes(key);}
App._togQGroup=(key)=>{const arr=_qColl();const i=arr.indexOf(key);if(i>=0)arr.splice(i,1);else arr.push(key);App._filterQuestions(S.filters.qSearch||'');};
App._qExpandAll=()=>{S.filters.qCollapsed=[];App._filterQuestions(S.filters.qSearch||'');};
App._qCollapseAll=()=>{
  const all=[];(DB.questions||[]).forEach(q=>{const d=(q.department||'').trim()||'__none__';if(!all.includes('d:'+d))all.push('d:'+d);});
  S.filters.qCollapsed=all;App._filterQuestions(S.filters.qSearch||'');
};
function _renderQGrouped(list){
  if(!list.length)return empty('help','No questions yet','Create questions or upload a CSV template.');
  const searching=!!(S.filters.qSearch||'').trim(); // during search, force-expand so matches are visible
  const byDept={};
  list.forEach(q=>{
    const d=(q.department||'').trim()||'__none__';
    const s=(q.subDepartment||'').trim()||'__none__';
    byDept[d]=byDept[d]||{};
    (byDept[d][s]=byDept[d][s]||[]).push(q);
  });
  const order=topDepts().map(d=>d.name).filter(n=>byDept[n]);
  Object.keys(byDept).forEach(d=>{if(d!=='__none__'&&!order.includes(d))order.push(d);});
  if(byDept['__none__'])order.push('__none__');
  const chev=open=>`<span style="display:inline-flex;color:var(--c-text-3);transition:transform .2s;transform:rotate(${open?90:0}deg)">${ic('chevR','w-4 h-4')}</span>`;
  let html='';
  order.forEach(dName=>{
    const subs=byDept[dName];
    const dLabel=dName==='__none__'?'Uncategorized':dName;
    const total=Object.values(subs).reduce((a,arr)=>a+arr.length,0);
    const dKey='d:'+dName;
    const dOpen=searching||!_qIsColl(dKey);
    html+=`<div data-k="${esc(dKey)}" onclick="App._togQGroup(this.dataset.k)" style="margin-top:14px;margin-bottom:8px;display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:10px 12px">`
      +chev(dOpen)
      +`<span style="display:inline-flex;color:#0E9F6E">${ic('dept','w-4 h-4')}</span>`
      +`<span style="font-size:14px;font-weight:800;color:var(--c-text)">${esc(dLabel)}</span>`
      +`<span style="font-size:11px;font-weight:700;color:#6B7280;background:var(--c-surface);border-radius:999px;padding:1px 9px">${total}</span></div>`;
    if(!dOpen)return;
    const subOrder=subDeptsOfName(dName).map(s=>s.name).filter(n=>subs[n]);
    Object.keys(subs).forEach(s=>{if(s!=='__none__'&&!subOrder.includes(s))subOrder.push(s);});
    if(subs['__none__'])subOrder.push('__none__');
    html+='<div style="padding-left:10px;border-left:2px solid var(--c-border);margin-left:6px">';
    subOrder.forEach(sName=>{
      const qs=subs[sName];
      const sLabel=sName==='__none__'?'(no sub-department)':sName;
      const sKey='s:'+dName+'␟'+sName;
      const sOpen=searching||!_qIsColl(sKey);
      html+=`<div data-k="${esc(sKey)}" onclick="App._togQGroup(this.dataset.k)" style="margin:10px 0 6px;display:flex;align-items:center;gap:7px;cursor:pointer">`
        +chev(sOpen)
        +`<span style="width:6px;height:6px;border-radius:50%;background:#0E9F6E"></span>`
        +`<span style="font-size:12px;font-weight:700;color:var(--c-text-2)">${esc(sLabel)}</span>`
        +`<span style="font-size:10px;color:var(--c-text-3)">${qs.length} question${qs.length!==1?'s':''}</span></div>`;
      if(sOpen)html+='<div class="space-y-2" style="margin:0 0 8px 4px">'+qs.map(q=>qCard(q)).join('')+'</div>';
    });
    html+='</div>';
  });
  return html;
}
function questionsPage(){
  // Questions tab: admin sees all; others see public questions + their own private questions
  const allQ=visibleQuestions();
  // perms M1: create/import gated by can('questions','manage'). Unassigned: _baseCan('questions','manage')
  // ===(me()?.questionsAccess||isSubAdmin())===exactly who can reach this page today, so no regression;
  // a profile with view-only now correctly hides the create/import controls.
  const canMng=can('questions','create'),canImp=can('questions','import'),canExp=can('questions','export');
  return`<div class="fade">${hdr('Questions','Reusable question library for your checklists',btn('Expand all','App._qExpandAll()',{variant:'ghost',size:'sm'})+btn('Collapse all','App._qCollapseAll()',{variant:'ghost',size:'sm'})+(canMng?btnP('New question','App._editQuestion(null)','plus'):''))}
    <!-- ONE aligned action row: search + exports + CSV import — shared filter-bar shell -->
    ${filterBar(
       `<div style="position:relative;flex:1;min-width:170px"><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-text-3);pointer-events:none">${ic('search','w-4 h-4')}</span><input id="qSearchInput" type="text" placeholder="Search questions…" value="${esc(S.filters.qSearch||'')}" oninput="App._filterQuestions(this.value)" class="ui-input rf" style="padding-left:34px;min-height:0;height:34px;font-size:13px"/></div>`
      +(allQ.length?btn('Download all','App._downloadAllQuestions()',{variant:'ghost',size:'sm',icon:'download'}):'')
      +(canExp?btn('CSV template','App._downloadQTemplate()',{variant:'ghost',size:'sm',icon:'download'}):'')
      +(canImp?`<label class="ui-btn ui-btn-brand ui-btn-sm" title="Fill the CSV template, then upload to add many questions at once" style="cursor:pointer">${ic('upload','w-4 h-4')} Upload CSV<input type="file" accept=".csv" onchange="App._importQCSV(this)" style="display:none"/></label>`:'')
      +filterCount(allQ.length+' question'+(allQ.length===1?'':'s')))}
    <div id="qResults">${(()=>{
      const filtered=S.filters.qSearch?allQ.filter(q=>q.text.toLowerCase().includes((S.filters.qSearch||'').toLowerCase())):allQ;
      return _renderQGrouped(filtered);
    })()}</div>
  </div>`;
}

App._togExpandQ=(id)=>{S.filters.expandedQ=S.filters.expandedQ===id?null:id;rr();};

App._filterQuestions=(val)=>{
  S.filters.qSearch=val;
  const box=document.getElementById('qResults');
  if(!box)return;
  const allQ=visibleQuestions();
  const filtered=val?allQ.filter(q=>q.text.toLowerCase().includes(val.toLowerCase())):allQ;
  box.innerHTML=_renderQGrouped(filtered);
};

App._delQuestion=(id)=>{
  {const _q=(DB.questions||[]).find(x=>x.id===id);if(_q&&!canDeleteQ(_q))return toast('You need Questions → Delete','err');}
  const q=(DB.questions||[]).find(x=>x.id===id);if(!q)return;
  // Referential-integrity guard: a question still used by checklists can't be deleted.
  if(!guardDelete('question',id,'this question'))return;
  if(!confirm('Delete "'+q.text+'"?'))return;
  if(!DB.questions_deleted)DB.questions_deleted=[];
  if(!DB.questions_deleted.includes(id))DB.questions_deleted.push(id);
  DB.questions=(DB.questions||[]).filter(x=>x.id!==id);
  DB.checklists.forEach(c=>{c.questionIds=(c.questionIds||[]).filter(x=>x!==id);if(c.questionConfigs)delete c.questionConfigs[id];});
  toast('Deleted','warn');saveDB();render();
  // Sync to Supabase in background
  sb.from('questions').delete().eq('id',id).then(({error})=>{
    if(error)console.error('delQuestion sync:',error.message);
  }).catch(e=>console.error('delQuestion:',e));
};

// (OKR v2: the question-linked “Track as OKR” flow is retired — OKRs are managed in the OKRs tab.)
App._editQuestion=(id)=>{
  const existing=id?(DB.questions||[]).find(x=>x.id===id):null;
  _QED=existing?JSON.parse(JSON.stringify(existing)):{
    id:uid('q'),text:'',type:'answer',options:[],photo:false,approval:false,comment:false,isPublic:true,department:'',subDepartment:''
  };
  if(_QED.department===undefined)_QED.department='';
  if(_QED.subDepartment===undefined)_QED.subDepartment='';
  if(_QED.isPublic===undefined)_QED.isPublic=true;
  App._renderQModal();
};
App._renderQModal=()=>{
  if(!_QED)return;
  const q=_QED;
  const au=DB.users.filter(u=>u.status==='Active');

  let optsHtml='';
  if(q.type==='answer'){
    let rows='';
    (q.options||[]).forEach((o,i)=>{
      rows+=`<div style="display:flex;align-items:center;gap:6px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:9px;padding:7px 10px">
        <span style="font-size:11px;font-weight:700;color:#9CA3AF;width:18px;text-align:center">${String.fromCharCode(65+i)}</span>
        <input type="text" value="${o.text||''}" oninput="_QED.options[${i}].text=this.value" placeholder="Answer option…" style="flex:1;background:transparent;border:none;border-bottom:1px solid #E5E7EB;font-size:13px;outline:none;padding:2px 0"/>
        <button onclick="_QED.options.splice(${i},1);App._renderQModal()" style="width:20px;height:20px;display:grid;place-items:center;border-radius:5px;border:none;background:transparent;color:#D1D5DB;cursor:pointer">${ic('x','w-3 h-3')}</button>
      </div>`;
    });
    optsHtml=rows+btn('Add answer',"_QED.options.push({text:''});App._renderQModal()",{variant:'brand',size:'sm',icon:'plus',attrs:'style="margin-top:6px"'});
  }
  else if(q.type==='number'){
    let rows='';
    (q.options||[]).forEach((o,i)=>{
      const cSel=NUM_CONDITIONS.map(c=>`<option value="${c.id}" ${o.condition===c.id?'selected':''}>${c.label}</option>`).join('');
      rows+=`<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:9px;padding:8px 10px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <select onchange="_QED.options[${i}].condition=this.value;App._renderQModal()" style="font-size:12px;background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;outline:none">${cSel}</select>
          <input type="number" value="${o.value!=null?o.value:''}" oninput="_QED.options[${i}].value=parseFloat(this.value)" placeholder="Value" style="width:70px;background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;font-size:12px;outline:none"/>
          ${o.condition==='between'?`<span style="font-size:12px;color:#9CA3AF">and</span><input type="number" value="${o.value2!=null?o.value2:''}" oninput="_QED.options[${i}].value2=parseFloat(this.value)" placeholder="Value 2" style="width:70px;background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;font-size:12px;outline:none"/>`:''}
          <button onclick="_QED.options.splice(${i},1);App._renderQModal()" style="width:20px;height:20px;display:grid;place-items:center;border-radius:5px;border:none;background:transparent;color:#D1D5DB;cursor:pointer;margin-left:auto">${ic('x','w-3 h-3')}</button>
        </div>
      </div>`;
    });
    optsHtml=rows+btn('Add condition',"_QED.options.push({condition:'lt',value:null,value2:null});App._renderQModal()",{variant:'brand',size:'sm',icon:'plus',attrs:'style="margin-top:6px"'});
  }
  else {
    const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
    const lbs=labels[q.type]||['Option A','Option B'];
    if(!q.options||q.options.length!==2)_QED.options=[{label:lbs[0]},{label:lbs[1]}];
    optsHtml=(q.options||[]).map((o,i)=>{
      const good=i===0;
      return`<div style="display:flex;align-items:center;gap:10px;background:${good?'#F0FDF4':'#FFF5F5'};border:1px solid ${good?'#BBF7D0':'#FECACA'};border-radius:9px;padding:8px 12px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:${good?'#16A34A':'#DC2626'};min-width:50px">${lbs[i]}</span>
      </div>`;
    }).join('');
  }

  // Preview
  let prev='';
  if(q.type==='answer')prev=(q.options||[]).map((o,i)=>`<div style="padding:7px 12px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:13px;margin-bottom:4px">${String.fromCharCode(65+i)}. ${o.text||'...'}</div>`).join('');
  else if(q.type==='number')prev=`<input disabled placeholder="Enter a number…" style="width:100%;padding:9px;border-radius:9px;border:1.5px solid #E5E7EB;font-size:14px;background:#F9FAFB"/>`;
  else if(q.type==='passfail')prev=`<div style="display:flex;gap:8px"><div style="flex:1;padding:9px;border-radius:9px;background:#DCFCE7;color:#16A34A;font-weight:700;font-size:13px;text-align:center">Pass</div><div style="flex:1;padding:9px;border-radius:9px;background:#FEE2E2;color:#DC2626;font-weight:700;font-size:13px;text-align:center">Fail</div></div>`;
  else if(q.type==='yesno')prev=`<div style="display:flex;gap:8px"><div style="flex:1;padding:9px;border-radius:9px;background:#DCFCE7;color:#16A34A;font-weight:700;font-size:13px;text-align:center">Yes</div><div style="flex:1;padding:9px;border-radius:9px;background:#FEE2E2;color:#DC2626;font-weight:700;font-size:13px;text-align:center">No</div></div>`;
  else if(q.type==='tick')prev=`<div style="display:flex;gap:8px"><div style="flex:1;padding:9px;border-radius:9px;background:#DCFCE7;color:#16A34A;display:flex;justify-content:center">${ic('check','w-[18px] h-[18px]')}</div><div style="flex:1;padding:9px;border-radius:9px;background:#FEE2E2;color:#DC2626;display:flex;justify-content:center">${ic('x','w-[18px] h-[18px]')}</div></div>`;

  const _qfl=(n,t)=>'<span style="display:inline-flex;align-items:center;gap:4px">'+ic(n,'w-3 h-3')+t+'</span>';
  const flags=[q.photo?_qfl('cam','Photo required'):'',q.comment?_qfl('msg','Comment required'):''].filter(Boolean);

  const togRow=(k,lbl,desc,iconName='')=>`<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:9px;border:1.5px solid ${_QED[k]?'#BBF7D0':'#F3F4F6'};background:${_QED[k]?'#F0FDF4':'#FAFAFA'};cursor:pointer;margin-bottom:5px">
    <div><div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600">${iconName?ic(iconName,'w-3.5 h-3.5'):''}${lbl}</div><div style="font-size:11px;color:#9CA3AF">${desc}</div></div>
    <button type="button" role="switch" aria-checked="${_QED[k]?'true':'false'}" aria-label="${esc(lbl)}" class="tog ${_QED[k]?'on':'off'}" onclick="_QED['${k}']=!_QED['${k}'];App._renderQModal()"><span></span></button>
  </label>`;

  const typeBtns=Q_TYPES.map(t=>`<button type="button" onclick="_QED.type='${t.id}';_QED.options=[];App._renderQModal()" style="padding:8px;border-radius:9px;border:1.5px solid ${q.type===t.id?Q_TYPE_CLR[t.id]:'#E5E7EB'};background:${q.type===t.id?Q_TYPE_BG[t.id]:'#fff'};cursor:pointer;text-align:left">
    <div style="font-size:12px;font-weight:700;color:${q.type===t.id?Q_TYPE_CLR[t.id]:'#374151'}">${t.label}</div>
    <div style="font-size:10px;color:#9CA3AF;margin-top:2px">${t.desc}</div>
  </button>`).join('');

  const isExisting=!!(DB.questions||[]).find(x=>x.id===q.id);

  const _lbl='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px';
  modalShell({title:`${isExisting?'Edit':'New'} Question`,size:'max-w-lg',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label for="qed-text" style="${_lbl};margin-bottom:6px">Question text *</label>
        <input id="qed-text" type="text" value="${q.text||''}" oninput="_QED.text=this.value" placeholder="e.g. Is the area clean?" class="ui-input" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="${_lbl};margin-bottom:6px">Department *</label>
          <select class="ui-input" onchange="_QED.department=this.value;_QED.subDepartment='';App._renderQModal()">
            <option value="">— Select —</option>
            ${topDepts().map(d=>`<option value="${esc(d.name)}" ${q.department===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="${_lbl};margin-bottom:6px">Sub-department *</label>
          <select class="ui-input" ${q.department?'':'disabled'} onchange="_QED.subDepartment=this.value">
            <option value="">${q.department?'— Select —':'Pick a department first'}</option>
            ${(q.department?subDeptsOfName(q.department):[]).map(s=>`<option value="${esc(s.name)}" ${q.subDepartment===s.name?'selected':''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label style="${_lbl}">Response type</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${typeBtns}</div>
      </div>
      <div>
        <label style="${_lbl}">${q.type==='answer'?'Answer options':q.type==='number'?'Conditions':'Response options'}</label>
        ${optsHtml}
      </div>
      <div>
        <label style="${_lbl}">Options</label>
        ${togRow('isPublic','Public question','Off = Private (default): only you and assigned users see it. On: everyone with Questions access sees it','globe')}
        ${togRow('photo','Photo mandatory','Upload button always shown — this makes it required','cam')}
        ${togRow('comment','Comment mandatory','Comment box always shown — this makes it required','msg')}
      </div>
      <div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:14px">      <div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Preview</div>
        <div style="font-size:14px;font-weight:700;color:var(--c-text);margin-bottom:10px">${q.text||'Your question text…'}</div>
        ${prev}
        ${flags.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${flags.map(f=>`<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:var(--c-border);color:var(--c-text)">${f}</span>`).join('')}</div>`:''}
      </div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(isExisting?'Save changes':'Create question','App._saveQuestion()')});

};

App._saveQuestion=()=>{
  {const _ed=window._QED;const _isNew=!_ed||!_ed.id||!(DB.questions||[]).some(x=>x.id===_ed.id);if(_isNew?!can('questions','create'):false)return toast('You need Questions → Create','err');}
  if(!_QED)return;
  const textEl=document.getElementById('qed-text');
  if(textEl)_QED.text=textEl.value.trim();
  const text=(_QED.text||'').trim();
  if(!text){toast('Question text is required','err');const qb=document.getElementById('q-save-btn');if(qb){qb.disabled=false;qb.textContent=_QED?.createdAt?'Save changes':'Create question';}return;}
  if(!(_QED.department||'').trim()){toast('Select a department','err');return;}
  // Only demand a sub-department when the chosen department actually has any —
  // otherwise a department without sub-departments could never hold a question.
  {const _dep=(DB.departments||[]).find(d=>d.name===_QED.department);
   const _hasSubs=!!_dep&&(DB.departments||[]).some(d=>d.parentId===_dep.id);
   if(_hasSubs&&!(_QED.subDepartment||'').trim()){toast('Select a sub-department','err');return;}
   if(!_hasSubs)_QED.subDepartment='';}
  if(_QED.type==='answer'){
    _QED.options=(_QED.options||[]).filter(o=>(o.text||'').trim());
    if(!_QED.options.length){toast('Add at least one answer option','err');const qb=document.getElementById('q-save-btn');if(qb){qb.disabled=false;qb.textContent=_QED?.createdAt?'Save changes':'Create question';}return;}
  }
  if(_QED.type==='number'&&!(_QED.options||[]).length){toast('Add at least one condition','err');const qb=document.getElementById('q-save-btn');if(qb){qb.disabled=false;qb.textContent=_QED?.createdAt?'Save changes':'Create question';}return;}
  if(!DB.questions)DB.questions=[];  if(!DB.questions)DB.questions=[];
  const existIdx=DB.questions.findIndex(x=>x.id===_QED.id);
  const isNew=existIdx===-1;
  if(!isNew){DB.questions[existIdx]=_QED;}
  else{_QED.createdBy=S.uid;_QED.createdAt=new Date().toISOString();DB.questions.push(_QED);}
  // ── Save locally and close IMMEDIATELY ──
  toast(isNew?'Question created':'Saved');
  closeModal();
  const savedQ=_QED;_QED=null;
  saveDB();
  render();
  // ── Sync to Supabase in background ──  saveDB();
  render();
  // ── Sync to Supabase in background ──
  const qRow={id:savedQ.id,text:savedQ.text||'',type:savedQ.type||'answer',options:savedQ.options||[],photo:savedQ.photo||false,approval:savedQ.approval||false,comment:savedQ.comment||false,is_public:savedQ.isPublic!==false,department:savedQ.department||'',sub_department:savedQ.subDepartment||'',created_by:savedQ.createdBy||null,created_at:savedQ.createdAt||new Date().toISOString()};
  sb.from('questions').upsert(qRow,{onConflict:'id'}).then(({error})=>{
    if(error){console.error('Question sync error:',error.message);toast('Question saved locally but not synced: '+error.message.slice(0,60),'warn');}
  }).catch(e=>console.error('Question sync:',e));
};

// ── Checklist question picker ──
App._openClQuestionPicker=()=>{
  if(!CLD)return;
  // CRITICAL: Snapshot form values NOW while checklist modal is still open
  _snapshotCLD();
  const allQ=visibleQuestions();
  const sel=new Set(CLD.questionIds||[]);
  App._clQSel=new Set(sel);
  App._showClQPicker();
};

App._showClQPicker=()=>{
  const sel=App._clQSel||new Set();
  // Show questions the user can see, plus any already selected on this checklist (so existing private picks aren't lost)
  const allQ=(DB.questions||[]).filter(q=>q.isPublic!==false||q.createdBy===S.uid||isAdmin()||can('questions','edit')||sel.has(q.id)); // micro
  modalShell({title:'Add Questions',sub:'Select questions, then configure escalation',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:5px">
      ${!allQ.length
        ?`<div style="text-align:center;padding:32px;color:var(--c-text-3);font-size:13px">No questions yet — create some in the Questions page first</div>`
        :allQ.map(q=>{
          const on=sel.has(q.id);
          const tl=(Q_TYPES.find(t=>t.id===q.type)||{label:q.type}).label;
          const clr=Q_TYPE_CLR[q.type]||'#6B7280';
          const bg=Q_TYPE_BG[q.type]||'#F6F7F8';
          return`<label id="qpick-${q.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid ${on?'#15171C':'#E5E7EB'};background:${on?'#F9FAFB':'#fff'};cursor:pointer" onclick="App._togClQ('${q.id}',this,event)">
            <div style="width:20px;height:20px;border-radius:6px;border:1.5px solid ${on?'#15171C':'#D1D5DB'};background:${on?'#15171C':'#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${on?`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><path d="M20 6 9 17l-5-5"/></svg>`:''}
            </div>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:${bg};color:${clr};flex-shrink:0">${tl}</span>
            ${q.isPublic===false?`<span style="display:inline-flex;flex-shrink:0;color:#9CA3AF" title="Private question">${ic('lock','w-3 h-3')}</span>`:''}
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.text}</div>
              <div style="font-size:11px;color:#9CA3AF">${(q.options||[]).length} option${(q.options||[]).length!==1?'s':''}</div>
            </div>
          </label>`;
        }).join('')}
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Next: Set escalation →','App._showClQEscalation()')});
};

App._togClQ=(qid,el,e)=>{if(e&&e.preventDefault)e.preventDefault();
  if(!App._clQSel)App._clQSel=new Set();
  const on=App._clQSel.has(qid);
  if(on)App._clQSel.delete(qid);else App._clQSel.add(qid);
  const now=!on;
  el.style.border=`1.5px solid ${now?'#15171C':'#E5E7EB'}`;
  el.style.background=now?'#F9FAFB':'#fff';
  const box=el.querySelector('div');
  if(box){
    box.style.border=`1.5px solid ${now?'#15171C':'#D1D5DB'}`;
    box.style.background=now?'#15171C':'#fff';
    box.innerHTML=now?`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><path d="M20 6 9 17l-5-5"/></svg>`:'';
  }
};

App._showClQEscalation=()=>{
  if(!CLD){toast('Checklist context lost — please reopen','err');return;}
  if(!App._clQSel)App._clQSel=new Set(CLD.questionIds||[]);
  const selectedIds=[...App._clQSel];
  if(!selectedIds.length){toast('Select at least one question','warn');return;}
  const au=DB.users.filter(u=>u.status==='Active');
  const configs=CLD.questionConfigs||{};

  const uOptsFn=(curVal)=>'<option value="">— No escalation —</option>'+au.map(u=>`<option value="${u.id}" ${curVal===u.id?'selected':''}>${fullName(u)}</option>`).join('');

  let sectionsHtml=selectedIds.map(qid=>{
    const q=(DB.questions||[]).find(x=>x.id===qid);
    if(!q)return'';
    const tl=(Q_TYPES.find(t=>t.id===q.type)||{label:q.type}).label;
    const clr=Q_TYPE_CLR[q.type]||'#6B7280';
    const bg=Q_TYPE_BG[q.type]||'#F6F7F8';
    const qCfg=configs[qid]||{};

    // Build option rows with escalation dropdown per option
    let optRows='';
    const opts=q.options||[];

    if(q.type==='answer'){
      opts.forEach((o,i)=>{
        const key='opt_'+i;
        const cur=qCfg[key]||'';
        optRows+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F5F4F0">
          <span style="width:20px;height:20px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#4338CA;flex-shrink:0">${String.fromCharCode(65+i)}</span>
          <span style="flex:1;font-size:13px;color:#374151">${o.text||''}</span>
          <select onchange="(CLD.questionConfigs=CLD.questionConfigs||{})['${qid}']=(CLD.questionConfigs['${qid}']||{});CLD.questionConfigs['${qid}']['opt_${i}']=this.value||null" style="font-size:12px;background:#fff;border:1.5px solid #E5E7EB;border-radius:8px;padding:4px 10px;outline:none;min-width:150px">${uOptsFn(cur)}</select>
        </div>`;
      });
    } else if(q.type==='number'){
      opts.forEach((o,i)=>{
        const key='opt_'+i;
        const cur=qCfg[key]||'';
        const condLabel=(NUM_CONDITIONS.find(c=>c.id===o.condition)||{label:o.condition}).label;
        const condText=condLabel+' '+o.value+(o.condition==='between'?' – '+o.value2:'');
        optRows+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F5F4F0">
          <span style="width:20px;height:20px;border-radius:50%;background:#E0F2FE;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#0369A1;flex-shrink:0">${i+1}</span>
          <span style="flex:1;font-size:13px;color:#374151">${condText}</span>
          <select onchange="(CLD.questionConfigs=CLD.questionConfigs||{})['${qid}']=(CLD.questionConfigs['${qid}']||{});CLD.questionConfigs['${qid}']['opt_${i}']=this.value||null" style="font-size:12px;background:#fff;border:1.5px solid #E5E7EB;border-radius:8px;padding:4px 10px;outline:none;min-width:150px">${uOptsFn(cur)}</select>
        </div>`;
      });
    } else {
      // passfail, yesno, tick
      const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
      const lbs=labels[q.type]||['Option A','Option B'];
      lbs.forEach((lbl,i)=>{
        const key='opt_'+i;
        const cur=qCfg[key]||'';
        const isGood=i===0;
        optRows+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #F5F4F0">
          <span style="font-size:12px;font-weight:700;color:${isGood?'#16A34A':'#DC2626'};min-width:50px">${lbl}</span>
          <div style="flex:1"></div>
          <select onchange="(CLD.questionConfigs=CLD.questionConfigs||{})['${qid}']=(CLD.questionConfigs['${qid}']||{});CLD.questionConfigs['${qid}']['opt_${i}']=this.value||null" style="font-size:12px;background:#fff;border:1.5px solid #E5E7EB;border-radius:8px;padding:4px 10px;outline:none;min-width:150px">${uOptsFn(cur)}</select>
        </div>`;
      });
    }

    if(!opts.length){
      optRows=`<p style="font-size:12px;color:#D1D5DB;font-style:italic;padding:6px 0">No options defined for this question</p>`;
    }

    return`<div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-md);padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${bg};color:${clr}">${tl}</span>
        <span style="font-size:13px;font-weight:700;color:var(--c-text)">${q.text}</span>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Escalate answer to</div>
      ${optRows}
    </div>`;
  }).join('');

  modalShell({title:'Set Escalation',sub:'Choose who gets notified for each answer',size:'max-w-lg',
    body:sectionsHtml,
    footer:btnG('← Back','App._showClQPicker()')+btnP('Done','App._confirmClQs()')});
};

// Read all checklist modal form values into CLD (prevents data loss on re-render)
function _snapshotCLD(){
  if(!CLD)return;
  // Only read fields that actually exist in DOM right now
  const el=id=>document.getElementById(id);
  if(el('cn-name'))CLD.name=el('cn-name').value.trim()||CLD.name;
  if(el('cn-desc'))CLD.description=el('cn-desc').value.trim();
  if(el('cn-status')&&el('cn-status').value)CLD.status=el('cn-status').value;
  if(el('cn-dep')&&el('cn-dep').value)CLD.department=el('cn-dep').value;
  if(el('cn-freq')&&el('cn-freq').value)CLD.frequency=el('cn-freq').value;
  if(el('cn-sd'))CLD.startDate=el('cn-sd').value||null;
  if(el('cn-ed'))CLD.endDate=el('cn-ed').value||null;
  if(el('cn-time'))CLD.scheduleTime=el('cn-time').value||null;
  if(el('cn-ddate'))CLD._deadlineDate=el('cn-ddate').value||null; // pending deadline date survives re-renders
  if(el('cn-anyone'))CLD.anyOne=el('cn-anyone').classList.contains('on');
}


App._confirmClQs=()=>{
  if(!CLD||!App._clQSel)return;
  // Snapshot all current form values before re-rendering (prevents data loss)
  _snapshotCLD();
  // Preserve existing order, then add new ones at end
  const existing=CLD.questionIds||[];
  const newIds=[...App._clQSel];
  // Keep existing order for already-selected, add new ones at end
  CLD.questionIds=[...existing.filter(id=>newIds.includes(id)),...newIds.filter(id=>!existing.includes(id))];
  CLD.questionConfigs=CLD.questionConfigs||{};
  // Remove configs for deselected questions
  Object.keys(CLD.questionConfigs).forEach(qid=>{
    if(!App._clQSel.has(qid))delete CLD.questionConfigs[qid];
  });
  closeModal();
  _renderClModal(!!(DB.checklists.find(c=>c.id===CLD.id)));
};

App._removeClQuestion=(qid)=>{
  if(!CLD)return;
  _snapshotCLD();
  CLD.questionIds=(CLD.questionIds||[]).filter(x=>x!==qid);
  if(CLD.questionConfigs)delete CLD.questionConfigs[qid];
  _renderClModal(!!(DB.checklists.find(c=>c.id===CLD.id)));
};

App._editClQuestionEscalation=(qid)=>{
  if(!CLD)return;
  _snapshotCLD(); // snapshot before replacing modal
  App._clQSel=new Set(CLD.questionIds||[]);
  App._showClQEscalation();
};


// ── Compliance check (Fix #3, revised) ──
// Returns the Set of question IDs that actually triggered a REAL escalation ticket for a
// given submission — matched by checklist + date + the submission's own submitter (so
// "any one" group submissions match whoever submitted). This is the single source of
// truth for both the card badge (count) and the per-question red highlight.
// Does a single stored answer (resp) trip an escalation for question q on checklist c?
// Pure re-evaluation of the saved response against the checklist's escalation config —
// this is what makes OLD submissions show compliance even when no ticket was ever created.
function _qrEscalates(c,q,resp){
  if(!c||!q||!resp)return false;
  const r=resp.response;
  if(r===null||r===undefined||r==='')return false; // unanswered ≠ escalation
  const qCfg=(c.questionConfigs||{})[q.id]||{};
  if(q.type==='answer'){
    const _respStr=String(r).trim();
    const optIdx=(q.options||[]).findIndex(o=>String(o.text||'').trim()===_respStr);
    return optIdx>-1&&!!qCfg['opt_'+optIdx];
  }
  if(q.type==='number'){
    const val=parseFloat(r);
    for(let i=0;i<(q.options||[]).length;i++){
      const cond=q.options[i];let m=false;
      if(cond.condition==='lt')m=val<cond.value;
      else if(cond.condition==='lte')m=val<=cond.value;
      else if(cond.condition==='gt')m=val>cond.value;
      else if(cond.condition==='gte')m=val>=cond.value;
      else if(cond.condition==='eq')m=val===cond.value;
      else if(cond.condition==='neq')m=val!==cond.value;
      else if(cond.condition==='between')m=val>=cond.value&&val<=(cond.value2||cond.value);
      if(m)return !!qCfg['opt_'+i];
    }
    return false;
  }
  // passfail / yesno / tick — match by label index
  const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
  const lbs=labels[q.type]||[];
  const optIdx=lbs.findIndex(l=>l.toLowerCase()===String(r).trim().toLowerCase());
  return optIdx>-1&&!!qCfg['opt_'+optIdx];
}
function _subEscalatedQids(c,sub){
  const out=new Set();
  if(!c||!sub)return out;
  // 1) Re-evaluate the actual saved answers against the escalation config (works on old data)
  const qById={};(c.questionIds||[]).forEach(qid=>{const q=(DB.questions||[]).find(x=>x.id===qid);if(q)qById[qid]=q;});
  (sub.questionResponses||[]).forEach(resp=>{
    const q=qById[resp.questionId];
    if(q&&_qrEscalates(c,q,resp))out.add(resp.questionId);
  });
  // 2) Union with any real escalation tickets recorded for this submission (belt and suspenders)
  const submitterId=sub.userId; // for "any one" group checklists this is whoever submitted
  (DB.tickets||[]).forEach(t=>{
    if(t.checklistId===c.id&&t.date===sub.date&&t.submitterId===submitterId&&t.questionId){
      out.add(t.questionId);
    }
  });
  return out;
}
// Count of distinct questions that escalated (0 = compliant).
function _subEscalationCount(c,sub){return _subEscalatedQids(c,sub).size;}
// ── Separate badges: Attempt (answered/total) + Compliance (escalations) ──
// Returns an HTML string with up to two pills. `opts.small` shrinks them for dense rows.
function _subBadges(c,sub,opts){
  if(!sub)return'';
  const total=(c.questionIds||[]).length;
  const answered=(sub.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length;
  const flagged=_subEscalationCount(c,sub);
  const small=opts&&opts.small;
  const pad=small?'2px 7px':'3px 9px';
  const fs=small?'10px':'11px';
  const allAns=total>0&&answered>=total;
  // Attempt badge — green when all questions attempted, grey otherwise
  const attBg=allAns?'#ECFDF5':'#F6F7F8';
  const attClr=allAns?'#059669':'#6B7280';
  const attLabel=small?answered+'/'+total:answered+'/'+total+' attempted';
  const attempt=total>0
    ? '<span title="'+answered+' of '+total+' question'+(total!==1?'s':'')+' attempted" style="display:inline-flex;align-items:center;gap:4px;font-size:'+fs+';font-weight:700;padding:'+pad+';border-radius:20px;background:'+attBg+';color:'+attClr+'">'+(allAns?ic('check','w-3 h-3'):'')+attLabel+'</span>'
    : '';
  // Compliance badge — green "Compliant" when no escalations, red "N escalated" when flagged
  const compBg=flagged?'#FFF1F2':'#ECFDF5';
  const compClr=flagged?'#BE123C':'#059669';
  const compLabel=flagged
    ? (small?ic('alert','w-3 h-3')+flagged:ic('alert','w-3 h-3')+flagged+' escalated')
    : (small?'':ic('check','w-3 h-3')+'Compliant');
  const compliance='<span title="'+(flagged?flagged+' answer'+(flagged!==1?'s':'')+' triggered an escalation':'No escalations — compliant')+'" style="display:inline-flex;align-items:center;gap:4px;font-size:'+fs+';font-weight:700;padding:'+pad+';border-radius:20px;background:'+compBg+';color:'+compClr+'">'+compLabel+'</span>';
  return attempt+compliance;
}

// ── Escalation on submit ──
function _processEscalations(checklistId,date,responses){
  const c=clById(checklistId);if(!c)return;
  const u=me();
  const configs=c.questionConfigs||{};
  (responses||[]).forEach(resp=>{
    const q=(DB.questions||[]).find(x=>x.id===resp.questionId);if(!q)return;
    const qCfg=configs[resp.questionId]||{};
    let escalateTo=null;
    // Find which option index matched the response
    if(q.type==='answer'){
      const _respStr=String(resp.response||'').trim();const optIdx=(q.options||[]).findIndex(o=>String(o.text||'').trim()===_respStr);
      if(optIdx>-1)escalateTo=qCfg['opt_'+optIdx]||null;
    } else if(q.type==='number'){
      const val=parseFloat(resp.response);
      for(let i=0;i<(q.options||[]).length;i++){
        const cond=q.options[i];
        let m=false;
        if(cond.condition==='lt')m=val<cond.value;
        else if(cond.condition==='lte')m=val<=cond.value;
        else if(cond.condition==='gt')m=val>cond.value;
        else if(cond.condition==='gte')m=val>=cond.value;
        else if(cond.condition==='eq')m=val===cond.value;
        else if(cond.condition==='neq')m=val!==cond.value;
        else if(cond.condition==='between')m=val>=cond.value&&val<=(cond.value2||cond.value);
        if(m){escalateTo=qCfg['opt_'+i]||null;break;}
      }
    } else {
      // passfail, yesno, tick — match by label index
      const labels={passfail:['Pass','Fail'],yesno:['Yes','No'],tick:['Done','Not done']};
      const lbs=labels[q.type]||[];
      const optIdx=lbs.findIndex(l=>l.toLowerCase()===String(resp.response||'').trim().toLowerCase());
      if(optIdx>-1)escalateTo=qCfg['opt_'+optIdx]||null;
    }
    if(escalateTo){
      if(!DB.notifications)DB.notifications=[];
      if(!DB.tickets)DB.tickets=[];
      const escMsg='⚠️ Escalation: "'+q.text+'" answered "'+String(resp.response||'')+'" by '+fullName(u)+' on '+c.name+' ('+date+')';
      // Determine priority from question or response
      const _respLower=String(resp.response||'').toLowerCase();
      const ticketPriority=_respLower==='fail'||_respLower==='not done'||_respLower==='no'?'High':'Medium';
      // ── Deduplication: don't create ticket if one already exists for same question+checklist
      // that is still Open or In Progress (unresolved)
      const existingOpenTicket=(DB.tickets||[]).find(t=>
        t.questionId===q.id&&
        t.checklistId===checklistId&&
        (t.status==='Open'||t.status==='In Progress')
      );
      if(existingOpenTicket){
        // Just update the notification so assignee knows it happened again
        notifyEvent('escalation',escalateTo,'🔁 Repeat escalation: "'+q.text+'" answered "'+String(resp.response||'')+'" again by '+fullName(u)+' — ticket #'+existingOpenTicket.id.slice(-6)+' still open','tickets',{question:q.text,answer:String(resp.response||''),submitter:fullName(u)});
        _invalidateNotifCache();
        return; // Skip creating a duplicate ticket
      }
      // Create ticket
      const ticket={
        id:uid('tk'),
        title:q.text.slice(0,80),
        description:'Answer: "'+String(resp.response||'')+'"\nSubmitted by: '+fullName(u)+'\nChecklist: '+c.name+'\nDate: '+date,
        priority:ticketPriority,
        status:'Open',
        assignedTo:escalateTo,
        createdBy:S.uid,
        checklistId:checklistId,
        questionId:q.id,
        questionText:q.text,
        answerGiven:String(resp.response||''),
        submitterId:S.uid,
        date:date,
        createdAt:new Date().toISOString(),
        resolvedAt:null,
        resolveNote:'',
        viewedBy:[]
      };
      DB.tickets.unshift(ticket);
      // Insert ticket directly to Supabase — don't rely on debounced _sync
      sb.from('tickets').insert({
        id:ticket.id,
        title:ticket.title,
        description:ticket.description,
        priority:ticket.priority,
        status:ticket.status,
        assigned_to:ticket.assignedTo,
        created_by:ticket.createdBy,
        checklist_id:ticket.checklistId,
        question_id:ticket.questionId,
        question_text:ticket.questionText,
        answer_given:ticket.answerGiven,
        submitter_id:ticket.submitterId,
        date:ticket.date,
        created_at:ticket.createdAt,
        resolved_at:null,
        resolve_note:'',
        viewed_by:[]
      }).then(({error})=>{
        if(error)console.error('[ticket insert]',error.message);
        else console.log('[ticket]',ticket.id,'inserted for',ticket.assignedTo);
      }).catch(e=>console.error('[ticket insert failed]',e.message));
      // In-app notification to assignee
      notifyEvent('escalation',escalateTo,escMsg,'tickets',{question:q.text,answer:String(resp.response||''),submitter:fullName(u)});
      // In-app notification to admin
      const adminU=DB.users.find(x=>isSuperU(x));
      if(adminU&&adminU.id!==escalateTo&&adminU.id!==S.uid){
        DB.notifications.unshift({id:uid('n'),userId:adminU.id,text:escMsg,time:new Date().toISOString(),read:false,type:'escalation',kind:'escalation'});
      }
      // Email the escalation target
      queueEmail('escalation',escalateTo,null,date,{checklist_name:c.name,question:q.text,answer:String(resp.response||''),submitter:fullName(u)});
      _invalidateNotifCache();
    }
  });
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.visibleQuestions=visibleQuestions;window.canManageQ=canManageQ;window.qCard=qCard;window._qColl=_qColl;window._qIsColl=_qIsColl;window._renderQGrouped=_renderQGrouped;window.questionsPage=questionsPage;window._snapshotCLD=_snapshotCLD;window._qrEscalates=_qrEscalates;window._subEscalatedQids=_subEscalatedQids;window._subEscalationCount=_subEscalationCount;window._subBadges=_subBadges;window._processEscalations=_processEscalations;
