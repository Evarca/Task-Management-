

/* ===== LOCATIONS ===== */
function locsPage(){
  const sel=S.filters.locSel||null;
  const stab=S.filters.locTab||'prog';
  // ── Detail view ──
  if(sel){
    const l=DB.locations.find(x=>x.id===sel);
    if(!l){S.filters.locSel=null;return locsPage();}
    // Requirement #6: block opening a city outside the user's city scope — but NEVER for admins
    // (an admin with old client chips must not lose access to a client they just created).
    if(!isAdmin()){const _mc=myCityScope();if(_mc.length&&!_mc.includes(l.id)){S.filters.locSel=null;toast('You do not have access to this client','warn');return locsPage();}}
    const TABS=[['prog',ic('chart','w-4 h-4')+'Progress'],['docs',ic('folder','w-4 h-4')+'Documents'],['info',ic('info','w-4 h-4')+'Info']];
    return'<div class="fade">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
      +'<button onclick="App._closeLoc()" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">'+ic('back','w-4 h-4')+'</button>'
      +'<div style="width:36px;height:36px;border-radius:10px;background:#EFF6FF;display:grid;place-items:center">'+ic('pin','w-4 h-4')+'</div>'
      +'<div style="flex:1"><div class="fd" style="font-size:16px;font-weight:800">'+esc(l.name)+'</div>'
      +'<div style="font-size:12px;color:#9CA3AF">'+esc(l.address||'No address')+'</div></div>'
      +chip(l.status||'Active')
      +(can('locations','edit')?'<button onclick="App.editLoc(this.dataset.id)" data-id="'+l.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#F6F7F8;color:#374151;font-size:13px;font-weight:600;border:1px solid #ECEDF0;cursor:pointer">'+ic('edit','w-4 h-4')+'Edit</button>':'')
      +(can('locations','delete')?'<button onclick="App.delLoc(this.dataset.id)" data-id="'+l.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#FFF1F2;color:#BE123C;font-size:13px;font-weight:600;border:1px solid #FECACA;cursor:pointer">'+ic('trash','w-4 h-4')+'Delete</button>':'')
      +'</div>'
      +'<div class="ui-tabs" style="margin-bottom:16px">'
      +TABS.map(([k,ll])=>'<button class="ui-tab'+(stab===k?' on':'')+'" onclick="App._setLocTab(this.dataset.k)" data-k="'+k+'">'+ll+'</button>').join('')
      +'</div>'
      +(stab==='prog'?_locProgTab(l):'')
      +(stab==='docs'?_locDocsTab(l.id):'')
      +(stab==='info'
        ?'<div class="bg-white rounded-2xl border border-ink-100 p-5 space-y-3">'
          +(()=>{const m=(DB.tmClientMeta||{})[l.id]||{};return [['Name',l.name],['Contact person',m.contactName||'—'],['Contact email',m.contactEmail||'—'],['Contact phone',m.contactPhone||'—'],['Reference / licence no.',m.reference||'—'],['Address',l.address||'—'],['Owning department',l.department||'All departments'],['Status',l.status||'Active'],['Notes',m.notes||'—']];})().map(([k,v])=>'<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;margin-bottom:2px">'+k+'</div><div style="font-size:14px;font-weight:600">'+esc(v)+'</div></div>').join('')
          +'</div>'
        :'')
      +'</div>';
  }
  // ── List view: a real table with a search box and filters, not a wall of cards ──
  // Client scope still applies to everyone except admins (an admin whose profile carries old
  // city chips must never lose sight of a client they just created).
  const _myCities=myCityScope();
  const _cityOK=l=>!_myCities.length||_myCities.includes(l.id);
  let list=(isAdmin()?DB.locations.slice():DB.locations.filter(_cityOK));
  const total=list.length;
  const f=S.filters;
  const q=(f.clQ||'').toLowerCase().trim();
  if(q)list=list.filter(l=>String(l.name||'').toLowerCase().includes(q)||String(l.address||'').toLowerCase().includes(q)||String(l.department||'').toLowerCase().includes(q));
  if(f.clStatus)list=list.filter(l=>(l.status||'Active')===f.clStatus);
  if(f.clDep)list=list.filter(l=>(l.department||'')===f.clDep);
  const sort=f.clSort||'name';
  const _n=l=>(DB.tmDocuments||[]).filter(d=>d.locationId===l.id).length;
  const _c=l=>(DB.checklists||[]).filter(c=>(c.locationIds||[]).includes(l.id)).length;
  list.sort((a2,b2)=>sort==='files'?(_n(b2)-_n(a2))
    :sort==='checklists'?(_c(b2)-_c(a2))
    :String(a2.name||'').localeCompare(String(b2.name||'')));
  const deps=[...new Set(DB.locations.map(l=>l.department).filter(Boolean))].sort();
  const active=!!(f.clQ||f.clStatus||f.clDep||(f.clSort&&f.clSort!=='name'));
  const _filterBar=filterBar(
     filterSearch('cl-q','clQ','Search clients by name, address or department…')
    +filterSelect('clStatus','Any status',['Active','Inactive'],f.clStatus)
    +(deps.length?filterSelect('clDep','All departments',deps,f.clDep):'')
    +`<select onchange="S.filters.clSort=this.value;rr()" class="ui-select" style="${FILTER_SEL_ST}" aria-label="Sort clients"><option value="name">Name A–Z</option><option value="checklists" ${sort==='checklists'?'selected':''}>Most checklists</option><option value="files" ${sort==='files'?'selected':''}>Most files</option></select>`
    +(active?filterClear(['clQ','clStatus','clDep','clSort']):'')
    +filterCount(list.length+' of '+total));

  const rows=list.map(l=>{
    const nD=_n(l),nF=(DB.tmFolders||[]).filter(x=>x.locationId===l.id&&!x.parentId).length,nC=_c(l);
    // Case progress at a glance: open cases, their average completion, and live blockers.
    const _oc=(DB.checklists||[]).filter(c=>isCase(c)&&c.status!=='Draft'&&(c.locationIds||[]).includes(l.id)&&!caseSub(c));
    let _pctSum=0,_blk=0;
    _oc.forEach(c=>{const cd=caseDate(c);const pr=_ansProgress(c,cd);_pctSum+=pr.total?pr.done/pr.total:0;
      _clQuestions(c).forEach(q=>{const a2=_ansFor(c.id,cd,q.id);if(a2&&a2.response!==null&&a2.response!=='')return;
        const st=_qStatusOf(c.id,cd,q.id);if(st&&st.status!=='in_progress')_blk++;});});
    const _avg=_oc.length?Math.round(_pctSum/_oc.length*100):0;
    return `<tr class="hover:bg-ink-50/50" style="cursor:pointer" onclick="App._openLoc('${l.id}')">
      <td class="px-4 py-3">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:32px;height:32px;border-radius:9px;background:#EFF6FF;color:#1D4ED8;display:grid;place-items:center;flex-shrink:0">${ic('pin','w-4 h-4')}</span>
          <div style="min-width:0">
            <div style="font-size:13.5px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.name)}</div>
            ${l.address?`<div style="font-size:11.5px;color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.address)}</div>`:''}
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-sm">${l.department?esc(l.department):'<span class="text-ink-300">All departments</span>'}</td>
      <td class="px-4 py-3 text-sm" style="white-space:nowrap">${nC?nC+' checklist'+(nC===1?'':'s'):'<span class="text-ink-300">—</span>'}</td>
      <td class="px-4 py-3" style="white-space:nowrap;min-width:130px">${_oc.length?`<div style="display:flex;align-items:center;gap:7px"><div style="flex:0 0 54px;height:6px;border-radius:99px;background:var(--c-surface-2);overflow:hidden"><div style="height:100%;width:${_avg}%;border-radius:99px;background:${_blk?'#F59E0B':'#0EA5E9'}"></div></div><span style="font-size:11.5px;font-weight:700;color:var(--c-text-2)">${_oc.length} open · ${_avg}%</span>${_blk?`<span title="${_blk} step(s) waiting on the client or an authority" style="font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:99px;background:#FEF3C7;color:#92400E">${_blk} blocked</span>`:''}</div>`:'<span class="text-ink-300 text-sm">—</span>'}</td>
      <td class="px-4 py-3 text-sm" style="white-space:nowrap">${(nD||nF)?(nF?nF+' folder'+(nF===1?'':'s')+' · ':'')+nD+' file'+(nD===1?'':'s'):'<span class="text-ink-300">—</span>'}</td>
      <td class="px-4 py-3">${chip(l.status||'Active')}</td>
      <td class="px-4 py-3"><div style="display:flex;gap:4px;justify-content:flex-end">
        ${can('locations','edit')?`<button onclick="event.stopPropagation();App.editLoc('${l.id}')" aria-label="Edit client" title="Edit client" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer">${ic('edit','w-4 h-4')}</button>`:''}
        ${can('locations','delete')?`<button onclick="event.stopPropagation();App.delLoc('${l.id}')" aria-label="Delete client" title="Delete client" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer">${ic('trash','w-4 h-4')}</button>`:''}
      </div></td>
    </tr>`;}).join('');

  return'<div class="fade">'+hdr('Clients',total+' client'+(total===1?'':'s'),can('locations','create')?btnP('Add client','App.editLoc()','plus'):'')
    +_filterBar
    +(list.length?`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left">
          <th class="px-4 py-2.5 font-semibold">Client</th>
          <th class="px-4 py-2.5 font-semibold">Department</th>
          <th class="px-4 py-2.5 font-semibold">Checklists</th>
          <th class="px-4 py-2.5 font-semibold">Case progress</th>
          <th class="px-4 py-2.5 font-semibold">Documents</th>
          <th class="px-4 py-2.5 font-semibold">Status</th>
          <th class="px-4 py-2.5 font-semibold text-right">Actions</th>
        </tr></thead>
        <tbody class="divide-y divide-ink-50">${rows}</tbody>
      </table></div></div>`
      :(total?empty('search','No clients match','Try clearing the filters.')
             :empty('pin','No clients yet','Add a client, then attach it to the checklists you run for them.')))
    +'</div>';
}

/* ═══ THE PUBLIC STATUS PAGE (#status/<token>) ═══
   What the client opens instead of calling. No login: the token is the key, checked
   server-side by the tm_client_status RPC (SECURITY DEFINER; anon has no table access).
   It shows progress only — step labels, done ticks with dates, what we're waiting on THEM
   for — never who on the team did what. Refreshes itself every 60s while open. */
async function _pubStatusRender(token){
  const el=document.getElementById('app');if(!el)return;
  const wrap=inner=>`<div style="min-height:100vh;background:#F7F6F2;padding:28px 16px;font-family:inherit">
    <div style="max-width:640px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <div style="width:38px;height:38px;border-radius:11px;background:#15171C;color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px">E</div>
        <div><div style="font-size:15px;font-weight:800;color:#15171C">Evarca</div><div style="font-size:11px;color:#9CA3AF">Live status</div></div>
      </div>
      ${inner}
      <div style="text-align:center;font-size:11px;color:#B8B5AC;margin-top:22px">This page updates automatically. Questions? Reply to your account manager.</div>
    </div></div>`;
  el.innerHTML=wrap('<div style="text-align:center;color:#9CA3AF;padding:60px 0;font-size:14px">Loading your status…</div>');
  let data=null;
  try{const r=await sb.rpc('tm_client_status',{p_token:token});data=r.data;if(r.error)throw r.error;}catch(e){data=null;}
  if(!data||data.ok===false){
    el.innerHTML=wrap('<div class="ui-card" style="padding:34px 24px;text-align:center"><div style="font-size:16px;font-weight:800;margin-bottom:6px">This link is no longer active</div><div style="font-size:13px;color:#6B7280">Please ask your account manager for a fresh status link.</div></div>');
    return;
  }
  const cases=Array.isArray(data.cases)?data.cases:[];
  const caseHtml=cases.map(cs=>{
    const steps=Array.isArray(cs.steps)?cs.steps:[];
    const done=steps.filter(s2=>s2.done).length;
    const pct=steps.length?Math.round(done/steps.length*100):0;
    const complete=!!cs.done;
    const waitingYou=steps.filter(s2=>!s2.done&&s2.waiting==='waiting_client');
    return `<div style="background:#fff;border:1px solid #ECEDF0;border-radius:16px;box-shadow:0 1px 3px rgba(15,15,15,.04);padding:18px 20px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <span style="font-size:15.5px;font-weight:800;color:#15171C">${esc(cs.name||'')}</span>
        ${complete?'<span style="font-size:10px;font-weight:800;padding:2px 10px;border-radius:99px;background:#DCFCE7;color:#0B7A55">COMPLETED</span>':'<span style="font-size:10px;font-weight:800;padding:2px 10px;border-radius:99px;background:#EEF2FF;color:#4338CA">IN PROGRESS</span>'}
        <span style="margin-left:auto;font-size:13px;font-weight:800;color:${complete?'#0B7A55':'#374151'}">${done}/${steps.length} · ${pct}%</span>
      </div>
      <div style="height:8px;border-radius:99px;background:#F3F4F6;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:${pct}%;background:${complete?'#22C55E':'#0EA5E9'};border-radius:99px"></div></div>
      ${cs.deadline_date&&!complete?`<div style="font-size:12px;color:#6B7280;margin-bottom:10px">Target completion: <b>${esc(fmtS(String(cs.deadline_date)))}${cs.deadline_time?' · '+esc(cs.deadline_time):''}</b></div>`:''}
      ${complete&&cs.completed_at?`<div style="font-size:12px;color:#0B7A55;margin-bottom:10px">Completed on <b>${new Date(cs.completed_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</b></div>`:''}
      ${waitingYou.length?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;padding:10px 13px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:800;color:#92400E;margin-bottom:3px">We're waiting on you for:</div>
        ${waitingYou.map(s2=>`<div style="font-size:12.5px;color:#78350F;padding:1px 0">• ${esc(s2.label||'')}${s2.waiting_days>0?' <span style="opacity:.7">('+s2.waiting_days+' day'+(s2.waiting_days===1?'':'s')+')</span>':''}</div>`).join('')}
      </div>`:''}
      <div>${steps.map(s2=>`<div style="display:flex;align-items:center;gap:9px;padding:6px 0;border-top:1px solid #F5F4F0">
        <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;${s2.done?'background:#DCFCE7;color:#0B7A55':'background:#F3F4F6;color:#C8C5BD'}">${s2.done?ic('check','w-3 h-3'):''}</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:${s2.done?'#9CA3AF':'#15171C'}">${esc(s2.label||'')}</span>
        ${s2.done&&s2.done_at?`<span style="font-size:11px;color:#B8B5AC">${new Date(s2.done_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>`
          :s2.waiting==='waiting_client'?'<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:#FEF3C7;color:#92400E">WITH YOU</span>'
          :s2.waiting==='waiting_authority'?'<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:#EDE9FE;color:#5B21B6">WITH AUTHORITY</span>':''}
      </div>`).join('')}</div>
    </div>`;
  }).join('');
  el.innerHTML=wrap(`
    <div style="margin-bottom:16px"><div style="font-size:21px;font-weight:800;color:#15171C">${esc(data.client||'')}</div>
    <div style="font-size:12.5px;color:#9CA3AF;margin-top:2px">Updated ${new Date(data.generated_at||Date.now()).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>
    ${caseHtml||'<div style="background:#fff;border:1px solid #ECEDF0;border-radius:16px;padding:34px 24px;text-align:center;font-size:13px;color:#6B7280">Nothing in progress right now.</div>'}`);
}
function _pubStatusBoot(){
  const h=String(window.location.hash||'');
  const m2=h.match(/^#status\/([a-z0-9]{10,64})$/);
  if(!m2)return false;
  document.title='Status — Evarca';
  _pubStatusRender(m2[1]);
  setInterval(()=>{try{_pubStatusRender(m2[1]);}catch(e){}},60000);
  return true;
}

/* ═══ THE CLIENT FILE ═══
   One screen that answers the phone call: how far along is this client, what exactly is done
   (and when), what is next, what are we blocked on and for how long — plus the share link that
   lets the client see it without calling at all. Reads only; all data comes from the case
   engine and the new tm_ tables. */
function _locProgTab(l){
  const m=(DB.tmClientMeta||{})[l.id]||{};
  const attached=(DB.checklists||[]).filter(c=>(c.locationIds||[]).includes(l.id)&&c.status!=='Draft');
  const cases=attached.filter(c=>isCase(c));
  const recurring=attached.filter(c=>!isCase(c));
  const openCases=cases.filter(c=>!caseSub(c));
  const doneCases=cases.filter(c=>!!caseSub(c));
  const canEdit=can('locations','edit');
  const lab='font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em';

  // ── contact strip ──
  const contact=`<div class="ui-card" style="padding:12px 16px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
    ${[['Contact',m.contactName],['Email',m.contactEmail],['Phone',m.contactPhone],['Reference',m.reference]].filter(x=>x[1]).map(([k,v])=>`<div><div style="${lab}">${k}</div><div style="font-size:13px;font-weight:600">${esc(v)}</div></div>`).join('')||'<span style="font-size:12px;color:var(--c-text-3)">No contact details yet — add them with Edit above.</span>'}
    ${m.notes?`<div style="flex-basis:100%;font-size:12px;color:var(--c-text-2);font-style:italic">"${esc(m.notes)}"</div>`:''}
  </div>`;

  // ── share link ──
  const link=(DB.tmShareLinks||[]).find(x=>x.clientId===l.id&&x.enabled);
  const shareUrl=link?(window.location.origin+window.location.pathname+'#status/'+link.token):'';
  const share=canEdit?`<div class="ui-card" style="padding:12px 16px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="font-size:13px;font-weight:800">${ic('link','w-4 h-4 inline')} Client status link</div>
        <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">A read-only page the client can open any time — progress, what's done, what we're waiting on them for. No login. Revoke it whenever you like.</div>
      </div>
      ${link?`<input readonly value="${esc(shareUrl)}" onclick="this.select()" class="ui-input" style="flex:2;min-width:220px;min-height:0;height:34px;font-size:12px"/>
        <button onclick="App._shareCopy('${esc(link.token)}')" class="ui-btn ui-btn-primary ui-btn-sm">Copy link</button>
        <button onclick="App._shareRevoke('${esc(link.token)}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="color:var(--c-danger-ink)">Revoke</button>`
      :`<button onclick="App._shareCreate('${l.id}')" class="ui-btn ui-btn-primary ui-btn-sm">Create link</button>`}
    </div>
  </div>`:'';

  // ── one case block ──
  const lastNudge=(qid,cid)=>{const n=(DB.tmNudges||[]).filter(x=>x.clientId===l.id&&(!qid||x.questionId===qid)&&(!cid||x.checklistId===cid)).sort((a,b)=>String(b.sentAt).localeCompare(String(a.sentAt)))[0];return n||null;};
  const caseBlock=c=>{
    const cd=caseDate(c);
    const qs=_clQuestions(c);
    const prog=_ansProgress(c,cd);
    const pct=prog.total?Math.round(prog.done/prog.total*100):0;
    const cs=caseSub(c);
    const dl=_clDeadlineLabel(c);
    const over=_clOverdue(c,cd);
    const next=qs.find(q=>{const a=_ansFor(c.id,cd,q.id);return !(a&&a.response!==null&&a.response!=='');});
    const rows=qs.map(q=>{
      const a=_ansFor(c.id,cd,q.id);
      const done=!!(a&&a.response!==null&&a.response!=='');
      const by=done&&a.submittedBy?uById(a.submittedBy):null;
      const st=!done?_qStatusOf(c.id,cd,q.id):null;
      const wc=st&&st.status==='waiting_client';
      const ng=wc?lastNudge(q.id,c.id):null;
      return `<div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--c-border)">
        <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;${done?'background:#DCFCE7;color:#0B7A55':'background:var(--c-surface-2);color:var(--c-text-3)'}">${done?ic('check','w-3 h-3'):(q===next?ic('chevR','w-3 h-3'):'')}</span>
        <span style="flex:1;min-width:0;font-size:13px;font-weight:${q===next?'800':'600'};color:${done?'var(--c-text-2)':'var(--c-text)'}">${esc(q.text)}${q===next&&!cs?' <span style="font-size:9.5px;font-weight:800;color:#4338CA;background:#EEF2FF;padding:1px 7px;border-radius:99px;vertical-align:middle">NEXT UP</span>':''}</span>
        ${done?`<span style="font-size:11px;color:var(--c-text-3);flex-shrink:0">${by?esc(fullName(by))+' · ':''}${a.submittedAt?new Date(a.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</span>`
          :(st?_qsBadge(c.id,cd,q.id):'')}
        ${wc&&m.contactEmail&&canEdit?`<button onclick="App._nudgeClient('${l.id}','${c.id}','${q.id}')" title="${ng?'Last nudged '+new Date(ng.sentAt).toLocaleString('en-GB',{day:'numeric',month:'short'}):'Email the client a reminder about this'}" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px;flex-shrink:0">${ic('mail','w-3 h-3')} Nudge${ng?'d '+new Date(ng.sentAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}</button>`:''}
      </div>`;
    }).join('');
    return `<div class="ui-card" style="margin-bottom:10px;overflow:hidden">
      <div style="padding:13px 16px 11px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-size:14.5px;font-weight:800">${esc(c.name)}</span>
          ${cs?`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;background:#DCFCE7;color:#0B7A55">COMPLETED ${cs.submittedAt?new Date(cs.submittedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}</span>`
            :over?'<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;background:#FEE2E2;color:#B91C1C">OVERDUE</span>'
            :'<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;background:#EEF2FF;color:#4338CA">OPEN</span>'}
          <span style="margin-left:auto;font-size:12px;font-weight:800;color:${pct===100?'#0B7A55':'var(--c-text-2)'}">${prog.done}/${prog.total} · ${pct}%</span>
        </div>
        <div style="height:7px;border-radius:99px;background:var(--c-surface-2);overflow:hidden;margin-bottom:6px"><div style="height:100%;width:${pct}%;border-radius:99px;background:${cs?'#22C55E':over?'#EF4444':'#0EA5E9'};transition:width .3s"></div></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--c-text-3)">
          <span>opened ${fmtS(caseDate(c))}</span>
          ${dl?`<span style="${over&&!cs?'color:#B91C1C;font-weight:700':''}">due ${esc(dl)}</span>`:''}
          ${(c.assignees||[]).length?`<span>${(c.assignees||[]).length} on it</span>`:''}
        </div>
      </div>
      <div style="padding:2px 16px 12px">${rows}</div>
    </div>`;
  };

  // ── blocked summary across the whole client ──
  const blocked=[];
  openCases.forEach(c=>{const cd=caseDate(c);_clQuestions(c).forEach(q=>{
    const a=_ansFor(c.id,cd,q.id);if(a&&a.response!==null&&a.response!=='')return;
    const st=_qStatusOf(c.id,cd,q.id);if(!st||st.status==='in_progress')return;
    blocked.push({c,q,st,days:_qsDays(st)});});});
  blocked.sort((a,b)=>b.days-a.days);
  const blockedCard=blocked.length?`<div class="ui-card" style="border-left:4px solid #F59E0B;padding:12px 16px;margin-bottom:12px">
    <div style="font-size:12.5px;font-weight:800;margin-bottom:6px">${ic('clock','w-4 h-4 inline')} Waiting on someone — ${blocked.length}</div>
    ${blocked.slice(0,6).map(b=>`<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 0">
      <span style="flex:1;min-width:0">${esc(b.q.text)} <span style="color:var(--c-text-3)">· ${esc(b.c.name)}</span></span>
      ${_qsBadge(b.c.id,caseDate(b.c),b.q.id)}
    </div>`).join('')}
  </div>`:'';

  const recurringCard=recurring.length?`<div class="ui-card" style="padding:12px 16px;margin-bottom:12px">
    <div style="${lab};margin-bottom:6px">Recurring work for this client</div>
    ${recurring.map(c=>{const on=clOn(c,todayISO());const sub=on?runSub(c.id,todayISO()):null;
      return `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 0">
        <span style="flex:1">${esc(c.name)} <span style="color:var(--c-text-3)">· ${esc(c.schedule||c.frequency)}</span></span>
        ${on?(sub?'<span style="font-size:10px;font-weight:800;color:#0B7A55">DONE TODAY</span>':'<span style="font-size:10px;font-weight:800;color:#92400E">DUE TODAY</span>'):'<span style="font-size:10px;font-weight:700;color:var(--c-text-3)">not today</span>'}
      </div>`;}).join('')}
  </div>`:'';

  return contact+share+blockedCard
    +(openCases.length?`<div style="${lab};margin:2px 0 8px">Open cases — ${openCases.length}</div>`+openCases.map(caseBlock).join(''):'')
    +((openCases.length===0&&doneCases.length===0)?empty('doc','No cases yet','Create a One-time checklist and attach this client — it becomes their case and shows here.'):'')
    +recurringCard
    +(doneCases.length?`<div style="${lab};margin:14px 0 8px">Completed — ${doneCases.length}</div>`+doneCases.map(caseBlock).join(''):'');
}

/* ── share links ── */
App._shareCreate=(locId)=>{
  if(!can('locations','edit'))return toast('You need Clients → Edit','err');
  const tok=Array.from(crypto.getRandomValues(new Uint8Array(18))).map(b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('');
  const row={token:tok,clientId:locId,enabled:true,createdBy:S.uid,createdAt:new Date().toISOString()};
  DB.tmShareLinks=DB.tmShareLinks||[];DB.tmShareLinks.push(row);
  sb.from('tm_share_links').insert({token:tok,client_id:locId,enabled:true,created_by:S.uid})
    .then(({error})=>{if(error)_syncErr('share link')(error);}).catch(_syncErr('share link'));
  log(fullName(me()),'Client link created',locById(locId)?.name||locId);
  saveDB();rr();toast('Link created — copy it and send it to the client');
};
App._shareCopy=(tok)=>{
  const url=window.location.origin+window.location.pathname+'#status/'+tok;
  (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('Link copied'),
    ()=>{const i=document.createElement('input');i.value=url;document.body.appendChild(i);i.select();try{document.execCommand('copy');toast('Link copied');}catch(e){toast(url,'warn');}i.remove();});
};
App._shareRevoke=(tok)=>{
  if(!can('locations','edit'))return toast('You need Clients → Edit','err');
  if(!confirm('Revoke this link? The client\'s page stops working immediately.'))return;
  const row=(DB.tmShareLinks||[]).find(x=>x.token===tok);if(row){row.enabled=false;row.revokedAt=new Date().toISOString();}
  sb.from('tm_share_links').update({enabled:false,revoked_at:new Date().toISOString()}).eq('token',tok)
    .then(({error})=>{if(error)_syncErr('share link')(error);}).catch(_syncErr('share link'));
  log(fullName(me()),'Client link revoked','');
  saveDB();rr();toast('Link revoked','warn');
};
async function _shareLoad(){
  try{
    const {data,error}=await sb.from('tm_share_links').select('*');
    if(error)return;
    DB.tmShareLinks=(data||[]).map(r=>({token:r.token,clientId:r.client_id,enabled:r.enabled!==false,createdBy:r.created_by||null,createdAt:r.created_at||null,revokedAt:r.revoked_at||null}));
  }catch(e){}
}
async function _nudgeLoad(){
  try{
    const {data,error}=await sb.from('tm_nudges').select('*').order('sent_at',{ascending:false}).limit(300);
    if(error)return;
    DB.tmNudges=(data||[]).map(r=>({id:r.id,clientId:r.client_id,checklistId:r.checklist_id||null,questionId:r.question_id||null,toEmail:r.to_email,note:r.note||'',sentBy:r.sent_by||null,sentAt:r.sent_at||null}));
  }catch(e){}
}

/* ── nudge: email the client about the thing we're waiting on, and keep the record ── */
App._nudgeClient=(locId,clId,qId)=>{
  if(!can('locations','edit'))return toast('You need Clients → Edit','err');
  const l=locById(locId);const m=(DB.tmClientMeta||{})[locId]||{};const c=clById(clId);
  const q=(DB.questions||[]).find(x=>x.id===qId);
  if(!l||!c||!q)return;
  if(!m.contactEmail)return toast('Add a contact email on the client first','err');
  if(!confirm('Email '+m.contactEmail+' a reminder about "'+q.text+'"?'))return;
  const subj='A quick reminder from '+((_ns&&_ns.email_from_name)||'Evarca')+' — '+c.name;
  const body='Hello'+(m.contactName?' '+m.contactName:'')+',\n\nWe are still waiting on you for the following item on "'+c.name+'":\n\n  • '+q.text+'\n\nSending it over as soon as convenient keeps your setup on schedule. Thank you!\n\n'+(((_ns&&_ns.email_from_name)||'Evarca'));
  const ob={id:uid('ob'),to_user:null,to_email:m.contactEmail,subject:subj,body,kind:'client_nudge',status:'queued',created_at:new Date().toISOString(),created_by_uid:S.uid};
  sb.from('notif_outbox').insert(ob).then(({error})=>{if(error)_syncErr('nudge email')(error);}).catch(_syncErr('nudge email'));
  const ng={id:uid('ng'),clientId:locId,checklistId:clId,questionId:qId,toEmail:m.contactEmail,note:q.text,sentBy:S.uid,sentAt:new Date().toISOString()};
  DB.tmNudges=DB.tmNudges||[];DB.tmNudges.unshift(ng);
  sb.from('tm_nudges').insert({id:ng.id,client_id:locId,checklist_id:clId,question_id:qId,to_email:m.contactEmail,note:q.text,sent_by:S.uid})
    .then(({error})=>{if(error)_syncErr('nudge log')(error);}).catch(_syncErr('nudge log'));
  log(fullName(me()),'Nudged client',l.name+' — '+q.text);
  saveDB();rr();toast('Reminder queued to '+m.contactEmail);
};

App.editLoc=(id=null)=>{
  const l=id?locById(id):null;
  const m=(DB.tmClientMeta||{})[id||'']||{};
  const lab='display:block;font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px';
  modalShell({title:`${l?'Edit':'New'} client`,sub:l?esc(l.name):'Add a client you run checklists for',size:'max-w-md',
  body:`<div style="display:flex;flex-direction:column;gap:14px">
    ${fld('Client name *','ln-n',l?.name||'','text','e.g. Acme Trading LLC')}
    <div class="grid grid-cols-2 gap-3">
      ${fld('Contact person','ln-cn',m.contactName||'','text','Who you deal with')}
      ${fld('Reference / licence no.','ln-ref',m.reference||'','text','Optional')}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${fld('Contact email','ln-ce',m.contactEmail||'','email','name@company.com')}
      ${fld('Contact phone','ln-cp',m.contactPhone||'','tel','+971…')}
    </div>
    ${fld('Address','ln-a',l?.address||'','text','Office or trade address')}
    <div class="grid grid-cols-2 gap-3">
      ${selF('Owning department','ln-d',[['','All departments'],...DB.departments.map(d=>[d.name,d.name])],l?.department||'')}
      ${selF('Status','ln-s',['Active','Inactive'],l?.status||'Active')}
    </div>
    <div><label for="ln-notes" style="${lab}">Notes</label>
      <textarea id="ln-notes" rows="3" class="ui-input rf" placeholder="Anything the team should know about this client…">${esc(m.notes||'')}</textarea></div>
  </div>`,
  footer:btnG('Cancel','App.closeModal()')+btnP(l?'Save':'Create client',`App.saveLoc('${id||''}')`)});
};
App.saveLoc=(id)=>{
  const n=$('#ln-n')?.value.trim();
  if(!n){toast('Client name is required','err');return;}
  const data={name:n,address:$('#ln-a')?.value.trim()||'',department:$('#ln-d')?.value||'',status:$('#ln-s')?.value||'Active'};
  const obj=id?locById(id):{id:uid('loc'),...data};
  if(id)Object.assign(obj,data);else DB.locations.push(obj);
  // A non-admin creator with client chips would otherwise lose sight of the client they just
  // made — add it to their own scope on create.
  if(!id){const cu=me();if(cu&&Array.isArray(cu.cities)&&cu.cities.length&&!cu.cities.includes(obj.id)){cu.cities.push(obj.id);sb.from('profiles').update({cities:cu.cities}).eq('id',cu.id).then(()=>{}).catch(()=>{});}}
  // The contact details live in the new tm_client_meta table, so `locations` keeps its shape.
  _clientMetaSave(obj.id,{
    contactName:$('#ln-cn')?.value.trim()||'',
    contactEmail:$('#ln-ce')?.value.trim()||'',
    contactPhone:$('#ln-cp')?.value.trim()||'',
    reference:$('#ln-ref')?.value.trim()||'',
    notes:$('#ln-notes')?.value.trim()||'',
  });
  log(fullName(me()),id?'Edited client':'Created client',n);
  toast(id?'Client updated':'Client created');saveDB();closeModal();render();
  sb.from('locations').upsert({id:obj.id,...data},{onConflict:'id'}).then(({error})=>{if(error)_syncErr('client')(error);}).catch(_syncErr('client'));
};
/* Client details: local write plus a targeted upsert on the new table. */
function _clientMetaSave(clientId,meta){
  DB.tmClientMeta=DB.tmClientMeta||{};
  DB.tmClientMeta[clientId]={...(DB.tmClientMeta[clientId]||{}),...meta};
  sb.from('tm_client_meta').upsert({client_id:clientId,contact_name:meta.contactName||'',contact_email:meta.contactEmail||'',
    contact_phone:meta.contactPhone||'',reference:meta.reference||'',notes:meta.notes||'',updated_at:new Date().toISOString()},{onConflict:'client_id'})
    .then(({error})=>{if(error)_syncErr('client details')(error);}).catch(_syncErr('client details'));
}
async function _clientMetaLoad(){
  try{
    const {data,error}=await sb.from('tm_client_meta').select('*');
    if(error)return;
    DB.tmClientMeta={};
    (data||[]).forEach(r=>{DB.tmClientMeta[r.client_id]={contactName:r.contact_name||'',contactEmail:r.contact_email||'',contactPhone:r.contact_phone||'',reference:r.reference||'',notes:r.notes||''};});
  }catch(e){console.warn('[client details] load skipped:',e&&e.message);}
}

App.delLoc=(id)=>{if(!can('locations','delete'))return toast('You need Clients → Delete','err');const l=locById(id);if(!l)return;
// Referential-integrity guard: blocked while people are assigned to it, checklists use it,
// or announcements target it.
if(!guardDelete('location',id,'"'+l.name+'"'))return;
if(!confirm('Delete "'+l.name+'"?'))return;if(!DB.locations_deleted)DB.locations_deleted=[];if(!DB.locations_deleted.includes(id))DB.locations_deleted.push(id);DB.locations=DB.locations.filter(x=>x.id!==id);
// DATA-4: clear the dangling locationId from every user pointing at the deleted location
// (mirrors the dept-clear pattern; u.hrm syncs via the user_hrm table, so cleared ids propagate on next sync).
// M4: _ensureHrm also self-heals a stale locationId on devices that haven't received this clear yet.
DB.users.forEach(u=>{if(u.hrm&&u.hrm.locationId===id)u.hrm.locationId=null;});
saveDB();render();toast('Deleted','warn');sb.from('locations').delete().eq('id',id).then(({error})=>{if(error)console.error('delLoc:',error.message);}).catch(()=>{});};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.locsPage=locsPage;window._clientMetaSave=_clientMetaSave;window._clientMetaLoad=_clientMetaLoad;window._locProgTab=_locProgTab;window._shareLoad=_shareLoad;window._nudgeLoad=_nudgeLoad;window._pubStatusRender=_pubStatusRender;window._pubStatusBoot=_pubStatusBoot;
