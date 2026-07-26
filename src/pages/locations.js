

/* ===== LOCATIONS ===== */
function locsPage(){
  const sel=S.filters.locSel||null;
  if(S.filters.locTab==='bill'&&!canBillView())S.filters.locTab='prog'; // billing is permission-gated
  const stab=S.filters.locTab||'prog';
  // ── Detail view ──
  if(sel){
    const l=DB.locations.find(x=>x.id===sel);
    if(!l){S.filters.locSel=null;return locsPage();}
    // Requirement #6: block opening a city outside the user's city scope — but NEVER for admins
    // (an admin with old client chips must not lose access to a client they just created).
    if(!isAdmin()){const _mc=myCityScope();if(_mc.length&&!_mc.includes(l.id)){S.filters.locSel=null;toast('You do not have access to this client','warn');return locsPage();}}
    const TABS=[['prog',ic('chart','w-4 h-4')+'Progress'],...(canBillView()?[['bill',ic('receipt','w-4 h-4')+'Billing']]:[]),['docs',ic('folder','w-4 h-4')+'Documents'],['info',ic('info','w-4 h-4')+'Info']];
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
      +(stab==='bill'?_locBillTab(l):'')
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
      <td class="px-4 py-2.5">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:32px;height:32px;border-radius:9px;background:#EFF6FF;color:#1D4ED8;display:grid;place-items:center;flex-shrink:0">${ic('pin','w-4 h-4')}</span>
          <div style="min-width:0">
            <div style="font-size:13.5px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.name)}</div>
            ${l.address?`<div style="font-size:11.5px;color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.address)}</div>`:''}
          </div>
        </div>
      </td>
      <td class="px-4 py-2.5 text-sm">${l.department?esc(l.department):'<span class="text-ink-300">All departments</span>'}</td>
      <td class="px-4 py-2.5 text-sm" style="white-space:nowrap">${nC?nC+' checklist'+(nC===1?'':'s'):'<span class="text-ink-300">—</span>'}</td>
      <td class="px-4 py-2.5" style="white-space:nowrap;min-width:130px">${_oc.length?`<div style="display:flex;align-items:center;gap:7px"><div style="flex:0 0 54px;height:6px;border-radius:99px;background:var(--c-surface-2);overflow:hidden"><div style="height:100%;width:${_avg}%;border-radius:99px;background:${_blk?'#F59E0B':'#0EA5E9'}"></div></div><span style="font-size:11.5px;font-weight:700;color:var(--c-text-2)">${_oc.length} open · ${_avg}%</span>${_blk?`<span title="${_blk} step(s) waiting on the client or an authority" style="font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:99px;background:#FEF3C7;color:#92400E">${_blk} blocked</span>`:''}</div>`:'<span class="text-ink-300 text-sm">—</span>'}</td>
      <td class="px-4 py-2.5 text-sm" style="white-space:nowrap">${(nD||nF)?(nF?nF+' folder'+(nF===1?'':'s')+' · ':'')+nD+' file'+(nD===1?'':'s'):'<span class="text-ink-300">—</span>'}</td>
      ${canBillView()?`<td class="px-4 py-2.5 text-sm" style="white-space:nowrap">${(()=>{const b=_cliBilling(l.id);if(!b&&!_cliPaid(l.id))return'<span class="text-ink-300">—</span>';const bal=Math.max(0,_cliBalance(l.id));return `<span style="font-weight:700;color:${bal>0?'#B45309':'#0B7A55'}">${esc(fmtMoney(bal,_cliCurrency(l.id)))}</span>`;})()}</td>`:''}
      <td class="px-4 py-2.5">${chip(l.status||'Active')}</td>
      <td class="px-4 py-2.5"><div style="display:flex;gap:4px;justify-content:flex-end">
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
          ${canBillView()?'<th class="px-4 py-2.5 font-semibold">Balance due</th>':''}
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
   server-side by the tm_client_status_v2 RPC (SECURITY DEFINER; anon has no table access).
   It shows progress — step labels, done ticks with dates, what we're waiting on THEM for
   and for exactly how long (days and hours) — never who on the team did what, and never
   per-step costs. When the team allows it, every waiting-on-you item carries a respond box:
   the client can reply, upload the pending documents (they land straight in their client
   file under “From client”), or simply confirm — which clears the waiting flag and
   notifies the team the moment they do. Two per-link switches can additionally surface
   open tickets and a Total/Paid/Balance summary. Refreshes itself every 60s while open
   (paused while a respond box is open). */
function _pubWaitLabel(s2){
  const h=Number(s2.waiting_hours);if(!(h>0))return'';
  const d=Math.floor(h/24);
  return d>0?d+'d '+(h%24)+'h':h+'h';
}
async function _pubStatusRender(token,fresh){
  const el=document.getElementById('app');if(!el)return;
  if(window._pubFormOpen&&!fresh)return;         // never yank the page out from under a half-written reply
  window._pubT=token;
  if(fresh==='cache'&&!window._pubData)fresh=true; // nothing cached yet -> fall through to a real fetch
  const wrap=inner=>`<div style="min-height:100vh;background:#F7F6F2;padding:28px 16px;font-family:inherit">
    <div style="max-width:640px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        <img src="/icon-192.png" alt="Evarca" width="38" height="38" style="width:38px;height:38px;border-radius:11px;object-fit:cover" onerror="this.outerHTML='<div style=&quot;width:38px;height:38px;border-radius:11px;background:#15171C;color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px&quot;>E</div>'"/>
        <div><div style="font-size:15px;font-weight:800;color:#15171C">Evarca</div><div style="font-size:11px;color:#9CA3AF">Live status</div></div>
      </div>
      ${inner}
      <div style="text-align:center;font-size:11px;color:#B8B5AC;margin-top:22px">This page updates automatically. Questions? Reply to your account manager.</div>
    </div></div>`;
  if(!window._pubData)el.innerHTML=wrap('<div style="text-align:center;color:#9CA3AF;padding:60px 0;font-size:14px">Loading your status…</div>');
  let data=null;
  if(fresh==='cache')data=window._pubData;       // opening/closing the respond box: no refetch, no flicker
  else try{const r=await sb.rpc('tm_client_status_v2',{p_token:token});data=r.data;if(r.error)throw r.error;}catch(e){data=null;}
  if(!data||data.ok===false){
    // keep showing the last good page on a transient network error; only a definitive
    // server "no" (or nothing cached at all) gets the dead-link screen
    if(data&&data.ok===false)window._pubData=null;
    if(window._pubData)return;
    el.innerHTML=wrap('<div class="ui-card" style="padding:34px 24px;text-align:center"><div style="font-size:16px;font-weight:800;margin-bottom:6px">This link is no longer active</div><div style="font-size:13px;color:#6B7280">Please ask your account manager for a fresh status link.</div></div>');
    return;
  }
  window._pubData=data;
  if(window._pubFormOpen&&!fresh)return;         // a form opened while we were fetching
  const cases=Array.isArray(data.cases)?data.cases:[];
  const caseHtml=cases.map(cs=>{
    const steps=Array.isArray(cs.steps)?cs.steps:[];
    const done=steps.filter(s2=>s2.done).length;
    const pct=steps.length?Math.round(done/steps.length*100):0;
    const complete=!!cs.done;
    const waitingYou=steps.filter(s2=>!s2.done&&s2.waiting==='waiting_client');
    const clId=String(cs.checklist_id||'');
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
        ${waitingYou.map(s2=>{
          const key=clId+'|'+String(s2.qid||'');
          const dur=_pubWaitLabel(s2);
          const open=window._pubFormOpen===key;
          return `<div style="padding:2px 0">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12.5px;color:#78350F">
              <span style="flex:1;min-width:140px">• ${esc(s2.label||'')}${dur?` <span style="opacity:.7">(waiting ${esc(dur)})</span>`:''}</span>
              ${s2.can_respond&&!open?`<button onclick="App._pubForm('${esc(clId)}','${esc(String(s2.qid||''))}')" style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:8px;border:none;background:#92400E;color:#fff;cursor:pointer">Respond</button>`:''}
            </div>
            ${s2.waiting_note?`<div style="font-size:12px;color:#92400E;padding:1px 0 1px 12px">${esc(s2.waiting_note)}</div>`:''}
            ${open?_pubFormHtml(clId,String(s2.qid||''),s2):''}
          </div>`;}).join('')}
        ${waitingYou.some(s2=>s2.can_respond)?'<div style="font-size:11px;color:#B45309;margin-top:5px">Tap <b>Respond</b> to reply, attach the documents, or simply confirm — it reaches the team instantly.</div>':''}
      </div>`:''}
      <div>${steps.map(s2=>`<div style="display:flex;align-items:center;gap:9px;padding:6px 0;border-top:1px solid #F5F4F0">
        <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;${s2.done?'background:#DCFCE7;color:#0B7A55':'background:#F3F4F6;color:#C8C5BD'}">${s2.done?ic('check','w-3 h-3'):''}</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:${s2.done?'#9CA3AF':'#15171C'}">${esc(s2.label||'')}</span>
        ${s2.replied_at&&!s2.done?`<span title="Received — thank you" style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:#DBEAFE;color:#1D4ED8">SENT ${new Date(s2.replied_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} ✓</span>`:''}
        ${s2.done&&s2.done_at?`<span style="font-size:11px;color:#B8B5AC">${new Date(s2.done_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>`
          :s2.waiting==='waiting_client'?`<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:#FEF3C7;color:#92400E">WITH YOU${_pubWaitLabel(s2)?' · '+esc(_pubWaitLabel(s2)):''}</span>`
          :s2.waiting==='waiting_authority'?`<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:#EDE9FE;color:#5B21B6">WITH AUTHORITY${_pubWaitLabel(s2)?' · '+esc(_pubWaitLabel(s2)):''}</span>`:''}
      </div>`).join('')}</div>
    </div>`;
  }).join('');
  // Optional sections, controlled by the team per link.
  const billing=data.billing&&typeof data.billing==='object'?(()=>{
    const b=data.billing;const money=n=>fmtMoney(n,b.currency||'AED');
    return `<div style="background:#fff;border:1px solid #ECEDF0;border-radius:16px;box-shadow:0 1px 3px rgba(15,15,15,.04);padding:16px 20px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:800;color:#15171C;margin-bottom:8px">Account summary</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <div><div style="font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.05em">Total</div><div style="font-size:16px;font-weight:800;color:#15171C">${esc(money(b.total))}</div></div>
        <div><div style="font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.05em">Paid</div><div style="font-size:16px;font-weight:800;color:#0B7A55">${esc(money(b.paid))}</div></div>
        <div><div style="font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.05em">Balance due</div><div style="font-size:16px;font-weight:800;color:${Number(b.balance)>0?'#B45309':'#0B7A55'}">${esc(money(Math.max(0,Number(b.balance)||0)))}</div></div>
      </div>
    </div>`;})():'';
  const tickets=Array.isArray(data.tickets)?`<div style="background:#fff;border:1px solid #ECEDF0;border-radius:16px;box-shadow:0 1px 3px rgba(15,15,15,.04);padding:16px 20px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:800;color:#15171C;margin-bottom:6px">Open items being looked into — ${data.tickets.length}</div>
      ${data.tickets.length?data.tickets.map(t=>`<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:4px 0;border-top:1px solid #F5F4F0">
        <span style="width:7px;height:7px;border-radius:99px;background:${t.priority==='High'||t.priority==='Critical'?'#EF4444':t.priority==='Medium'?'#F59E0B':'#9CA3AF'};flex-shrink:0"></span>
        <span style="flex:1;font-weight:600;color:#374151">${esc(t.title||'')}</span>
        <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;background:#F3F4F6;color:#6B7280">${esc(String(t.status||'').toUpperCase())}</span>
      </div>`).join(''):'<div style="font-size:12px;color:#9CA3AF">Nothing open right now.</div>'}
    </div>`:'';
  el.innerHTML=wrap(`
    <div style="margin-bottom:16px"><div style="font-size:21px;font-weight:800;color:#15171C">${esc(data.client||'')}</div>
    <div style="font-size:12.5px;color:#9CA3AF;margin-top:2px">Updated ${new Date(data.generated_at||Date.now()).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>
    ${billing}
    ${caseHtml||'<div style="background:#fff;border:1px solid #ECEDF0;border-radius:16px;padding:34px 24px;text-align:center;font-size:13px;color:#6B7280">Nothing in progress right now.</div>'}
    ${tickets}`);
}

/* ── the respond box (message + documents + one-tap confirm) ── */
function _pubFormHtml(clId,qid,s2){
  const picked=window._pubFiles||[];
  return `<div style="background:#fff;border:1px solid #FDE68A;border-radius:10px;padding:11px 12px;margin:7px 0 4px">
    <div style="font-size:11.5px;font-weight:800;color:#92400E;margin-bottom:6px">${esc(s2.label||'Respond')}</div>
    <textarea id="pub-msg" rows="3" placeholder="Write a short reply… (optional if you attach files)" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #E5E7EB;border-radius:9px;font-size:13px;resize:vertical;outline:none;font-family:inherit"></textarea>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">
      <label style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:9px;background:#F3F4F6;color:#374151;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid #E5E7EB">
        ${ic('paperclip','w-3.5 h-3.5')}Attach documents<input type="file" multiple style="display:none" onchange="App._pubPick(this)"/>
      </label>
      <span id="pub-file-list" style="font-size:11.5px;color:#6B7280">${picked.length?picked.map(f=>esc(f.name)).join(', '):'Up to 6 files, 25 MB each'}</span>
    </div>
    <div id="pub-form-err" style="display:none;font-size:12px;font-weight:700;color:#B91C1C;margin-top:7px"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button id="pub-send" onclick="App._pubSend('${esc(clId)}','${esc(qid)}')" style="font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:9px;border:none;background:#0E9F6E;color:#fff;cursor:pointer">Send response</button>
      <button onclick="App._pubConfirm('${esc(clId)}','${esc(qid)}')" title="No message or file — just tell the team this is taken care of" style="font-size:12.5px;font-weight:700;padding:8px 14px;border-radius:9px;border:1.5px solid #E5E7EB;background:#fff;color:#374151;cursor:pointer">✓ Just confirm</button>
      <button onclick="App._pubFormClose()" style="font-size:12.5px;font-weight:700;padding:8px 12px;border-radius:9px;border:none;background:transparent;color:#9CA3AF;cursor:pointer">Cancel</button>
    </div>
  </div>`;
}
App._pubForm=(clId,qid)=>{window._pubFormOpen=clId+'|'+qid;window._pubFiles=[];_pubStatusRender(window._pubT,'cache');};
App._pubFormClose=()=>{window._pubFormOpen=null;window._pubFiles=[];_pubStatusRender(window._pubT,'cache');};
App._pubPick=(input)=>{
  const files=[...((input&&input.files)||[])].slice(0,6);
  window._pubFiles=files.filter(f=>f.size<=25*1024*1024);
  const el=document.getElementById('pub-file-list');
  if(el)el.textContent=window._pubFiles.length?window._pubFiles.map(f=>f.name).join(', '):'Up to 6 files, 25 MB each';
  if(files.some(f=>f.size>25*1024*1024))_pubErr('A file over 25 MB was skipped');
};
function _pubErr(msg){const el=document.getElementById('pub-form-err');if(el){el.style.display='block';el.textContent=msg;}}
App._pubConfirm=(clId,qid)=>App._pubSubmit(clId,qid,'confirm');
App._pubSend=(clId,qid)=>App._pubSubmit(clId,qid,null);
App._pubSubmit=async(clId,qid,forceKind)=>{
  if(window._pubBusy)return;
  const token=window._pubT;if(!token)return;
  const msg=forceKind==='confirm'?'':String(document.getElementById('pub-msg')?.value||'').trim();
  const files=forceKind==='confirm'?[]:(window._pubFiles||[]);
  if(forceKind!=='confirm'&&!msg&&!files.length){_pubErr('Write a reply or attach a document — or use “Just confirm”.');return;}
  window._pubBusy=true;
  const btn2=document.getElementById('pub-send');if(btn2){btn2.disabled=true;btn2.textContent=files.length?'Uploading…':'Sending…';}
  try{
    const meta=[];
    for(const f of files.slice(0,6)){
      const safe=String(f.name).replace(/[^\w.\- ]+/g,'_').slice(0,120);
      const path='client-uploads/'+token+'/'+uid('cu')+'_'+safe;
      const {error}=await sb.storage.from('tm-location-docs').upload(path,f,{cacheControl:'3600',upsert:false,contentType:f.type||'application/octet-stream'});
      if(error){console.warn('[client upload]',error.message);continue;}
      meta.push({name:f.name,path,size:f.size,type:f.type||''});
    }
    if(files.length&&!meta.length){_pubErr('The upload did not go through — please try again.');return;}
    const kind=forceKind||(meta.length?'document':'reply');
    const r=await sb.rpc('tm_client_respond',{p_token:token,p_checklist:clId,p_question:qid,p_kind:kind,p_message:msg,p_files:meta});
    if(r.error||!r.data||r.data.ok===false){
      const reason=(r.data&&r.data.reason)||'error';
      _pubErr(reason==='not_waiting'?'This item was just updated by the team — refreshing…':'Could not send right now — please try again.');
      if(reason==='not_waiting'){window._pubFormOpen=null;window._pubFiles=[];setTimeout(()=>_pubStatusRender(token,true),900);}
      return;
    }
    window._pubFormOpen=null;window._pubFiles=[];
    await _pubStatusRender(token,true);
    try{toast('Sent — thank you! The team has been notified.','ok');}catch(e){}
  }catch(e){_pubErr('Could not send right now — please try again.');}
  finally{
    window._pubBusy=false;
    const b3=document.getElementById('pub-send');if(b3){b3.disabled=false;b3.textContent='Send response';}
  }
};
function _pubStatusBoot(){
  const h=String(window.location.hash||'');
  const m2=h.match(/^#status\/([a-z0-9]{10,64})$/);
  if(!m2)return false;
  document.title='Status — Evarca';
  window._pubFormOpen=null;window._pubFiles=[];window._pubData=null;window._pubBusy=false;
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
  const contact=`<div class="ui-card" style="padding:10px 14px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
    ${[['Contact',m.contactName],['Email',m.contactEmail],['Phone',m.contactPhone],['Reference',m.reference]].filter(x=>x[1]).map(([k,v])=>`<div><div style="${lab}">${k}</div><div style="font-size:13px;font-weight:600">${esc(v)}</div></div>`).join('')||'<span style="font-size:12px;color:var(--c-text-3)">No contact details yet — add them with Edit above.</span>'}
    ${m.notes?`<div style="flex-basis:100%;font-size:12px;color:var(--c-text-2);font-style:italic">"${esc(m.notes)}"</div>`:''}
  </div>`;

  // ── money strip (Billing permission only): total · paid · balance · utilized ──
  const bill=_cliBilling(l.id);
  const cur=_cliCurrency(l.id);
  const paid=_cliPaid(l.id),used=_cliUtilized(l.id);
  const billStrip=(canBillView()&&(bill||paid>0||used>0))?(()=>{
    const total=bill?Number(bill.total)||0:0;
    const pctPaid=total>0?Math.min(100,Math.round(paid/total*100)):0;
    return `<div class="ui-card" style="padding:10px 14px;margin-bottom:10px;cursor:pointer" onclick="App._setLocTab('bill')" title="Open the Billing tab">
      <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
        <div><div style="${lab}">Total value</div><div style="font-size:15px;font-weight:800">${esc(fmtMoney(total,cur))}</div></div>
        <div><div style="${lab}">Paid</div><div style="font-size:15px;font-weight:800;color:#0B7A55">${esc(fmtMoney(paid,cur))}</div></div>
        <div><div style="${lab}">Balance due</div><div style="font-size:15px;font-weight:800;color:${total-paid>0?'#B45309':'var(--c-text)'}">${esc(fmtMoney(Math.max(0,total-paid),cur))}</div></div>
        <div><div style="${lab}">Utilized</div><div style="font-size:15px;font-weight:800;color:${total>0&&used>total?'#B91C1C':'var(--c-text-2)'}">${esc(fmtMoney(used,cur))}</div></div>
        ${total>0?`<div style="flex:1;min-width:140px"><div style="${lab};margin-bottom:4px">${pctPaid}% collected</div>
          <div style="height:7px;border-radius:99px;background:var(--c-surface-2);overflow:hidden"><div style="height:100%;width:${pctPaid}%;border-radius:99px;background:#0EA5E9"></div></div></div>`:''}
        <span style="margin-left:auto;font-size:11px;font-weight:700;color:var(--c-brand-ink)">${ic('receipt','w-3.5 h-3.5 inline')} Billing →</span>
      </div>
    </div>`;})():'';

  // ── what the client sent back through the status link ──
  const replies=_repliesFor(l.id);
  const repliesCard=replies.length?`<div class="ui-card" style="border-left:3px solid #0EA5E9;padding:10px 14px;margin-bottom:10px">
    <div style="font-size:12.5px;font-weight:800;margin-bottom:6px">${ic('send','w-4 h-4 inline')} From the client — ${replies.length}</div>
    ${replies.slice(0,6).map(r=>{
      const q=(DB.questions||[]).find(x=>x.id===r.questionId);const c2=clById(r.checklistId);
      return `<div style="padding:6px 0;border-top:1px solid var(--c-border)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:800;padding:1px 8px;border-radius:99px;${r.kind==='document'?'background:#EFF6FF;color:#1D4ED8':r.kind==='confirm'?'background:#DCFCE7;color:#0B7A55':'background:#F5F3FF;color:#5B21B6'}">${r.kind==='document'?'DOCUMENTS':r.kind==='confirm'?'CONFIRMED':'REPLY'}</span>
          <span style="flex:1;min-width:0;font-weight:600">${esc(q?q.text:r.questionId)} <span style="color:var(--c-text-3)">· ${esc(c2?c2.name:'')}</span></span>
          <span style="font-size:11px;color:var(--c-text-3)" title="${esc(String(r.submittedAt||''))}">${_agoLabel(r.submittedAt)}</span>
        </div>
        ${r.message?`<div style="font-size:12px;color:var(--c-text-2);font-style:italic;margin-top:3px;padding-left:2px">"${esc(r.message)}"</div>`:''}
        ${(r.files||[]).length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${(r.files||[]).map(f=>f.doc_id?`<button onclick="App._docDownload('${esc(f.doc_id)}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px">${ic('paperclip','w-3 h-3')} ${esc(String(f.name||'file').slice(0,40))}</button>`:'').join('')}</div>`:''}
      </div>`;}).join('')}
    <div style="font-size:11px;color:var(--c-text-3);margin-top:5px">Documents land in this client's Documents tab, under “From client”.</div>
  </div>`:'';

  // ── share link (+ per-link switches: respond / tickets / billing summary) ──
  const link=(DB.tmShareLinks||[]).find(x=>x.clientId===l.id&&x.enabled);
  const shareUrl=link?(window.location.origin+window.location.pathname+'#status/'+link.token):'';
  const _sp=_sharePrefsOf(l.id);
  const _spTog=(key,label,on,hint)=>`<label title="${esc(hint)}" style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:${on?'var(--c-text)':'var(--c-text-3)'};cursor:pointer">
      <button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="App._sharePref('${l.id}','${key}')"><span></span></button>${label}</label>`;
  const share=canEdit?`<div class="ui-card" style="padding:10px 14px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="font-size:13px;font-weight:800">${ic('link','w-4 h-4 inline')} Client status link</div>
        <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">A page the client can open any time — progress, what we're waiting on them for, and (if you allow it) a way to reply or send documents right there. No login. Revoke it whenever you like.</div>
      </div>
      ${link?`<input readonly value="${esc(shareUrl)}" onclick="this.select()" class="ui-input" style="flex:2;min-width:220px;min-height:0;height:34px;font-size:12px"/>
        <button onclick="App._shareCopy('${esc(link.token)}')" class="ui-btn ui-btn-primary ui-btn-sm">Copy link</button>
        <button onclick="App._shareRevoke('${esc(link.token)}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="color:var(--c-danger-ink)">Revoke</button>`
      :`<button onclick="App._shareCreate('${l.id}')" class="ui-btn ui-btn-primary ui-btn-sm">Create link</button>`}
    </div>
    ${link?`<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px dashed var(--c-border)">
      <span style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;align-self:center">The client sees</span>
      ${_spTog('allowRespond','Can respond & upload',_sp.allowRespond,'Waiting-on-you items get a reply box and a document upload on the status page')}
      ${_spTog('showTickets','Open tickets',_sp.showTickets,'Shows open ticket titles and statuses — never who they are assigned to')}
      ${_spTog('showBilling','Billing summary',_sp.showBilling,'Shows Total / Paid / Balance due only — never per-step costs')}
    </div>`:''}
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
      const escd=done&&_qrEscalates(c,q,a);
      const rep=!done?_replyForQ(c.id,cd,q.id):null;          // the client's own response, via the link
      const qc=canBillView()?_qCostOf(c.id,cd,q.id):null;      // per-step utilized cost (Billing eyes only)
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--c-border)">
        <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;${escd?'background:#FEE2E2;color:#B91C1C':done?'background:#DCFCE7;color:#0B7A55':'background:var(--c-surface-2);color:var(--c-text-3)'}">${escd?ic('alert','w-3 h-3'):done?ic('check','w-3 h-3'):(q===next?ic('chevR','w-3 h-3'):'')}</span>
        <span style="flex:1;min-width:0;font-size:13px;font-weight:${q===next?'800':'600'};color:${done?'var(--c-text-2)':'var(--c-text)'}">${esc(q.text)}${q===next&&!cs?' <span style="font-size:9.5px;font-weight:800;color:#4338CA;background:#EEF2FF;padding:1px 7px;border-radius:99px;vertical-align:middle">NEXT UP</span>':''}</span>
        ${qc&&qc.amount>0?`<span title="Utilized on this step" style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;background:var(--c-surface-2);color:var(--c-text-2);flex-shrink:0">${esc(fmtMoney(qc.amount,_cliCurrency(l.id)))}</span>`:''}
        ${escd?'<span style="font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:99px;background:#FEE2E2;color:#B91C1C;flex-shrink:0">ESCALATED</span>':''}
        ${rep&&!st?`<span title="${esc(rep.message||(rep.kind==='document'?'Documents received':'Confirmed by the client'))}" style="font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:99px;background:#DBEAFE;color:#1D4ED8;flex-shrink:0">CLIENT REPLIED ${esc(_agoLabel(rep.submittedAt)).toUpperCase()}</span>`:''}
        ${done?`<span style="font-size:11px;color:var(--c-text-3);flex-shrink:0">${by?esc(fullName(by))+' · ':''}${a.submittedAt?new Date(a.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</span>`
          :(st?_qsBadge(c.id,cd,q.id):'')}
        ${wc&&m.contactEmail&&canEdit?`<button onclick="App._nudgeClient('${l.id}','${c.id}','${q.id}')" title="${ng?'Last nudged '+new Date(ng.sentAt).toLocaleString('en-GB',{day:'numeric',month:'short'}):'Email the client a reminder about this'}" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px;flex-shrink:0">${ic('mail','w-3 h-3')} Nudge${ng?'d '+new Date(ng.sentAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}</button>`:''}
      </div>`;
    }).join('');
    return `<div class="ui-card" style="margin-bottom:8px;overflow:hidden">
      <div style="padding:11px 14px 9px">
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
          ${canBillView()&&_runUtilized(c.id,cd)>0?`<span title="Σ per-step costs on this case">utilized <b style="color:var(--c-text-2)">${esc(fmtMoney(_runUtilized(c.id,cd),_cliCurrency(l.id)))}</b></span>`:''}
        </div>
      </div>
      <div style="padding:2px 14px 10px">${rows}</div>
    </div>`;
  };

  // ── blocked summary across the whole client ──
  const blocked=[];
  openCases.forEach(c=>{const cd=caseDate(c);_clQuestions(c).forEach(q=>{
    const a=_ansFor(c.id,cd,q.id);if(a&&a.response!==null&&a.response!=='')return;
    const st=_qStatusOf(c.id,cd,q.id);if(!st||st.status==='in_progress')return;
    blocked.push({c,q,st,days:_qsDays(st)});});});
  blocked.sort((a,b)=>b.days-a.days);
  const blockedCard=blocked.length?`<div class="ui-card" style="border-left:3px solid #F59E0B;padding:10px 14px;margin-bottom:10px">
    <div style="font-size:12.5px;font-weight:800;margin-bottom:6px">${ic('clock','w-4 h-4 inline')} Waiting on someone — ${blocked.length}</div>
    ${blocked.slice(0,6).map(b=>{const wn=b.st.status==='waiting_client'?_waitNoteOf(b.c.id,caseDate(b.c),b.q.id):null;
      return `<div style="padding:3px 0">
      <div style="display:flex;align-items:center;gap:8px;font-size:12.5px">
        <span style="flex:1;min-width:0">${esc(b.q.text)} <span style="color:var(--c-text-3)">· ${esc(b.c.name)}</span></span>
        ${_qsBadge(b.c.id,caseDate(b.c),b.q.id)}
      </div>
      ${wn&&wn.note?`<div style="font-size:11.5px;color:#92400E;padding-left:2px">↳ waiting for: ${esc(wn.note)}</div>`:''}
    </div>`;}).join('')}
  </div>`:'';

  const recurringCard=recurring.length?`<div class="ui-card" style="padding:10px 14px;margin-bottom:10px">
    <div style="${lab};margin-bottom:6px">Recurring work for this client</div>
    ${recurring.map(c=>{const on=clOn(c,todayISO());const sub=on?runSub(c.id,todayISO()):null;
      return `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 0">
        <span style="flex:1">${esc(c.name)} <span style="color:var(--c-text-3)">· ${esc(c.schedule||c.frequency)}</span></span>
        ${on?(sub?'<span style="font-size:10px;font-weight:800;color:#0B7A55">DONE TODAY</span>':'<span style="font-size:10px;font-weight:800;color:#92400E">DUE TODAY</span>'):'<span style="font-size:10px;font-weight:700;color:var(--c-text-3)">not today</span>'}
      </div>`;}).join('')}
  </div>`:'';

  // ── open tickets touching this client (through its checklists) ──
  const cliTickets=(DB.tickets||[]).filter(t=>clientIdsOfTicket(t).includes(l.id)&&t.status!=='Resolved'&&t.status!=='Closed');
  const ticketsCard=`<div class="ui-card" style="padding:10px 14px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:${cliTickets.length?'6px':'0'}">
      <div style="font-size:12.5px;font-weight:800">${ic('flag','w-4 h-4 inline')} Open tickets — ${cliTickets.length}</div>
      ${can('tickets','create')?`<button onclick="App._newTicketFor('${l.id}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-left:auto">${ic('plus','w-3 h-3')} Raise ticket</button>`:''}
    </div>
    ${cliTickets.slice(0,5).map(t=>{const a2=uById(t.assignedTo);
      return `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:4px 0;cursor:pointer" onclick="S.route='tickets';S.filters.tkClient='${l.id}';render()">
        <span style="width:7px;height:7px;border-radius:99px;background:${t.priority==='High'||t.priority==='Critical'?'#EF4444':t.priority==='Medium'?'#F59E0B':'#9CA3AF'};flex-shrink:0"></span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${esc(t.title)}</span>
        ${chip(t.status)}
        ${a2?`<span style="font-size:11px;color:var(--c-text-3)">${esc(fullName(a2))}</span>`:''}
      </div>`;}).join('')}
    ${cliTickets.length>5?`<div style="font-size:11px;color:var(--c-text-3);margin-top:3px">+${cliTickets.length-5} more — tap any row to open Tickets filtered to this client.</div>`:''}
  </div>`;

  return contact+billStrip+share+repliesCard+blockedCard+ticketsCard
    +(openCases.length?`<div style="${lab};margin:2px 0 8px">Open cases — ${openCases.length}</div>`+openCases.map(caseBlock).join(''):'')
    +((openCases.length===0&&doneCases.length===0)?empty('doc','No cases yet','Create a One-time checklist and attach this client — it becomes their case and shows here.'):'')
    +recurringCard
    +(doneCases.length?`<div style="${lab};margin:14px 0 8px">Completed — ${doneCases.length}</div>`+doneCases.map(caseBlock).join(''):'');
}

/* ═══ THE BILLING TAB ═══
   Everything money for one client: the engagement total, every payment received,
   every invoice issued, and the running utilized/balance picture. Permission-gated
   by Clients → Billing & invoices; the tm_ billing tables enforce the same server-side. */
function _locBillTab(l){
  if(!(can('locations','billing')||can('locations','billingView')||isAdmin()))return '';
  const manage=canBill();
  const lab='font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em';
  const b=_cliBilling(l.id);
  const cur=_cliCurrency(l.id);
  const total=b?Number(b.total)||0:0;
  const paid=_cliPaid(l.id);
  const balance=Math.max(0,total-paid);
  const used=_cliUtilized(l.id);
  const pays=(DB.tmPayments||[]).filter(p=>p.clientId===l.id).sort((a,b2)=>String(b2.paidOn||'').localeCompare(String(a.paidOn||'')));
  const invs=(DB.tmInvoices||[]).filter(v=>v.clientId===l.id).sort((a,b2)=>String(b2.createdAt||'').localeCompare(String(a.createdAt||'')));
  const stat=(label,val,color)=>`<div class="ui-card" style="padding:10px 14px;flex:1;min-width:145px">
    <div style="${lab}">${label}</div><div style="font-size:17px;font-weight:800;margin-top:2px;color:${color||'var(--c-text)'}">${esc(val)}</div></div>`;

  const summary=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
    ${stat('Total value',fmtMoney(total,cur))}
    ${stat('Paid',fmtMoney(paid,cur),'#0B7A55')}
    ${stat('Balance due',fmtMoney(balance,cur),balance>0?'#B45309':'#0B7A55')}
    ${stat('Utilized',fmtMoney(used,cur),total>0&&used>total?'#B91C1C':'var(--c-text-2)')}
  </div>`;

  const actions=manage?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    ${btnP('Record payment',`App._payAdd('${l.id}')`,'plus')}
    ${btn('Generate invoice',`App._invGen('${l.id}','')`,{variant:'ghost',icon:'receipt'})}
    ${btn('Invoice template','App._invSettings()',{variant:'ghost',icon:'cog'})}
    <span style="margin-left:auto;font-size:11.5px;color:var(--c-text-3);align-self:center">Total &amp; currency are set on the client — Edit above.</span>
  </div>`:'<div style="font-size:11.5px;color:var(--c-text-3);margin-bottom:12px">View-only — recording payments and issuing invoices needs Clients → Billing — manage.</div>';

  const payCard=`<div class="ui-card" style="margin-bottom:12px;overflow:hidden">
    <div style="padding:9px 14px;border-bottom:1px solid var(--c-border);font-size:12.5px;font-weight:800">${ic('check','w-4 h-4 inline')} Payments — ${pays.length}</div>
    ${pays.length?pays.map(p=>{
      const by=uById(p.recordedBy);
      const inv=invs.find(v=>v.paymentId===p.id&&v.status!=='Void');
      return `<div style="display:flex;align-items:center;gap:9px;padding:7px 14px;border-bottom:1px solid var(--c-border);font-size:12.5px;flex-wrap:wrap">
        <span style="font-weight:800;min-width:110px">${esc(fmtMoney(p.amount,cur))}</span>
        <span style="color:var(--c-text-3)">${fmtS(String(p.paidOn||''))}</span>
        ${p.method?`<span style="font-size:10px;font-weight:700;padding:1px 8px;border-radius:99px;background:var(--c-surface-2);color:var(--c-text-2)">${esc(p.method)}</span>`:''}
        ${p.reference?`<span style="color:var(--c-text-3)">ref ${esc(p.reference)}</span>`:''}
        ${p.notes?`<span style="color:var(--c-text-3);font-style:italic">"${esc(p.notes)}"</span>`:''}
        <span style="margin-left:auto;display:inline-flex;gap:6px;align-items:center">
          ${by?`<span style="font-size:11px;color:var(--c-text-3)">${esc(fullName(by))}</span>`:''}
          ${inv?`<button onclick="App._invView('${esc(inv.id)}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px">${esc(inv.number)}</button>`
              :manage?`<button onclick="App._invGen('${l.id}','${esc(p.id)}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px">${ic('receipt','w-3 h-3')} Invoice</button>`:''}
          ${manage?`<button onclick="App._payDel('${esc(p.id)}')" aria-label="Delete payment" title="Delete payment" style="width:26px;height:26px;display:grid;place-items:center;border-radius:7px;color:var(--c-danger-ink);background:transparent;border:none;cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:''}
        </span>
      </div>`;}).join('')
    :'<div style="padding:16px;font-size:12.5px;color:var(--c-text-3)">No payments recorded yet. “Record payment” keeps the running Paid / Balance picture right and can raise the invoice in the same step.</div>'}
  </div>`;

  const invCard=`<div class="ui-card" style="overflow:hidden">
    <div style="padding:9px 14px;border-bottom:1px solid var(--c-border);font-size:12.5px;font-weight:800">${ic('receipt','w-4 h-4 inline')} Invoices — ${invs.length}</div>
    ${invs.length?invs.map(v=>`<div style="display:flex;align-items:center;gap:9px;padding:7px 14px;border-bottom:1px solid var(--c-border);font-size:12.5px;flex-wrap:wrap">
        <span style="font-weight:800">${esc(v.number)}</span>
        <span style="font-weight:700">${esc(fmtMoney(v.total,v.currency))}</span>
        ${v.taxRate?`<span style="color:var(--c-text-3)">incl. ${esc((v.snapshot&&v.snapshot.taxLabel)||'VAT')} ${v.taxRate}%</span>`:''}
        <span style="color:var(--c-text-3)">${fmtS(String(v.issuedOn||''))}</span>
        ${v.status==='Void'?'<span style="font-size:10px;font-weight:800;padding:1px 8px;border-radius:99px;background:#FEE2E2;color:#B91C1C">VOID</span>':''}
        <span style="margin-left:auto;display:inline-flex;gap:6px">
          <button onclick="App._invView('${esc(v.id)}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px">${ic('eye','w-3 h-3')} View / print</button>
          ${v.status!=='Void'&&manage?`<button onclick="App._invVoid('${esc(v.id)}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px;color:var(--c-danger-ink)">Void</button>`:''}
        </span>
      </div>`).join('')
    :'<div style="padding:16px;font-size:12.5px;color:var(--c-text-3)">No invoices yet. Record a payment (an invoice can be raised in the same step), or “Generate invoice” for any amount.</div>'}
  </div>`;

  return summary+actions+payCard+invCard;
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
  confirmModal({title:'Revoke this link?',body:'The client\'s status page stops working immediately. You can always create a fresh link later.',
    confirmLabel:'Revoke link',danger:true,onConfirm:`App._shareRevokeGo('${esc(tok)}')`});
};
App._shareRevokeGo=(tok)=>{
  if(!can('locations','edit'))return;
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
  const m=(DB.tmClientMeta||{})[locId]||{};
  const q=(DB.questions||[]).find(x=>x.id===qId);
  if(!m.contactEmail)return toast('Add a contact email on the client first','err');
  confirmModal({title:'Nudge the client?',body:'Emails <b>'+esc(m.contactEmail)+'</b> a polite reminder about "'+esc(q?q.text:'')+'" and records that you chased it.',
    confirmLabel:'Send reminder',onConfirm:`App._nudgeClientGo('${esc(locId)}','${esc(clId)}','${esc(qId)}')`});
};
App._nudgeClientGo=(locId,clId,qId)=>{
  if(!can('locations','edit'))return;
  const l=locById(locId);const m=(DB.tmClientMeta||{})[locId]||{};const c=clById(clId);
  const q=(DB.questions||[]).find(x=>x.id===qId);
  if(!l||!c||!q||!m.contactEmail)return;
  // Compose from the editable template (Settings → Templates → "Client reminder").
  const vars={contact_name:m.contactName||'there',client_name:l.name,checklist_name:c.name,
    question:q.text,from_name:(_ns&&_ns.email_from_name)||'Evarca'};
  const defs=_defaultTemplates().client_nudge;
  const saved=(_ns&&_ns.templates&&_ns.templates.client_nudge)||{};
  const subj=_fillTemplate(saved.subject||defs.subject,vars);
  const body=_fillTemplate(saved.body||defs.body,vars);
  const ob={id:uid('ob'),to_user:null,to_email:m.contactEmail,subject:subj,body,kind:'client_nudge',status:'queued',created_at:new Date().toISOString(),created_by_uid:S.uid};
  sb.from('notif_outbox').insert(ob).then(({error})=>{if(error)_syncErr('nudge email')(error);}).catch(_syncErr('nudge email'));
  const ng={id:uid('ng'),clientId:locId,checklistId:clId,questionId:qId,toEmail:m.contactEmail,note:q.text,sentBy:S.uid,sentAt:new Date().toISOString()};
  DB.tmNudges=DB.tmNudges||[];DB.tmNudges.unshift(ng);
  sb.from('tm_nudges').insert({id:ng.id,client_id:locId,checklist_id:clId,question_id:qId,to_email:m.contactEmail,note:q.text,sent_by:S.uid})
    .then(({error})=>{if(error)_syncErr('nudge log')(error);}).catch(_syncErr('nudge log'));
  log(fullName(me()),'Nudged client',l.name+' — '+q.text);
  saveDB();rr();toast('Reminder queued to '+m.contactEmail);
};

/* Jump straight to a client's file from anywhere (dashboard, tickets…). */
App._openClientFile=(id)=>{S.route='locations';S.filters.locSel=id;S.filters.locTab='prog';S.filters.docFolder=null;render();window.scrollTo(0,0);};

App.editLoc=(id=null)=>{
  const l=id?locById(id):null;
  const m=(DB.tmClientMeta||{})[id||'']||{};
  const b=id?_cliBilling(id):null;
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
    ${canBill()?`<div style="border-top:1px dashed var(--c-border);padding-top:12px">
      <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${ic('receipt','w-3.5 h-3.5 inline')} Engagement value</div>
      <div class="grid grid-cols-2 gap-3">
        ${fld('Full cost (total)','ln-total',b?b.total:'','number','e.g. 10000')}
        ${fld('Currency','ln-cur',(b&&b.currency)||_invDefaults().currency||'AED','text','AED')}
      </div>
      ${!l?`<div class="grid grid-cols-2 gap-3" style="margin-top:10px">
        ${fld('Initial payment received','ln-init','','number','e.g. 7000 (optional)')}
        <div style="align-self:end;font-size:11.5px;color:var(--c-text-3);padding-bottom:8px">Recorded as the first payment — invoice it from the Billing tab.</div>
      </div>`:`<div style="font-size:11.5px;color:var(--c-text-3);margin-top:6px">Payments and invoices live on the client's Billing tab.</div>`}
    </div>`:''}
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
  // Billing (permission-gated): the engagement total + currency, and — on create — the
  // first payment. Written AFTER the locations upsert resolves so the new client row is
  // already on the server when the billing rows referencing its id arrive.
  const _hasBillFields=canBill()&&$('#ln-total');
  const _billTotal=_hasBillFields?Math.max(0,Number($('#ln-total')?.value)||0):null;
  const _billCur=_hasBillFields?(($('#ln-cur')?.value||'AED').trim()||'AED'):null;
  const _initAmt=(!id&&_hasBillFields)?Math.max(0,Number($('#ln-init')?.value)||0):0;
  log(fullName(me()),id?'Edited client':'Created client',n);
  toast(id?'Client updated':'Client created');saveDB();closeModal();render();
  sb.from('locations').upsert({id:obj.id,...data},{onConflict:'id'})
    .then(({error})=>{
      if(error){_syncErr('client')(error);return;}
      if(_hasBillFields&&(_billTotal>0||_cliBilling(obj.id)))_billingSave(obj.id,_billTotal,_billCur);
      if(_initAmt>0){
        const p={id:uid('pay'),clientId:obj.id,amount:_initAmt,paidOn:todayISO(),method:'',reference:'',notes:'Initial payment',recordedBy:S.uid,createdAt:new Date().toISOString()};
        DB.tmPayments=DB.tmPayments||[];DB.tmPayments.unshift(p);
        sb.from('tm_payments').insert(_payRow(p)).then(({error:e2})=>{if(e2)_syncErr('payment')(e2);else{saveDB();rr();}}).catch(_syncErr('payment'));
        log(fullName(me()),'Recorded payment',fmtMoney(_initAmt,_billCur)+' · '+n);
      }
    }).catch(_syncErr('client'));
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
// (checklists attached, folders, files).
if(!guardDelete('location',id,'"'+l.name+'"'))return;
if(!confirm('Delete "'+l.name+'"?'))return;if(!DB.locations_deleted)DB.locations_deleted=[];if(!DB.locations_deleted.includes(id))DB.locations_deleted.push(id);DB.locations=DB.locations.filter(x=>x.id!==id);
// DATA-4: clear the dangling locationId from every user pointing at the deleted location
// (mirrors the dept-clear pattern; u.hrm syncs via the user_hrm table, so cleared ids propagate on next sync).
// M4: _ensureHrm also self-heals a stale locationId on devices that haven't received this clear yet.
DB.users.forEach(u=>{if(u.hrm&&u.hrm.locationId===id)u.hrm.locationId=null;});
saveDB();render();toast('Deleted','warn');sb.from('locations').delete().eq('id',id).then(({error})=>{if(error)console.error('delLoc:',error.message);}).catch(()=>{});};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.locsPage=locsPage;window._clientMetaSave=_clientMetaSave;window._clientMetaLoad=_clientMetaLoad;window._locProgTab=_locProgTab;window._locBillTab=_locBillTab;window._shareLoad=_shareLoad;window._nudgeLoad=_nudgeLoad;window._pubStatusRender=_pubStatusRender;window._pubStatusBoot=_pubStatusBoot;window._pubFormHtml=_pubFormHtml;window._pubWaitLabel=_pubWaitLabel;window._pubErr=_pubErr;
