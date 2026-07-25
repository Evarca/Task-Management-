

/* ════════ ACCESS CONTROL (role profiles & permissions) — Super Admin only ════════ */
/* ═══════ ACCESS CONTROL v3 — ROLES first ═══════
   Two tabs. ROLES: create/edit named roles — each role is a full toggle set over every tab,
   feature and action (incl. all HR modules). PEOPLE: assign a role to each person in ONE click,
   plus per-person switches (submission rules, approvals, client access, document
   access) and optional per-area OVERRIDES that beat the role. Staged edits — Save applies.
   Guard rails: the LAST person with Access Control can never lose it (any path). */
window._ACD=null; // per-user draft: {uid,perms(overrides),rules,approval,isHR,cities,docAccess,dirty}
window._RPD=null; // role draft: {id,name,description,perms,builtin,isNew,dirty}
function accessControlPage(){
  if(!can('accessControl','view'))return empty('shield','Restricted','You don\'t have access to Access Control.');
  _seedRoleProfiles();
  const tab=S.filters.acTab||'people';
  const tabs=`<div class="ui-tabs" style="margin-bottom:14px">
    <button class="ui-tab${tab==='people'?' on':''}" onclick="S.filters.acTab='people';rr()">People <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;background:var(--c-surface-2);color:var(--c-text-2);margin-left:5px">${DB.users.filter(u=>u.status==='Active').length}</span></button>
    <button class="ui-tab${tab==='roles'?' on':''}" onclick="S.filters.acTab='roles';rr()">Roles <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;background:var(--c-surface-2);color:var(--c-text-2);margin-left:5px">${Object.keys(DB.roleProfiles||{}).length}</span></button>
  </div>`;
  return `<div class="fade">${hdr('Access Control','Create roles → assign to people. Overrides handle the exceptions. Toggles also decide which Dashboard, People, Checklists and Administration sub-tabs a person sees.')}${tabs}${_howBar('accesscontrol')}${tab==='roles'?_acRolesTab():_acPeopleTab()}</div>`;
}
/* ─────────────── PEOPLE TAB ─────────────── */
function _acPeopleTab(){
  const canMng=can('accessControl','manage');
  const q=(S.filters.acQ||'').toLowerCase();
  let list=DB.users.slice();
  if(q)list=list.filter(u=>fullName(u).toLowerCase().includes(q)||String(u.email||'').toLowerCase().includes(q));
  if(S.filters.acDep)list=list.filter(u=>u.department===S.filters.acDep);
  list.sort((a,b)=>fullName(a).localeCompare(fullName(b)));
  const roles=Object.values(DB.roleProfiles||{});
  const hi=S.filters.acUser;
  const rows=list.map(u=>{
    _ensureHrm(u);
    const rid=u.hrm.roleProfileId||'';
    const nOv=Object.keys(u.hrm.perms||{}).length;
    const hrTag=u.hrm.isHR?'<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:10px;background:#FCE7F3;color:#9D174D" title="HR approver stage">HR</span>':'';
    return `<tr id="acu-${u.id}" style="${hi===u.id?'background:var(--c-brand-soft);':''}border-bottom:1px solid var(--c-border)">
      <td style="padding:11px 16px"><div style="display:flex;align-items:center;gap:11px;min-width:0">${avatar(u,'w-8 h-8','text-[11px]')}<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--c-text);display:flex;align-items:center;gap:6px">${esc(fullName(u))} ${hrTag}</div><div style="font-size:11px;color:var(--c-text-3)">${esc(u.department||'—')} · ${esc(u.position||roleName(u))}</div></div></div></td>
      <td style="padding:11px 8px">${canMng
        ?`<select onchange="App._acAssignRole('${u.id}',this.value)" class="ui-select" style="width:200px;font-size:12.5px;min-height:0;height:36px;padding:4px 26px 4px 12px">${roles.map(r=>`<option value="${r.id}" ${rid===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}${rid&&!DB.roleProfiles[rid]?`<option value="${esc(rid)}" selected>${esc(rid)} (missing)</option>`:''}${!rid?'<option value="" selected>— No role —</option>':''}</select>`
        :`<span style="font-size:12px;font-weight:700;color:var(--c-text-2)">${esc((DB.roleProfiles[rid]||{}).name||'— No role —')}</span>`}</td>
      <td style="padding:11px 16px;text-align:right"><button onclick="App._acPreview('${u.id}')" title="What does this person actually see?" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('eye','w-3.5 h-3.5')}Preview</button> <button onclick="App._acCustomize('${u.id}')" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('cog','w-3.5 h-3.5')}Personal</button></td>
    </tr>`;
  }).join('');
  return `<div class="ui-card" style="padding:0;overflow:hidden">
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding:12px;border-bottom:1px solid var(--c-border)">
      <input oninput="S.filters.acQ=this.value;App._searchRR('ac-q')" id="ac-q" value="${esc(S.filters.acQ||'')}" placeholder="Search people…" class="ui-input" style="flex:1;min-width:160px"/>
      <select onchange="S.filters.acDep=this.value;rr()" class="ui-select" style="width:auto"><option value="">All departments</option>${DB.departments.map(d=>`<option ${S.filters.acDep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    </div>
    <div style="overflow-x:auto"><table class="ac-people" style="width:100%;border-collapse:collapse">
      <thead><tr style="text-align:left;border-bottom:1px solid var(--c-border)">
        <th style="padding:11px 16px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Person</th>
        <th style="padding:11px 8px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Role (decides their tabs)</th>
        <th style="padding:11px 16px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;text-align:right">Personal settings</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="3">${empty('users','No people match','')}</td></tr>`}</tbody>
    </table></div>
  </div>`;
}
App._acAssignRole=(uid2,roleId)=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const u=uById(uid2);if(!u||!roleId||!DB.roleProfiles[roleId])return;
  _ensureHrm(u);
  const old=u.hrm.roleProfileId;
  if(old===roleId)return;
  // lockout: if the OLD standing granted AC and the new role doesn't, someone else must still hold it
  const newGrants=a=>!!(DB.roleProfiles[roleId].perms?.accessControl?.actions?.[a])||!!(u.hrm.perms?.accessControl?.actions?.[a]);
  for(const act of ['view','manage']){
    if(canUser(u,'accessControl',act)&&!newGrants(act)&&!_acLockoutSafe(u.id,act)){rr();return toast('Blocked — '+fullName(u)+' is the last person with Access Control ('+act+')','err');}
  }
  u.hrm.roleProfileId=roleId;u.hrm.permsV3=1;
  // R20: the access role IS the only role — no legacy base-role field to mirror any more.
  u.hrm.isHR=(roleId==='hr'); // ONE concept: the HR role IS the HR approver stage
  log(fullName(me()),'Role assigned',fullName(u)+' → '+(DB.roleProfiles[roleId].name||roleId));
  _acPushHrm(u); // R14: the assignment lives on u.hrm — push NOW so a reload can't revert it
  saveDB();_syncRoleProfiles();toast(fullName(u)+' → '+(DB.roleProfiles[roleId].name||roleId));rr();
};
/* ── Per-person Customize modal: personal switches + doc access + per-area overrides ── */
function _acDraft(u){
  if(_ACD&&_ACD.uid===u.id)return _ACD;
  _ensureHrm(u);
  _ACD={uid:u.id,
    perms:JSON.parse(JSON.stringify(u.hrm.perms||{})),
    rules:{past:true,future:true,edit:true,...(u.rules||{})},
    approval:{past:false,future:false,edited:false,...(u.approval||{})},
    isHR:u.hrm.isHR===true,
    cities:Array.isArray(u.cities)?u.cities.slice():[],
    docAccess:JSON.parse(JSON.stringify(u.docAccess||{departments:{},locations:{}})),
    dirty:false};
  return _ACD;
}
function _acTogBtn(on,label,onclick,disabled){
  return `<button ${disabled?'disabled':''} onclick="${onclick}" style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;border:1.5px solid ${on?'#0E9F6E':'var(--c-border)'};background:${on?'#ECFDF5':'var(--c-surface)'};color:${on?'#0B7A55':'var(--c-text-3)'};font-size:11.5px;font-weight:700;cursor:${disabled?'not-allowed':'pointer'};opacity:${disabled?'.45':'1'}">
    <span style="width:6px;height:6px;border-radius:50%;background:${on?'#10B981':'#D1D5DB'};flex-shrink:0"></span>${esc(label)}</button>`;
}
App._acCustomize=(uid2)=>{
  if(_ACD&&_ACD.uid!==uid2&&_ACD.dirty&&!confirm('Discard unsaved changes for the previous person?'))return;
  if(_ACD&&_ACD.uid!==uid2)_ACD=null;
  S.filters.acUser=uid2;
  App._renderACUser();
};
App._renderACUser=()=>{
  const u=uById(S.filters.acUser);if(!u)return;
  const d=_acDraft(u);
  const canMng=can('accessControl','manage'),dis=!canMng;
  const lab='font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em';
  const role=_roleOf(u);
  const r=d.rules,ap=d.approval;
  const personal=`<div style="${lab};margin:2px 0 8px">Personal switches</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px">
      <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--c-text)">Checklist submissions</div><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">
        ${_acTogBtn(r.past!==false,'Can submit past dates',`App._acRule('past')`,dis)}
        ${_acTogBtn(r.future!==false,'Can submit future dates',`App._acRule('future')`,dis)}
        ${_acTogBtn(r.edit!==false,'Can edit submitted data',`App._acRule('edit')`,dis)}
      </div></div>
      <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--c-text)">Needs approval when…</div><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">
        ${_acTogBtn(ap.past===true,'Past-dated entry',`App._acAppr('past')`,dis)}
        ${_acTogBtn(ap.future===true,'Future-dated entry',`App._acAppr('future')`,dis)}
        ${_acTogBtn(ap.edited===true,'Edited entry',`App._acAppr('edited')`,dis)}
      </div></div>

      <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--c-text)">Client access <span style="font-weight:500;color:var(--c-text-3)">(none selected = every client)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${(DB.locations||[]).filter(l=>l.status==='Active').map(l=>_acTogBtn((d.cities||[]).includes(l.id),l.name,`App._acCity('${l.id}')`,dis)).join('')||'<span style="font-size:11px;color:var(--c-text-3)">No clients yet.</span>'}</div>
      </div>
    </div>`;
  const da=d.docAccess||{departments:{},locations:{}};
  const docRow=(kind,id,name)=>{
    const p=(da[kind]||{})[id]||{};
    return `<div style="display:flex;align-items:center;gap:7px;padding:4px 0">
      <span style="flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>
      ${_acTogBtn(!!p.view,'View',`App._acDoc('${kind}','${id}','view')`,dis)}
      ${_acTogBtn(!!(p.upload||p.edit||p.download),'Manage',`App._acDoc('${kind}','${id}','manage')`,dis)}
    </div>`;
  };
  const docs=`<div style="${lab};margin:2px 0 4px">Document access <span style="text-transform:none;font-weight:600">(also unlocks the Departments / Locations tabs)</span></div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);margin:2px 0 4px">Departments</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:2px 20px;margin-bottom:10px">
      ${(DB.departments||[]).map(dp=>docRow('departments',dp.id,dp.name)).join('')||'<span style="font-size:11px;color:var(--c-text-3)">No departments.</span>'}
    </div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);margin:2px 0 4px">Clients</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:2px 20px;margin-bottom:14px">
      ${(DB.locations||[]).filter(l=>l.status==='Active').map(l=>docRow('locations',l.id,l.name)).join('')||'<span style="font-size:11px;color:var(--c-text-3)">No clients yet.</span>'}
    </div>`;
  // per-area overrides: follows role by default; Override copies the role's area for editing
  const groups={};_tmAreas().forEach(a=>{(groups[a.group||'System']=groups[a.group||'System']||[]).push(a);});
  const ovCards=Object.keys(groups).map(g=>{
    const rowsH=groups[g].map(a=>{
      const ov=d.perms[a.key];
      const roleArea=(role&&role.perms&&role.perms[a.key])||null;
      const roleActs=roleArea?a.actions.filter(x=>roleArea.actions&&roleArea.actions[x]).map(x=>PERM_ACTION_LABEL[x]||x).join(', ')||'nothing':'nothing';
      const body=ov
        ?`<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
            ${a.actions.map(act=>_acTogBtn(!!(ov.actions||{})[act],PERM_ACTION_LABEL[act]||act,`App._acT('${a.key}','${act}')`,dis)).join('')}
            ${a.scoped?`<select ${dis?'disabled':''} onchange="App._acScope('${a.key}',this.value)" class="ui-select" style="width:auto;font-size:11px;padding:3px 24px 3px 8px;min-height:0;height:25px">${_scopeOpts(ov.scope)}</select>`:''}
            ${canMng?`<button onclick="App._acOvRm('${a.key}')" style="font-size:10.5px;font-weight:700;color:var(--c-danger-ink);background:none;border:none;cursor:pointer;padding:2px 6px">✕ Remove override</button>`:''}
          </div>`
        :`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;color:var(--c-text-3)">Follows role: <b style="color:var(--c-text-2)">${esc(roleActs)}</b>${a.scoped&&roleArea?` · sees ${SCOPE_LABEL[roleArea.scope||'none']}`:''}</span>
            ${canMng?`<button onclick="App._acOvAdd('${a.key}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px">Override</button>`:''}
          </div>`;
      return `<div style="display:grid;grid-template-columns:minmax(140px,200px) 1fr;gap:4px 12px;padding:8px 0;border-top:1px solid var(--c-border);align-items:center;${ov?'background:linear-gradient(90deg,rgba(245,158,11,.06),transparent);':''}">
        <div><div style="font-size:12px;font-weight:700;color:var(--c-text)">${esc(a.label)}${ov?' <span style="font-size:9px;font-weight:800;color:#92400E;background:#FEF3C7;padding:1px 6px;border-radius:8px;vertical-align:middle">OVERRIDE</span>':''}</div></div>
        ${body}
      </div>`;
    }).join('');
    return `<div style="margin-bottom:10px"><div style="${lab};margin-bottom:2px">${esc(g)}</div>${rowsH}</div>`;
  }).join('');
  modalShell({title:'Personal settings — '+fullName(u),sub:(role?('Role: '+role.name):'No role assigned')+' · changes apply on Save',size:'max-w-3xl',
    body:`<div>${d.dirty?'<div style="font-size:11.5px;font-weight:800;color:#92400E;background:#FEF3C7;border-radius:9px;padding:7px 11px;margin-bottom:12px">● Unsaved changes — press Save below</div>':''}
      ${personal}${docs}
      ${(()=>{const SYS=['departments','locations','documentsOrg'];const legacy=Object.keys(d.perms).filter(k=>!SYS.includes(k));return legacy.length?`<div style="font-size:11px;color:var(--c-text-3);background:var(--c-surface-2);border-radius:9px;padding:8px 11px">This person has ${legacy.length} legacy exception(s) from migration, so some areas ignore their role. <button onclick="['${'${'}legacy.join(\"','\")}'].forEach(k=>delete _ACD.perms[k]);_acMark()" style="border:none;background:none;color:var(--c-danger-ink);font-weight:800;cursor:pointer;font-size:11px;padding:0">Clear them</button> so the role decides everything. (Document-folder access is managed above and not affected.)</div>`:'';})()}
    </div>`,
    footer:btnG('Cancel','_ACD=null;App.closeModal();rr()')+(canMng?btnP('Save changes','App._acSave()'):'')});
};
function _acGuard(){if(!can('accessControl','manage')){toast('You need Access Control → Manage','err');return false;}return true;}
function _acMark(){if(_ACD){_ACD.dirty=true;App._renderACUser();}}
function _acPushProfile(u){
  sb.from('profiles').update({rules:u.rules||{},approval_settings:u.approval||{},cities:u.cities||[],doc_access:u.docAccess||{departments:{},locations:{}}}).eq('id',u.id).then(({error})=>{if(error)_syncErr('access change')(error);}).catch(_syncErr('access change'));
}
/* R14 (owner report: "I update the access and it's not getting updated"): permission overrides,
   the HR flag and the assigned role all live on u.hrm — previously they reached the server only
   via the DEBOUNCED background batch, so a quick reload (or one failed push) silently reverted
   the change at next login. Access changes now push the user_hrm row IMMEDIATELY. */
function _acPushHrm(u){
  sb.from('user_hrm').upsert({user_id:u.id,hrm:_hrmStrip(u.hrm),updated_at:new Date().toISOString()},{onConflict:'user_id'}).then(({error})=>{
    if(error){_syncErr('access change (hrm)')(error);return;}
    /* R17 (owner report: "I removed the permission but he can still use it"): a target user's OPEN
       session kept the old permissions until their next reload. Realtime on user_hrm itself proved
       unreliable (the RLS check drops those events), so we ride the PROVEN notifications channel:
       tell the target "your access changed" — their client's realtime listener sees kind='access',
       refetches user_hrm + role_profiles, re-renders, and the stale controls vanish within ~1s.
       Deduped per target (10s) so a burst of edits produces one ping. */
    try{
      if(u.id!==S.uid){
        window._acNtfAt=window._acNtfAt||{};const now=Date.now();
        if(!window._acNtfAt[u.id]||now-window._acNtfAt[u.id]>10000){
          window._acNtfAt[u.id]=now;
          sb.from('notifications').insert({id:uid('n'),user_id:u.id,text:'\ud83d\udd10 Your access or HR settings were just updated by an admin',read:false,kind:'access',created_at:new Date().toISOString()}).then(()=>{}).catch(()=>{});
        }
      }
    }catch(e){}
  }).catch(_syncErr('access change (hrm)'));
}
App._acOvAdd=(area)=>{
  if(!_acGuard()||!_ACD)return;
  const u=uById(_ACD.uid);const role=_roleOf(u);
  const base=(role&&role.perms&&role.perms[area])?JSON.parse(JSON.stringify(role.perms[area])):{scope:'none',actions:{}};
  base.actions=base.actions||{};
  _ACD.perms[area]=base;_acMark();
};
App._acOvRm=(area)=>{if(!_acGuard()||!_ACD)return;delete _ACD.perms[area];_acMark();};
App._acT=(area,act)=>{
  if(!_acGuard()||!_ACD)return;
  const p=_ACD.perms[area];if(!p)return;
  p.actions=p.actions||{};
  const next=!p.actions[act];p.actions[act]=next;
  if(next&&act!=='view'&&(PERM_AREAS.find(a=>a.key===area)||{actions:[]}).actions.includes('view')&&!p.actions.view)p.actions.view=true;
  if(next&&(PERM_AREAS.find(a=>a.key===area)||{}).scoped&&(!p.scope||p.scope==='none'))p.scope='self';
  _acMark();
};
App._acScope=(area,scope)=>{if(!_acGuard()||!_ACD)return;const p=_ACD.perms[area];if(!p)return;p.scope=scope;_acMark();};
App._acRule=(key)=>{if(!_acGuard()||!_ACD)return;_ACD.rules[key]=_ACD.rules[key]===false;_acMark();};
App._acAppr=(key)=>{if(!_acGuard()||!_ACD)return;_ACD.approval[key]=_ACD.approval[key]!==true;_acMark();};
App._acHRFlag=()=>{if(!_acGuard()||!_ACD)return;_ACD.isHR=!(_ACD.isHR===true);_acMark();};
App._acCity=(cityId)=>{
  if(!_acGuard()||!_ACD)return;
  const i=_ACD.cities.indexOf(cityId);
  if(i>-1)_ACD.cities.splice(i,1);else _ACD.cities.push(cityId);
  _acMark();
};
App._acDoc=(kind,id,which)=>{
  if(!_acGuard()||!_ACD)return;
  const bucket=_ACD.docAccess[kind]=_ACD.docAccess[kind]||{};
  const p=bucket[id]=bucket[id]||{};
  if(which==='view'){const on=!p.view;p.view=on;if(!on){p.upload=false;p.edit=false;p.download=false;}}
  else{const on=!(p.upload||p.edit||p.download);p.upload=on;p.edit=on;p.download=on;if(on)p.view=true;}
  _acMark();
};
App._acSave=()=>{
  if(!_acGuard())return;
  const d=_ACD;if(!d)return;
  const u=uById(d.uid);if(!u)return;
  for(const act of ['view','manage']){
    const has=canUser(u,'accessControl',act);
    const ov=d.perms.accessControl;
    const role=_roleOf(u);
    const will=ov?!!(ov.actions&&ov.actions[act]):!!(role&&role.perms&&role.perms.accessControl&&role.perms.accessControl.actions&&role.perms.accessControl.actions[act]);
    if(has&&!will&&!_acLockoutSafe(u.id,act))return toast('Blocked — '+fullName(u)+' is the last person with Access Control ('+act+'). Grant it to someone else first.','err');
  }
  _ensureHrm(u);
  u.hrm.perms=Object.keys(d.perms).length?JSON.parse(JSON.stringify(d.perms)):null;
  u.hrm.isHR=d.isHR===true;
  u.rules={...d.rules};u.approval={...d.approval};
  u.cities=d.cities.slice();u.docAccess=JSON.parse(JSON.stringify(d.docAccess));
  _acPushProfile(u);
  _acPushHrm(u); // R14: perms/isHR live on u.hrm — push NOW, don't wait for the debounced batch
  log(fullName(me()),'Access updated',fullName(u));
  _ACD=null;
  saveDB();closeModal();toast('Access saved for '+fullName(u));rr();
};
/* Options for a scope <select>. Only the choices that still resolve are offered, but a value
   already stored on a bundle is always included so opening the editor can never silently
   change it to something else. */
function _scopeOpts(cur){
  const v=cur||'none';
  const list=SCOPE_CHOICES.includes(v)?SCOPE_CHOICES:[...SCOPE_CHOICES,v];
  return list.map(s=>`<option value="${s}" ${v===s?'selected':''}>${esc(SCOPE_LABEL[s]||s)}</option>`).join('');
}

/* ─────────────── ROLES TAB ─────────────── */
function _acRolesTab(){
  const canMng=can('accessControl','manage');
  const roles=Object.values(DB.roleProfiles||{}).sort((a,b)=>(b.builtin?1:0)-(a.builtin?1:0)||String(a.name).localeCompare(String(b.name)));
  const cards=roles.map(p=>{
    const n=DB.users.filter(u=>u.hrm?.roleProfileId===p.id).length;
    let on=0;Object.values(p.perms||{}).forEach(a=>Object.values(a.actions||{}).forEach(v=>{if(v)on++;}));
    return `<div class="ui-card" style="padding:16px;display:flex;flex-direction:column;gap:9px">
      <div style="min-width:0">
        <div class="fd" style="font-size:15px;font-weight:800;color:var(--c-text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">${esc(p.name)}${p.builtin?'<span style="font-size:9px;font-weight:800;text-transform:uppercase;background:var(--c-info-soft);color:var(--c-info-ink);padding:2px 6px;border-radius:99px">Built-in</span>':''}</div>
        <div style="font-size:12px;color:var(--c-text-3);margin-top:3px;line-height:1.45">${esc(p.description||'')}</div>
      </div>
      <div style="display:flex;gap:12px;font-size:11.5px;color:var(--c-text-2);font-weight:600">
        <span style="display:inline-flex;align-items:center;gap:4px">${ic('users','w-3.5 h-3.5')}${n} ${n===1?'person':'people'}</span>
        <span style="display:inline-flex;align-items:center;gap:4px">${ic('check','w-3.5 h-3.5')}${on} permissions on</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto">
        ${canMng?btn('Edit',`App._rpEdit('${p.id}')`,{variant:'ghost',size:'sm',icon:'edit'}):btn('View',`App._rpEdit('${p.id}')`,{variant:'ghost',size:'sm'})}
        ${canMng?btn('Duplicate',`App._rpDup('${p.id}')`,{variant:'ghost',size:'sm',icon:'copy'}):''}
        ${canMng&&!p.builtin?btn('Delete',`App._rpDel('${p.id}')`,{variant:'danger',size:'sm',icon:'trash'}):''}
      </div>
    </div>`;
  }).join('');
  return `<div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <p style="font-size:12.5px;color:var(--c-text-3);max-width:560px;line-height:1.5;margin:0">A role bundles every tab / feature / action toggle. Assign roles in the <b>People</b> tab. Built-in roles can be edited or duplicated as a starting point.</p>
      ${canMng?btnP('New role','App._rpNewChooser()','plus'):''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">${cards||empty('shield','No roles yet','Create one to get started.')}</div>
  </div>`;
}
App._rpEdit=(id)=>{
  const ex=id?DB.roleProfiles[id]:null;
  _RPD=ex?{...JSON.parse(JSON.stringify(ex)),isNew:false,dirty:false}
        :{id:uid('role'),name:'',description:'',builtin:false,perms:{},isNew:true,dirty:false};
  App._renderRPEdit();
};
App._renderRPEdit=()=>{
  const p=_RPD;if(!p)return;
  const canMng=can('accessControl','manage'),dis=!canMng;
  const lab='font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em';
  const nUsers=p.isNew?0:DB.users.filter(u=>u.hrm?.roleProfileId===p.id).length;
  const groups={};_tmAreas().forEach(a=>{(groups[a.group||'System']=groups[a.group||'System']||[]).push(a);});
  const grid=Object.keys(groups).map(g=>{
    const rowsH=groups[g].map(a=>{
      const cur=p.perms[a.key]||{scope:'none',actions:{}};
      const nOn=a.actions.filter(x=>(cur.actions||{})[x]).length;
      const hay=(a.label+' '+a.desc+' '+a.actions.map(x=>PERM_ACTION_LABEL[x]||x).join(' ')).toLowerCase();
      return `<div data-rp-row="${esc(hay)}" style="display:${(p.q&&!hay.includes(String(p.q).toLowerCase()))?'none':'grid'};grid-template-columns:minmax(140px,200px) 1fr;gap:4px 12px;padding:8px 0;border-top:1px solid var(--c-border);align-items:center">
        <div><div style="font-size:12px;font-weight:700;color:var(--c-text)">${esc(a.label)} ${nOn?`<span style="font-size:9px;font-weight:800;color:#0B7A55">${nOn} on</span>`:''}</div><div style="font-size:10px;color:var(--c-text-3);line-height:1.3">${esc(a.desc)}</div></div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
          ${a.actions.map(act=>_acTogBtn(!!(cur.actions||{})[act],PERM_ACTION_LABEL[act]||act,`App._rpT('${a.key}','${act}')`,dis)).join('')}
          ${a.scoped?`<span style="font-size:9.5px;color:var(--c-text-3)">sees:</span><select ${dis?'disabled':''} onchange="App._rpScope('${a.key}',this.value)" class="ui-select" style="width:auto;font-size:11px;padding:3px 24px 3px 8px;min-height:0;height:25px">${_scopeOpts(cur.scope)}</select>`:''}
        </div>
      </div>`;
    }).join('');
    return `<div style="margin-bottom:8px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><span style="${lab}">${esc(g)}</span>${canMng?`<button onclick="App._rpGroupSet('${esc(g)}',true)" style="font-size:9.5px;font-weight:800;color:#0B7A55;background:#ECFDF5;border:1px solid #D1FAE5;border-radius:7px;padding:2px 8px;cursor:pointer">ALL ON</button><button onclick="App._rpGroupSet('${esc(g)}',false)" style="font-size:9.5px;font-weight:800;color:#BE123C;background:#FFF1F2;border:1px solid #FECDD3;border-radius:7px;padding:2px 8px;cursor:pointer">ALL OFF</button>`:''}</div>${rowsH}</div>`;
  }).join('');
  const _tot=_tmAreas().reduce((n,a)=>n+a.actions.length,0);
  const _on=_tmAreas().reduce((n,a)=>n+a.actions.filter(x=>((p.perms[a.key]||{}).actions||{})[x]).length,0);
  modalShell({title:p.isNew?'New role':('Role — '+(p.name||'Untitled')),sub:(nUsers?nUsers+' people have this role · ':'')+_on+' of '+_tot+' permissions on · toggles apply on Save',size:'max-w-3xl',
    body:`<div>
      ${p.dirty?'<div style="font-size:11.5px;font-weight:800;color:#92400E;background:#FEF3C7;border-radius:9px;padding:7px 11px;margin-bottom:12px">● Unsaved changes — press Save below</div>':''}
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-bottom:14px">
        <div><label style="${lab}">Role name *</label><input ${dis?'disabled':''} type="text" value="${esc(p.name||'')}" oninput="_RPD.name=this.value;_RPD.dirty=true" placeholder="e.g. Branch Supervisor" class="ui-input rf" style="margin-top:5px"/></div>
        <div><label style="${lab}">Description</label><input ${dis?'disabled':''} type="text" value="${esc(p.description||'')}" oninput="_RPD.description=this.value;_RPD.dirty=true" placeholder="What is this role for?" class="ui-input rf" style="margin-top:5px"/></div>
      </div>
      <input value="${esc(p.q||'')}" placeholder="Find a permission… e.g. create user, approve, tickets" class="ui-input rf" style="margin-bottom:10px" oninput="_RPD.q=this.value;const q=this.value.toLowerCase();document.querySelectorAll('[data-rp-row]').forEach(r=>{r.style.display=!q||r.getAttribute('data-rp-row').includes(q)?'grid':'none'});"/>
      ${grid}
    </div>`,
    footer:btnG('Cancel','_RPD=null;App.closeModal()')+(canMng?btnP(p.isNew?'Create role':'Save role','App._rpSave()'):'')});
};
/* FINAL-UX: one click grants/clears a whole permission group in the role editor (marks dirty, applies on Save). */
App._rpGroupSet=(group,on)=>{
  const p=_RPD;if(!p||!can('accessControl','manage'))return;
  _tmAreas().filter(a=>(a.group||'System')===group).forEach(a=>{
    const cur=p.perms[a.key]=p.perms[a.key]||{scope:'none',actions:{}};
    cur.actions=cur.actions||{};
    a.actions.forEach(act=>{cur.actions[act]=!!on;});
    if(a.scoped)cur.scope=on?'everyone':'none';
  });
  p.dirty=true;App._renderRPEdit();
};
App._rpT=(area,act)=>{
  if(!can('accessControl','manage')||!_RPD)return;
  const p=_RPD.perms[area]=_RPD.perms[area]||{scope:'none',actions:{}};
  p.actions=p.actions||{};
  const next=!p.actions[act];p.actions[act]=next;
  if(next&&act!=='view'&&(PERM_AREAS.find(a=>a.key===area)||{actions:[]}).actions.includes('view')&&!p.actions.view)p.actions.view=true;
  if(next&&(PERM_AREAS.find(a=>a.key===area)||{}).scoped&&(!p.scope||p.scope==='none'))p.scope='self';
  _RPD.dirty=true;App._renderRPEdit();
};
App._rpScope=(area,scope)=>{if(!can('accessControl','manage')||!_RPD)return;const p=_RPD.perms[area]=_RPD.perms[area]||{scope:'none',actions:{}};p.scope=scope;_RPD.dirty=true;App._renderRPEdit();};
App._rpSave=()=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const p=_RPD;if(!p)return;
  if(!(p.name||'').trim())return toast('Give the role a name','err');
  // lockout: would this edit strip Access Control from its LAST holder(s)?
  const ex=DB.roleProfiles[p.id];
  if(ex){
    for(const act of ['view','manage']){
      const had=!!(ex.perms?.accessControl?.actions?.[act]);
      const will=!!(p.perms?.accessControl?.actions?.[act]);
      if(had&&!will){
        const holders=DB.users.filter(u=>u.status==='Active'&&canUser(u,'accessControl',act));
        const survivors=holders.filter(u=>{
          const o=_userPermArea(u,'accessControl');
          if(o)return !!(o.actions&&o.actions[act]);
          return u.hrm?.roleProfileId!==p.id; // keeps it via a different role
        });
        if(holders.length&&!survivors.length)return toast('Blocked — removing Access Control ('+act+') from this role would lock everyone out. Grant it elsewhere first.','err');
      }
    }
  }
  const clean={id:p.id,name:p.name.trim(),description:p.description||'',builtin:!!(ex&&ex.builtin),_v:ex?ex._v:'3',perms:JSON.parse(JSON.stringify(p.perms||{}))};
  DB.roleProfiles[p.id]=clean;
  log(fullName(me()),p.isNew?'Role created':'Role updated',clean.name);
  _RPD=null;
  saveDB();_syncRoleProfiles();closeModal();toast('Role saved — applies to everyone assigned to it');rr();
};
App._rpDup=(id)=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const ex=DB.roleProfiles[id];if(!ex)return;
  const copy=JSON.parse(JSON.stringify(ex));
  copy.id=uid('role');copy.name=ex.name+' (copy)';copy.builtin=false;delete copy._v;
  DB.roleProfiles[copy.id]=copy;
  log(fullName(me()),'Role duplicated',ex.name);
  saveDB();_syncRoleProfiles();toast('Role duplicated — edit the copy');rr();
};
App._rpDel=(id)=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const ex=DB.roleProfiles[id];if(!ex)return;
  if(ex.builtin)return toast('Built-in roles can\'t be deleted (duplicate them instead)','err');
  // Referential-integrity guard (upgraded from the old toast): names who still holds the role.
  if(!guardDelete('role',id,'role "'+ex.name+'"'))return;
  if(!confirm('Delete role "'+ex.name+'"?'))return;
  delete DB.roleProfiles[id];
  log(fullName(me()),'Role deleted',ex.name);
  saveDB();_syncRoleProfiles();toast('Role deleted','warn');rr();
};
function _syncRoleProfiles(){
  if(!can('accessControl','manage')||!sb||!DB.roleProfiles)return;
  sb.from('workspace_settings').upsert({key:'role_profiles',value:DB.roleProfiles,updated_at:new Date().toISOString()},{onConflict:'key'})
    .then(({error})=>{if(error)toast('Couldn\'t sync role profiles to server','err');}).catch(()=>toast('Couldn\'t sync role profiles to server','err'));
}


/* ═══ VIEW AS USER — read-only simulation of what a person can actually see & do ═══
   Resolved with the SAME canUser/role/override rules the app enforces; nothing is switched. */
const _AC_ROUTES=[
  ['Dashboard & Inbox',[['My Day','dashboard','view'],['Company dashboard','analytics','view'],['Approvals inbox','approvals','view']]],
  ['Work & Content',[['My checklists',null,null],['Checklist builder','checklists','create'],['All results','allChecklists','view'],['Team view','teamview','view'],['Questions','questions','view'],['Tickets','tickets','view'],['Announcements','announcements','view']]],
  ['People & Org',[['People directory','employees','view'],['Hierarchy','hierarchy','view']]],
  ['Administration',[['Departments','departments','view'],['Clients','locations','view'],['Audit log','audit','view'],['Settings','settings','view'],['Access Control','accessControl','view']]],
];
function _acEffArea(u,areaKey){
  const o=_userPermArea(u,areaKey);
  if(o)return{actions:o.actions||{},scope:o.scope||'none',src:'override'};
  const rp=_roleOf(u);
  const a=rp&&rp.perms&&rp.perms[areaKey];
  if(a)return{actions:a.actions||{},scope:a.scope||'none',src:rp.name||'role'};
  const base=DB.roleProfiles&&DB.roleProfiles.basic&&DB.roleProfiles.basic.perms&&DB.roleProfiles.basic.perms[areaKey];
  return{actions:(base&&base.actions)||{},scope:(base&&base.scope)||'none',src:'Basic fallback'};
}
App._acPreview=(uid2)=>{
  const u=uById(uid2);if(!u)return;
  const role=_roleOf(u);
  const routeChip=(label,ok)=>`<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:${ok?'var(--c-success-soft)':'var(--c-surface-2)'};color:${ok?'var(--c-success-ink)':'var(--c-text-3)'};${ok?'':'text-decoration:line-through;opacity:.7'}">${esc(label)}</span>`;
  const routes=_AC_ROUTES.map(([grp,items])=>`<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">${esc(grp)}</div><div style="display:flex;gap:5px;flex-wrap:wrap">${items.map(([label,area,act])=>routeChip(label,area?canUser(u,area,act):true)).join('')}</div></div>`).join('');
  const rows=_tmAreas().map(a=>{
    const eff=_acEffArea(u,a.key);
    const on=a.actions.filter(x=>eff.actions[x]);
    if(!on.length)return'';
    return`<div style="display:grid;grid-template-columns:minmax(130px,190px) 1fr;gap:4px 12px;padding:7px 0;border-top:1px solid var(--c-border);align-items:baseline">
      <div style="font-size:12px;font-weight:700;color:var(--c-text)">${esc(a.label)}${eff.src==='override'?' <span style="font-size:9px;font-weight:800;color:#92400E;background:#FEF3C7;padding:1px 6px;border-radius:8px;vertical-align:middle">OVERRIDE</span>':''}</div>
      <div style="font-size:11.5px;color:var(--c-text-2);line-height:1.6">${on.map(x=>esc(PERM_ACTION_LABEL[x]||x)).join(' · ')}${a.scoped?` <span style="color:var(--c-text-3)">— sees ${esc(SCOPE_LABEL[eff.scope]||eff.scope)}</span>`:''}</div>
    </div>`;
  }).join('');
  modalShell({title:'Access preview — '+fullName(u),sub:(role?('Role: '+role.name):'No role (Basic fallback)')+' · read-only simulation, resolved exactly like the app does',size:'max-w-2xl',
    body:`<div>
      <div style="font-size:10.5px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Pages they can open</div>
      ${routes}
      <div style="font-size:10.5px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 2px">Everything they can do (action by action)</div>
      ${rows||'<p style="font-size:12.5px;color:var(--c-text-3);padding:8px 0">Nothing granted.</p>'}
    </div>`,
    footer:btnG('Close','App.closeModal()')+(can('accessControl','manage')?btnP('Edit personal settings',`App.closeModal();App._acCustomize('${u.id}')`):'')});
};

/* ═══ NEW ROLE FROM TEMPLATE — start from a built-in bundle instead of a blank sheet ═══ */
App._rpNewFrom=(tplId)=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  closeModal();
  if(!tplId){App._rpEdit(null);return;}
  const tpl=DB.roleProfiles[tplId];if(!tpl){App._rpEdit(null);return;}
  App._rpEdit(null);
  if(window._RPD){_RPD.perms=JSON.parse(JSON.stringify(tpl.perms||{}));_RPD.description='Based on '+(tpl.name||tplId);_RPD.dirty=true;App._renderRPEdit();}
};
App._rpNewChooser=()=>{
  if(!can('accessControl','manage'))return toast('You need Access Control → Manage','err');
  const opt=(id,label,desc)=>`<button onclick="App._rpNewFrom(${id?`'${id}'`:'null'})" class="ui-card" style="width:100%;text-align:left;padding:12px 14px;cursor:pointer;display:block;border:1px solid var(--c-border);margin-bottom:8px">
    <div style="font-size:13.5px;font-weight:800;color:var(--c-text)">${esc(label)}</div>
    <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px;line-height:1.45">${esc(desc)}</div></button>`;
  modalShell({title:'New role — start from…',sub:'Pick a starting point; every toggle stays editable before you save.',size:'max-w-md',
    body:`<div>${opt(null,'Blank','No permissions on — build it up toggle by toggle.')}
      ${opt('basic','Basic Employee template','Their own checklists and tickets.')}
      ${opt('manager','Team Lead / Manager template','Team-scoped: checklists, approvals, tickets and the team board.')}
      ${opt('hr','Operations template','Org-wide visibility across checklists, people and reporting.')}
      ${opt('admin','Administrator template','Everything except Access Control itself.')}</div>`,
    footer:btnG('Cancel','App.closeModal()')});
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.accessControlPage=accessControlPage;window._acPeopleTab=_acPeopleTab;window._acDraft=_acDraft;window._acTogBtn=_acTogBtn;window._acGuard=_acGuard;window._acMark=_acMark;window._acPushProfile=_acPushProfile;window._scopeOpts=_scopeOpts;window._acRolesTab=_acRolesTab;window._syncRoleProfiles=_syncRoleProfiles;window._acPushHrm=_acPushHrm;
