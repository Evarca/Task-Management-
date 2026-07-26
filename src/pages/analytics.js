

App._aStatCard=(label,val,color,type,data)=>{
  const colMap={sky:'#0EA5E9',brand:'#0E9F6E',rose:'#EF4444',orange:'#F97316'};
  const c=colMap[color]||color;
  return`<div class="stat-card-click" onclick="App._aStatDrill('${type}')" data-col="${c}" style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px;cursor:pointer;transition:border-color .15s,box-shadow .15s">`
  +`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);margin-bottom:10px">${label}</div><div class="fd" style="font-size:30px;font-weight:800;line-height:1;color:${c}">${val}</div><div style="font-size:12px;color:var(--c-text-3);margin-top:8px;display:flex;align-items:center;gap:3px">Details ${ic('chevR','w-3 h-3')}</div></div>`;
};

App._aStatDrill=(type)=>{
  const f=S.filters;
  const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  let subs=DB.submissions;
  if(!isAdmin()){const _sc=_reportScopeIds();subs=subs.filter(s=>_sc.has(s.userId));}
  if(fArr('users').length)subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('deps').includes(c.department);});
  if(fArr('locs').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('locs').some(l=>(c.locationIds||[]).includes(l));});
  if(fArr('stats').length)subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1)subs=subs.filter(s=>s.date>=f.dr1);
  if(f.dr2)subs=subs.filter(s=>s.date<=f.dr2);
  let aTickets=(DB.tickets||[]).slice();
  if(!isAdmin()){
    // Both manager and user: only tickets assigned to them
    aTickets=aTickets.filter(t=>t.assignedTo===S.uid);
  }
  if(f.dr1)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')>=f.dr1);
  if(f.dr2)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')<=f.dr2);
  const today=todayISO();
  let title='',rows='',emptyMsg='No data.';
  const subRow=s=>{
    const u=uById(s.userId),c=clById(s.checklistId);
    const extra=s.submittedAt?' · '+new Date(s.submittedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
    return'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App.viewSub(\''+s.id+'\')" onmouseover="this.style.background=\'var(--c-surface-2)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+(c?esc(c.name):'<span style="color:var(--c-danger);font-style:italic">[Deleted checklist]</span>')+'</div>'
      +'<div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+(u?esc(fullName(u)):'?')+' · '+fmtS(s.date)+extra+'</div>'
      +'</div>'+chip(s.status)+'</div>';
  };
  if(type==='submitted'){
    const list=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='All Submissions ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No submissions in this period.';
  } else if(type==='ontime'){
    const list=subs.filter(s=>s.status==='On Time').sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='On Time ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No on-time submissions.';
  } else if(type==='late'){
    const list=subs.filter(s=>s.status==='Late').sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='Late ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No late submissions.';
  } else if(type==='missed'){
    const relevantUsers=isAdmin()?DB.users:DB.users.filter(u=>_reportScopeIds().has(u.id));
    const dr1=f.dr1||(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
    const dr2=f.dr2||today;
    const dateRange=[];
    let d=new Date(dr1+'T00:00:00');const dEnd=new Date(dr2+'T00:00:00');
    while(d<=dEnd&&dateRange.length<60){dateRange.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
    const missed=[];
    const _seenGrp=new Set(); // anyOne checklists are collective → list once per date
    relevantUsers.forEach(u=>{
      dateRange.forEach(dt=>{
        if(dt>=today)return;
        DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,dt)&&c.status!=='Draft').forEach(c=>{
          // For "any one" group checklists, a completion by ANY assignee counts for everyone —
          // so it's only "missed" if nobody in the group submitted. Otherwise check own submission.
          const done=c.anyOne
            ? DB.submissions.some(s=>s.checklistId===c.id&&s.date===dt&&s.status!=='Editing')
            : !!DB.submissions.find(s=>s.checklistId===c.id&&s.userId===u.id&&s.date===dt);
          if(done)return;
          if(c.anyOne){
            const k=c.id+'|'+dt;
            if(_seenGrp.has(k))return; // already listed this group checklist for this date
            _seenGrp.add(k);
            missed.push({u:null,c,dt}); // group → no single owner
          } else {
            missed.push({u,c,dt});
          }
        });
      });
    });
    title='Missed ('+missed.length+')';
    rows=missed.slice(0,100).map(({u,c,dt})=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border)"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text)">'+esc(c.name)+(c.anyOne?' <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;background:var(--c-info-soft);color:var(--c-info-ink);display:inline-flex;align-items:center;gap:3px;vertical-align:middle">'+ic('users','w-3 h-3')+'Group</span>':'')+'</div><div style="font-size:11px;color:var(--c-text-3)">'+(u?esc(fullName(u)):'No one in group completed')+' · '+fmtS(dt)+'</div></div><span style="font-size:11px;font-weight:700;color:var(--c-warn);background:var(--c-warn-soft);padding:2px 8px;border-radius:20px">Missed</span></div>').join('');
    emptyMsg='No missed checklists in this period.';
  } else if(type==='compliant'||type==='noncompliant'){
    const want=type==='noncompliant';
    const list=subs.map(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return null;const n=_subEscalationCount(c,s);return{s,c,n};})
      .filter(x=>x&&((x.n>0)===want))
      .sort((a,b)=>want?(b.n-a.n)||((b.s.submittedAt||'').localeCompare(a.s.submittedAt||'')):(b.s.submittedAt||'').localeCompare(a.s.submittedAt||''));
    title=(want?'Non-compliant':'Compliant')+' ('+list.length+')';
    rows=list.map(({s,c,n})=>{const u=uById(s.userId);return'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App.viewSub(\''+s.id+'\')" onmouseover="this.style.background=\'var(--c-surface-2)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(c.name)+'</div>'
      +'<div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+(u?esc(fullName(u)):'?')+' · '+fmtS(s.date)+'</div></div>'
      +(want
        ? '<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink)">'+ic('alert','w-3 h-3')+n+' escalated</span>'
        : '<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-success-soft);color:var(--c-success-ink)">'+ic('check','w-3 h-3')+'Compliant</span>')
      +'</div>';}).join('');
    emptyMsg=want?'No non-compliant submissions in this period — all clear.':'No compliant submissions in this period.';
  } else {
    const tkMap={tickets:aTickets,tkopen:aTickets.filter(t=>t.status==='Open'),tkhigh:aTickets.filter(t=>t.priority==='High'||t.priority==='Critical'),tkresolved:aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed')};
    const tkLabels={tickets:'All Tickets',tkopen:'Open Tickets',tkhigh:'High Priority Tickets',tkresolved:'Resolved Tickets'};
    const list=(tkMap[type]||[]).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    title=(tkLabels[type]||'Tickets')+' ('+list.length+')';
    const priClr={High:'#DC2626',Medium:'#F59E0B',Low:'#6B7280',Critical:'#7C3AED'};
    rows=list.map(t=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border)"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(t.title)+'</div><div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+(uById(t.submitterId)?'From '+esc(fullName(uById(t.submitterId))):'')+' → '+(uById(t.assignedTo)?esc(fullName(uById(t.assignedTo))):'?')+' · '+fmtS(t.date||t.createdAt?.slice(0,10)||'')+'</div></div><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:'+(priClr[t.priority]||'#6B7280')+'">'+esc(t.priority)+'</span>'+chip(t.status)+'</div>').join('');
    emptyMsg='No tickets in this category.';
  }
  modalShell({title,size:'max-w-lg',
    body:'<div style="margin:-20px">'+(rows||'<div style="padding:32px;text-align:center;color:var(--c-text-3);font-size:13px">'+emptyMsg+'</div>')+'</div>'});
};

window._AData=null;window._AFiltered=null;window._aCharts=[];
// Who the dashboard analytics can see — the SAME reports-permission scope HRM Analytics uses, so the
// two pages always show the same set of people (instead of a hard-coded reporting subtree).
function _reportScopeIds(){const s=new Set(scopedUsers('reports').map(u=>u.id));s.add(S.uid);return s;}
/* ── THE CLIENT BOARD ──
   For a business-setup company the question is never "how did employees do" but "where does
   each client stand". One row per client with live case work: average progress, what's blocked,
   what's overdue, the next deadline. Tap a row for the full client file. */
/* ── Billing at a glance (round 9): only for people who can see money ── */
function _billingStrip(){
  if(typeof canBillView!=='function'||!canBillView())return'';
  const ids=Object.keys(DB.tmBilling||{});
  const anyPay=(DB.tmPayments||[]).length;
  if(!ids.length&&!anyPay)return'';
  const ym=todayISO().slice(0,7);
  let totalV=0,paidV=0;
  ids.forEach(id=>{const b=DB.tmBilling[id];totalV+=Number(b.total)||0;});
  (DB.tmPayments||[]).forEach(p=>{paidV+=Number(p.amount)||0;});
  const outstanding=Math.max(0,totalV-paidV);
  const collectedM=(DB.tmPayments||[]).filter(p=>String(p.paidOn||'').slice(0,7)===ym).reduce((a,p)=>a+(Number(p.amount)||0),0);
  const invsM=(DB.tmInvoices||[]).filter(v=>v.status!=='Void'&&String(v.issuedOn||'').slice(0,7)===ym);
  const cur=_invDefaults().currency||'AED';
  const tile=(lbl,val,color)=>`<div onclick="S.route='locations';render()" style="flex:1;min-width:150px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;box-shadow:var(--sh-sm);padding:10px 14px;cursor:pointer">
    <div style="font-size:9.5px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em">${lbl}</div>
    <div style="font-size:16.5px;font-weight:800;margin-top:2px;color:${color||'var(--c-text)'}">${esc(val)}</div></div>`;
  return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
    ${tile('Engagements total',fmtMoney(totalV,cur))}
    ${tile('Collected — all time',fmtMoney(paidV,cur),'#0B7A55')}
    ${tile('Outstanding',fmtMoney(outstanding,cur),outstanding>0?'#B45309':'#0B7A55')}
    ${tile('Collected this month',fmtMoney(collectedM,cur),'#0B7A55')}
    ${tile('Invoices this month',invsM.length+(invsM.length?' · '+fmtMoney(invsM.reduce((a,v)=>a+(Number(v.total)||0),0),cur):''))}
  </div>`;
}
function _clientCasesSection(){
  const today=todayISO();
  const rows=[];
  let kOpen=0,kDue7=0,kOver=0,kBlocked=0;
  (DB.locations||[]).filter(l=>l.status!=='Inactive').forEach(l=>{
    const cases=(DB.checklists||[]).filter(c=>isCase(c)&&c.status!=='Draft'&&(c.locationIds||[]).includes(l.id));
    const open=cases.filter(c=>!caseSub(c));
    if(!open.length)return;
    let pctSum=0,blocked=0,over=0,nextDl=null;
    open.forEach(c=>{
      const cd=caseDate(c);
      const pr=_ansProgress(c,cd);pctSum+=pr.total?pr.done/pr.total:0;
      if(_clOverdue(c,cd))over++;
      const dl=_clDeadlineDate(c.id);
      if(dl){if(!nextDl||dl<nextDl)nextDl=dl;
        const in7=(new Date(dl+'T00:00:00')-new Date(today+'T00:00:00'))/86400000;
        if(in7>=0&&in7<=7)kDue7++;}
      _clQuestions(c).forEach(q=>{const a2=_ansFor(c.id,cd,q.id);if(a2&&a2.response!==null&&a2.response!=='')return;
        const st=_qStatusOf(c.id,cd,q.id);if(st&&st.status!=='in_progress')blocked++;});
    });
    kOpen+=open.length;kOver+=over;kBlocked+=blocked;
    rows.push({l,open:open.length,pct:Math.round(pctSum/open.length*100),blocked,over,nextDl});
  });
  if(!rows.length)return'';
  rows.sort((a,b)=>(b.over-a.over)||(b.blocked-a.blocked)||(a.pct-b.pct));
  const kpi=(n,label,tone)=>`<div style="flex:1;min-width:110px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:10px 14px">
    <div style="font-size:20px;font-weight:800;color:${tone||'var(--c-text)'}">${n}</div>
    <div style="font-size:11px;font-weight:700;color:var(--c-text-3)">${label}</div></div>`;
  return `<div style="margin-bottom:14px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      ${kpi(kOpen,'Open cases')}${kpi(kDue7,'Due in 7 days',kDue7?'#B45309':null)}${kpi(kOver,'Overdue',kOver?'#B91C1C':null)}${kpi(kBlocked,'Blocked steps',kBlocked?'#92400E':null)}
    </div>
    <div class="ui-card" style="overflow:hidden">
      <div style="padding:12px 16px 8px;font-size:12.5px;font-weight:800">${ic('pin','w-4 h-4 inline')} Where each client stands</div>
      ${rows.map(r=>`<div onclick="App._openClientFile('${r.l.id}')" style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--c-border);cursor:pointer" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.l.name)}</div>
          <div style="font-size:11px;color:var(--c-text-3)">${r.open} open case${r.open===1?'':'s'}${r.nextDl?' · next deadline '+fmtS(r.nextDl):''}</div>
        </div>
        ${r.over?`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;background:#FEE2E2;color:#B91C1C">${r.over} OVERDUE</span>`:''}
        ${r.blocked?`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;background:#FEF3C7;color:#92400E">${r.blocked} blocked</span>`:''}
        <div style="flex:0 0 120px;display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:7px;border-radius:99px;background:var(--c-surface-2);overflow:hidden"><div style="height:100%;width:${r.pct}%;border-radius:99px;background:${r.over?'#EF4444':r.blocked?'#F59E0B':'#0EA5E9'}"></div></div>
          <span style="font-size:12px;font-weight:800;color:var(--c-text-2)">${r.pct}%</span>
        </div>
        <span style="color:var(--c-text-3)">${ic('chevR','w-4 h-4')}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

function analyticsPage(){
  const today=todayISO();
  // Collect all relevant submissions
  let subs=DB.submissions;
  if(!isAdmin()){const _sc=_reportScopeIds();subs=subs.filter(s=>_sc.has(s.userId));}
  const f=S.filters;
  const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  if(fArr('users').length)  subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)   subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('deps').includes(c.department);});
  if(fArr('locs').length)   subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('locs').some(l=>(c.locationIds||[]).includes(l));});
  if(fArr('stats').length)  subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1) subs=subs.filter(s=>s.date>=f.dr1);
  if(f.dr2) subs=subs.filter(s=>s.date<=f.dr2);

  // Ticket stats for analytics
  let aTickets=(DB.tickets||[]).slice();
  if(!isAdmin()){
    // Both manager and user: only tickets assigned to them
    aTickets=aTickets.filter(t=>t.assignedTo===S.uid);
  }
  if(f.dr1)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')>=f.dr1);
  if(f.dr2)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')<=f.dr2);
  const tkOpen=aTickets.filter(t=>t.status==='Open').length;
  const tkResolved=aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed').length;
  const tkHigh=aTickets.filter(t=>t.priority==='High'||t.priority==='Critical').length;
  const tot=Math.max(subs.length,1);
  const byS={'On Time':0,'Late':0,'Pending Approval':0,'Rejected':0,'Pending (not submitted)':0};
  subs.forEach(s=>{if(byS[s.status]!==undefined)byS[s.status]++;else byS['Pending (not submitted)']++;});
  // ── Compliance over the filtered submissions (computed from answers → covers old data) ──
  let compliantN=0,nonCompliantN=0,totalEscalations=0;
  subs.forEach(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return;const n=_subEscalationCount(c,s);if(n>0){nonCompliantN++;totalEscalations+=n;}else{compliantN++;}});

  // Count missed (assigned but no submission for past dates)
  const relevantUsers=isAdmin()?DB.users:DB.users.filter(u=>_reportScopeIds().has(u.id));
  const dateRange=[];
  const dr1=f.dr1||(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  const dr2=f.dr2||today;
  let d=new Date(dr1+'T00:00:00');const dEnd=new Date(dr2+'T00:00:00');
  while(d<=dEnd&&dateRange.length<60){dateRange.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
  let totalAssigned=0,totalMissed=0;const _missedList=[];
  relevantUsers.forEach(u=>{
    if(fArr('users').length&&!fArr('users').includes(u.id))return;
    dateRange.forEach(dt=>{
      const cls=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,dt)&&c.status!=='Draft');
      cls.forEach(c=>{
        totalAssigned++;
        // For "any one" group checklists, a submission by ANY assignee completes it for
        // everyone — so it's only "missed" if nobody submitted (Fix #2).
        const _done=c.anyOne
          ? DB.submissions.some(s=>s.checklistId===c.id&&s.date===dt&&s.status!=='Editing')
          : !!DB.submissions.find(s=>s.checklistId===c.id&&s.userId===u.id&&s.date===dt);
        if(!_done&&dt<today){
          totalMissed++;
          _missedList.push({userId:u.id,checklistId:c.id,date:dt});
        }
      });
    });
  });

  const recent=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,50);
  const activeCount=fArr('users').length+fArr('deps').length+fArr('locs').length+fArr('stats').length+(f.dr1?1:0)+(f.dr2?1:0);

  function msDropdown(label,key,items,getId,getLabel){
    const sel=fArr(key);const isOpen=S.afOpen===key;
    const txt=sel.length===0?'All':sel.length===1?getLabel(items.find(x=>getId(x)===sel[0])||items[0])||'?':sel.length+' selected';
    return`<div data-af="1" style="position:relative;flex:1;min-width:120px">
      <button data-af="1" type="button" onclick="S.afOpen=S.afOpen==='${key}'?null:'${key}';rr()"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--c-surface);border:1px solid ${isOpen?'var(--c-brand)':sel.length?'var(--c-text)':'var(--c-border)'};border-radius:10px;padding:8px 12px;font-size:13px;font-weight:${sel.length?600:400};color:${sel.length?'var(--c-text)':'var(--c-text-3)'};cursor:pointer">
        <span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(label+(sel.length?': '+txt:''))}</span>
        <span style="color:var(--c-text-3);transform:rotate(${isOpen?180:0}deg);transition:transform .15s;flex-shrink:0">${ic('chevD','w-4 h-4')}</span>
      </button>
      ${isOpen?`<div data-af="1" style="position:absolute;top:calc(100%+4px);left:0;right:0;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;box-shadow:var(--sh-pop);z-index:100;max-height:220px;overflow-y:auto;padding:6px">
        ${sel.length?`<button data-af="1" onclick="delete S.filters['${key}'];rr()" style="width:100%;text-align:left;padding:6px 10px;font-size:12px;font-weight:600;color:var(--c-rose,#E11D48);background:none;border:none;cursor:pointer;border-radius:8px">Clear selection</button><div style="height:1px;background:var(--c-border);margin:4px 0"></div>`:''}
        ${items.map(item=>{const id=getId(item);const nm=getLabel(item)||'?';const on=sel.includes(id);return`<button data-af="1" type="button" onclick="App._togF('${key}','${id}')"
          style="width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:none;cursor:pointer;background:${on?'var(--c-brand-soft)':'transparent'};text-align:left">
          <div style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${on?'var(--c-brand)':'var(--c-border)'};background:${on?'var(--c-brand)':'var(--c-surface)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${on?`<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>`:''}
          </div>
          <span style="font-size:13px;font-weight:${on?600:400};color:${on?'var(--c-text)':'var(--c-text-2)'}">${esc(nm)}</span>
        </button>`;}).join('')}
      </div>`:''}
    </div>`;
  }
  

  // ── Pending approvals (scoped) + the chart datasets behind the live visuals ──
  const _pendA=(DB.approvals||[]).filter(a=>a.status==='Pending'&&(isAdmin()||relevantUsers.some(u=>u.id===a.requesterId))).length;
  const _trendLabels=dateRange.map(d=>d.slice(5));
  const _dateMap={};dateRange.forEach(d=>{_dateMap[d.slice(5)]=d;});
  const _depMap={};subs.forEach(s=>{const c=clById(s.checklistId);if(!c)return;const dn=c.department||'—';(_depMap[dn]=_depMap[dn]||{t:0,ot:0});_depMap[dn].t++;if(s.status==='On Time')_depMap[dn].ot++;});
  const _depArr=Object.keys(_depMap).map(k=>({name:k,t:_depMap[k].t,ot:_depMap[k].ot})).sort((a,b)=>b.t-a.t).slice(0,8);
  // compliant / non-compliant submission LISTS (for click-to-drill)
  const _comp=[],_noncomp=[];subs.forEach(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return;(_subEscalationCount(c,s)>0?_noncomp:_comp).push(s);});
  _AData={
    status:{labels:['On Time','Late','Pending Approval','Rejected','Missed'],data:[byS['On Time']||0,byS['Late']||0,byS['Pending Approval']||0,byS['Rejected']||0,totalMissed],colors:['#10B981','#EF4444','#F97316','#9F1239','#F59E0B']},
    trend:{labels:_trendLabels,sub:dateRange.map(dt=>subs.filter(s=>s.date===dt).length),ontime:dateRange.map(dt=>subs.filter(s=>s.date===dt&&s.status==='On Time').length),late:dateRange.map(dt=>subs.filter(s=>s.date===dt&&s.status==='Late').length)},
    dept:{labels:_depArr.map(d=>d.name),total:_depArr.map(d=>d.t),onTime:_depArr.map(d=>d.ot)},
    tickets:{labels:['Open','In Progress','Resolved'],data:[aTickets.filter(t=>t.status==='Open').length,aTickets.filter(t=>t.status==='In Progress').length,aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed').length],colors:['#F59E0B','#0EA5E9','#0E9F6E']},
    compliance:{labels:['Compliant','Non-compliant'],data:[compliantN,nonCompliantN],colors:['#0E9F6E','#BE123C']},
    // PRO-VIZ: submission volume by weekday (vertical gradient bars).
    weekday:(()=>{const names=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];const n=[0,0,0,0,0,0,0];subs.forEach(s=>{if(!s.date)return;const d=new Date(s.date+'T00:00:00').getDay();n[(d+6)%7]++;});return{labels:names,data:n};})()
  };
  _AFiltered={subs:subs.slice(),tickets:aTickets.slice(),missed:_missedList,compliant:_comp,nonCompliant:_noncomp,dateMap:_dateMap};
  // Company hero: today's headline figures (permission-scoped — relevantUsers already honors the report scope)
  const _hero=(()=>{try{
    const scope=relevantUsers.filter(x=>x.status==='Active');
    const dueToday=(DB.checklists||[]).filter(c=>clOn(c,today)&&(c.assignees||[]).some(a=>scope.some(x=>x.id===a)));
    let dueN=0,doneN=0,overdueN=0;
    const nowM=nowHM();
    dueToday.forEach(c=>{
      (c.assignees||[]).forEach(aid=>{
        if(!scope.some(x=>x.id===aid))return;
        dueN++;
        if(subForCl(c,aid,today))doneN++;
        else if(c.scheduleTime&&nowM>hm2m(c.scheduleTime))overdueN++;
      });
    });
    const onT=byS['On Time'],ltN=byS['Late'];const rate=(onT+ltN)?Math.round(onT/(onT+ltN)*100):null;
    const pendA=(DB.approvals||[]).filter(a=>a.status==='Pending').length;
    const k=(v,l,c,icn,ibg,iik,drill)=>`<div ${drill?`onclick="App._dashDrill('${drill}')" role="button" tabindex="0" title="Tap for the list"`:''} style="flex:1;min-width:150px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:12px 14px;box-shadow:var(--sh-sm);display:flex;align-items:center;gap:11px;${drill?'cursor:pointer':''}"><span style="width:38px;height:38px;border-radius:11px;background:${ibg||'var(--c-surface-2)'};color:${iik||'var(--c-text-2)'};display:grid;place-items:center;flex-shrink:0">${ic(icn||'chart','w-5 h-5')}</span><span style="min-width:0"><span class="fd" style="display:block;font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1.05;color:${c||'var(--c-text)'}">${v}</span><span style="display:block;font-size:10.5px;font-weight:700;color:var(--c-text-2);margin-top:3px;white-space:nowrap">${l}</span></span></div>`;
    return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${k(scope.length,'Active people',undefined,'users',undefined,undefined,'activeusers')}${k(doneN+'/'+dueN,'Done today','var(--c-success-ink)','check','var(--c-success-soft)','var(--c-success-ink)','day-done')}${k(overdueN,'Past deadline',overdueN?'var(--c-danger-ink)':undefined,'alert',overdueN?'var(--c-danger-soft)':undefined,overdueN?'var(--c-danger-ink)':undefined,'overdue')}${k(pendA,'Approvals waiting',pendA?'#B45309':undefined,'approve',pendA?'#FFFBEB':undefined,pendA?'#B45309':undefined,'approvals')}${rate!=null?k(rate+'%','On-time rate','var(--c-brand-ink)','check','var(--c-brand-soft)','var(--c-brand-ink)'):''}${k(tkOpen,'Open tickets',tkOpen?'#B45309':undefined,'ticket',tkOpen?'#FFF7ED':undefined,tkOpen?'#C2410C':undefined,'tickets')}</div>`;
  }catch(e){return'';}})();
  const _cc='background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px';
  const _ct='font-size:14px;font-weight:700;color:var(--c-text);margin-bottom:12px';
  const _view=S.dashView==='details'?'details':'visuals';
  const _stb=(v,lbl,icn)=>`<button onclick="S.dashView='${v}';rr()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid ${_view===v?'var(--c-text)':'var(--c-border)'};background:${_view===v?'var(--c-text)':'var(--c-surface)'};color:${_view===v?'#fff':'var(--c-text-2)'};font-size:13px;font-weight:700;cursor:pointer">${ic(icn,'w-4 h-4')}${lbl}</button>`;
  const _subTab=`<div class="hscroll" style="gap:8px;margin-bottom:14px">${_stb('visuals','Visuals','chart')}${_stb('details','Details','list')}</div>`;

  return`<div class="fade" onclick="(function(e){if(S.afOpen&&!e.target.closest('[data-af]')){S.afOpen=null;rr();}})(event)">
  ${hdr('Company',new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}
  ${typeof _pulseStrip==='function'?_pulseStrip():''}
  ${_billingStrip()}
  ${_clientCasesSection()}
  ${typeof _clOverviewWidget==='function'?_clOverviewWidget(today):''}
  <!-- Filter bar -->
  <div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:14px 16px;margin-bottom:14px;position:sticky;top:0;z-index:20">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      ${msDropdown('Status','stats',['On Time','Late','Pending Approval','Rejected'],s=>s,s=>s)}
      ${msDropdown('Department','deps',DB.departments,d=>d.name,d=>d.name)}
      ${msDropdown('Team member','users',relevantUsers,u=>u.id,u=>fullName(u))}
      ${DB.locations.length?msDropdown('Client','locs',DB.locations,l=>l.id,l=>l.name):''}
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:220px">
        <input type="date" value="${f.dr1||''}" onchange="S.filters.dr1=this.value;rr()" style="flex:1;min-width:0;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:8px;padding:7px 10px;font-size:13px;outline:none;color:var(--c-text)"/>
        <span style="color:var(--c-text-3)">to</span>
        <input type="date" value="${f.dr2||''}" onchange="S.filters.dr2=this.value;rr()" style="flex:1;min-width:0;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:8px;padding:7px 10px;font-size:13px;outline:none;color:var(--c-text)"/>
      </div>

      ${activeCount?btn('Clear ('+activeCount+')','S.filters={};S.afOpen=null;rr()',{variant:'ghost',size:'sm'}):''}
      ${btnG('Export','App._exportReport()','download')}
    </div>
  </div>

  ${_subTab}
  ${_view==='details'?`
  <!-- Stats row 1: submissions (all clickable) -->
  <div class="astat-grid" style="margin-bottom:8px">
    ${App._aStatCard('Submitted',subs.length,'sky','submitted',subs)}
    ${App._aStatCard('On time',byS['On Time']||0,'brand','ontime',subs.filter(s=>s.status==='On Time'))}
    ${App._aStatCard('Late',byS['Late']||0,'rose','late',subs.filter(s=>s.status==='Late'&&!!clById(s.checklistId)))}
    ${App._aStatCard('Missed',totalMissed,'orange','missed',null)}
  </div>
  <!-- Stats row 2: tickets (all clickable) -->
  <div class="astat-grid" style="margin-bottom:8px">
    ${App._aStatCard('Tickets',aTickets.length,'#F97316','tickets',aTickets)}
    ${App._aStatCard('Open',tkOpen,'#F59E0B','tkopen',aTickets.filter(t=>t.status==='Open'))}
    ${App._aStatCard('High Priority',tkHigh,'#DC2626','tkhigh',aTickets.filter(t=>t.priority==='High'||t.priority==='Critical'))}
    ${App._aStatCard('Resolved',tkResolved,'#0E9F6E','tkresolved',aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed'))}
  </div>
  <!-- Stats row 3: compliance + pending approvals -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    ${App._aStatCard('Compliant',compliantN,'#0E9F6E','compliant',null)}
    ${App._aStatCard('Non-compliant',nonCompliantN,'#BE123C','noncompliant',null)}
    <div onclick="App.go('approvals')" style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px;cursor:pointer"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);margin-bottom:10px">Pending approvals</div><div class="fd" style="font-size:30px;font-weight:800;line-height:1;color:#F59E0B">${_pendA}</div><div style="font-size:12px;color:var(--c-text-3);margin-top:8px;display:flex;align-items:center;gap:3px">Open approvals ${ic('chevR','w-3 h-3')}</div></div>
  </div>
  `:''}
  ${_view==='visuals'?`
  <!-- Live charts (update with every filter) -->
  <div class="achart-grid" style="margin-bottom:14px">
    <div style="${_cc}"><div class="fd" style="${_ct}">Status breakdown</div><div style="position:relative;height:230px"><canvas id="aChartStatus" data-chart="status"></canvas></div></div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Submissions over time</div><div style="position:relative;height:230px"><canvas id="aChartTrend" data-chart="submissions-over-time"></canvas></div></div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Department performance</div><div style="position:relative;height:230px"><canvas id="aChartDept" data-chart="department"></canvas></div></div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Tickets</div><div style="position:relative;height:230px"><canvas id="aChartTickets" data-chart="tickets"></canvas></div></div>
  </div>
  <div class="achart-grid" style="margin-bottom:14px">
    <div style="${_cc}"><div class="fd" style="${_ct}">Compliance</div>${(compliantN+nonCompliantN)?`<div style="position:relative;height:210px"><canvas id="aChartCompliance" data-chart="compliance"></canvas></div>`:`<div style="height:210px;display:grid;place-items:center;font-size:12.5px;color:var(--c-text-3);text-align:center;padding:0 20px">No submitted checklists in this range yet.<br/>Compliance appears once work is submitted.</div>`}</div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Submissions by weekday</div><div style="position:relative;height:210px"><canvas id="aChartWeekday" data-chart="weekday"></canvas></div></div>
  </div>
  ${typeof _clOverviewTable==='function'?_clOverviewTable(today,{title:"Today's checklists"}):''}
  `:''}
  ${_view==='details'?`
  ${typeof _clOverviewTable==='function'?_clOverviewTable(today,{title:"Today's checklists"}):''}

  <!-- Table -->
  <div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--c-border);display:flex;justify-content:space-between;align-items:center">
      <span class="fd" style="font-size:14px;font-weight:700;color:var(--c-text)">Submissions (${subs.length})</span>
      ${btnG('Export CSV','App._exportCSV()','download')}
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:1px solid var(--c-border)">
        ${['User','Checklist','Dept','Date','Status','Answered','Compliance'].map(h=>`<th style="padding:9px 16px;font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${recent.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return'';const qCount=(s.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length;if(!c)return`<tr style="border-bottom:1px solid var(--c-border);opacity:.5"><td style="padding:9px 16px" colspan="7"><span style="font-size:12px;color:var(--c-text-3)">${esc(fullName(u))} — deleted checklist — ${fmtS(s.date)}</span></td></tr>`;const _qTot=(c.questionIds||[]).length;const _esc=_qTot?_subEscalationCount(c,s):0;return`<tr style="border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App.viewSub('${s.id}')" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background=''">
        <td style="padding:9px 16px"><div style="display:flex;align-items:center;gap:7px;cursor:pointer" onclick="event.stopPropagation();App._userDrill('${u.id}')">${avatar(u,'w-7 h-7','text-[10px]')}<span style="font-weight:500;color:var(--c-text);text-decoration:underline;text-decoration-color:var(--c-border)">${esc(fullName(u))}</span></div></td>
        <td style="padding:9px 16px;max-width:140px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--c-text)">${esc(c.name)}</td>
        <td style="padding:9px 16px;color:var(--c-text-3);font-size:12px">${esc(c.department)}</td>
        <td style="padding:9px 16px;color:var(--c-text-3);font-size:12px;white-space:nowrap">${fmtS(s.date)}</td>
        <td style="padding:9px 16px">${chip(s.status)}</td>
        <td style="padding:9px 16px">${qCount?`<span style="font-size:12px;font-weight:700;color:var(--c-brand)">${qCount}/${_qTot}</span>`:'<span style="color:var(--c-text-3)">—</span>'}</td>
        <td style="padding:9px 16px">${_qTot?(_esc>0?`<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink);white-space:nowrap">${ic('alert','w-3 h-3')}${_esc}</span>`:`<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-success-soft);color:var(--c-success-ink);white-space:nowrap">${ic('check','w-3 h-3')}</span>`):'<span style="color:var(--c-text-3)">—</span>'}</td>
      </tr>`;}).join('')}</tbody>
    </table>${recent.length?'':empty('chart','No submissions match','Adjust filters or date range')}</div>
  </div>
  `:''}</div>`;
}


App._viewSubById=(id)=>App.viewSub(id);
App._userDrill=(uid)=>{
  const u=uById(uid);if(!u)return;
  let subs=DB.submissions.filter(s=>s.userId===uid);
  const today=todayISO();
  const dr1=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  subs=subs.filter(s=>s.date>=dr1);
  const tot=subs.length;
  const onTime=subs.filter(s=>s.status==='On Time').length;
  const late=subs.filter(s=>s.status==='Late'&&!!clById(s.checklistId)).length;
  const pending=subs.filter(s=>s.status==='Pending Approval').length;
  const rejected=subs.filter(s=>s.status==='Rejected').length;
  const issues=subs.reduce((n,s)=>n+(s.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length,0);
  const nonComp=subs.reduce((n,s)=>{const c=clById(s.checklistId);return n+((c&&(c.questionIds||[]).length&&_subEscalationCount(c,s)>0)?1:0);},0);
  const pct=tot?Math.round(onTime/tot*100):0;
  const recent=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,10);
  modalShell({title:fullName(u),sub:(u.position||'')+' · '+(u.department||''),size:'max-w-md',
    body:''
    // Score
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
    +[['Submitted',tot,'var(--c-text)'],['On time',onTime,'#059669'],['Late',late,'#DC2626'],['Pending',pending,'#F97316'],['Non-compliant',nonComp,'#BE123C'],['Answered',issues,'#0E9F6E']].map(([l,v,c])=>'<div style="background:var(--c-surface-2);border-radius:12px;padding:12px;text-align:center"><div class="fd" style="font-size:22px;font-weight:800;color:'+c+'">'+v+'</div><div style="font-size:11px;font-weight:600;color:var(--c-text-3);margin-top:2px">'+l+'</div></div>').join('')
    +'</div>'
    // Completion rate bar
    +'<div style="background:var(--c-surface-2);border-radius:12px;padding:12px;margin-bottom:16px">'
    +'<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px"><span style="color:var(--c-text)">On-time rate (last 30d)</span><span style="color:'+(pct>=80?'#059669':pct>=60?'#F97316':'#DC2626')+'">'+pct+'%</span></div>'
    +'<div style="height:6px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct>=80?'#059669':pct>=60?'#F97316':'#DC2626')+';border-radius:3px;transition:width .5s"></div></div>'
    +'</div>'
    // Recent submissions
    +'<div class="fd" style="font-size:13px;font-weight:700;color:var(--c-text);margin-bottom:8px">Recent submissions</div>'
    +(recent.length
      ? recent.map(s=>{const c=clById(s.checklistId);const _esc=(c&&(c.questionIds||[]).length)?_subEscalationCount(c,s):0;const _comp=(c&&(c.questionIds||[]).length)?(_esc>0?'<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink);white-space:nowrap">'+ic('alert','w-3 h-3')+_esc+'</span>':'<span style="display:inline-flex;align-items:center;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--c-success-soft);color:var(--c-success-ink)">'+ic('check','w-3 h-3')+'</span>'):'';return'<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App._viewSubById(this.dataset.id)" data-id="'+s.id+'">'+'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(c?.name||'—')+'</div><div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+fmtS(s.date)+'</div></div>'+_comp+chip(s.status)+'</div>';}).join('')
      : '<p style="font-size:13px;color:var(--c-text-3)">No submissions in last 30 days</p>'
    )});
};
App._togF=(key,val)=>{
  if(!S.filters)S.filters={};
  if(!S.filters[key])S.filters[key]=[];
  if(!Array.isArray(S.filters[key]))S.filters[key]=[S.filters[key]];
  const idx=S.filters[key].indexOf(val);
  if(idx>-1)S.filters[key].splice(idx,1);
  else S.filters[key].push(val);
  if(!S.filters[key].length)delete S.filters[key];
  S.afOpen=key; // keep dropdown open
  rr();
};

function _csvDownload(rows,filenamePrefix){
  const csv=rows.map(r=>r.map(v=>{let c=String(v??'');
    // Neutralize CSV formula injection (= + - @ tab CR → text).
    if(/^[=+\-@\t\r]/.test(c))c="'"+c;
    return '"'+c.replace(/"/g,'""')+'"';}).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
  a.download=(filenamePrefix||'evarca_report')+'_'+todayISO()+'.csv';
  a.click();
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._reportScopeIds=_reportScopeIds;window.analyticsPage=analyticsPage;window._billingStrip=_billingStrip;window._clientCasesSection=_clientCasesSection;window._csvDownload=_csvDownload;
