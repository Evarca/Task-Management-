

/* ===== LOCATIONS ===== */
function locsPage(){
  const sel=S.filters.locSel||null;
  const stab=S.filters.locTab||'docs';
  // ── Detail view ──
  if(sel){
    const l=DB.locations.find(x=>x.id===sel);
    if(!l){S.filters.locSel=null;return locsPage();}
    // Requirement #6: block opening a city outside the user's city scope — but NEVER for admins
    // (an admin with old client chips must not lose access to a client they just created).
    if(!isAdmin()){const _mc=myCityScope();if(_mc.length&&!_mc.includes(l.id)){S.filters.locSel=null;toast('You do not have access to this client','warn');return locsPage();}}
    const TABS=[['docs',ic('folder','w-4 h-4')+'Documents'],['info',ic('info','w-4 h-4')+'Info']];
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
window.locsPage=locsPage;window._clientMetaSave=_clientMetaSave;window._clientMetaLoad=_clientMetaLoad;
