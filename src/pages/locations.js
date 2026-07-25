

/* ===== LOCATIONS ===== */
function locsPage(){
  const sel=S.filters.locSel||null;
  const stab=S.filters.locTab||'checklists';
  // ── Detail view ──
  if(sel){
    const l=DB.locations.find(x=>x.id===sel);
    if(!l){S.filters.locSel=null;return locsPage();}
    // Requirement #6: block opening a city outside the user's city scope — but NEVER for admins
    // (BUGFIX: an admin with old city chips couldn't open a location they had just created).
    if(!isAdmin()){const _mc=myCityScope();if(_mc.length&&!_mc.includes(l.id)){S.filters.locSel=null;toast('You do not have access to this city','warn');return locsPage();}}
    const lCls=DB.checklists.filter(c=>(c.locationIds||[]).includes(l.id));
    const TABS=[['checklists',ic('check','w-4 h-4')+'Checklists'],['info',ic('info','w-4 h-4')+'Info']];
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
      +(stab==='checklists'
        ?('<div class="space-y-2">'
          +(lCls.length
            ?lCls.map(c=>'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px"><div style="width:36px;height:36px;border-radius:10px;background:#F6F7F8;display:grid;place-items:center;flex-shrink:0">'+ic('list','w-4 h-4')+'</div><div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(c.name)+'</div><div style="font-size:12px;color:#9CA3AF">'+esc(c.frequency)+'</div></div></div>').join('')
            :empty('list','No checklists','No checklists assigned to this location.')
          )+'</div>')
        :'')
      +(stab==='info'
        ?'<div class="bg-white rounded-2xl border border-ink-100 p-5 space-y-3">'
          +[['Name',l.name],['Address',l.address||'—'],['Department',l.department||'All departments'],['Status',l.status||'Active']].map(([k,v])=>'<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;margin-bottom:2px">'+k+'</div><div style="font-size:14px;font-weight:600">'+esc(v)+'</div></div>').join('')
          +'</div>'
        :'')
      +'</div>';
  }
  // ── List view ──
  // Filter locations by user's access if not admin
  // Requirement #6: city scope. If the current user has cities selected, restrict to them (empty = all cities).
  // BUGFIX (owner report: "created a location but it's not showing"): the city-scope filter was
  // applied to ADMINS too, so an admin whose profile carried old city chips could not see any
  // location created after those chips were set — including ones they created themselves.
  // Admins now always see every location; city scope keeps applying to everyone else.
  const _myCities=myCityScope();
  const _cityOK=l=>!_myCities.length||_myCities.includes(l.id);
  const visibleLocs=isAdmin()?DB.locations.slice():DB.locations.filter(l=>{
    const da=(me()?.docAccess)||{};
    return Object.keys(da.locations||{}).includes(l.id);
  }).filter(_cityOK);
  return'<div class="fade">'+hdr('Locations','Physical sites & areas',can('locations','create')?btnP('Add location','App.editLoc()','plus'):'')
    +'<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">'
    +visibleLocs.map(l=>{
      const nCls=(DB.checklists||[]).filter(c=>(c.locationIds||[]).includes(l.id)).length;
      return'<div onclick="App._openLoc(this.dataset.id)" data-id="'+l.id+'" class="loc-card" style="background:#fff;border-radius:16px;border:1.5px solid #ECEDF0;padding:16px;cursor:pointer;transition:all .15s;display:block;width:100%">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:12px">'
        +'<div style="width:36px;height:36px;border-radius:10px;background:#EFF6FF;display:grid;place-items:center;flex-shrink:0">'+ic('pin','w-4 h-4')+'</div>'
        +'<div style="display:flex;align-items:center;gap:6px">'+chip(l.status||'Active')
        +(can('locations','edit')?'<button onclick="event.stopPropagation();App.editLoc(this.dataset.id)" data-id="'+l.id+'" aria-label="Edit location" title="Edit location" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#6B7280;border:1px solid #ECEDF0;background:#fff;cursor:pointer">'+ic('edit','w-3.5 h-3.5')+'</button>':'')
        +(can('locations','delete')?'<button onclick="event.stopPropagation();App.delLoc(this.dataset.id)" data-id="'+l.id+'" aria-label="Delete location" title="Delete location" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#BE123C;border:1px solid #FECACA;background:#FFF1F2;cursor:pointer">'+ic('trash','w-3.5 h-3.5')+'</button>':'')
        +'</div></div>'
        +'<div class="fd" style="font-size:15px;font-weight:800;margin-bottom:4px">'+esc(l.name)+'</div>'
        +'<div style="font-size:12px;color:#9CA3AF;margin-bottom:8px">'+esc(l.address||l.department||'')+'</div>'
        +(nCls?'<div style="font-size:11px;font-weight:600;color:#3B82F6;margin-bottom:8px">'+nCls+' checklist'+(nCls===1?'':'s')+'</div>':'')
        +'<div style="font-size:11px;font-weight:600;color:#6B7280;text-align:right">Open →</div>'
        +'</div>';
    }).join('')
    +(DB.locations.length?'':empty('pin','No locations','Add locations to assign them to checklists.'))
    +'</div></div>';
}
App.editLoc=(id=null)=>{const l=id?locById(id):null;modalShell({title:`${l?'Edit':'New'} location`,size:'max-w-sm',
  body:`<div style="display:flex;flex-direction:column;gap:14px">${fld('Location name','ln-n',l?.name||'')}${fld('Address','ln-a',l?.address||'')}${selF('Department (optional)','ln-d',[['','All departments'],...DB.departments.map(d=>[d.name,d.name])],l?.department||'')}${selF('Status','ln-s',['Active','Inactive'],l?.status||'Active')}
</div>`,
  footer:btnG('Cancel','App.closeModal()')+btnP(l?'Save':'Create',`App.saveLoc('${id||''}')`)});};
App.saveLoc=(id)=>{const n=$('#ln-n')?.value.trim();if(!n){toast('Name required','err');return;}const data={name:n,address:$('#ln-a')?.value.trim()||'',department:$('#ln-d')?.value||'',status:$('#ln-s')?.value||'Active'};const obj=id?locById(id):{id:uid('loc'),...data};if(id)Object.assign(obj,data);else DB.locations.push(obj);
  // BUGFIX companion: a non-admin creator with city chips would lose sight of their own new
  // location — add it to their city scope on create so it stays visible to them.
  if(!id){const _cu=me();if(_cu&&Array.isArray(_cu.cities)&&_cu.cities.length&&!_cu.cities.includes(obj.id)){_cu.cities.push(obj.id);sb.from('profiles').update({cities:_cu.cities}).eq('id',_cu.id).then(()=>{}).catch(()=>{});}}
  log(fullName(me()),id?'Edited location':'Created location',n);toast(id?'Updated':'Created');saveDB();closeModal();render();sb.from('locations').upsert({id:obj.id,...data},{onConflict:'id'}).then(({error})=>{if(error)_syncErr('location')(error);}).catch(_syncErr('location'));};
App.delLoc=(id)=>{if(!can('locations','delete'))return toast('You need Locations → Delete','err');const l=locById(id);if(!l)return;
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
window.locsPage=locsPage;
