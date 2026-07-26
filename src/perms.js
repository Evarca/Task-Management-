
/* ═══════════════════════════════════════════════════════════════
   PERMISSIONS SYSTEM (frontend-only — NO Supabase, all on DB / u.hrm)
   - PERM_AREAS: single source of truth. Add an area = add one entry.
   - DB.roleProfiles: named permission bundles (object keyed by id).
   - u.hrm.roleProfileId: per-user assignment (null = base-role floor).
   - can()/scopeOf()/scopeFilter(): the resolver every gate calls.
   - R20: the legacy base-role shim is gone. Anyone with no resolvable
     role falls back to the Basic Employee bundle (superadmin id exempt).
   ═══════════════════════════════════════════════════════════════ */
// `group` partitions the Access-Control editor into labelled sections (rendering only — does not
// affect can()/scope resolution). Every `actions` entry below is an action that is actually enforced
// by a can(area,action) gate somewhere in this file (verified by grep — see B2a matrix); the editor
// is fully data-driven from this list so a toggle exists for every gate the app checks.
const PERM_GROUPS=['Dashboards & Inbox','Work & Content','People & Org','Administration']; // mirrors the sidebar hubs 1:1
/* ── AREAS THIS BUILD SHOWS ──
   PERM_AREAS below deliberately keeps EVERY area the platform defines, including the ones whose
   features this task-management build doesn't ship. That is not dead weight: role bundles live in
   the shared workspace_settings row, and the Access Control editor writes back the bundle it was
   given. Dropping an area from PERM_AREAS would only hide it from the editor — the stored toggles
   for it are copied through untouched on save — but keeping the full list also means _seedRoleProfiles
   can never re-seed a built-in role with a narrower permission set than the platform expects.
   TM_AREAS is what the editor RENDERS; resolution (can/scopeOf) always uses the full list. */
const TM_AREAS=['dashboard','analytics','approvals','teamview','checklists','allChecklists','questions','tickets','employees','hierarchy','locations','departments','audit','settings','accessControl'];
/* Actions PERM_AREAS defines that NOTHING in this build checks. They stay in PERM_AREAS (and in a
   saved bundle) so the wider platform keeps them, but the editor must not offer a switch that
   changes nothing — a permission you can turn on and off with no effect is worse than no switch.
   Verified by grep: no can(area,action) call site exists for any pair below. */
const TM_HIDDEN_ACTIONS={
  checklists:['assign'],                              // assigning people IS editing the checklist
  employees:['manageAssets','assign','manage'],       // assets/lifecycle live in the full platform only
  locations:['manage'],                               // covered by Create / Edit
};
/* Wording for this build. Same keys, same behaviour — the platform's labels talk about HR features
   that aren't here, which made the editor read as if it controlled more than it does. */
const TM_AREA_COPY={
  locations:{label:'Clients',desc:'The client list, the folders and documents held against each client, and — behind its own Billing & invoices toggle — engagement totals, payments and invoices'},
  employees:{label:'People',desc:'The people directory — add people, edit them, reset passwords, set who reports to whom'},
  checklists:{label:'Checklists — builder',desc:'Building checklists, and approving edits to answers that are already submitted'},
  allChecklists:{label:'Checklists — all results',desc:'Every checklist across the company, not just their own team'},
  analytics:{label:'Dashboard — Company',desc:'The company-wide view: what is running, what is late, tickets'},
  approvals:{label:'Inbox — Approvals',desc:'The approvals inbox. What they can actually decide still comes from each area'},
  teamview:{label:'Checklists — team',desc:"Today's live status for the people who report to them"},
};
/* Returns COPIES — PERM_AREAS itself is never mutated, so resolution and the round-trip save keep
   seeing the full platform list. */
const _tmAreas=()=>PERM_AREAS.filter(a=>TM_AREAS.includes(a.key)).map(a=>{
  const hide=TM_HIDDEN_ACTIONS[a.key],copy=TM_AREA_COPY[a.key];
  if(!hide&&!copy)return a;
  return {...a,...(copy||{}),actions:hide?a.actions.filter(x=>!hide.includes(x)):a.actions};
});
const PERM_AREAS=[
  {key:'dashboard',label:'Dashboard — My Day',desc:'The landing overview',actions:['view'],scoped:false,group:'Dashboards & Inbox'},
  {key:'attendance',label:'Attendance',desc:'Clock-in/out records & calendar',actions:['view','edit','download'],scoped:true,group:'Time & Leave'},
  {key:'leaveRequests',label:'Leave — requests',desc:'Applying for and acting on leave',actions:['view','create','approve','download'],scoped:true,group:'Time & Leave'},
  {key:'leaveBalances',label:'Leave — balances',desc:"People's leave day balances",actions:['view','edit','grant'],scoped:true,group:'Time & Leave'},
  {key:'hrSettings',label:'HR Config (policy, types, flows)',desc:'Leave policy, types, holidays, approval flows',actions:['view','edit'],scoped:false,group:'Administration'},
  {key:'employees',label:'People directory',desc:'The people directory — create, edit, deactivate people, assign managers',actions:['view','create','edit','delete','deactivate','resetPassword','manageAssets','assignManager','assignRole','assign','manage'],scoped:true,group:'People & Org'},
  {key:'hierarchy',label:'Hierarchy / Org chart',desc:'The reporting tree',actions:['view'],scoped:true,group:'People & Org'},
  {key:'teamview',label:'Checklists — team view',desc:'The Team page — live checklist status of the team',actions:['view'],scoped:false,group:'Work & Content'},
  {key:'checklists',label:'Checklists — builder',desc:'The checklist system',actions:['view','create','edit','duplicate','delete','assign','approve'],scoped:true,group:'Work & Content'},
  {key:'allChecklists',label:'Checklists — all results',desc:'Browse every checklist across the company',actions:['view'],scoped:false,group:'Work & Content'},
  {key:'questions',label:'Questions',desc:'The reusable question bank — every operation has its own toggle',actions:['view','create','edit','delete','import','export'],scoped:false,group:'Work & Content'},
  {key:'tickets',label:'Tickets',desc:'Issue tickets — status changes, resolving and deleting are separate toggles',actions:['view','create','changeStatus','resolve','delete'],scoped:true,group:'Work & Content'},
  {key:'documentsOrg',label:'Documents (organization)',desc:'Shared dept/location files',actions:['view','create','delete','download','approve'],scoped:true,group:'Work & Content'},
  {key:'documentsPersonal',label:'Personal documents',desc:'Files on a person\'s profile',actions:['view','create','delete','download'],scoped:true,group:'Work & Content'},
  {key:'analytics',label:'Dashboard — Company',desc:'Operational analytics dashboard (checklists, compliance, tickets)',actions:['view'],scoped:false,group:'Dashboards & Inbox'},
  {key:'reports',label:'Dashboard — HRM Analytics',desc:'HR analytics dashboard & CSV exports',actions:['view','download'],scoped:true,group:'Dashboards & Inbox'},
  {key:'okr',label:'OKRs',desc:'Hierarchical objectives (L0 → L1 → L2) with annual → quarterly splits. “Sees” decides WHOSE objectives they can view — owners always see their own (they have to update them); sub-objectives of anything visible are included',actions:['view','create','edit','checkin','manage','delete'],scoped:true,group:'Dashboards & Inbox'},
  {key:'announcements',label:'Announcements',desc:'Company-wide messages',actions:['view','create','delete'],scoped:false,group:'Work & Content'},
  {key:'locations',label:'Clients',desc:'The client list, and the folders and documents held against each one',actions:['view','create','edit','delete','manage','billing'],scoped:false,group:'Administration'},
  {key:'departments',label:'Departments',desc:'Departments & sub-departments — create, edit and delete are separate toggles',actions:['view','create','edit','delete'],scoped:false,group:'Administration'},
  {key:'approvals',label:'Inbox — Approvals',desc:'The unified approvals page (what they can act on is still per-area)',actions:['view'],scoped:false,group:'Dashboards & Inbox'},
  {key:'scheduling',label:'Shifts / Roster',desc:'The weekly shift roster — build, edit, publish and delete are separate toggles',actions:['view','create','edit','publish','delete'],scoped:true,group:'Time & Leave'},
  {key:'overtime',label:'Overtime',desc:'Log extra hours; weekly review, pay or time-in-lieu',actions:['view','submit','approve'],scoped:true,group:'Time & Leave'},
  {key:'lifecycle',label:'Lifecycle flows',desc:'Onboarding, probation & exit checklists — starting a flow and updating its steps are separate toggles',actions:['view','start','progress'],scoped:true,group:'People & Org'},
  {key:'discipline',label:'Discipline',desc:'Warnings on file (12-month retention) — create, edit and delete are separate toggles',actions:['view','create','edit','delete'],scoped:true,group:'People & Org'},
  {key:'letters',label:'Letters',desc:'Request, approve & issue HR letters from templates',actions:['view','create','approve','issue'],scoped:true,group:'Work & Content'},
  {key:'payroll',label:'Payroll',desc:'Runs, verification, payslips, WPS export',actions:['view','verify','run','approve','finalize','rollback','download'],scoped:false,group:'Pay'},
  {key:'surveys',label:'Surveys',desc:'Pulse & performance surveys — create, open/close, delete and export are separate toggles',actions:['view','submit','create','close','delete','export'],scoped:false,group:'People & Org'},
  {key:'reviews',label:'Performance reviews',desc:'Appraisal cycles — creating/opening cycles, closing them and exporting are separate toggles',actions:['view','submit','create','close','export'],scoped:true,group:'People & Org'},
  {key:'audit',label:'Audit / Activity log',desc:'History of actions',actions:['view'],scoped:false,group:'Administration'},
  {key:'settings',label:'Settings',desc:'App settings',actions:['view','edit'],scoped:false,group:'Administration'},
  {key:'accessControl',label:'Access Control',desc:'The role-profile system itself',actions:['view','manage'],scoped:false,group:'Administration'},
];
// Plain-language labels used by the Access Control editor + live summary.
const PERM_ACTION_LABEL={view:'View',create:'Create',edit:'Edit',delete:'Delete',deactivate:'Deactivate',approve:'Approve',download:'Download / Export',manage:'Manage',billing:'Billing & invoices',manageSettings:'Manage settings',assign:'Assign',assignRole:'Assign role profile',assignManager:'Assign manager',grant:'Grant / Remove',submit:'Submit',upload:'Upload',manageGeofence:'Manage geofence',issue:'Issue',verify:'Verify',run:'Run',finalize:'Finalize',rollback:'Roll back',checkin:'Check-in / Update',changeStatus:'Change status',resolve:'Resolve',duplicate:'Duplicate',resetPassword:'Reset password',manageAssets:'Assets (assign / return)',start:'Start / Assign flow',progress:'Update steps',publish:'Publish',close:'Open / Close'};
const SCOPE_ORDER=['none','self','team','department','location','everyone'];
const SCOPE_LABEL={none:'None',self:'Only their own',team:'Their team',department:'Their department',location:'Their office',everyone:'Everyone'};
/* People are no longer assigned to an office, so the 'location' scope has nothing left to
   resolve against and is not offered in the editor. It stays in SCOPE_ORDER so a bundle saved
   earlier (or by the full platform) still reads back correctly instead of silently changing. */
const SCOPE_CHOICES=SCOPE_ORDER.filter(x=>x!=='location');
const _areaByKey=k=>PERM_AREAS.find(a=>a.key===k);

/* ── MICRO-PERMISSIONS MIGRATION (v10) ──
   Coarse umbrella actions were split into per-operation toggles. Any CUSTOM role or per-user
   override that held the old umbrella gets every new granular action it implied, so nobody
   loses a capability they had. Idempotent (stamped _micro / hrm.permsMicro). Built-ins are
   re-seeded by version instead. Stale umbrella keys left in stored bundles are harmless —
   no gate reads them anymore. */
const _MICRO_EXPAND={
  tickets:{manage:['changeStatus','resolve']},
  questions:{manage:['create','edit','delete','import','export']},
  discipline:{manage:['create','edit','delete']},
  lifecycle:{manage:['start','progress']},
  scheduling:{manage:['create','edit','publish','delete']},
  surveys:{manage:['create','close','delete','export']},
  reviews:{manage:['create','close','export']},
  checklists:{edit:['duplicate','delete']},
  announcements:{create:['delete']},
  employees:{edit:['resetPassword','manageAssets']},
  departments:{edit:['delete']},
  locations:{edit:['delete']},
};
function _permsMicroExpand(bundle){
  if(!bundle||typeof bundle!=='object')return false;
  let hit=false;
  Object.entries(_MICRO_EXPAND).forEach(([area,map])=>{
    const a=bundle[area];if(!a||!a.actions)return;
    Object.entries(map).forEach(([oldA,news])=>{
      if(a.actions[oldA])news.forEach(x=>{if(a.actions[x]===undefined){a.actions[x]=true;hit=true;}});
    });
  });
  return hit;
}
function _permsMicroMigrate(){
  let n=0;
  Object.values(DB.roleProfiles||{}).forEach(p=>{
    if(p&&!p.builtin&&!p._micro){if(_permsMicroExpand(p.perms))n++;p._micro=1;}
  });
  (DB.users||[]).forEach(u=>{
    if(u&&u.hrm&&u.hrm.perms&&!u.hrm.permsMicro){_permsMicroExpand(u.hrm.perms);u.hrm.permsMicro=1;}
  });
  if(n)console.log('[perms] micro-expansion applied to',n,'custom role(s)');
}

// ── Seed built-in roles (idempotent; version-stamped so v3 upgrades older seeds in place) ──
// ROLES-FIRST MODEL (v3): Access Control creates ROLES (full toggle bundles); every user is
// ASSIGNED one role (u.hrm.roleProfileId) and sees only what it grants. Per-user AREA OVERRIDES
// (u.hrm.perms) sit on top for individual exceptions and beat the role — even for a Super Admin.
function _seedRoleProfiles(){
  if(!DB.roleProfiles||typeof DB.roleProfiles!=='object')DB.roleProfiles={};
  const A=(scope,...acts)=>({scope,actions:acts.reduce((o,a)=>(o[a]=true,o),{})});
  const allOf=(exceptAC)=>{const p={};PERM_AREAS.forEach(a=>{if(exceptAC&&a.key==='accessControl')return;p[a.key]={scope:a.scoped?'everyone':'none',actions:a.actions.reduce((o,act)=>(o[act]=true,o),{})};});return p;};
  const presets={
    superadmin:{id:'superadmin',name:'Super Admin',description:'Everything, including Access Control itself.',builtin:true,perms:allOf(false)},
    admin:{id:'admin',name:'Administrator',description:'Full operational access across the whole organization — everything except Access Control.',builtin:true,perms:allOf(true)},
    manager:{id:'manager',name:'Team Lead / Manager',description:'Sees and acts on their team: approvals, checklists, tickets, team OKRs, reports.',builtin:true,perms:{
      dashboard:A('none','view'),
      attendance:A('team','view','download'),
      leaveRequests:A('team','view','create','approve','download'),
      leaveBalances:A('team','view'),
      employees:A('team','view'),
      teamview:A('none','view'),
      hierarchy:A('team','view'),
      checklists:A('team','view','create','edit','duplicate','delete','assign','approve'),
      questions:A('none','view','create','edit'),
      tickets:A('team','view','create','changeStatus','resolve'),
      documentsPersonal:A('self','view','create','download'),
      reports:A('team','view'),
      announcements:A('none','view'),
      approvals:A('none','view'),
      okr:A('team','view','create','edit','checkin','manage'),
      analytics:A('none','view'),
      scheduling:A('team','view','create','edit','publish','delete'),
      overtime:A('team','view','submit','approve'),
      lifecycle:A('team','view','start','progress'),
      discipline:A('team','view'),
      letters:A('self','view','create'),
      surveys:A('none','view','submit'),
      reviews:A('team','view','submit'),
    }},
    hr:{id:'hr',name:'HR',description:'The HR modules: attendance, leave & balances, HR settings, HRM analytics, document approvals.',builtin:true,perms:{
      dashboard:A('none','view'),
      attendance:A('everyone','view','edit','download'),
      leaveRequests:A('everyone','view','create','approve','download'),
      leaveBalances:A('everyone','view','edit','grant'),
      hrSettings:A('none','view','edit'),
      employees:A('everyone','view'),
      hierarchy:A('everyone','view'),
      checklists:A('self','view'),
      tickets:A('self','view','create'),
      documentsOrg:A('everyone','view','approve'),
      documentsPersonal:A('self','view','create','download'),
      reports:A('everyone','view','download'),
      announcements:A('none','view','create','delete'),
      approvals:A('none','view'),
      okr:A('self','view'),
      scheduling:A('everyone','view','create','edit','publish','delete'),
      overtime:A('everyone','view','submit','approve'),
      lifecycle:A('everyone','view','start','progress'),
      discipline:A('everyone','view','create','edit','delete'),
      letters:A('everyone','view','create','approve','issue'),
      payroll:{scope:'none',actions:{view:true,verify:true,run:true,download:true}},
      surveys:A('none','view','submit','create','close','delete','export'),
      reviews:A('everyone','view','submit','create','close','export'),
    }},
    basic:{id:'basic',name:'Basic Employee',description:'A standard employee — their own checklists, attendance, leave and tickets.',builtin:true,perms:{
      dashboard:A('none','view'),
      attendance:A('self','view'),
      leaveRequests:A('self','view','create'),
      leaveBalances:A('self','view'),
      hierarchy:A('self','view'),
      checklists:A('self','view'),
      tickets:A('self','view','create'),
      documentsPersonal:A('self','view','create','download'),
      announcements:A('none','view'),
      okr:A('self','view','checkin'),
      scheduling:A('self','view'),
      overtime:A('self','view','submit'),
      letters:A('self','view','create'),
      surveys:A('none','view','submit'),
      reviews:A('self','view','submit'),
    }},
  };
  const V='11'; // v11: locations.billing — client billing & invoices get their own toggle; superadmin/admin re-seed WITH it, every other role stays off until it is granted // v10 micro permissions // v9 OKR port // v8 // v7 // v6
  Object.values(presets).forEach(p=>{
    const cur=DB.roleProfiles[p.id];
    if(!cur||(cur.builtin&&cur._v!==V)){p._v=V;DB.roleProfiles[p.id]=p;} // upgrade built-ins once; never touch custom roles
  });
}

// ── Resolver v4 (R20: roles-first, fully toggle-driven — the legacy base-role shim is GONE) ──
// Priority: 1) per-user AREA OVERRIDE (u.hrm.perms — beats everything, even Super Admin)
//           2) ASSIGNED ROLE (u.hrm.roleProfileId → DB.roleProfiles)
//           3) safety nets: the superadmin id is always all-powerful (even if its bundle is
//              missing), and anyone with NO resolvable role gets the Basic Employee bundle.
function _myProfile(){const u=me();if(!u)return null;const id=u.hrm?.roleProfileId;return id?(DB.roleProfiles?.[id]||null):null;}
function _roleOf(u){const id=u&&u.hrm&&u.hrm.roleProfileId;return id?(DB.roleProfiles?.[id]||null):null;}
function _userPermArea(u,area){const p=u&&u.hrm&&u.hrm.perms;return(p&&typeof p==='object'&&p[area]&&typeof p[area]==='object')?p[area]:null;}
function can(area,action){
  const u=me();if(!u)return false;
  const o=_userPermArea(u,area);
  if(o)return !!(o.actions&&o.actions[action]);
  const rp=_roleOf(u);
  if(rp)return !!(rp.perms&&rp.perms[area]&&rp.perms[area].actions&&rp.perms[area].actions[action]);
  if(isSuperU(u))return true; // superadmin never locks itself out, even if its bundle is missing
  const b=DB.roleProfiles?.basic; // no resolvable role → Basic Employee floor
  return !!(b&&b.perms&&b.perms[area]&&b.perms[area].actions&&b.perms[area].actions[action]);
}
// Evaluate for ANOTHER user (Access Control editor + lockout guard).
function canUser(u,area,action){
  if(!u)return false;
  const o=_userPermArea(u,area);
  if(o)return !!(o.actions&&o.actions[action]);
  const rp=_roleOf(u);
  if(rp)return !!(rp.perms&&rp.perms[area]&&rp.perms[area].actions&&rp.perms[area].actions[action]);
  if(isSuperU(u))return true;
  const b=DB.roleProfiles?.basic;
  return !!(b&&b.perms&&b.perms[area]&&b.perms[area].actions&&b.perms[area].actions[action]);
}
// Lockout guard: would ANY other active user still hold accessControl.<action> if `uid2` loses it?
function _acLockoutSafe(uid2,action){
  return (DB.users||[]).some(x=>x.id!==uid2&&x.status==='Active'&&canUser(x,'accessControl',action));
}
// Default role for a user with none assigned (new users; the legacy role field is retired).
function _roleIdForUser(u){
  if(u.hrm&&u.hrm.isHR===true)return 'hr';
  if((DB.users||[]).some(x=>x.managerId===u.id&&x.id!==u.id))return 'manager';
  return 'basic';
}
/* ── One-time v3 migration: assign everyone a ROLE from their current standing, translate the old
   personal grants (questionsAccess / docAccess) into small per-user overrides, and clear the v2
   full baked maps so the ROLE is what drives access from now on. Idempotent via u.hrm.permsV3. ── */
function _permsV3Migrate(){
  let n=0;
  (DB.users||[]).forEach(u=>{
    if(!u)return;_ensureHrm(u);
    if(u.hrm.permsV3)return;
    if(!u.hrm.roleProfileId||!DB.roleProfiles[u.hrm.roleProfileId])u.hrm.roleProfileId=_roleIdForUser(u);
    const ov={};
    if(u.questionsAccess&&u.hrm.roleProfileId==='basic')ov.questions={scope:'none',actions:{view:true,manage:false}};
    const da=u.docAccess||{};
    const anyDept=Object.values(da.departments||{}).some(p=>p&&p.view);
    const anyLoc=Object.values(da.locations||{}).some(p=>p&&p.view);
    if((anyDept||anyLoc)&&['basic','manager','hr'].includes(u.hrm.roleProfileId)){
      ov.documentsOrg={scope:'everyone',actions:{view:true,create:true,download:true,delete:false,approve:u.hrm.roleProfileId==='hr'}};
      if(anyDept)ov.departments={scope:'none',actions:{view:true,create:false,edit:false}};
      if(anyLoc)ov.locations={scope:'none',actions:{view:true,create:false,edit:false,manage:false}};
    }
    u.hrm.perms=Object.keys(ov).length?ov:null; // clear v2 baked map — the role drives now
    u.hrm.permsBaked=1;u.hrm.permsV3=1;n++;
  });
  if(n){console.log('[perms] v3 roles assigned to',n,'user(s)');saveDB();}
}
// scopeOf(area) → 'none'|'self'|'team'|'department'|'location'|'everyone'
function scopeOf(area){
  const u=me();if(!u)return 'none';
  const o=_userPermArea(u,area);
  if(o)return o.scope||'none';
  const rp=_roleOf(u);
  if(rp){const a=rp.perms&&rp.perms[area];return a?(a.scope||'none'):'none';}
  if(isSuperU(u))return 'everyone';
  const b=DB.roleProfiles?.basic;const a=b&&b.perms&&b.perms[area];
  return a?(a.scope||'none'):'none';
}
// scopeFilter(area) → predicate(userId)=>bool ("can I see this person under <area>'s scope").
function scopeFilter(area){
  const sc=scopeOf(area),myId=S.uid,u=me();
  if(sc==='none')return ()=>false;
  if(sc==='everyone')return id=>{const t=uById(id);return !!t&&(!isSuperU(t)||isAdmin());};
  if(sc==='self')return id=>id===myId;
  if(sc==='team'){const set=new Set([myId,...subTree(myId).map(x=>x.id)]);return id=>set.has(id);}
  if(sc==='department'){const d=u?.department;return id=>!!d&&uById(id)?.department===d;}
  if(sc==='location'){const l=u?.hrm?.locationId;return id=>!!l&&uById(id)?.hrm?.locationId===l;}
  return ()=>false;
}
function scopedUsers(area){const f=scopeFilter(area);return DB.users.filter(u=>f(u.id));}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.PERM_GROUPS=PERM_GROUPS;window.PERM_AREAS=PERM_AREAS;window.TM_AREAS=TM_AREAS;window.TM_HIDDEN_ACTIONS=TM_HIDDEN_ACTIONS;window.TM_AREA_COPY=TM_AREA_COPY;window._tmAreas=_tmAreas;window.PERM_ACTION_LABEL=PERM_ACTION_LABEL;window.SCOPE_ORDER=SCOPE_ORDER;window.SCOPE_CHOICES=SCOPE_CHOICES;window.SCOPE_LABEL=SCOPE_LABEL;window._areaByKey=_areaByKey;window._seedRoleProfiles=_seedRoleProfiles;window._permsMicroMigrate=_permsMicroMigrate;window._permsMicroExpand=_permsMicroExpand;window._MICRO_EXPAND=_MICRO_EXPAND;window._myProfile=_myProfile;window._roleOf=_roleOf;window._userPermArea=_userPermArea;window.can=can;window.canUser=canUser;window._acLockoutSafe=_acLockoutSafe;window._roleIdForUser=_roleIdForUser;window._permsV3Migrate=_permsV3Migrate;window.scopeOf=scopeOf;window.scopeFilter=scopeFilter;window.scopedUsers=scopedUsers;
