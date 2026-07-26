

/* ===== DEPARTMENTS — hierarchy helpers ===== */
function _deptById(id){return (DB.departments||[]).find(d=>d.id===id);}
function _deptByName(n){return (DB.departments||[]).find(d=>d.name===n&&!d.parentId);}
// Top-level departments = no parent, OR a parent that no longer exists (orphan self-heal).
function topDepts(){return (DB.departments||[]).filter(d=>!d.parentId||!_deptById(d.parentId));}
function subDepts(parentId){return (DB.departments||[]).filter(d=>d.parentId===parentId);}
// Sub-departments of a top-level department, looked up by its NAME (questions store names).
function subDeptsOfName(name){const p=_deptByName(name);return p?subDepts(p.id):[];}

/* ===== CITY (location) access scope helpers — requirement #6 ===== */
// A user's cities = array of location ids. Empty/absent ⇒ ALL cities.
function userCities(u){return Array.isArray(u&&u.cities)?u.cities:[];}
// Active location ids the current user may act within (empty array meaning is "all" handled by callers).
function myCityScope(){const u=me();return u?userCities(u):[];}

/* ===== DEPARTMENTS ===== */
// Detail-view navigation, shared with the Locations page.
App._openDept=(id)=>{S.filters.deptSel=id;S.filters.deptTab='users';rr();};
App._closeDept=()=>{S.filters.deptSel=null;rr();};
App._openLoc=(id)=>{S.filters.locSel=id;S.filters.locTab='prog';S.filters.docFolder=null;rr();};
App._closeLoc=()=>{S.filters.locSel=null;rr();};
App._setDeptTab=(k)=>{S.filters.deptTab=k;rr();};
App._setLocTab=(k)=>{S.filters.locTab=k;S.filters.docFolder=null;rr();};



function deptsPage(){
  const sel=S.filters.deptSel||null;
  const stab=S.filters.deptTab||'users';
  // ── Detail view ──
  if(sel){
    const d=DB.departments.find(x=>x.id===sel||x.name===sel);
    if(!d){S.filters.deptSel=null;return deptsPage();}
    const dUsers=DB.users.filter(u=>u.department===d.name);
    const dCls=DB.checklists.filter(c=>c.department===d.name);
    const dSubs=subDepts(d.id);
    // Sub-departments only apply to a top-level department (one level of nesting).
    const isTop=!d.parentId||!_deptById(d.parentId);
    const TABS=[...(isTop?[['subdepts',ic('dept','w-4 h-4')+'Sub-departments']]:[]),['users',ic('users','w-4 h-4')+'Users'],['checklists',ic('check','w-4 h-4')+'Checklists']];
    const stab2=TABS.some(t=>t[0]===stab)?stab:TABS[0][0];
    return'<div class="fade">'
      // Back bar
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
      +'<button onclick="App._closeDept()" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">'+ic('back','w-4 h-4')+'</button>'
      +'<div style="width:36px;height:36px;border-radius:10px;background:#ECFDF5;display:grid;place-items:center">'+ic('dept','w-4 h-4 text-brand-600')+'</div>'
      +'<div style="flex:1"><div class="fd" style="font-size:16px;font-weight:800">'+esc(d.name)+'</div>'
      +'<div style="font-size:12px;color:#9CA3AF">'+dUsers.length+' users · '+dCls.length+' checklists</div></div>'
      +(isAdmin()?'<button onclick="App.editDept(this.dataset.id)" data-id="'+d.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#F6F7F8;color:#374151;font-size:13px;font-weight:600;border:1px solid #ECEDF0;cursor:pointer">'+ic('edit','w-4 h-4')+'Edit</button>':'')
      +'</div>'
      // Sub-tabs
      +'<div class="ui-tabs" style="margin-bottom:16px">'
      +TABS.map(([k,l])=>'<button class="ui-tab'+(stab2===k?' on':'')+'" onclick="App._setDeptTab(this.dataset.k)" data-k="'+k+'">'+l+'</button>').join('')
      +'</div>'
      // Tab content
      +(stab2==='subdepts'
        ?('<div>'
          +(isAdmin()?'<div style="margin-bottom:14px">'+btnP('Add sub-department',"App.editDept(null,'"+d.id+"')",'plus')+'</div>':'')
          +(dSubs.length
            ?('<div class="space-y-2">'+dSubs.map(sd=>{
                const su=DB.users.filter(u=>u.department===sd.name).length;
                return'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px"><div style="width:36px;height:36px;border-radius:10px;background:#ECFDF5;display:grid;place-items:center;flex-shrink:0">'+ic('dept','w-4 h-4 text-brand-600')+'</div><div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(sd.name)+'</div><div style="font-size:12px;color:#9CA3AF">'+su+' user'+(su!==1?'s':'')+'</div></div>'+(isAdmin()?'<div style="display:flex;gap:4px"><button onclick="App.editDept(this.dataset.id)" data-id="'+sd.id+'" aria-label="Edit" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;border:none;background:transparent;cursor:pointer">'+ic('edit','w-4 h-4')+'</button><button onclick="App.delDept(this.dataset.id)" data-id="'+sd.id+'" aria-label="Delete" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;border:none;background:transparent;cursor:pointer">'+ic('trash','w-4 h-4')+'</button></div>':'')+'</div>';
              }).join('')+'</div>')
            :empty('dept','No sub-departments',isAdmin()?'Click "Add sub-department" to create one inside '+esc(d.name)+'.':'No sub-departments yet.')
          )+'</div>')
        :'')
      +(stab2==='users'
        ?('<div class="space-y-2">'
          +(dUsers.length
            ?dUsers.map(u=>'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px">'+avatar(u,'w-10 h-10','text-xs')+'<div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(fullName(u))+'</div><div style="font-size:12px;color:#9CA3AF">'+esc(u.position||roleName(u))+'</div></div>'+chip(u.status)+'</div>').join('')
            :empty('users','No users','No users assigned to this department.')
          )+'</div>')
        :'')
      +(stab2==='checklists'
        ?('<div class="space-y-2">'
          +(dCls.length
            ?dCls.map(c=>'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px"><div style="width:36px;height:36px;border-radius:10px;background:#F6F7F8;display:grid;place-items:center;flex-shrink:0">'+ic('list','w-4 h-4')+'</div><div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(c.name)+'</div><div style="font-size:12px;color:#9CA3AF">'+esc(c.frequency)+' · '+(c.assignees||[]).length+' assigned</div></div></div>').join('')
            :empty('list','No checklists','No checklists in this department.')
          )+'</div>')
        :'')
      +'</div>';
  }
  // ── List view ──
  // Filter depts by user's access if not admin
  const _allTop=topDepts();
  const visibleDepts=isAdmin()?_allTop:_allTop.filter(d=>{
    const da=(me()?.docAccess)||{};
    return Object.keys(da.departments||{}).includes(d.name);
  });
  return'<div class="fade">'+hdr('Departments','',isAdmin()?btnP('Add','App.editDept()','plus'):'')
    +'<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">'
    +visibleDepts.map(d=>{
      const us=DB.users.filter(u=>u.department===d.name);
      const cls=DB.checklists.filter(c=>c.department===d.name);
      const docs=(DB.documents||[]).filter(x=>x.type==='dept'&&x.scope===d.name).length;
      const folders=(DB.folders||[]).filter(x=>x.type==='dept'&&x.scope===d.name&&!x.parentId).length;
      return'<div onclick="App._openDept(this.dataset.id)" data-id="'+d.id+'" class="dept-card" style="background:#fff;border-radius:16px;border:1.5px solid #ECEDF0;padding:16px;cursor:pointer;transition:all .15s;display:block;width:100%">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:12px">'
        +'<div style="width:36px;height:36px;border-radius:10px;background:#ECFDF5;display:grid;place-items:center">'+ic('dept','w-4 h-4 text-brand-600')+'</div>'
        +(isAdmin()?'<div style="display:flex;gap:4px" onclick="event.stopPropagation()"><button onclick="App.editDept(this.dataset.id)" data-id="'+d.id+'" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#9CA3AF;border:none;background:transparent;cursor:pointer">'+ic('edit','w-3.5 h-3.5')+'</button><button onclick="App.delDept(this.dataset.id)" data-id="'+d.id+'" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#9CA3AF;border:none;background:transparent;cursor:pointer">'+ic('trash','w-3.5 h-3.5')+'</button></div>':'')
        +'</div>'
        +'<div class="fd" style="font-size:15px;font-weight:800;margin-bottom:6px">'+esc(d.name)+'</div>'
        +'<div style="display:flex;gap:12px;font-size:12px;color:#9CA3AF">'
        +'<span><b style="color:#15171C">'+us.length+'</b> users</span>'
        +'<span><b style="color:#15171C">'+cls.length+'</b> checklists</span>'
        +(docs||folders?'<span><b style="color:#0E9F6E">'+(folders+' folders, '+docs+' files')+'</b></span>':'')
        +'</div>'
        +(subDepts(d.id).length?('<div style="margin-top:12px;border-top:1px dashed #ECEDF0;padding-top:10px">'
          +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;margin-bottom:6px">Sub-departments</div>'
          +'<div style="display:flex;flex-wrap:wrap;gap:6px">'
          +subDepts(d.id).map(sd=>'<span style="background:#F3F4F6;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:600;color:#374151">'+esc(sd.name)+'</span>').join('')
          +'</div></div>'):'')
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">'
        +'<div style="display:flex;-space-x-1.5">'+us.slice(0,5).map(u=>'<div style="border-radius:50%;ring:2px solid #fff;margin-right:-6px">'+avatar(u,'w-6 h-6','text-[9px]')+'</div>').join('')+'</div>'
        +'<span style="font-size:11px;font-weight:600;color:#0E9F6E">Open →</span>'
        +'</div></div>';
    }).join('')
    +(DB.departments.length?'':empty('dept','No departments','Create your first department.'))
    +'</div></div>';
}
App.editDept=(id=null,presetParent=null)=>{
  if(id?!can('departments','edit'):!can('departments','create'))return toast(id?'You need Departments → Edit':'You need Departments → Create','err');
  const d=id?DB.departments.find(x=>x.id===id):null;
  const hasChildren=d?subDepts(d.id).length>0:false;
  const curParent=d?(d.parentId||''):(presetParent||'');
  const parentOpts=[['','— None (top-level department) —'],...topDepts().filter(x=>!d||x.id!==d.id).map(x=>[x.id,x.name])];
  // A department that itself has sub-departments can't become a sub-department (only one level of nesting).
  const parentField=hasChildren
    ?'<input type="hidden" id="d-parent" value="">'
    :selF('Parent department (optional)','d-parent',parentOpts,curParent);
  modalShell({title:`${d?'Edit':'New'} ${curParent?'sub-department':'department'}`,size:'max-w-sm',
    body:fld('Name','d-n',d?.name||'')+parentField,
    footer:btnG('Cancel','App.closeModal()')+btnP(d?'Save':'Create',`App.saveDept('${id||''}')`)});
};
App.saveDept=(id)=>{if(id?!can('departments','edit'):!can('departments','create'))return toast('Not allowed','err');const n=$('#d-n')?.value.trim();if(!n){toast('Name required','err');return;}
  let parentId=$('#d-parent')?.value||null;
  // Guard: a department with sub-departments stays top-level.
  if(id&&subDepts(id).length)parentId=null;
  const obj=id?DB.departments.find(x=>x.id===id):{id:uid('d'),name:n,parentId};
  if(id){obj.name=n;obj.parentId=parentId;}else DB.departments.push(obj);
  log(fullName(me()),id?'Edited dept':'Created dept',n);toast(id?'Updated':'Created');saveDB();closeModal();render();
  sb.from('departments').upsert({id:obj.id,name:obj.name,parent_id:obj.parentId||null},{onConflict:'id'}).then(({error})=>{if(error)_syncErr('department')(error);}).catch(_syncErr('department'));};
App.delDept=(id)=>{if(!can('departments','delete'))return toast('You need Departments → Delete','err');const d=DB.departments.find(x=>x.id===id);if(!d)return;
  // Referential-integrity guard: a department with sub-departments, people, checklists or targeted
  // linked records can't be deleted until those links are moved/removed (the old cascade is gone).
  if(!guardDelete('department',id,'"'+d.name+'"'))return;
  const kids=subDepts(id); // empty by now — kept so the tombstone loop below stays byte-compatible
  if(!confirm('Delete "'+d.name+'"?'))return;
  if(!DB.departments_deleted)DB.departments_deleted=[];
  const toDelete=[id,...kids.map(k=>k.id)];
  toDelete.forEach(delId=>{if(!DB.departments_deleted.includes(delId))DB.departments_deleted.push(delId);});
  DB.departments=DB.departments.filter(x=>!toDelete.includes(x.id));
  sb.from('departments').delete().in('id',toDelete).then(({error})=>{if(error)_syncErr('department delete')(error);}).catch(_syncErr('department delete'));// Clear dept from users and checklists (don't delete them)
const _affected=[];DB.users.forEach(u=>{if(u.department===d.name){u.department='';_affected.push(u.id);}});DB.checklists.forEach(c=>{if(c.department===d.name)c.department='';});
// N3: profiles aren't part of the debounced _sync, so persist the cleared department directly.
if(_affected.length)sb.from('profiles').update({department:''}).in('id',_affected).then(({error})=>{if(error)_syncErr('clear department')(error);}).catch(_syncErr('clear department'));
log(fullName(me()),'Deleted dept',d.name);toast('Deleted','warn');saveDB();render();};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._deptById=_deptById;window._deptByName=_deptByName;window.topDepts=topDepts;window.subDepts=subDepts;window.subDeptsOfName=subDeptsOfName;window.userCities=userCities;window.myCityScope=myCityScope;window.deptsPage=deptsPage;
