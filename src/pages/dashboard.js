

/* ── CHECKLIST OVERVIEW ──
   The state of the WORK, not of the people. One entry per checklist running on the given
   day: how many of its questions are answered, whether it has been submitted, whether it
   is past its deadline, and who has contributed so far. */
function _clOverview(date){
  const d=date||todayISO();
  const seesAll=isAdmin()||scopeOf('checklists')==='everyone';
  const f=scopeFilter('checklists');
  return (DB.checklists||[]).filter(c=>{
    if(c.status==='Draft')return false;
    if(!clOn(c,d))return false;
    if(seesAll)return true;
    return c.createdBy===S.uid||(c.assignees||[]).includes(S.uid)||(c.assignees||[]).some(a=>f(a));
  }).map(c=>{
    const prog=_ansProgress(c,d);
    const sub=runSub(c.id,d);
    const submitted=!!sub&&sub.status!=='Editing';
    const overdue=!submitted&&_clOverdue(c,d);
    const state=submitted?(sub.status==='Pending Approval'?'Awaiting approval':'Submitted')
      :overdue?'Overdue':prog.done?'In progress':'Not started';
    return{c,date:d,prog,sub,submitted,overdue,state,contributors:_ansContributors(c.id,d),
      pct:prog.total?Math.round(prog.done/prog.total*100):(submitted?100:0)};
  }).sort((a,b)=>{
    const rank={'Overdue':0,'In progress':1,'Not started':2,'Awaiting approval':3,'Submitted':4};
    return (rank[a.state]-rank[b.state])||String(a.c.name).localeCompare(String(b.c.name));
  });
}
const _CL_STATE_TONE={'Overdue':['#FEF2F2','#DC2626'],'In progress':['#EFF6FF','#1D4ED8'],'Not started':['#F9FAFB','#6B7280'],'Awaiting approval':['#FFF7ED','#C2410C'],'Submitted':['#F0FDF4','#15803D']};
/* The headline strip: where today's checklists stand. */
function _clOverviewWidget(date){
  const rows=_clOverview(date);
  const d=date||todayISO();
  const by=st=>rows.filter(r=>r.state===st).length;
  const cell=(label,n,fg,drill)=>`<div ${drill?`onclick="App._dashDrill('${drill}')" role="button" tabindex="0" title="Tap for the list"`:''} style="flex:1;min-width:118px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:11px 13px;${drill?'cursor:pointer':''}">
    <div class="fd" style="font-size:21px;font-weight:800;color:${fg};line-height:1">${n}</div>
    <div style="font-size:11px;font-weight:700;color:var(--c-text-2);margin-top:4px">${label}</div>
  </div>`;
  return `<div class="ui-card" style="padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px;flex-wrap:wrap">
      <div class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">Checklists today</div>
      <span style="font-size:11px;color:var(--c-text-3)">${new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})} · ${rows.length} running</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${cell('Submitted',by('Submitted')+by('Awaiting approval'),'var(--c-success-ink)','cl-done')}
      ${cell('In progress',by('In progress'),'#1D4ED8','cl-progress')}
      ${cell('Not started',by('Not started'),'var(--c-text-3)','cl-notstarted')}
      ${cell('Overdue',by('Overdue'),by('Overdue')?'var(--c-danger-ink)':'var(--c-text-3)','cl-overdue')}
    </div>
  </div>`;
}
/* The overview table itself — the thing the client asked to see on the dashboard. */
function _clOverviewTable(date,opt){
  const o=opt||{};
  const rows=_clOverview(date);
  const d=date||todayISO();
  if(!rows.length)return `<div class="ui-card" style="padding:34px 20px;text-align:center">
    <div style="width:52px;height:52px;border-radius:14px;background:var(--c-surface-2);color:var(--c-text-3);display:grid;place-items:center;margin:0 auto 12px">${ic('list','w-6 h-6')}</div>
    <div class="fd" style="font-size:15px;font-weight:800;color:var(--c-text)">No checklists scheduled</div>
    <p style="font-size:12.5px;color:var(--c-text-3);margin-top:4px">Nothing is due on this date.</p></div>`;
  const row=r=>{
    const [bg,fg]=_CL_STATE_TONE[r.state]||['#F9FAFB','#6B7280'];
    const dl=_clDeadlineLabel(r.c);
    return `<tr class="hover:bg-ink-50/50" style="cursor:pointer" onclick="App._clDrill('${r.c.id}','${d}')">
      <td class="px-4 py-3">
        <div style="font-size:13.5px;font-weight:700;color:var(--c-text)">${esc(r.c.name)}</div>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:2px">${esc(r.c.department||'—')}${dl?' · due '+esc(dl):''}</div>
      </td>
      <td class="px-4 py-3" style="white-space:nowrap">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:70px;height:6px;border-radius:3px;background:#ECEDF0;overflow:hidden"><div style="height:100%;width:${r.pct}%;background:${r.pct>=100?'#0E9F6E':r.pct>0?'#0EA5E9':'#E5E7EB'}"></div></div>
          <span style="font-size:12px;font-weight:700;color:var(--c-text-2)">${r.prog.done}/${r.prog.total||0}</span>
        </div>
      </td>
      <td class="px-4 py-3">
        ${r.contributors.length?`<span style="display:inline-flex" title="${esc(r.contributors.map(fullName).join(', '))}">${r.contributors.slice(0,4).map(u=>`<span style="margin-right:-6px">${avatar(u,'w-6 h-6','text-[9px]')}</span>`).join('')}${r.contributors.length>4?`<span style="margin-left:10px;font-size:10px;color:var(--c-text-3);align-self:center">+${r.contributors.length-4}</span>`:''}</span>`:'<span style="font-size:12px;color:var(--c-text-3)">—</span>'}
      </td>
      <td class="px-4 py-3" style="white-space:nowrap"><span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${bg};color:${fg}">${r.state}</span></td>
    </tr>`;
  };
  return `<div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden${o.mt?' mt-4':''}">
    <div class="px-5 py-3 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
      <h3 class="fd font-semibold text-sm">${esc(o.title||'Checklist overview')}</h3>
      <span style="font-size:11.5px;color:var(--c-text-3)">${rows.length} checklist${rows.length===1?'':'s'} · tap a row for detail</span>
    </div>
    <div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left">
        <th class="px-4 py-2.5 font-semibold">Checklist</th>
        <th class="px-4 py-2.5 font-semibold">Answers in</th>
        <th class="px-4 py-2.5 font-semibold">Who</th>
        <th class="px-4 py-2.5 font-semibold">Status</th>
      </tr></thead>
      <tbody class="divide-y divide-ink-50">${rows.map(row).join('')}</tbody>
    </table></div>
  </div>`;
}
/* Question-by-question detail for one checklist run. */
App._clDrill=(clId,date)=>{
  const c=clById(clId);if(!c)return;
  const d=date||todayISO();
  const qs=_clQuestions(c);
  const body=qs.length?qs.map(q=>{
    const a=_ansFor(clId,d,q.id);
    const by=a?uById(a.submittedBy):null;
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border)">
      <span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;background:${a?'#ECFDF5':'#F3F4F6'};color:${a?'#0B7A55':'#9CA3AF'}">${a?ic('check','w-3 h-3'):ic('clock','w-3 h-3')}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--c-text)">${esc(q.text)}</div>
        ${a?`<div style="font-size:12px;color:var(--c-text-2);margin-top:2px"><strong>${esc(String(a.response??'—'))}</strong> · ${esc(by?fullName(by):'Unknown')} · ${a.submittedAt?new Date(a.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</div>`
          :'<div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">Not answered yet</div>'}
      </div>
    </div>`;}).join(''):'<p style="font-size:13px;color:var(--c-text-3);text-align:center;padding:18px">This checklist has no questions.</p>';
  const prog=_ansProgress(c,d);
  modalShell({title:c.name,sub:fmtD(d)+' · '+prog.done+'/'+prog.total+' answers in'+(_clDeadlineLabel(c)?' · due '+_clDeadlineLabel(c):''),size:'max-w-md',
    body:body,
    footer:btnG('Close','App.closeModal()')+btnP('Open checklists',"App.closeModal();App.go('allcl')")});
};

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
  }else if(kind==='cl-done'||kind==='cl-progress'||kind==='cl-notstarted'||kind==='cl-overdue'){
    const want={'cl-done':['Submitted','Awaiting approval'],'cl-progress':['In progress'],'cl-notstarted':['Not started'],'cl-overdue':['Overdue']}[kind];
    title={'cl-done':'Submitted today','cl-progress':'In progress','cl-notstarted':'Not started','cl-overdue':'Past their deadline'}[kind];
    route='allcl';routeLbl='Open All results';
    rows=_clOverview(t).filter(r=>want.includes(r.state)).map(r=>row(
      '<span style="width:32px;height:32px;border-radius:9px;background:var(--c-surface-2);color:var(--c-text-2);display:grid;place-items:center;flex-shrink:0">'+ic('list','w-4 h-4')+'</span>',
      esc(r.c.name),
      r.prog.done+'/'+r.prog.total+' answers'+(r.c.department?' · '+esc(r.c.department):'')+(_clDeadlineLabel(r.c)?' · due '+esc(_clDeadlineLabel(r.c)):'')));
  }else if(kind==='overdue'){
    title='Past their deadline';route='allcl';routeLbl='Open All results';
    rows=_clOverview(t).filter(r=>r.state==='Overdue').map(r=>row(
      '<span style="width:32px;height:32px;border-radius:9px;background:var(--c-danger-soft);color:var(--c-danger-ink);display:grid;place-items:center;flex-shrink:0">'+ic('alert','w-4 h-4')+'</span>',
      esc(r.c.name),
      r.prog.done+'/'+r.prog.total+' answers in · due '+esc(_clDeadlineLabel(r.c)||fmtS(t))));
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

/* ===== COMPANY / TEAM DASHBOARD =====
   Deliberately about the WORK: which checklists are running, how far through they are and
   which are late. Per-person performance tables are not part of this build — the audit trail
   on each answer already says who did what, without turning the dashboard into a scoreboard. */
function _dashboardPage(){return homeDash();} // hub: Dashboard = My Day for everyone; Company lives on the 'analytics' sub-tab

function adminDash(){
  const today=todayISO();
  const fSubs=DB.submissions.filter(s=>_inDashRange(s.date));
  const active=DB.users.filter(u=>u.status==='Active').length;
  const pendA=DB.approvals.filter(a=>a.status==='Pending').length;
  const late=fSubs.filter(s=>s.status==='Late').length;
  // Department view stays, but reads as "how much work is landing on time", not per-person.
  const depts=DB.departments.map(d=>{
    const cls=DB.checklists.filter(c=>c.department===d.name).length;
    const ss=fSubs.filter(s=>{const c=clById(s.checklistId);return c&&c.department===d.name;});
    return{name:d.name,cls,total:ss.length,onTime:ss.filter(s=>s.status==='On Time').length,late:ss.filter(s=>s.status==='Late').length};
  }).filter(d=>d.cls||d.total);
  const recent=fSubs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,8);
  return`<div class="fade">${_clOverviewWidget(today)}${hdr('Dashboard',new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}
  ${_dashFilterBar()}
  ${_pulseStrip()}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
    ${statCard('Active people',active,'sky',"App._dashDrill('activeusers')")}${statCard('Pending approvals',pendA,'amber',"App._dashDrill('approvals')")}${statCard('Late submissions',late,'rose',"App._dashDrill('latesubs')")}
  </div>
  ${_clOverviewTable(today,{title:"Today's checklists"})}
  <div class="grid lg:grid-cols-3 gap-4 mt-4">
    <div class="lg:col-span-2 bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
      <div class="px-5 py-3 border-b border-ink-100"><h3 class="fd font-semibold text-sm">On-time rate by department</h3></div>
      <div class="divide-y divide-ink-50">${depts.map(d=>`<div class="px-5 py-3 flex items-center gap-4"><span class="text-sm font-semibold w-32 truncate">${esc(d.name)}</span><div class="flex-1"><div class="pg"><div class="pgf" style="width:${d.total?Math.round(d.onTime/d.total*100):0}%"></div></div></div><span class="text-xs text-ink-400 w-24 text-right shrink-0">${d.cls}cl · ${d.late?`<span class="text-rose-600 font-semibold">${d.late} late</span>`:d.total+' sub'}</span></div>`).join('')||empty('dept','No department activity','Department figures appear here once checklists are submitted.')}</div>
    </div>
    <div class="space-y-4">
      <div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
        <div class="px-4 py-3 border-b border-ink-100 flex justify-between items-center"><h3 class="fd font-semibold text-sm">Recent submissions</h3><button onclick="App.go('allcl')" class="text-xs font-semibold text-brand-700">View all →</button></div>
        <div class="divide-y divide-ink-50">${recent.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);const cName=c?c.name:'[Deleted]';return`<div class="px-4 py-2.5 flex items-center gap-2.5">${u?avatar(u,'w-7 h-7','text-[10px]'):''}<div class="flex-1 min-w-0"><div class="text-xs font-semibold truncate">${esc(cName)}</div><div class="text-[11px] text-ink-400 truncate">${esc(u?fullName(u):'—')} · ${fmtS(s.date)}</div></div>${chip(s.status)}</div>`;}).join('')||empty('check','No submissions yet','Recent checklist submissions will show up here.')}</div>
      </div>
      ${_dashTicketsPanel(null)}
    </div>
  </div>
  </div>`;}

/* ===== MANAGER DASHBOARD ===== */
function mgrDash(){
  const team=subTree(S.uid);if(!team.length)return myClsPage();
  const today=todayISO();
  const pendA=_approvalPendingCount();
  const rows=_clOverview(today);
  const overdue=rows.filter(r=>r.state==='Overdue').length;
  const openTk=(DB.tickets||[]).filter(t=>(t.status==='Open'||t.status==='In Progress')&&team.some(u=>u.id===t.assignedTo)).length;
  return`<div class="fade">${_clOverviewWidget(today)}${hdr('Team Dashboard',team.length+' member'+(team.length!==1?'s':''))}
  ${_dashFilterBar()}
  ${_pulseStrip()}
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
    ${statCard('Team members',team.length,'sky',"App.go('teamview')")}${statCard('Overdue today',overdue,'rose',"App._dashDrill('cl-overdue')")}${statCard('Waiting on you',pendA,'amber',"App.go('approvals')")}${statCard('Open tickets',openTk,'brand',"App.go('tickets')")}
  </div>
  ${_clOverviewTable(today,{title:"Today's checklists"})}
  </div>`;}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._clOverview=_clOverview;window._clOverviewWidget=_clOverviewWidget;window._clOverviewTable=_clOverviewTable;window._CL_STATE_TONE=_CL_STATE_TONE;window._pulseStrip=_pulseStrip;window.DASH_RANGES=DASH_RANGES;window._dashRangeBounds=_dashRangeBounds;window._inDashRange=_inDashRange;window._dashFilterBar=_dashFilterBar;window._dashTicketsPanel=_dashTicketsPanel;window._dashboardPage=_dashboardPage;window.adminDash=adminDash;window.mgrDash=mgrDash;
