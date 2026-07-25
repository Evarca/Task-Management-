
/* ===== HIERARCHY ===== */
/* §9 — Org chart as a real top-down tree (pure HTML/CSS connector lines, no libraries).
   Scope: Super Admin / everyone-scope sees the whole org (roots = users with no manager);
   everyone else sees their own subtree (root = me) via scopeOf('hierarchy'). Built from managerId
   (reuses subTree for scope membership). Branches expand/collapse via COLL; "Center on me" scrolls. */
function hierarchyPage(){
  if(!can('hierarchy','view'))return`<div class="fade">${hdr('Hierarchy','Reporting structure')}${empty('tree','Not available','You don\'t have access to the org chart.')}</div>`;
  const sc=scopeOf('hierarchy');
  let roots;
  // UI-3: a user is a root when they have no manager OR their managerId points to a deleted/missing
  // user (dangling pointer). Without this, such users are neither a root nor any node's child and
  // vanish from the chart entirely. (_orgNode's _seen cycle guard still handles A→B→A loops.)
  if(sc==='everyone'){roots=DB.users.filter(u=>!u.managerId||!uById(u.managerId));}
  else{roots=[me()].filter(Boolean);}
  const wide=sc==='everyone';
  const title=wide?'Organisation':'My Team';
  return`<div class="fade">${hdr(title,'Reporting structure — compact by default; expand a branch or tap a person for their profile',
    btnG('Expand all','App._orgExpandAll()','chevD')+btnG('Collapse all','App._orgCollapseAll()','chevR')+btnG('Center on me','App._orgCenter()','search'))}
  <div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:16px">
    <div id="org-scroll" class="org-scroll" style="max-height:72vh">
      <div style="min-width:max-content;padding:8px 20px 20px;margin:0 auto">
        <ul class="org-tree org-tree-root" style="justify-content:center">${(()=>{const _seenTop=new Set();const nodes=roots.map(r=>_orgNode(r,_seenTop,0)).join('');return nodes||empty('tree','No reporting structure yet','Assign managers to build the org chart.');})()}</ul>
      </div>
    </div>
  </div></div>`;
}
App._orgCenter=()=>{
  // UI-4: my node is only in the DOM if every ancestor branch is expanded. Walk up the manager
  // chain and clear COLL[ancestorId] for each ancestor, re-render, THEN scroll to the node.
  const u=me();
  if(u){let cur=u.managerId,guard=new Set([u.id]);while(cur&&!guard.has(cur)){guard.add(cur);COLL[cur]=false;const m=uById(cur);cur=m?m.managerId:null;}rr();} // explicit false — undefined now means "collapsed by default" at depth ≥1
  const scrollToMe=()=>{const el=document.getElementById('node-'+S.uid);const sc=document.getElementById('org-scroll');if(el&&sc&&el.scrollIntoView){el.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});el.animate?el.animate([{boxShadow:'0 0 0 0 rgba(14,159,110,.5)'},{boxShadow:'0 0 0 6px rgba(14,159,110,0)'}],{duration:900}):0;}else toast('Your card isn\'t in the current view','err');};
  if(window.requestAnimationFrame)requestAnimationFrame(scrollToMe);else scrollToMe();
};
// One node card + (optionally) its children row. Card shows avatar, name, position, role badge.
// COMPACT DEFAULT: roots (depth 0) show their direct reports; every deeper manager starts
// collapsed until expanded (COLL[u.id]===false). Clicking a card opens the safe profile popup.
function _orgNode(u,_seen=new Set(),depth=0){
  if(!u||_seen.has(u.id))return'';
  _seen.add(u.id);
  const kids=DB.users.filter(x=>x.managerId===u.id&&x.id!==u.id&&!_seen.has(x.id));
  const col=COLL[u.id]!==undefined?COLL[u.id]:depth>=1;
  const isMe=u.id===S.uid;
  const badge=isSuperU(u)?`<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:var(--c-ink);color:#fff">SUPER ADMIN</span>`:_pidOf(u)==='admin'?`<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:var(--c-info-soft);color:var(--c-info-ink)">${esc(roleName(u).toUpperCase())}</span>`:'';
  const card=`<div id="node-${u.id}" class="org-card" role="button" tabindex="0" onclick="App._orgProfile('${u.id}')" onkeydown="if(event.key==='Enter')App._orgProfile('${u.id}')" style="display:flex;flex-direction:column;align-items:center;gap:6px;background:${isMe?'var(--c-brand-soft)':'var(--c-surface)'};border:1px solid ${isMe?'var(--c-brand)':'var(--c-border)'};border-radius:var(--r-md);padding:10px 14px 12px;min-width:148px;max-width:200px;box-shadow:var(--sh-sm);cursor:pointer">
    ${avatar(u,'w-11 h-11','text-sm')}
    <div style="text-align:center;min-width:0">
      <div style="font-size:14px;font-weight:600;color:var(--c-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:172px">${esc(fullName(u))}</div>
      <div style="font-size:11px;color:var(--c-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:172px">${esc(u.position||'—')}${u.department?' · '+esc(u.department):''}</div>
      ${badge?`<div style="margin-top:3px">${badge}</div>`:''}
    </div>
    ${kids.length?`<button type="button" onclick="event.stopPropagation();COLL['${u.id}']=${col?'false':'true'};rr()" style="margin-top:2px;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--c-brand-ink);background:var(--c-brand-soft);border:none;border-radius:99px;padding:3px 10px;cursor:pointer">${ic(col?'chevR':'chevD','w-3 h-3')}${kids.length} report${kids.length!==1?'s':''}</button>`:''}
  </div>`;
  const childRow=(kids.length&&!col)?`<div class="org-children"><ul class="org-tree">${kids.map(k=>_orgNode(k,_seen,depth+1)).join('')}</ul></div>`:'';
  return`<li class="${kids.length&&!col?'org-parent':''}">${card}${childRow}</li>`;
}
App._orgExpandAll=()=>{DB.users.forEach(u=>{COLL[u.id]=false;});rr();};
App._orgCollapseAll=()=>{DB.users.forEach(u=>{if(DB.users.some(x=>x.managerId===u.id))COLL[u.id]=true;});rr();};

/* Tenure: "2 yr 4 mo" (or "11 mo" / "23 d") from the joining date to today. */
function _tenureStr(join){
  if(!join)return'';
  const ms=Date.now()-new Date(join+'T00:00:00').getTime();
  if(!(ms>0))return'';
  const days=Math.floor(ms/86400000);
  if(days<31)return days+' day'+(days===1?'':'s');
  const months=Math.floor(days/30.44);
  const y=Math.floor(months/12),m=months%12;
  return(y?y+' yr'+(y>1?'s':'')+' ':'')+(m?m+' mo':(y?'':'<1 mo'));
}
/* Safe profile popup for the org chart — directory info ONLY. Deliberately excludes salary,
   IBAN/bank, assets, personal documents, payroll hold, permissions and any account internals. */
App._orgProfile=(id)=>{
  const u=uById(id);if(!u)return;
  if(!can('hierarchy','view'))return;
  const h=u.hrm||{};
  const mgr=u.managerId?uById(u.managerId):null;
  const reports=DB.users.filter(x=>x.managerId===id);
  const loc=h.locationId?locById(h.locationId):null;
  const tenure=_tenureStr(h.joiningDate);
  const row=(k,v)=>v?`<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--c-border)"><div style="width:118px;flex-shrink:0;font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.04em;padding-top:1px">${k}</div><div style="flex:1;font-size:13.5px;color:var(--c-text);min-width:0;overflow-wrap:anywhere">${v}</div></div>`:'';
  modalShell({title:fullName(u),sub:(u.position||'')+(u.department?' · '+u.department:''),size:'max-w-md',
    body:`<div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">${avatar(u,'w-14 h-14','text-lg')}<div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${chip(u.status)}${isSuperU(u)?'<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-ink);color:#fff">Super Admin</span>':_pidOf(u)==='admin'?'<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-info-soft);color:var(--c-info-ink)">'+esc(roleName(u))+'</span>':''}</div>${tenure?`<div style="font-size:12px;color:var(--c-text-2);margin-top:4px">With the company ${tenure}</div>`:''}</div></div>
      ${row('Email',u.email?`<a href="mailto:${esc(u.email)}" style="color:var(--c-brand-ink)">${esc(u.email)}</a>`:'')}
      ${row('Department',u.department?esc(u.department):'')}
      ${row('Reports to',mgr?esc(fullName(mgr)):'—')}
      ${row('Direct reports',reports.length?esc(reports.slice(0,6).map(r=>fullName(r)).join(', '))+(reports.length>6?' +'+(reports.length-6)+' more':''):'')}
      ${row('Office',loc?esc(loc.name):'—')}
      ${row('Joined',h.joiningDate?fmtD(h.joiningDate)+(tenure?' · '+tenure:''):'')}
      ${row('Birthday',h.dob?fmtD(h.dob):'')}
      ${row('Work week',h.schedule?esc((h.schedule.workWeek||5)+'-day · '+(h.schedule.in||'09:00')+'–'+(h.schedule.out||'18:00')):'')}
    </div>`,
    footer:btnG('Close','App.closeModal()')+((can('employees','edit')&&scopeFilter('employees')(id))?btnP('Open in Users','App.closeModal();App.editUser(\''+id+'\')'):'')});
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.hierarchyPage=hierarchyPage;window._orgNode=_orgNode;window._tenureStr=_tenureStr;
