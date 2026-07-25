

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

  // ── MY WORK: how my own submissions have gone over a pickable range (defaults to this month) ──
  const _mwF=S.filters.myWorkFrom||(today.slice(0,8)+'01');
  const _mwT=(S.filters.myWorkTo&&S.filters.myWorkTo>=_mwF)?S.filters.myWorkTo:today;
  const MW=(()=>{
    const out={assigned:0,onTime:0,late:0,pendingApproval:0,rejected:0,missed:0,days:0};
    let d=_mwF,g=0;
    while(d<=_mwT&&g++<400){
      const cls=myCls(S.uid,d);
      if(cls.length)out.days++;
      cls.forEach(c=>{
        out.assigned++;
        const sub=subForCl(c,S.uid,d);
        if(!sub){if(d<today)out.missed++;return;}
        if(sub.status==='Late')out.late++;
        else if(sub.status==='Rejected')out.rejected++;
        else if(String(sub.status||'').startsWith('Pending'))out.pendingApproval++;
        else out.onTime++;
      });
      d=_isoAdd(d,1);
    }
    return out;
  })();
  const _mwDone=MW.onTime+MW.late+MW.pendingApproval+MW.rejected;
  _HData={myWork:{labels:['On time','Late','Awaiting approval','Rejected','Missed'],
    data:[MW.onTime,MW.late,MW.pendingApproval,MW.rejected,MW.missed],
    done:_mwDone,assigned:MW.assigned}};
  const _mwChip=(n,label,fg,bg)=>`<div style="background:${bg||'var(--c-surface-2)'};border:1px solid var(--c-border);border-radius:11px;padding:9px 11px"><span class="fd" style="display:block;font-size:18px;font-weight:800;line-height:1;color:${fg||'var(--c-text)'}">${n}</span><span style="display:block;font-size:10.5px;font-weight:700;color:var(--c-text-2);margin-top:3px;white-space:nowrap">${label}</span></div>`;
  const myWorkCard=`<div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">My record</div>
  <div class="ui-card" style="padding:16px;margin-bottom:16px">
    <div class="hscroll" style="gap:8px;align-items:center;margin-bottom:14px">
      <span style="font-size:10.5px;font-weight:800;color:var(--c-text-3);flex-shrink:0">FROM</span>
      <input type="date" value="${_mwF}" onchange="S.filters.myWorkFrom=this.value;rr()" class="ui-input" style="width:auto;min-height:36px;padding:5px 10px;font-size:13px"/>
      <span style="font-size:10.5px;font-weight:800;color:var(--c-text-3);flex-shrink:0">TO</span>
      <input type="date" value="${_mwT}" onchange="S.filters.myWorkTo=this.value;rr()" class="ui-input" style="width:auto;min-height:36px;padding:5px 10px;font-size:13px"/>
      ${(S.filters.myWorkFrom||S.filters.myWorkTo)?`<button onclick="delete S.filters.myWorkFrom;delete S.filters.myWorkTo;rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="flex-shrink:0">This month</button>`:`<span style="font-size:11px;font-weight:700;color:var(--c-text-3);flex-shrink:0">Current month</span>`}
    </div>
    <div class="grid md:grid-cols-2 gap-4 items-center">
      <div style="position:relative;height:215px"><canvas id="hChartMyWork" data-chart="my-work"></canvas></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:8px">
        ${_mwChip(MW.assigned,'Assigned')}
        ${_mwChip(MW.onTime,'On time','var(--c-success-ink)','var(--c-success-soft)')}
        ${_mwChip(MW.late,'Late',MW.late?'#B45309':undefined,MW.late?'#FFFBEB':undefined)}
        ${_mwChip(MW.pendingApproval,'Awaiting approval','#5B2DBE','#F1ECFE')}
        ${_mwChip(MW.rejected,'Rejected',MW.rejected?'var(--c-danger-ink)':undefined,MW.rejected?'var(--c-danger-soft)':undefined)}
        ${_mwChip(MW.missed,'Missed',MW.missed?'var(--c-danger-ink)':undefined,MW.missed?'var(--c-danger-soft)':undefined)}
        ${_mwChip(MW.assigned?Math.round(_mwDone/MW.assigned*100)+'%':'—','Completion','var(--c-brand-ink)','var(--c-brand-soft)')}
        ${_mwChip(MW.days,'Active days')}
      </div>
    </div>
  </div>`;

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
    ${(isMgr()||can('teamview','view'))?_todayLoadWidget():''}
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


function _clFooter(c,date,sub,isPast,isFuture,u,hasEditReq,editApproved){
  const cid=c.id;
  // "Any one can complete" mode: submission was made by another assignee — read-only for me
  if(sub&&sub.status!=='Editing'&&sub.userId&&sub.userId!==S.uid){
    const by=uById(sub.userId);
    const st=sub.submittedAt?new Date(sub.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#0D7A4E;font-weight:600">'+ic('check','w-3.5 h-3.5')+'Completed by '+esc(by?fullName(by):'a teammate')+(st?' · '+st:'')+'</span><span></span>';
  }
  // Guard: never show Submit if already submitted (catches stale RUN state)
  if(sub&&sub.status!=='Editing'){
    const st=sub.submittedAt?new Date(sub.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    const eb=(sub.editCount||0)>0?'<span style="font-size:10px;font-weight:700;background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:10px">edit #'+sub.editCount+'</span>':'';
    const left='<span style="font-size:12px;color:#B8B5AC">Submitted '+st+eb+'</span>';
    let right='';
    if(hasEditReq)right='<span style="font-size:12px;font-weight:600;color:#F97316">Edit pending</span>';
    else if(editApproved)right='<button onclick="App._resubmit(\''+cid+'\',\''+date+'\')" class="submit-pill go">Edit &amp; Resubmit</button>';
    else if(sub.status==='Pending Approval'||sub.status==='Pending')right='<span style="font-size:12px;font-weight:600;color:#F97316">Awaiting approval</span>';
    else if(u?.rules?.edit&&u?.managerId)right='<button onclick="App._reqEdit(\''+cid+'\',\''+date+'\')" style="font-size:13px;font-weight:700;color:#0D7A4E;background:#ECFDF5;border:1px solid #6EE7B7;border-radius:8px;cursor:pointer;padding:7px 16px">Request edit</button>';
    return left+right;
  }
  if(!sub){
    if(isPast&&!u?.rules?.past)return '<span style="font-size:12px;color:#B36A00;font-weight:600">No permission for past dates</span><span></span>';
    if(isFuture&&!u?.rules?.future)return '<span style="font-size:12px;color:#9CA3AF">Scheduled for this date</span><button class="submit-pill no" disabled style="opacity:.4;cursor:not-allowed">Not yet</button>';
    return '<span></span><span style="display:inline-flex;gap:8px"><button onclick="App._saveClDraft(\''+cid+'\',\''+date+'\')" style="font-size:13px;font-weight:700;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;cursor:pointer;padding:7px 14px">Save draft</button><button onclick="App._submitRun(\''+cid+'\',\''+date+'\')" class="submit-pill go" data-cl="'+cid+'">\u2713 Submit</button></span>';
  }
  // Editing mode
  if(sub.status==='Editing'){
    return '<span style="font-size:12px;font-weight:700;color:#0EA5E9">Editing\u2026</span><span style="display:inline-flex;gap:8px"><button onclick="App._saveClDraft(\''+cid+'\',\''+date+'\')" style="font-size:13px;font-weight:700;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;cursor:pointer;padding:7px 14px">Save draft</button><button onclick="App._submitRun(\''+cid+'\',\''+date+'\')" class="submit-pill go" data-cl="'+cid+'">\u2713 Submit edit</button></span>';
  }
  return '';
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
  const sub=subForCl(c,S.uid,date);
  const today=todayISO();
  const isPast=date<today;const isFuture=date>today;const u=me();
  const st=sub?sub.status:isFuture?'Upcoming':isPast?'Late':c.scheduleTime&&nowHM()>hm2m(c.scheduleTime)?'Late':'Pending';
  const exp=S.expandedCl===c.id;
  // If sub exists and is not in Editing mode, tasks are locked — don't init a fresh RUN
  const isSubmitted=!!sub&&sub.status!=='Editing';
  // Only initialise fresh RUN if: no entry, date changed, OR not currently editing
  if(!RUN[c.id]||(RUN[c.id].date!==date&&RUN[c.id].status!=='Editing')){
    // Restore questionResponses from existing submission if available
    const _existSub=subForCl(c,S.uid,date);
    RUN[c.id]={checklistId:c.id,userId:S.uid,date,tasks:[],questionResponses:JSON.parse(JSON.stringify(_existSub?.questionResponses||[]))};
    // PHASE4b: no submission for this day → resume the saved server draft (works across devices).
    if(!isSubmitted&&!(RUN[c.id].questionResponses||[]).length){
      const _dr=_draftFor('checklist',c.id,date);
      if(_dr&&_dr.payload&&Array.isArray(_dr.payload.questionResponses)&&_dr.payload.questionResponses.length){
        RUN[c.id].questionResponses=JSON.parse(JSON.stringify(_dr.payload.questionResponses));
      }
    }
  }
  const run=RUN[c.id];
  const hasEditReq=DB.approvals.some(a=>a.type==='Edit Request'&&a.requesterId===S.uid&&a.checklistId===c.id&&a.date===date&&a.status==='Pending');
  const editApproved=DB.approvals.some(a=>a.type==='Edit Request'&&a.requesterId===S.uid&&a.checklistId===c.id&&a.date===date&&a.status==='Approved');
  const stCls={'On Time':'st-on','Submitted':'st-sub','Pending':'st-pend','Late':'st-late','Pending Approval':'st-pa','Rejected':'st-late','Editing':'st-pend','Upcoming':'st-pend'};
  const stBar={'On Time':'#22C55E','Submitted':'#22C55E','Pending':'#F59E0B','Late':'#EF4444','Pending Approval':'#F97316','Rejected':'#EF4444','Editing':'#0EA5E9','Upcoming':'#A855F7'};

  return`<div class="clc" style="border-top:3px solid ${stBar[st]||'#EEECE8'}">
    <!-- Header -->
    <button class="clc-hdr" onclick="S.expandedCl=S.expandedCl==='${c.id}'?null:'${c.id}';rr()">
      <div style="flex:1;text-align:left;min-width:0">
        <div class="fd" style="font-size:15px;font-weight:800;color:#111110">${esc(c.name)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap">
          ${c.department?`<span style="font-size:12px;color:#B8B5AC">${esc(c.department)}</span>`:''}
          ${c.anyOne?`<span title="Any one assignee can complete this" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:#EEF2FF;color:#4338CA;flex-shrink:0">${ic('users','w-3 h-3')}Any one</span>`:''}
          ${c.description?`<span style="font-size:11px;color:#B8B5AC;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${esc(c.description)}</span>`:''}
          ${(()=>{
            const total=(c.questionIds||[]).length;if(!total)return'';
            const answered=(run?.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length;
            const allAnswered=!isSubmitted&&answered>=total;
            if(isSubmitted){
              // After submit: show attempt + compliance badges (read-only, locked)
              return _subBadges(c,sub,{small:true});
            }
            return`<span style="font-size:11px;font-weight:600;color:${allAnswered?'#0E9F6E':'#9CA3AF'};flex-shrink:0">${answered}/${total} attempted</span>`;
          })()}
          ${(!isSubmitted&&_draftFor('checklist',c.id,date))?`<span title="A saved draft exists — it loads automatically on any of your devices" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:#FEF3C7;color:#92400E;flex-shrink:0">${ic('edit','w-3 h-3')}Draft</span>`:''}
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
        const qs=(c.questionIds||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean);
        if(!qs.length)return'';
        const locked=isSubmitted&&(!run||run.status!=='Editing');
        return'<div style="padding:12px 16px;border-top:1px solid #F5F4F0;display:flex;flex-direction:column;gap:10px">'+qs.map((q,qi)=>{
          const qr=(run.questionResponses||[]).find(r=>r.questionId===q.id)||{};
          const resp=qr.response??null;
          const TYPE_LABELS={answer:'Answer',number:'Number',passfail:'Pass/Fail',yesno:'Yes/No',tick:'Tick/Cross'};
          let inputHtml='';
          if(locked){
            inputHtml='<span style="font-size:13px;font-weight:600;color:#0E9F6E">'+(resp!==null&&resp!==undefined?esc(String(resp)):'<em style="color:#D1D5DB">Not answered</em>')+'</span>';
          } else if(q.type==='answer'){
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
          const _fl=(n,t)=>'<span style="display:inline-flex;align-items:center;gap:3px;vertical-align:middle">'+ic(n,'w-3 h-3')+t+'</span>';
          const flags=[];if(q.photo)flags.push(_fl('cam','Required'));if(q.approval)flags.push(_fl('check','Approval'));if(q.comment)flags.push(_fl('msg','Required'));
          // Photo upload — always shown; q.photo flag only makes it mandatory at submit.
          // Supports MULTIPLE photos via r.photos[]; falls back to legacy r.photo for old data.
          if(!locked){
            const _qrPhoto=(run.questionResponses||[]).find(r=>r.questionId===q.id)||{};
            const photos=_qrPhotoList(_qrPhoto);
            inputHtml+='<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
              +photos.map((ph,pi)=>'<div style="position:relative;display:inline-block"><img src="'+ph+'" alt="Task response photo" onclick="App._bigImg(\''+ph.replace(/'/g,"\\'")+'\')" style="max-width:100px;max-height:72px;border-radius:8px;object-fit:cover;border:1.5px solid #BBF7D0;cursor:pointer"/><button onclick="App._clearQRPhoto(\''+c.id+'\',\''+q.id+'\','+pi+')" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#EF4444;border:1.5px solid #fff;color:#fff;font-size:11px;cursor:pointer;display:grid;place-items:center;font-weight:700">×</button></div>').join('')
              +'<label style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;background:'+(photos.length?'#F0FDF4':'#F3F4F6')+';color:'+(photos.length?'#16A34A':'#374151')+';font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid '+(photos.length?'#BBF7D0':'#E5E7EB')+'">'
              +ic('cam','w-3.5 h-3.5')+(photos.length?'Add more':'Add photo')+(q.photo&&!photos.length?' <span style="color:#EF4444">*</span>':'')
              +'<input type="file" accept="image/*" capture="environment" multiple style="display:none" onchange="App._setQRPhoto(\''+c.id+'\',\''+q.id+'\',this)"/>'
              +'</label>'
              +'</div>';
          } else {
            const _qr2=(sub?.questionResponses||[]).find(r=>r.questionId===q.id)||{};
            const photos2=_qrPhotoList(_qr2);
            if(photos2.length)inputHtml+='<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+photos2.map(ph=>'<img src="'+ph+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(\''+ph.replace(/'/g,"\\'")+'\')" style="max-width:110px;max-height:80px;border-radius:8px;object-fit:cover;border:1px solid #E5E7EB;cursor:pointer"/>').join('')+'</div>';
          }
          return`<div style="background:#FAFAFA;border:1px solid #ECEDF0;border-radius:12px;padding:12px 14px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
              <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:5px;background:${Q_TYPE_BG[q.type]||'#F6F7F8'};color:${Q_TYPE_CLR[q.type]||'#6B7280'}">${TYPE_LABELS[q.type]||q.type}</span>
              <span style="font-size:13px;font-weight:600;color:#15171C">${esc(q.text)}</span>
              ${flags.length?`<span style="margin-left:auto;font-size:11px;color:#9CA3AF">${flags.join(' · ')}</span>`:''}
            </div>
            ${inputHtml}
            ${!locked?`<textarea oninput="App._setQRComment('${c.id}','${q.id}',this.value)" placeholder="${q.comment?'Comment (required)…':'Add a comment (optional)…'}" style="width:100%;box-sizing:border-box;margin-top:8px;padding:8px 10px;border:1.5px solid ${q.comment?'#FCA5A5':'#E5E7EB'};border-radius:9px;font-size:12px;resize:none;outline:none;font-family:inherit;background:#fff" rows="2">${esc(qr.comment||'')}</textarea>`:''}
            ${locked&&qr.comment?`<div style="margin-top:6px;font-size:12px;color:#6B7280;font-style:italic;padding:5px 8px;background:#F9FAFB;border-radius:7px">"${esc(qr.comment)}"</div>`:''}
          </div>`;
        }).join('')+'</div>';
      })()}
      <div class="clc-ft">${_clFooter(c,date,sub,isPast,isFuture,u,hasEditReq,editApproved)}</div>
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
App._resubmit=(clId,date)=>{const sub=DB.submissions.find(s=>s.checklistId===clId&&s.userId===S.uid&&s.date===date);const ea=DB.approvals.find(a=>a.type==='Edit Request'&&a.checklistId===clId&&a.requesterId===S.uid&&a.date===date&&a.status==='Approved');if(ea){ea.status='Used';ea.usedAt=new Date().toISOString();ea.isResubmit=true;}if(sub){sub.editCount=(sub.editCount||0)+1;sub.editHistory=sub.editHistory||[];sub.editHistory.push({startedAt:new Date().toISOString(),editNumber:sub.editCount,by:S.uid});sub.status='Editing';RUN[clId]={id:sub.id,checklistId:clId,userId:S.uid,date,tasks:[],questionResponses:JSON.parse(JSON.stringify(sub.questionResponses||[])),status:'Editing',editCount:sub.editCount,editHistory:sub.editHistory};}else{delete RUN[clId];}log(fullName(me()),'Started resubmit',clById(clId)?.name||'');toast('Edit mode — make changes and resubmit');saveDB();render();};
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
async function _uploadSubmissionPhotos(clId,userId,date,responses){
  const out=(responses||[]).map(r=>({...r}));
  for(const r of out){
    // Build the working list (photos[] + any legacy single photo)
    let list=[];
    if(Array.isArray(r.photos))list.push(...r.photos);
    if(r.photo)list.push(r.photo);
    if(!list.length)continue;
    const uploaded=[];
    for(let i=0;i<list.length;i++){
      const p=list[i];
      if(!p||typeof p!=='string'){continue;}
      if(!p.startsWith('data:')){uploaded.push(p);continue;} // already a URL/placeholder
      try{
        const blob=_dataUrlToBlob(p);
        if(!blob){uploaded.push('[photo]');continue;}
        const ext=(blob.type.split('/')[1]||'jpg').replace(/[^a-z0-9]/gi,'')||'jpg';
        const path='submissions/'+clId+'/'+userId+'/'+date+'/'+r.questionId+'_'+Date.now()+'_'+i+'.'+ext;
        const {error}=await sb.storage.from('documents').upload(path,blob,{cacheControl:'3600',upsert:true,contentType:blob.type});
        if(error){console.warn('[photo upload]',error.message);uploaded.push('[photo]');continue;}
        const {data:urlData}=sb.storage.from('documents').getPublicUrl(path);
        uploaded.push(urlData?.publicUrl||'[photo]');
      }catch(e){console.warn('[photo upload failed]',e.message);uploaded.push('[photo]');}
    }
    r.photos=uploaded;
    r.photo=null; // consolidated into photos[]
  }
  return out;
}

App._submitRun=async(clId,date)=>{
  const c=clById(clId);const run=RUN[clId];if(!run)return;
  const existingSub=subFor(clId,S.uid,date);if(existingSub&&existingSub.status!=='Editing'){toast('Already submitted for this date','warn');return;}
  // Group ("any one") checklist already completed by a teammate → read-only, block duplicate submit
  if(c&&c.anyOne&&!existingSub){
    const peerDone=DB.submissions.find(s=>s.checklistId===clId&&s.date===date&&s.userId!==S.uid&&s.status!=='Editing');
    if(peerDone){const by=uById(peerDone.userId);toast('Already completed by '+(by?fullName(by):'a teammate'),'warn');delete RUN[clId];S.expandedCl=null;render();return;}
  }
  // ── Validate mandatory fields before submitting ──
  const _qs=(c.questionIds||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean);
  // 1) Every question must be answered first.
  if(_qs.length){
    const _unanswered=_qs.filter(_q=>{const _qr=(run.questionResponses||[]).find(r=>r.questionId===_q.id)||{};return _qr.response===null||_qr.response===undefined||_qr.response==='';});
    if(_unanswered.length){toast('Please answer all '+_qs.length+' question'+((_qs.length>1)?'s':'')+' before submitting','err');return;}
  }
  // 2) Enforce mandatory photo/comment on EVERY question (independent of each other).
  //    Each requirement is checked against that question's own response only.
  for(const _q of _qs){
    const _qr=(run.questionResponses||[]).find(r=>r.questionId===_q.id)||{};
    if(_q.photo&&!_qrHasPhoto(_qr)){
      toast('Photo required for: "'+_q.text.slice(0,40)+'"','err');return;
    }
    if(_q.comment&&(!_qr.comment||!_qr.comment.trim())){
      toast('Comment required for: "'+_q.text.slice(0,40)+'"','err');return;
    }
  }
  const today=todayISO();
  const late=date<today||(date===todayISO()&&c.scheduleTime&&nowHM()>hm2m(c.scheduleTime));
  const _ua=(me()?.approval)||{};
  const _isPast=date<todayISO();const _isFut=date>todayISO();
  const dateAppr=(_isPast&&_ua.past)||(_isFut&&_ua.future);
  const needsAppr=dateAppr;
  const isResub=run.status==='Editing';run.status=needsAppr?'Pending Approval':late?'Late':'On Time';run.submittedAt=new Date().toISOString();const u=me();const mgrId=u?.managerId;if(isResub){const ei=DB.submissions.findIndex(s=>s.checklistId===clId&&s.userId===S.uid&&s.date===date);if(ei>-1){const ex=DB.submissions[ei];ex.tasks=JSON.parse(JSON.stringify(run.tasks));ex.questionResponses=JSON.parse(JSON.stringify(run.questionResponses||[]));ex.status=run.status;ex.submittedAt=run.submittedAt;ex.editCount=run.editCount||0;ex.editHistory=run.editHistory||[];}if(needsAppr){DB.approvals.push({id:uid('a'),type:'Submission',requesterId:S.uid,checklistId:clId,date,status:'Pending',note:'Resubmitted after edit #'+(run.editCount||1),createdAt:new Date().toISOString(),isResubmit:true});if(mgrId&&_inappOn('checklist')&&(!_ns||_ns.inapp_submission_submitted!==false))DB.notifications.unshift({id:uid('n'),userId:mgrId,text:'Re-submitted: '+fullName(u)+' edited and resubmitted — needs re-approval',time:new Date().toISOString(),read:false,kind:'submission'});}}else{run.id=uid('s');DB.submissions.push(JSON.parse(JSON.stringify(run)));if(needsAppr){DB.approvals.push({id:uid('a'),type:'Submission',requesterId:S.uid,checklistId:clId,date,status:'Pending',note:'Awaiting approval',createdAt:new Date().toISOString()});_invalidateNotifCache();}}
  if(needsAppr){
    const apprText='🔔 Approval needed: '+fullName(u)+' submitted "'+c.name+'" — awaiting your review';
    const _subNotifOn=_inappOn('checklist')&&(!_ns||_ns.inapp_submission_submitted!==false);
    if(mgrId&&_subNotifOn)DB.notifications.unshift({id:uid('n'),userId:mgrId,text:apprText,time:new Date().toISOString(),read:false,kind:'submission'});
    const adminU2=DB.users.find(x=>isSuperU(x));
    if(adminU2&&adminU2.id!==mgrId&&_subNotifOn)DB.notifications.unshift({id:uid('n'),userId:adminU2.id,text:apprText,time:new Date().toISOString(),read:false,kind:'submission'});
  }
  log(fullName(u),'Submitted '+run.status,c.name);
  _draftDelete('checklist',clId,date); // PHASE4b: submitted → the draft leaves the drafts table
  toast(needsAppr?'Submitted — pending approval':'Submitted',late||needsAppr?'warn':'ok');
  // Process escalations — only on first submission, not resubmits
  if(!isResub)_processEscalations(clId,date,run.questionResponses||[]);
  // questionResponses already in run — will be included in push/update below
  // Capture the original responses (may contain base64 photos) so we can persist photos
  // to Storage in the background after the instant render (Fix #5).
  const _origQR=JSON.parse(JSON.stringify(run.questionResponses||[]));
  const _subId=run.id;
  const _inlineP=r=>(Array.isArray(r.photos)&&r.photos.some(p=>typeof p==='string'&&p.startsWith('data:')))||(typeof r.photo==='string'&&r.photo.startsWith('data:'));
  const _hasInlinePhoto=_origQR.some(_inlineP);
  // Strip base64 photos before sending to Supabase (store placeholder; URLs persisted in bg)
  const _stripP=p=>(typeof p==='string'&&p.startsWith('data:'))?'[photo]':p;
  const srQR=(run.questionResponses||[]).map(r=>{
    const o={...r};
    if(Array.isArray(o.photos))o.photos=o.photos.map(_stripP);
    if(o.photo)o.photo=_stripP(o.photo);
    return o;
  });
  const sr={id:run.id,checklist_id:clId,user_id:S.uid,date,status:run.status,submitted_at:run.submittedAt,tasks:run.tasks,question_responses:srQR,edit_count:run.editCount||0,edit_history:run.editHistory||[]};
  // 1. Save immediately (saveDB strips photos before writing)
  saveDB();
  // 2. Render immediately — UI updates in <50ms
  delete RUN[clId];S.expandedCl=null;_invalidateNotifCache();_touchAction();render();
  // 3. Save ONLY this submission to Supabase (targeted — not full _sync of 11 tables)
  sb.from('submissions').upsert(sr,{onConflict:'id'}).then(({error})=>{
    if(error)console.warn('sub upsert:',error.message);
    // 3a. Persist photos to Storage in the background, then re-save the submission with
    // durable URLs (Fix #5). Entirely optional — submission already succeeded above.
    if(_hasInlinePhoto){
      _uploadSubmissionPhotos(clId,S.uid,date,_origQR).then(uploadedQR=>{
        const anyUrl=uploadedQR.some(r=>(Array.isArray(r.photos)&&r.photos.some(p=>typeof p==='string'&&p.startsWith('http')))||(typeof r.photo==='string'&&r.photo.startsWith('http')));
        if(!anyUrl)return; // nothing persisted (all failed) — leave placeholders, no-op
        // Patch the in-memory record so managers see the real photo without a reload
        const rec=DB.submissions.find(s=>s.id===_subId);
        if(rec)rec.questionResponses=uploadedQR;
        saveDB();
        // Re-upsert just this submission with the URL-bearing responses
        sb.from('submissions').upsert({id:_subId,checklist_id:clId,user_id:S.uid,date,status:sr.status,submitted_at:sr.submitted_at,tasks:sr.tasks,question_responses:uploadedQR,edit_count:sr.edit_count,edit_history:sr.edit_history},{onConflict:'id'})
          .then(({error})=>{if(error)console.warn('[photo re-upsert]',error.message);})
          .catch(e=>console.warn('[photo re-upsert failed]',e.message));
      }).catch(e=>console.warn('[photo persist]',e.message));
    }
    // After submission saved, sync notifications/approvals/issues in background
    Promise.allSettled([
      DB.approvals.length?sb.from('approvals').upsert(DB.approvals.filter(a=>a.requesterId===S.uid||can('checklists','approve')||isAdmin()||isHR()).map(a=>({id:a.id,type:a.type||'Submission',requester_id:a.requesterId,checklist_id:a.checklistId||null,date:a.date||null,status:a.status,note:a.note||'',is_resubmit:a.isResubmit||false,used_at:a.usedAt||null})),{onConflict:'id'}):Promise.resolve(),
      sb.from('notifications').upsert(DB.notifications.slice(0,50).map(n=>({id:n.id,user_id:n.userId,text:n.text,read:n.read||false,created_at:n.time||new Date().toISOString(),kind:n.kind||null,target_route:n.targetRoute||null})),{onConflict:'id'}),
      DB.tickets&&DB.tickets.length?sb.from('tickets').upsert(DB.tickets.filter(t=>t.createdBy===S.uid||t.assignedTo===S.uid||t.submitterId===S.uid||can('tickets','changeStatus')||can('tickets','resolve')||isAdmin()||isHR()).map(t=>({id:t.id,title:t.title||'',description:t.description||'',priority:t.priority||'Medium',status:t.status||'Open',assigned_to:t.assignedTo||null,created_by:t.createdBy||null,checklist_id:t.checklistId||null,question_id:t.questionId||null,question_text:t.questionText||'',answer_given:t.answerGiven||'',submitter_id:t.submitterId||null,date:t.date||null,created_at:t.createdAt||new Date().toISOString(),resolved_at:t.resolvedAt||null,resolve_note:t.resolveNote||'',viewed_by:t.viewedBy||[]})),{onConflict:'id'}):Promise.resolve(),
    ]).catch(()=>{});
  }).catch(e=>console.warn('sub upsert failed:',e.message));
};
App._reqEdit=(clId,date)=>{modalShell({title:'Request edit',sub:'Manager approval required to edit a submission.',size:'max-w-sm',body:`<textarea id="re-n" rows="3" placeholder="Reason for edit…" class="ui-input rf"></textarea>`,footer:btnG('Cancel','App.closeModal()')+btnP('Send request',`App._sendReq('${clId}','${date}')`)});};
App._sendReq=(clId,date)=>{
  const note=$('#re-n')?.value.trim()||'Edit requested';
  const u=me();
  // Guard: prevent duplicate pending edit requests for same checklist+date
  const existingReq=DB.approvals.find(a=>a.type==='Edit Request'&&a.requesterId===S.uid&&a.checklistId===clId&&a.date===date&&a.status==='Pending');
  if(existingReq){toast('Edit request already pending — awaiting manager approval','warn');closeModal();return;}
  DB.approvals.push({id:uid('a'),type:'Edit Request',requesterId:S.uid,checklistId:clId,date,status:'Pending',note,createdAt:new Date().toISOString()});
  // Mark submission status as "Pending Approval" to show in UI
  const sub=DB.submissions.find(s=>s.checklistId===clId&&s.userId===S.uid&&s.date===date);
  if(sub)sub.editRequestStatus='Pending';
  // Notify manager
  const mgrId=u?.managerId;
  const clName=clById(clId)?.name||'a checklist';
  const _edReqNotifOn=_inappOn('checklist')&&(!_ns||_ns.inapp_approval_requested!==false);
  if(mgrId){if(_edReqNotifOn)DB.notifications.unshift({id:uid('n'),userId:mgrId,text:'✏️ Edit request from '+fullName(u)+' for "'+clName+'" on '+fmtS(date),time:new Date().toISOString(),read:false,kind:'edit'});
    if(typeof queueEmail==='function')queueEmail('approval_requested',mgrId,clId,date,{checklist_name:clName,employee_name:fullName(u)});} // FINAL-FIX
  // Notify admin if not same as manager
  const admin=DB.users.find(x=>isSuperU(x));
  if(admin&&admin.id!==mgrId&&_edReqNotifOn)DB.notifications.unshift({id:uid('n'),userId:admin.id,text:'Edit request: '+fullName(u)+' — '+clName,time:new Date().toISOString(),read:false,kind:'edit'});
  _invalidateNotifCache();log(fullName(u),'Edit request',clName);
  toast('Edit request sent to your manager');saveDB();closeModal();render();
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.COLL=COLL;window.homeDash=homeDash;window.myClsPage=myClsPage;window._clFooter=_clFooter;window._qrPhotoList=_qrPhotoList;window._qrHasPhoto=_qrHasPhoto;window._clCard=_clCard;window._dataUrlToBlob=_dataUrlToBlob;window._uploadSubmissionPhotos=_uploadSubmissionPhotos;
