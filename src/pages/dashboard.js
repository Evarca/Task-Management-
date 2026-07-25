

/* ── TODAY'S CHECKLIST LOAD — one source of truth for the day's completion numbers ──
   The widget cells and the drill-down lists both read this, so a count can never
   disagree with the names behind it. */
function _todayLoad(){
  const d=todayISO();
  const act=DB.users.filter(u=>u.status==='Active');
  const DONE=[],DUE=[],CLEAR=[];
  act.forEach(u=>{
    const cls=myCls(u.id,d);
    if(!cls.length){CLEAR.push(u);return;}
    const open=cls.filter(c=>!subForCl(c,u.id,d));
    (open.length?DUE:DONE).push(u);
  });
  return{DONE,DUE,CLEAR,date:d};
}
function _todayLoadWidget(){
  const {DONE,DUE,CLEAR,date}=_todayLoad();
  const d=date;
  const assigned=DB.checklists.filter(c=>clOn(c,d));
  const late=DB.submissions.filter(s=>s.date===d&&s.status==='Late').length;
  const cell=(label,arr,fg,drill)=>`<div ${drill?`onclick="App._dashDrill('${drill}')" role="button" tabindex="0" title="Tap for the list"`:''} style="flex:1;min-width:105px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:10px 12px;${drill?'cursor:pointer':''}">
    <div style="display:flex;align-items:baseline;gap:6px"><span class="fd" style="font-size:19px;font-weight:800;color:${fg}">${arr.length}</span><span style="font-size:11px;font-weight:700;color:var(--c-text-2)">${label}</span></div>
    <div style="display:flex;margin-top:6px">${arr.slice(0,6).map(u=>`<span style="margin-right:-6px" title="${esc(fullName(u))}">${avatar(u,'w-6 h-6','text-[9px]')}</span>`).join('')||'<span style="font-size:11px;color:var(--c-text-3)">—</span>'}${arr.length>6?`<span style="margin-left:10px;font-size:10px;color:var(--c-text-3);align-self:center">+${arr.length-6}</span>`:''}</div>
  </div>`;
  return `<div class="ui-card" style="padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">Today — where the work stands</div><span style="font-size:11px;color:var(--c-text-3)">${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})} · ${assigned.length} checklist${assigned.length===1?'':'s'} running${late?' · '+late+' late':''}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${cell('All done',DONE,'var(--c-success-ink)','day-done')}${cell('Still open',DUE,'var(--c-danger-ink)','day-due')}${cell('Nothing due',CLEAR,'var(--c-text-3)','day-clear')}</div>
  </div>`;
}

/* ── SETUP GUIDE — a living checklist on the admin dashboard: what to configure next, one click away.
      Auto-checks real data; disappears forever once complete (or when dismissed). ── */
function _setupGuideWidget(){
  if(!can('accessControl','manage'))return'';
  try{if(localStorage.getItem('bridge_setup_dismissed'))return'';}catch(e){}
  const items=[
    ['Add your departments',(DB.departments||[]).length>0,'departments'],
    ['Add your people',(DB.users||[]).filter(u=>u.status==='Active').length>1,'users'],
    ['Set who reports to whom',(DB.users||[]).some(u=>u.managerId),'users'],
    ['Assign access roles',(DB.users||[]).filter(u=>u.status==='Active').every(u=>u.hrm?.roleProfileId),'accesscontrol'],
    ['Create the first checklist',(DB.checklists||[]).length>0,'checklists'],
    ['Build the question bank',(DB.questions||[]).length>0,'questions'],
    ['Assign a checklist to someone',(DB.checklists||[]).some(c=>(c.assignees||[]).length>0),'checklists'],
    ['Add your office locations',(DB.locations||[]).some(l=>l.status==='Active'),'locations'],
  ];
  const done=items.filter(i=>i[1]).length;
  if(done===items.length)return'';
  return `<div class="ui-card" style="padding:16px;margin-bottom:16px;border-left:3px solid var(--c-brand)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="flex:1"><div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">Setup guide — ${done}/${items.length} done</div>
      <div style="font-size:11.5px;color:var(--c-text-3)">Finish these and the app runs itself. Each one is one click away.</div></div>
      <button onclick="try{localStorage.setItem('bridge_setup_dismissed','1')}catch(e){};rr()" style="border:none;background:transparent;color:var(--c-text-3);cursor:pointer;font-size:11px;font-weight:700">Hide</button>
    </div>
    <div style="height:6px;background:var(--c-border);border-radius:3px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:${Math.round(done/items.length*100)}%;background:var(--c-brand)"></div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:6px">
      ${items.map(([l,ok,r])=>`<button onclick="App.go('${r}')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:9px;border:1px solid ${ok?'transparent':'var(--c-border)'};background:${ok?'transparent':'var(--c-surface)'};cursor:pointer;text-align:left;${ok?'opacity:.55':''}">
        <span style="width:18px;height:18px;border-radius:50%;background:${ok?'#22C55E':'var(--c-border)'};color:#fff;display:grid;place-items:center;flex-shrink:0">${ok?ic('check','w-3 h-3'):''}</span>
        <span style="font-size:12px;font-weight:${ok?'600':'700'};color:var(--c-text);${ok?'text-decoration:line-through':''}">${l}</span>
      </button>`).join('')}
    </div>
  </div>`;
}

/* ===== DASHBOARD HELPERS: date range filter + tickets panel ===== */
const DASH_RANGES=[['all','All time'],['today','Today'],['yesterday','Yesterday'],['cweek','Current week'],['lweek','Last week'],['cmonth','Current month'],['lmonth','Last month'],['custom','Custom range']];
function _dashRangeBounds(){
  const r=S.filters.dashRange||'all';
  const today=todayISO();
  const t=new Date(today+'T00:00:00');
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(r==='today')return{from:today,to:today};
  if(r==='yesterday'){const d=new Date(t);d.setDate(d.getDate()-1);const y=iso(d);return{from:y,to:y};}
  if(r==='cweek'){const d=new Date(t);const dow=d.getDay();d.setDate(d.getDate()+(dow===0?-6:1-dow));return{from:iso(d),to:today};}
  if(r==='lweek'){const d=new Date(t);const dow=d.getDay();d.setDate(d.getDate()+(dow===0?-6:1-dow)-7);const e=new Date(d);e.setDate(e.getDate()+6);return{from:iso(d),to:iso(e)};}
  if(r==='cmonth'){return{from:iso(new Date(t.getFullYear(),t.getMonth(),1)),to:today};}
  if(r==='lmonth'){return{from:iso(new Date(t.getFullYear(),t.getMonth()-1,1)),to:iso(new Date(t.getFullYear(),t.getMonth(),0))};}
  if(r==='custom'){
    const f=S.filters.dashFrom||'',e=S.filters.dashTo||'';
    if(!f&&!e)return null;
    return{from:f||'0000-01-01',to:e||'9999-12-31'};
  }
  return null; // 'all'
}
const _inDashRange=date=>{const b=_dashRangeBounds();if(!b)return true;return !!date&&date>=b.from&&date<=b.to;};

/* ── DRILL-DOWNS (owner request): every dashboard card opens the LIST behind its number.
      Each list is permission-scoped with the same resolver the target page uses (scopeFilter/can),
      and the modal offers a jump to the full page. ── */
App._dashDrill=(kind)=>{
  const t=todayISO();
  const row=(av,main,sub,right)=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--c-border)">${av||''}<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${main}</div>${sub?`<div style="font-size:11.5px;color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</div>`:''}</div>${right||''}</div>`;
  const uRow=(u,sub,right)=>u?row(avatar(u,'w-8 h-8','text-[10px]'),esc(fullName(u)),sub,right):'';
  const actives=DB.users.filter(u=>u.status==='Active');
  const empScope=u=>u&&(u.id===S.uid||scopeFilter('employees')(u.id));
  let title='',rows=[],route=null,routeLbl='';
  if(kind==='approvals'){
    title='Pending approvals';route='approvals';routeLbl='Open Approvals';
    rows=(DB.approvals||[]).filter(a=>a.status==='Pending').map(a=>{const u=uById(a.requesterId);const c=a.checklistId?clById(a.checklistId):null;return uRow(u,esc(a.type||'Approval')+(c?' · '+esc(c.name):'')+(a.date?' · '+fmtS(a.date):''));});
  }else if(kind==='tickets'){
    title='Open tickets';route='tickets';routeLbl='Open Tickets';
    rows=(DB.tickets||[]).filter(x=>x.status==='Open'||x.status==='In Progress').map(x=>{const u=x.assignedTo?uById(x.assignedTo):null;return row('',esc(x.title||('#'+String(x.id||'').slice(-6))),(u?esc(fullName(u)):'Unassigned')+(x.priority?' · '+esc(x.priority):'')+(x.status==='In Progress'?' · In progress':''));});
  }else if(kind==='unassigned'){
    title='Unassigned tickets';route='tickets';routeLbl='Open Tickets';
    rows=(DB.tickets||[]).filter(x=>!x.assignedTo&&(x.status==='Open'||x.status==='In Progress')).map(x=>row('',esc(x.title||('#'+String(x.id||'').slice(-6))),(x.priority?esc(x.priority)+' priority':'')+(x.createdAt?' · raised '+fmtS(String(x.createdAt).slice(0,10)):'')));
  }else if(kind==='day-due'){
    title='Still to submit today';route='teamview';routeLbl='Open Team';
    rows=_todayLoad().DUE.filter(empScope).map(u=>{const open=myCls(u.id,t).filter(c=>!subForCl(c,u.id,t));return uRow(u,open.length+' of '+myCls(u.id,t).length+' outstanding · '+open.slice(0,2).map(c=>esc(c.name)).join(', ')+(open.length>2?' +'+(open.length-2):''));});
  }else if(kind==='day-done'){
    title='Finished today';route='teamview';routeLbl='Open Team';
    rows=_todayLoad().DONE.filter(empScope).map(u=>uRow(u,myCls(u.id,t).length+' checklist'+(myCls(u.id,t).length===1?'':'s')+' complete'));
  }else if(kind==='day-clear'){
    title='Nothing scheduled today';
    rows=_todayLoad().CLEAR.filter(empScope).map(u=>uRow(u,esc(u.position||'—')+(u.department?' · '+esc(u.department):'')));
  }else if(kind==='overdue'){
    title='Past their deadline today';route='teamview';routeLbl='Open Team';
    const nowM=nowHM();
    (DB.checklists||[]).filter(c=>c.scheduleTime&&clOn(c,t)&&nowM>hm2m(c.scheduleTime)).forEach(c=>{
      (c.assignees||[]).forEach(aid=>{if(subForCl(c,aid,t))return;const u=uById(aid);if(!u||!empScope(u))return;rows.push(uRow(u,esc(c.name)+' · was due '+c.scheduleTime));});
    });
  }else if(kind==='activeusers'){
    title='Active people';route='users';routeLbl='Open Users';
    rows=actives.filter(u=>scopeFilter('employees')(u.id)).map(u=>uRow(u,esc(u.position||'—')+(u.department?' · '+esc(u.department):'')));
  }else if(kind==='latesubs'){
    title='Late submissions'+((S.filters.dashRange&&S.filters.dashRange!=='all')?' (filtered range)':'');
    rows=DB.submissions.filter(s=>s.status==='Late'&&_inDashRange(s.date)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,80).map(s=>{const u=uById(s.userId);const c=clById(s.checklistId);return uRow(u,esc(c?c.name:'[deleted checklist]')+' · '+fmtS(s.date));});
  }
  rows=rows.filter(Boolean);
  modalShell({title:title||'Details',sub:rows.length+' record'+(rows.length===1?'':'s'),size:'max-w-md',
    body:rows.length?`<div>${rows.join('')}</div>`:`<div style="text-align:center;padding:26px 10px;color:var(--c-text-3);font-size:13px">Nothing here right now 🎉</div>`,
    footer:btnG('Close','App.closeModal()')+(route?btnP(routeLbl||'Open page',`App.closeModal();App.go('${route}')`):'')});
};

/* ── FINAL-UX: "Pulse" strip — live counts across every module, permission-gated, one tap to act ── */
function _pulseStrip(){
  const t=todayISO();
  const nowM=nowHM();
  const cards=[];
  // Cards open a DETAIL modal — the modal itself links to the full page.
  const add=(show,label,n,drill,accent,sub)=>{if(!show)return;cards.push(`<button onclick="App._dashDrill('${drill}')" title="Tap for the list" style="flex:1;min-width:132px;background:#fff;border:1px solid var(--c-border);border-left:3px solid ${accent};border-radius:14px;padding:10px 14px;cursor:pointer;text-align:left">
    <div style="font-size:20px;font-weight:800;color:${n>0?'var(--c-text)':'var(--c-text-3)'}">${n}</div>
    <div style="font-size:11px;font-weight:700;color:var(--c-text-2)">${label}</div>
    ${sub?`<div style="font-size:10px;color:var(--c-text-3)">${sub}</div>`:''}</button>`);};
  // How many assignees are past a checklist's deadline and still haven't submitted.
  const overdue=(DB.checklists||[]).filter(c=>c.scheduleTime&&clOn(c,t)&&nowM>hm2m(c.scheduleTime))
    .reduce((n,c)=>n+(c.assignees||[]).filter(a=>!subForCl(c,a,t)).length,0);
  add(can('approvals','view'),'Approvals waiting',(DB.approvals||[]).filter(a=>a.status==='Pending').length,'approvals','#F59E0B','submissions & edits');
  add(can('tickets','view'),'Open tickets',(DB.tickets||[]).filter(x=>x.status==='Open').length,'tickets','#EF4444','need attention');
  add(can('tickets','view'),'Unassigned tickets',(DB.tickets||[]).filter(x=>!x.assignedTo&&(x.status==='Open'||x.status==='In Progress')).length,'unassigned','#8B5CF6','nobody owns these');
  add(true,'Past deadline today',overdue,'overdue','#F43F5E','not submitted yet');
  add(true,'Late today',DB.submissions.filter(s=>s.date===t&&s.status==='Late').length,'latesubs','#0EA5E9','submitted after cut-off');
  return cards.length?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">${cards.join('')}</div>`:'';
}
function _dashFilterBar(){
  const r=S.filters.dashRange||'all';
  const b=_dashRangeBounds();
  return`<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:#fff;border-radius:14px;border:1.5px solid #ECEDF0">
    <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em">${ic('calendar','w-4 h-4')}Date range</span>
    <select onchange="S.filters.dashRange=this.value;rr()" style="background:#fff;border:1.5px solid #E5E7EB;border-radius:9px;padding:6px 10px;font-size:13px;font-weight:600;outline:none;cursor:pointer">
      ${DASH_RANGES.map(([id,lbl])=>`<option value="${id}" ${r===id?'selected':''}>${lbl}</option>`).join('')}
    </select>
    ${r==='custom'?`
      <input type="date" value="${esc(S.filters.dashFrom||'')}" onchange="S.filters.dashFrom=this.value;rr()" style="border:1.5px solid #E5E7EB;border-radius:9px;padding:5px 8px;font-size:13px;outline:none"/>
      <span style="font-size:12px;color:#9CA3AF">to</span>
      <input type="date" value="${esc(S.filters.dashTo||'')}" onchange="S.filters.dashTo=this.value;rr()" style="border:1.5px solid #E5E7EB;border-radius:9px;padding:5px 8px;font-size:13px;outline:none"/>
    `:''}
    ${b?`<span style="font-size:12px;color:#6B7280;font-weight:600">${b.from===b.to?new Date(b.from+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):new Date(b.from+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' – '+new Date(b.to+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>`:''}
  </div>`;
}
function _dashTicketsPanel(scopeUsers){
  const open=(DB.tickets||[]).filter(t=>t.status==='Open'||t.status==='In Progress');
  const ids=scopeUsers?new Set(scopeUsers.map(u=>u.id)):null;
  const counts={};let unassigned=0;
  open.forEach(t=>{
    if(!t.assignedTo){if(!ids)unassigned++;return;}
    if(ids&&!ids.has(t.assignedTo))return;
    counts[t.assignedTo]=(counts[t.assignedTo]||0)+1;
  });
  const rows=Object.entries(counts).map(([uid2,n])=>({u:uById(uid2),n})).filter(r=>r.u).sort((a,b)=>b.n-a.n);
  const total=rows.reduce((s,r)=>s+r.n,0)+unassigned;
  return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
    <div class="px-4 py-3 border-b border-ink-100 flex justify-between items-center">
      <h3 class="fd font-semibold text-sm">Open tickets by user</h3>
      <button onclick="App.go('tickets')" class="text-xs font-semibold text-brand-700">View all →</button>
    </div>
    <div class="divide-y divide-ink-50">
      ${rows.map(({u,n})=>`<div class="px-4 py-2.5 flex items-center gap-2.5" style="cursor:pointer" onclick="App.go('tickets')">${avatar(u,'w-7 h-7','text-[10px]')}<div class="flex-1 min-w-0"><div class="text-xs font-semibold truncate">${esc(fullName(u))}</div><div class="text-[11px] text-ink-400">not completed</div></div><span style="font-size:12px;font-weight:800;min-width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:13px;background:${n>=5?'#FFEDED':'#FEF7E6'};color:${n>=5?'#C92C2C':'#B36A00'};padding:0 8px">${n}</span></div>`).join('')}
      ${unassigned?`<div class="px-4 py-2.5 flex items-center gap-2.5"><div style="width:28px;height:28px;border-radius:50%;background:#F3F4F6;display:grid;place-items:center;font-size:11px">？</div><div class="flex-1 min-w-0"><div class="text-xs font-semibold">Unassigned</div></div><span style="font-size:12px;font-weight:800;min-width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:13px;background:#F3F4F6;color:#6B7280;padding:0 8px">${unassigned}</span></div>`:''}
      ${!total?`<div class="px-4 py-8 text-center text-sm text-ink-400"><div style="display:flex;justify-content:center;margin-bottom:6px;color:#16A34A">${ic('check','w-6 h-6')}</div>No open tickets</div>`:''}
    </div>
  </div>`;
}

/* ===== ADMIN DASHBOARD ===== */
// Dashboard === Analytics for anyone with analytics access; everyone else gets the visual home dashboard.
function _dashboardPage(){return homeDash();} // hub: Dashboard=My Day for EVERYONE; Company lives on the 'analytics' sub-tab
function adminDash(){
  const today=todayISO();
  const fSubs=DB.submissions.filter(s=>_inDashRange(s.date));
  const active=DB.users.filter(u=>u.status==='Active').length;
  const pendA=DB.approvals.filter(a=>a.status==='Pending').length;
  const late=fSubs.filter(s=>s.status==='Late').length;
  const depts=DB.departments.map(d=>{const us=DB.users.filter(u=>u.department===d.name).length;const cls=DB.checklists.filter(c=>c.department===d.name).length;const ss=fSubs.filter(s=>{const c=clById(s.checklistId);return c?.department===d.name;});return{name:d.name,us,cls,total:ss.length,onTime:ss.filter(s=>s.status==='On Time').length,late:ss.filter(s=>s.status==='Late').length};}).filter(d=>d.us||d.cls);
  const recent=fSubs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,8);
  return`<div class="fade">${_setupGuideWidget()}${_todayLoadWidget()}${hdr('Dashboard',new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}
  ${_dashFilterBar()}
  ${_pulseStrip()}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
    ${statCard('Active users',active,'sky',"App._dashDrill('activeusers')")}${statCard('Pending approvals',pendA,'amber',"App._dashDrill('approvals')")}${statCard('Late submissions',late,'rose',"App._dashDrill('latesubs')")}
  </div>
  <div class="grid lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2 bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
      <div class="px-5 py-3 border-b border-ink-100"><h3 class="fd font-semibold text-sm">Department performance</h3></div>
      <div class="divide-y divide-ink-50">${depts.map(d=>`<div class="px-5 py-3 flex items-center gap-4"><span class="text-sm font-semibold w-32 truncate">${esc(d.name)}</span><div class="flex-1"><div class="pg"><div class="pgf" style="width:${d.total?Math.round(d.onTime/d.total*100):0}%"></div></div></div><span class="text-xs text-ink-400 w-24 text-right shrink-0">${d.us}u · ${d.cls}cl · ${d.late?`<span class="text-rose-600 font-semibold">${d.late} late</span>`:d.total+' sub'}</span></div>`).join('')||empty('dept','No department activity','Department performance appears here once checklists are submitted.')}</div>
    </div>
    <div class="space-y-4">
      <div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
        <div class="px-4 py-3 border-b border-ink-100 flex justify-between items-center"><h3 class="fd font-semibold text-sm">Recent submissions</h3><button onclick="App.go('dashboard')" class="text-xs font-semibold text-brand-700">View all →</button></div>
        <div class="divide-y divide-ink-50">${recent.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return'';const cName=c?c.name:'[Deleted]';return`<div class="px-4 py-2.5 flex items-center gap-2.5">${avatar(u,'w-7 h-7','text-[10px]')}<div class="flex-1 min-w-0"><div class="text-xs font-semibold truncate">${esc(fullName(u))}</div><div class="text-[11px] text-ink-400 truncate">${esc(cName)}</div></div>${chip(s.status)}</div>`;}).join('')||empty('check','No submissions yet','Recent checklist submissions will show up here.')}</div>
      </div>
      ${_dashTicketsPanel(null)}
    </div>
  </div>
  <!-- All users performance (range-aware) -->
  ${(()=>{
    const aRows=DB.users.filter(u=>u.status==='Active').map(u=>{
      const asgn=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)).length;
      const ss=fSubs.filter(s=>s.userId===u.id);
      const lateU=ss.filter(s=>s.status==='Late').length;
      const pend=ss.filter(s=>['Pending','Pending Approval'].includes(s.status)).length;
      const tk=(DB.tickets||[]).filter(t=>t.assignedTo===u.id&&(t.status==='Open'||t.status==='In Progress')).length;
      const todayAsgnCls=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,todayISO()));
      const todayAsgn=todayAsgnCls.length;
      // Effective completions for today: own submission, OR for "any one" group checklists
      // any assignee's completed submission counts as done for this user (Fix #2).
      const todayDone=todayAsgnCls.filter(c=>subForCl(c,u.id,todayISO())).length;
      const pct=todayAsgn?Math.round(todayDone/todayAsgn*100):ss.length?Math.round(Math.min(ss.length,asgn)/Math.max(asgn,1)*100):0;
      return{u,asgn,total:ss.length,late:lateU,pend,tk,pct};
    }).sort((a,b)=>fullName(a.u).localeCompare(fullName(b.u)));
    return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden mt-4">
    <div class="px-5 py-3 border-b border-ink-100"><h3 class="fd font-semibold text-sm">All users performance</h3></div>
    <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-4 py-2.5 font-semibold">Member</th><th class="px-4 py-2.5 font-semibold">Assigned</th><th class="px-4 py-2.5 font-semibold">Submitted</th><th class="px-4 py-2.5 font-semibold">Late</th><th class="px-4 py-2.5 font-semibold">Pending</th><th class="px-4 py-2.5 font-semibold" title="Open + In Progress tickets assigned to this member">Tickets</th><th class="px-4 py-2.5 font-semibold">Completion</th></tr></thead>
    <tbody class="divide-y divide-ink-50">${aRows.map(({u,asgn,total,late:lt,pend,tk,pct})=>`<tr class="hover:bg-ink-50/50"><td class="px-4 py-2.5"><div class="flex items-center gap-2">${avatar(u,'w-7 h-7','text-[10px]')}<span class="font-semibold text-sm">${esc(fullName(u))}</span></div></td><td class="px-4 py-2.5 text-sm">${asgn}</td><td class="px-4 py-2.5 text-emerald-700 font-medium text-sm">${total}</td><td class="px-4 py-2.5 ${lt?'text-rose-600 font-semibold':''} text-sm">${lt}</td><td class="px-4 py-2.5 text-amber-600 text-sm">${pend}</td><td class="px-4 py-2.5">${tk?`<span onclick="App.go('tickets')" title="${tk} open ticket${tk!==1?'s':''} — not completed" style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 8px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;background:${tk>=5?'#FFEDED':'#FEF7E6'};color:${tk>=5?'#C92C2C':'#B36A00'}">${tk}</span>`:`<span class="text-sm text-ink-300">0</span>`}</td><td class="px-4 py-2.5"><div class="flex items-center gap-2"><div style="width:64px;height:6px;border-radius:3px;background:#ECEDF0;overflow:hidden"><div style="height:100%;border-radius:2px;width:${pct}%;background:${pct>=80?'#0E9F6E':pct>=50?'#F59E0B':'#F43F5E'}"></div></div><span class="text-xs font-semibold">${pct}%</span></div></td></tr>`).join('')}</tbody></table></div>
  </div>`;
  })()}
  </div>`;}

/* ===== MANAGER DASHBOARD ===== */
function mgrDash(){
  const team=subTree(S.uid);if(!team.length)return myClsPage();
  const teamIds=new Set(team.map(u=>u.id));
  // Former direct reports (manager changed away) — shown only if they have in-range data from their time under me
  const former=DB.users.filter(u=>!teamIds.has(u.id)&&u.id!==S.uid&&Array.isArray(u.managerHistory)&&u.managerHistory.some(p=>p.managerId===S.uid));
  const mkRow=(u,cur)=>{
    // Only count submissions from dates the user was actually under me (handles transfers in AND out)
    const ss=DB.submissions.filter(s=>s.userId===u.id&&_inDashRange(s.date)&&_underOn(u.id,S.uid,s.date));
    const late=ss.filter(s=>s.status==='Late').length;
    const pend=ss.filter(s=>['Pending','Pending Approval'].includes(s.status)).length;
    if(!cur)return ss.length?{u,cur,asgn:null,total:ss.length,late,pend,tk:null,pct:null}:null;
    const asgn=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)).length;
    const tk=(DB.tickets||[]).filter(t=>t.assignedTo===u.id&&(t.status==='Open'||t.status==='In Progress')).length;
    const todayAsgnCls=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,todayISO()));
    const todayAsgn=todayAsgnCls.length;
    const todayDone=todayAsgnCls.filter(c=>subForCl(c,u.id,todayISO())).length;
    const pct=todayAsgn?Math.round(todayDone/todayAsgn*100):ss.length?Math.round(Math.min(ss.length,asgn)/Math.max(asgn,1)*100):0;
    return{u,cur,asgn,total:ss.length,late,pend,tk,pct};
  };
  const rows=[...team.map(u=>mkRow(u,true)),...former.map(u=>mkRow(u,false))].filter(Boolean);
  const curRows=rows.filter(r=>r.cur);
  return`<div class="fade">${_todayLoadWidget()}${hdr('Team Dashboard',team.length+' member'+(team.length!==1?'s':''))}
  ${_dashFilterBar()}
  ${_pulseStrip()}
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
    ${statCard('Team members',team.length,'sky',"App.go('teamview')")}${statCard('Late submissions',rows.reduce((n,r)=>n+r.late,0),'rose',"S.filters={stats:['Late']};App.go('dashboard')")}${statCard('Avg completion',Math.round(curRows.reduce((n,r)=>n+r.pct,0)/Math.max(curRows.length,1))+'%','brand',"App.go('dashboard')")}
  </div>
  <div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden mb-4">
    <div class="px-5 py-3 border-b border-ink-100"><h3 class="fd font-semibold text-sm">Team performance</h3></div>
    <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-4 py-2.5 font-semibold">Member</th><th class="px-4 py-2.5 font-semibold">Assigned</th><th class="px-4 py-2.5 font-semibold">Submitted</th><th class="px-4 py-2.5 font-semibold">Late</th><th class="px-4 py-2.5 font-semibold">Pending</th><th class="px-4 py-2.5 font-semibold" title="Open + In Progress tickets assigned to this member">Tickets</th><th class="px-4 py-2.5 font-semibold">Completion</th></tr></thead>
    <tbody class="divide-y divide-ink-50">${rows.map(({u,cur,asgn,total,late,pend,tk,pct})=>`<tr class="hover:bg-ink-50/50"><td class="px-4 py-2.5"><div class="flex items-center gap-2">${avatar(u,'w-7 h-7','text-[10px]')}<span class="font-semibold text-sm">${esc(fullName(u))}</span>${cur?'':'<span title="No longer reports to you — showing data from when they did" style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;background:#F3F4F6;color:#6B7280">former</span>'}</div></td><td class="px-4 py-2.5 text-sm">${cur?asgn:'<span class="text-ink-300">—</span>'}</td><td class="px-4 py-2.5 text-emerald-700 font-medium text-sm">${total}</td><td class="px-4 py-2.5 ${late?'text-rose-600 font-semibold':''} text-sm">${late}</td><td class="px-4 py-2.5 text-amber-600 text-sm">${pend}</td><td class="px-4 py-2.5">${cur?(tk?`<span onclick="App.go('tickets')" title="${tk} open ticket${tk!==1?'s':''} — not completed" style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 8px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;background:${tk>=5?'#FFEDED':'#FEF7E6'};color:${tk>=5?'#C92C2C':'#B36A00'}">${tk}</span>`:`<span class="text-sm text-ink-300">0</span>`):'<span class="text-ink-300">—</span>'}</td><td class="px-4 py-2.5">${cur?`<div class="flex items-center gap-2"><div style="width:64px;height:6px;border-radius:3px;background:#ECEDF0;overflow:hidden"><div style="height:100%;border-radius:2px;width:${pct}%;background:${pct>=80?'#0E9F6E':pct>=50?'#F59E0B':'#F43F5E'}"></div></div><span class="text-xs font-semibold">${pct}%</span></div>`:'<span class="text-ink-300">—</span>'}</td></tr>`).join('')}</tbody></table></div>
  </div></div>`;}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._todayLoad=_todayLoad;window._todayLoadWidget=_todayLoadWidget;window._setupGuideWidget=_setupGuideWidget;window._pulseStrip=_pulseStrip;window.DASH_RANGES=DASH_RANGES;window._dashRangeBounds=_dashRangeBounds;window._inDashRange=_inDashRange;window._dashFilterBar=_dashFilterBar;window._dashTicketsPanel=_dashTicketsPanel;window._dashboardPage=_dashboardPage;window.adminDash=adminDash;window.mgrDash=mgrDash;
