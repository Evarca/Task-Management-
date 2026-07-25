

/* ===== USERS ===== */
function _disableBtn(u){
  if(!can('employees','deactivate')||!scopeFilter('employees')(u.id))return''; // C2: gate enable/disable button to the dedicated permission
  if(isSuperU(u)&&!isAdmin())return''; // never offer to disable a Super Admin to a non-admin
  const isActive=u.status==='Active';
  const bg=isActive?'transparent':'#FEF3C7';
  const col=isActive?'#9CA3AF':'#D97706';
  const tip=isActive?'Disable user':'Enable user';
  return '<button onclick="App.togUser(\''+u.id+'\')" title="'+tip+'" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:'+col+';background:'+bg+';border:none;cursor:pointer">'+ic(isActive?'lock':'unlock','w-4 h-4')+'</button>';
}

function usersPage(){
  // Directory scoped by the resolver (employees area). Keep Super Admin out of the people list
  // for non-admins exactly as before — scopeFilter('employees') handles that.
  const _canEdit=can('employees','edit'),_canDel=can('employees','delete');
  let list=scopedUsers('employees');const q=S.search.toLowerCase();
  if(q)list=list.filter(u=>fullName(u).toLowerCase().includes(q)||u.email.toLowerCase().includes(q));
  if(S.filters.dep)list=list.filter(u=>u.department===S.filters.dep);
  if(S.filters.stat)list=list.filter(u=>u.status===S.filters.stat);
  return`<div class="fade">${hdr('Users',scopedUsers('employees').length+' people',can('employees','create')?btnP('Add user','App.editUser()','plus'):'')}
  <div class="flex gap-2 mb-4 flex-wrap">
    <div class="relative flex-1 min-w-[180px]"><span class="absolute left-3 top-1/2 -translate-y-1/2" style="color:var(--c-text-3)">${ic('search','w-4 h-4')}</span><input id="usr-q" oninput="S.search=this.value;App._searchRR('usr-q')" value="${esc(S.search)}" placeholder="Search people by name or email…" class="ui-input" style="padding-left:36px"/></div>
    <select onchange="S.filters.dep=this.value;rr()" class="ui-select" style="width:auto"><option value="">All depts</option>${DB.departments.map(d=>`<option ${S.filters.dep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    <select onchange="S.filters.stat=this.value;rr()" class="ui-select" style="width:auto"><option value="">Any status</option><option ${S.filters.stat==='Active'?'selected':''}>Active</option><option ${S.filters.stat==='Inactive'?'selected':''}>Inactive</option></select>
  </div>
  <div class="hidden md:block bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
    <table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-5 py-3 font-semibold">Name</th><th class="px-5 py-3 font-semibold">Department</th><th class="px-5 py-3 font-semibold">Role</th><th class="px-5 py-3 font-semibold">Reports to</th><th class="px-5 py-3 font-semibold">Status</th><th class="px-5 py-3"></th></tr></thead>
    <tbody class="divide-y divide-ink-50">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;const isMgrUser=subTree(u.id).length>0;return`<tr class="hover:bg-ink-50/50"><td class="px-5 py-3"><div class="flex items-center gap-3">${avatar(u,'w-9 h-9','text-xs')}<div><div class="font-semibold">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.email)}</div></div></div></td><td class="px-5 py-3">${esc(u.department)}<div class="text-xs text-ink-400">${esc(u.position)}</div></td><td class="px-5 py-3">${isSuperU(u)?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#15171C;color:#fff">Super Admin</span>':_pidOf(u)==='admin'?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#4338CA">'+esc(roleName(u))+'</span>':isMgrUser?'<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">Manager</span>':'<span class="text-xs text-ink-400">'+esc(roleName(u))+'</span>'}</td><td class="px-5 py-3 text-sm">${mgr?esc(fullName(mgr)):'<span class="text-ink-300">—</span>'}</td><td class="px-5 py-3">${chip(u.status)}</td><td class="px-5 py-3"><div class="flex gap-1 justify-end">${(_canEdit||_canDel)?`${_canEdit?`<button onclick="App.editUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'">${ic('edit','w-4 h-4')}</button><button onclick="App.resetPw('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'" title="Reset password">${ic('key','w-4 h-4')}</button>${_disableBtn(u)}`:''}${(_canDel&&!isSuperU(u))?`<button onclick="App.delUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#FFF1F2';this.style.color='#BE123C'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF'">${ic('trash','w-4 h-4')}</button>`:''}`:'<span class="text-ink-200">—</span>'}</div></td></tr>`;}).join('')}</tbody></table>
    ${list.length?'':empty('users','No users','')}
  </div>
  <div class="md:hidden space-y-2">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-4" ${_canEdit?`onclick="App.editUser('${u.id}')" style="cursor:pointer"`:''}>
    <div class="flex items-center gap-3">${avatar(u,'w-10 h-10','text-sm')}<div class="min-w-0 flex-1"><div class="font-semibold truncate">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.position)} · ${esc(u.department)}</div></div>${chip(u.status)}</div>
    ${mgr?`<div class="text-xs text-ink-400 mt-2.5 pt-2.5 border-t border-ink-50">Reports to <strong>${esc(fullName(mgr))}</strong></div>`:''}</div>`;}).join('')}</div>
</div>`;}
function _hrmUserSection(u){
  _ensureHrm(u||{hrm:{}});
  const h=(u&&u.hrm)||{schedule:{in:'09:00',out:'18:00',hours:9,workWeek:5,offDays:['Sun']},reportPerms:{}};
  const s=h.schedule||{in:'09:00',out:'18:00',hours:9,workWeek:5,offDays:['Sun']};
  const off=new Set(s.offDays||[]);
  return `<div class="bg-ink-50 rounded-2xl p-4 space-y-3"><p class="text-[10px] font-bold text-ink-400 uppercase tracking-wide">Directory details</p>
    <div class="grid grid-cols-2 gap-3">${fld('Date of birth','u-dob',h.dob||'','date')}${fld('Joining date','u-join',h.joiningDate||'','date')}</div>
  </div>`;
  /* perms v2: the HR toggle + role-profile picker moved to the Access Control tab. */
}
function _readHrmFromForm(prev){
  const g=i=>($('#'+i)?.value||'').trim();
  const p=prev&&typeof prev==='object'?prev:{};
  /* This build edits two directory fields. Everything else on u.hrm belongs to modules it
     doesn't ship (work schedule, salary, probation, pension, asset records) — and the whole blob
     syncs to user_hrm, which is SHARED, so untouched fields are carried through verbatim rather
     than rewritten with a default. Access stays managed in Access Control. */
  return {
    ...p,
    dob:$('#u-dob')?(g('u-dob')||null):(p.dob??null),
    joiningDate:$('#u-join')?(g('u-join')||null):(p.joiningDate??null),
    isHR:p.isHR===true,
    roleProfileId:p.roleProfileId||null,
    perms:(p.perms&&typeof p.perms==='object')?p.perms:undefined,
    permsBaked:p.permsBaked||0,
  };
}
// Client-access checkboxes for the user modal.
function _cityScopeChips(u){
  const active=(DB.locations||[]).filter(l=>l.status==='Active');
  if(!active.length)return'<p style="font-size:12px;color:#9CA3AF">No clients yet. Add them in the Clients tab.</p>';
  const sel=new Set(Array.isArray(u&&u.cities)?u.cities:[]);
  return'<div style="display:flex;flex-wrap:wrap;gap:8px">'+active.map(l=>`<label style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1.5px solid ${sel.has(l.id)?'#6EE7B7':'#E5E7EB'};border-radius:10px;padding:6px 11px;font-size:12px;font-weight:600;color:#374151;cursor:pointer"><input type="checkbox" class="city-chk" data-id="${esc(l.id)}" ${sel.has(l.id)?'checked':''} onchange="this.closest('label').style.borderColor=this.checked?'#6EE7B7':'#E5E7EB'"> ${esc(l.name)}</label>`).join('')+'</div>';
}

App.editUser=(id=null)=>{
  // SEC-2: re-check action + scope (buttons are hidden but the handler must not trust that).
  if(id){
    if(!can('employees','edit')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  }else if(!can('employees','create')){toast('Not allowed','err');return;}
  const u=id?uById(id):null;
  // ONE ROLE CONCEPT (R20): the Access Control role is the only role that exists — shown read-only here.
  const roleSelHtml=(()=>{const rname=u?roleName(u):'Basic Employee';
    return `<div><label class="block text-xs font-semibold text-ink-500 mb-1">Access role</label><div class="w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-500">${esc(rname)}</div><p style="font-size:11px;color:#9CA3AF;margin-top:4px">Set in <strong>Access Control → People</strong> — one dropdown decides everything this person sees.</p></div>`;})();
  const mgrOpts=DB.users.filter(x=>!u||x.id!==u.id&&!isDesc(x.id,u.id));
  const v=(f,d='')=>esc(u?u[f]??d:d);
  modalShell({title:`${u?'Edit':'New'} user`,size:'max-w-2xl',
  body:`<div class="space-y-3">
    <div class="grid grid-cols-2 gap-3">${fld('First name','u-fn',v('firstName'))}${fld('Last name','u-ln',v('lastName'))}</div>
    <div class="grid grid-cols-2 gap-3">${fld('Email','u-email',v('email'),'email')}${fld('Phone','u-phone',v('phone'))}</div>
    <div class="grid grid-cols-2 gap-3">${fld('Position','u-pos',v('position'))}${selF('Department','u-dep',DB.departments.map(d=>d.name),u?.department||'')}</div>
    <div class="grid grid-cols-3 gap-3">${roleSelHtml}${selF('Status','u-status',['Active','Inactive'],u?.status||'Active')}<div><label for="u-mgr" class="block text-xs font-semibold text-ink-500 mb-1">Reports to</label>${can('employees','assignManager')
      ?`<select id="u-mgr" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">— None —</option>${mgrOpts.map(m=>`<option value="${m.id}"${u?.managerId===m.id?' selected':''}>${esc(fullName(m))}</option>`).join('')}</select>`
      // C2: no assignManager permission → current manager read-only + hidden input so saveUser preserves it.
      :`<div class="w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-500">${esc(u?.managerId?fullName(uById(u.managerId)):'— None —')}</div><input type="hidden" id="u-mgr" value="${esc(u?.managerId||'')}">`}</div></div>
    ${!u?fldPw('Password','u-pw','','Set a password','Minimum 6 characters — tap the eye to check it'):''}
    <div class="bg-ink-50 rounded-2xl p-4"><p class="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">Notifications</p>${mkTog('u-em',u?.emailEnabled??true,'Receive email notifications')}</div>
    ${_hrmUserSection(u)}
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><p style="flex:1;min-width:200px;font-size:11.5px;color:#1E40AF;line-height:1.5;margin:0"><strong>All access &amp; permissions</strong> — tabs, submission rules, approvals, HR powers, document/city access — are managed per person in <strong>Access Control</strong>.</p>${(u&&can('accessControl','view'))?`<button type="button" onclick="App.closeModal();S.filters.acUser='${u.id}';App.go('accesscontrol')" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('shield','w-4 h-4')}Open Access Control</button>`:''}</div>
  </div>`,
  footer:btnG('Cancel','App.closeModal()')+`<button type="button" id="save-user-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=this.textContent==='Save'?'Saving…':'Creating…';App.saveUser('${id||''}').catch(()=>{}).finally(()=>{const b=document.getElementById('save-user-btn');if(b){b.disabled=false;b.textContent='${u?'Save':'Create'}';}})" class="ui-btn ui-btn-primary">${u?'Save':'Create'}</button>`});
};
App.saveUser=async(id)=>{
  // SEC-2: re-check action + scope before mutating (handler must not trust hidden buttons).
  if(id){
    if(!can('employees','edit')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  }else if(!can('employees','create')){toast('Not allowed','err');return;}
  const g=i=>($('#'+i)?.value||'').trim();
  const fn=g('u-fn'),ln=g('u-ln'),email=g('u-email');
  if(!fn||!ln||!email){toast('Name & email required','err');return;}
  const _existingU=id?uById(id):null;
  // C2: assignManager is a dedicated gate. If the user lacks it, preserve the existing manager
  //   (or force none on create) so a deep-link/console call can't re-parent someone out of scope.
  let mId=$('#u-mgr')?.value||null;
  if(!can('employees','assignManager')){
    const cur=_existingU?(_existingU.managerId||null):null;
    if((mId||null)!==(cur||null)){toast('Not permitted to change reporting manager','err');return;}
    mId=cur;
  }
  if(id&&mId&&(mId===id||isDesc(mId,id))){toast('Circular hierarchy!','err');return;}

  // ── Access (docAccess / questionsAccess) is now governed by Role profiles (Access Control tab).
  //    The per-user toggles were removed from this form, so preserve any existing values verbatim
  //    rather than reading them from the (now-absent) DOM controls. ──
  const docAccess=(_existingU&&_existingU.docAccess)?_existingU.docAccess:{departments:{},locations:{}};

  // ── Read ALL toggles and DOM values NOW, before any async/closeModal ──
  const questionsAccess=_existingU?(_existingU.questionsAccess??false):false;
  // Email notifications opt-in (requirement #4) — default on.
  const email_enabled=$('#u-em')?togV('u-em'):true;
  // City (location) access scope (requirement #6) — empty array = all cities.
  // perms v2: rules / approval / city access moved to Access Control — preserve existing values here.
  const cities=_existingU?(_existingU.cities||[]):[];
  const rules=_existingU?(_existingU.rules||{past:true,future:true,edit:true}):{past:true,future:true,edit:true};
  const approval_settings=_existingU?(_existingU.approval||{past:false,future:false,edited:false}):{past:false,future:false,edited:false};
  // HRM fields — stored locally on u.hrm ONLY, never added to the Supabase upsert payload (pd)
  const hrm=_readHrmFromForm(id?uById(id)?.hrm:null);
  // C2: assignRole is a dedicated gate (it grants permission BUNDLES → privilege escalation risk).
  //   If the user lacks it, preserve the existing role profile (or none on create) — never let the
  //   form value change who the target can act as.
  if(!can('employees','assignRole')){
    const curRP=_existingU?.hrm?.roleProfileId??null;
    if((hrm.roleProfileId||null)!==(curRP||null)){toast('Not permitted to assign a role profile','err');return;}
    hrm.roleProfileId=curRP;
  }

  // R20: the legacy role field is gone. Roles are assigned ONLY in Access Control → People
  // (u.hrm.roleProfileId), which _acAssignRole already guards (accessControl.manage + lockout).
  const existing=id?uById(id):null;
  const pd={first_name:fn,last_name:ln,email,
    phone:g('u-phone'),position:g('u-pos'),
    department:$('#u-dep')?.value,
    status:$('#u-status')?.value,manager_id:mId||null,
    rules,approval_settings,
    doc_access:docAccess,questions_access:questionsAccess,
    email_enabled,cities};

  if(id){
    // Update local state immediately
    const u=uById(id);
    // ── Manager change: record history so dashboards can scope by date ──
    // Rule: dates BEFORE the change belong to the old manager; the change date onwards belongs to the new one
    if(u&&(u.managerId||null)!==(mId||null)){
      const chDate=todayISO();
      let h=Array.isArray(u.managerHistory)?JSON.parse(JSON.stringify(u.managerHistory)):[];
      if(!h.length)h.push({managerId:u.managerId||null,from:'0001-01-01',to:chDate});
      else{const open=h.find(p=>!p.to);if(open)open.to=chDate;}
      h.push({managerId:mId||null,from:chDate,to:null});
      u.managerHistory=h;
      pd.manager_history=h;
    }
    if(u)Object.assign(u,{firstName:fn,lastName:ln,email,
      phone:pd.phone,position:pd.position,department:pd.department,
      status:pd.status,managerId:mId,
      rules,approval:approval_settings,
      questionsAccess,emailEnabled:email_enabled,cities,
      docAccess,hrm});
    log(fullName(me()),'Edited user',fn+' '+ln);
    toast('Saved');closeModal();saveDB();render();
    // Sync all fields including doc_access to Supabase in background
    sb.from('profiles').update(pd).eq('id',id).then(({error})=>{
      if(error)_syncErr('user changes')(error);
    }).catch(_syncErr('user changes'));
    _acPushHrm(u); // directory details live on u.hrm — push NOW, not on the debounce
  } else {
    const pw=g('u-pw');if(!pw){toast('Password required','err');return;}
    const saveBtn=document.querySelector('[onclick*="saveUser"]');
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Creating…';}
    toast('Creating user…','ok');
    const{data:res,error}=await sb.functions.invoke('create-user',{body:{...pd,password:pw}});
    if(error||res?.error){
      let msg=error?.message||res?.error||'Failed';
      try{if(error?.context){const b=await error.context.json();msg=b.error||msg;}}catch(e){}
      toast(msg,'err');
      if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Create';}
      return;
    }
    const newId=res?.id||res?.user?.id;
    if(!newId){toast('User created — reload to see them','ok');closeModal();render();return;}
    DB.users.push(_ensureHrm({id:newId,firstName:fn,lastName:ln,email,
      phone:pd.phone,position:pd.position,department:pd.department,
      status:pd.status,managerId:mId,
      rules:pd.rules,approval:pd.approval_settings,
      questionsAccess,emailEnabled:email_enabled,cities,
      docAccess,hrm,password:'***'}));
    (()=>{const nu=uById(newId);if(nu){_ensureHrm(nu);nu.hrm.roleProfileId=_roleIdForUser(nu);nu.hrm.permsV3=1;}})(); // perms v3: assign role
    // Save doc_access + questions_access + email/cities for new user
    sb.from('profiles').update({doc_access:docAccess,questions_access:questionsAccess,email_enabled,cities}).eq('id',newId).then(()=>{}).catch(()=>{});
    log(fullName(me()),'Created user',fn+' '+ln);
    toast(fn+' '+ln+' created');
    closeModal();saveDB();render();
  }
};
App.resetPw=(id)=>{
  if(!can('employees','resetPassword'))return toast('You need People → Reset password','err');
  // SEC-2: require employees.edit + target in scope.
  if(!can('employees','edit')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  const u=uById(id);
  modalShell({title:'Reset password',sub:'New password for '+fullName(u),size:'max-w-sm',
    body:fldPw('New password','rp-pw','','New password','Minimum 6 characters — tap the eye to check it'),
    footer:btnG('Cancel','App.closeModal()')
      +'<button type="button" id="rp-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=\'Resetting…\';App._doResetPw(this.dataset.uid).finally(()=>{const b=document.getElementById(\'rp-btn\');if(b){b.disabled=false;b.textContent=\'Reset\';}})" data-uid="'+id+'" class="ui-btn ui-btn-primary">Reset</button>'});
};
App._doResetPw=async(uid)=>{
  if(!can('employees','resetPassword'))return toast('You need People → Reset password','err');
  // SEC-2: re-check action + scope (this is the actual privileged call).
  if(!can('employees','edit')||!scopeFilter('employees')(uid)){toast('Not allowed','err');return;}
  const pw=$('#rp-pw')?.value?.trim();
  if(!pw){toast('Enter a password','err');return;}
  const{error}=await sb.functions.invoke('reset-password',{body:{user_id:uid,password:pw}});
  if(error){toast(error.message,'err');return;}
  log(fullName(me()),'Reset password',fullName(uById(uid)));
  toast('Password reset');closeModal();
};
App.togUser=(id)=>{
  const u=uById(id);if(!u)return;
  // SEC-2/C2: require employees.deactivate (dedicated gate) + target in scope; never disable a Super Admin unless Super Admin.
  if(!can('employees','deactivate')||!scopeFilter('employees')(id)){toast('Not permitted','err');return;}
  if(isSuperU(u)&&!isAdmin()){toast('Not permitted','err');return;}
  const enabling=u.status!=='Active';
  u.status=enabling?'Active':'Inactive';
  // Deactivating someone must not strand work that is still pointing at them: their pending
  // approvals stay visible to the approver, but unfinished tickets are unassigned so they
  // don't sit in a queue nobody is watching.
  if(!enabling){
    let freed=0;
    (DB.tickets||[]).filter(t=>t.assignedTo===id&&(t.status==='Open'||t.status==='In Progress')).forEach(t=>{
      t.assignedTo=null;freed++;
      sb.from('tickets').update({assigned_to:null}).eq('id',t.id).then(()=>{}).catch(()=>{});
    });
    if(freed){hlog('Tickets unassigned on deactivation',fullName(u)+' ('+freed+')');toast(freed+' open ticket'+(freed===1?'':'s')+' unassigned','warn');}
  }
  saveDB();render();
  toast(fullName(u)+' '+(enabling?'enabled':'disabled'),enabling?'ok':'warn');
  sb.from('profiles').update({status:u.status}).eq('id',id).then(({error})=>{if(error)_syncErr(enabling?'enable':'disable')(error);}).catch(_syncErr(enabling?'enable':'disable'));
};
App.delUser=async(id)=>{
  const u=uById(id);if(!u)return;
  // SEC-2: require employees.delete + target in scope; never delete a Super Admin unless Super Admin.
  if(!can('employees','delete')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  if(isSuperU(u)&&!isAdmin()){toast('Not allowed','err');return;}
  const name=fullName(u);
  // Referential-integrity guard: block while they still have live links (direct reports, assigned
  // checklists, pending approvals and open tickets,
  // open payroll). Pure history never blocks — Disable is the way to retire someone.
  if(!guardDelete('user',id,name))return;
  if(!confirm('Permanently delete '+name+'?\n\nThis will delete ALL their submissions and approvals. This cannot be undone.\n\nTo keep their data, use Disable instead.'))return;
  // Optimistic local cleanup first
  DB.users.filter(x=>x.managerId===id).forEach(x=>x.managerId=u.managerId);
  if(!DB.users_deleted)DB.users_deleted=[];
  if(!DB.users_deleted.includes(id))DB.users_deleted.push(id);
  DB.users=DB.users.filter(x=>x.id!==id);
  DB.checklists.forEach(c=>c.assignees=(c.assignees||[]).filter(a=>a!==id));
  DB.submissions=DB.submissions.filter(s=>s.userId!==id);
  DB.approvals=DB.approvals.filter(a=>a.requesterId!==id);
  DB.notifications=DB.notifications.filter(n=>n.userId!==id);
  DB.feedback=(DB.feedback||[]).filter(f=>f.userId!==id&&f.managerId!==id);
  // N2: also prune the deleted user's HRM data so their pending leave doesn't linger in
  // approver queues and their reserved balances/attendance/expenses/shifts/SOPs don't leak.
  DB.leaveRequests=(DB.leaveRequests||[]).filter(r=>r.userId!==id);
  DB.leaveBalances=(DB.leaveBalances||[]).filter(b=>b.userId!==id);
  DB.attendance=(DB.attendance||[]).filter(a=>a.userId!==id);
  DB.expenses=(DB.expenses||[]).filter(x=>x.userId!==id);
  DB.shifts=(DB.shifts||[]).filter(s=>s.userId!==id);
  DB.sopInstances=(DB.sopInstances||[]).filter(i=>i.userId!==id);
  // R20: manager-ness is structural (who reports to whom) — nothing to downgrade when the
  // last report leaves; isMgr()/subTree() simply stop matching. Access roles live in Access Control.
  log(fullName(me()),'Deleted user',name);
  toast(name+' deleted','warn');
  render();saveDB();
  // Background Supabase deletion of all related data
  Promise.all([
    sb.from('submissions').delete().eq('user_id',id),
    sb.from('approvals').delete().eq('requester_id',id),
    sb.from('notifications').delete().eq('user_id',id),
    sb.from('feedback').delete().eq('user_id',id),
    sb.from('leave_requests').delete().eq('user_id',id),
    sb.from('leave_balances').delete().eq('user_id',id),
    sb.from('attendance').delete().eq('user_id',id),
    sb.from('expenses').delete().eq('user_id',id),
    sb.from('shifts').delete().eq('user_id',id),
    sb.from('sop_instances').delete().eq('user_id',id),
    sb.from('profiles').delete().eq('id',id),
  ]).then(()=>{}).catch(e=>console.warn('delUser cleanup:',e));
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._disableBtn=_disableBtn;window.usersPage=usersPage;window._hrmUserSection=_hrmUserSection;window._readHrmFromForm=_readHrmFromForm;window._cityScopeChips=_cityScopeChips;
