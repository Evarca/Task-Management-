


/* ===== DATA MODEL ===== */
window.DB={
  departments:[],
  users:[],checklists:[],submissions:[],approvals:[],feedback:[],folders:[],documents:[],locations:[],audit:[],notifications:[],questions:[],tickets:[],
  // ── OKR v2 (hierarchical objectives) — okrs = tree nodes, okrCheckins = scheduled progress
  //    updates (value + comment + photos), okrLogs = per-OKR activity trail (every edit is logged).
  okrs:[],okrCheckins:[],okrLogs:[],
  // ── HRM build plan (targeted writes, like OKRs) ──
  flows:[],letters:[],discipline:[],overtime:[],payrollRuns:[],payrollItems:[],surveys:[],surveyAnswers:[],
  // ── HRM (Attendance & Leave) — FRONTEND-ONLY, never added to _sync()/loadFromSB() table lists ──
  hrmConfig:{},     // company/country policy profiles
  attendance:[],    // attendance day records (one per user per date)
  leaveTypes:[],    // leave-type definitions (seeded from statutory defaults)
  leaveRequests:[], // leave applications + 2-stage approval state
  leaveBalances:[], // per-user/type/leaveYear ledgers
  holidays:[],      // public holiday calendar
  hrmAudit:[],      // HRM audit log (local-only — NOT audit_logs)
  announcements:[], // §10 — company announcements (FRONTEND-ONLY, never synced). {id,title,body,deptTarget|null,locTarget|null,createdBy,createdAt}
  roleProfiles:{},  // PERMISSIONS — named permission bundles (frontend-only, seeded by _seedRoleProfiles)
  // ── SOPs — Standard Operating Procedures: a browsable library you can also assign (sync to sop_templates/sop_instances).
  //    A SOP = {category, description, content body, ordered steps}. Onboarding is just the 'Onboarding'-category SOP assigned to a new hire.
  sopTemplates:[], // [{id,name,category,description,content,steps:[{id,title,kind,assignee,requiresApproval,content}],active,createdBy,createdAt}]
  sopInstances:[],  // [{id,templateId,userId,status,steps:[{...snapshot,status,docId,decidedBy,decidedAt,note,doneBy,doneAt}],createdBy,createdAt,completedAt}]
  // ── Shift Scheduling / Rostering (Part 2-A) — syncs to the `shifts` table (snake_case). A shift is a
  //    planned working block for one employee on one day; managers/HR build a weekly roster, publish it,
  //    and employees see their OWN published shifts. {id,userId,date,start,end,locationId,note,status:'draft'|'published',publishedAt,createdBy,createdAt}
  shifts:[],
  // ── Expense Claims / Reimbursements (Part 2-E) — syncs to the `expenses` table (snake_case). An
  //    expense = one employee's reimbursement claim; the employee submits (status 'pending'), an
  //    approver (manager-of/HR/Admin) approves/rejects via the unified inbox. Mirrors leave_requests.
  //    {id,userId,date,category,amount,currency,description,receiptNote,status:'pending'|'approved'|'rejected',approverId,decidedBy,decidedAt,decisionNote,createdAt}
  expenses:[],
  // ── Drafts (PHASE4b) — per-user, server-backed saves of in-progress checklist runs and OKR
  //    check-ins (syncs to the `drafts` table; RLS = owner only). Photos are stripped from payloads.
  //    {id,userId,kind:'checklist'|'okr',refId,date|null,payload,updatedAt}
  drafts:[],
  // ── Task-management build: the SHARED per-question run ──
  //    tmAnswers      one row per (checklist, date, question) — who answered, when, locked?
  //    tmAnswerEdits  edit requests raised against a single submitted answer
  //    tmMeta         per-checklist extras this build adds (the optional deadline date)
  tmAnswers:[],tmAnswerEdits:[],tmMeta:{},
  // ── Location documents (new tm_folders / tm_documents tables) ──
  tmFolders:[],tmDocuments:[],tmClientMeta:{}
};
function log(a,b,c){
  if(!a||!b)return;
  if(DB.audit.length>200)DB.audit.length=200;
  const entry={id:uid('lg'),actor:a,action:b,target:c||'',time:new Date().toISOString()};
  DB.audit.unshift(entry);
  // Write audit log directly to Supabase — use Promise chain not .catch() directly
  sb.from('audit_logs').insert({id:entry.id,actor:entry.actor,action:entry.action,target:entry.target,created_at:entry.time}).then(()=>{}).catch(()=>{});
}

/* ===== LOCALSTORAGE ===== */
const LS_KEY=window.LS_KEY='shiftly_v3';
window._syncTimer=null;
function saveDB(){
  // Always save to localStorage — strip large base64 photos to avoid 5MB limit
  try{
    const dbCopy=JSON.parse(JSON.stringify({DB,uid:S.uid}));
    // Strip base64 photos from submissions to avoid 5MB localStorage limit
    (dbCopy.DB.submissions||[]).forEach(s=>{
      (s.tasks||[]).forEach(t=>{if(t.photo&&t.photo.startsWith('data:'))t.photo='[photo]';});
      // Also strip question response photos (single legacy + multi photos[])
      (s.questionResponses||[]).forEach(r=>{
        if(r.photo&&r.photo.startsWith('data:'))r.photo='[photo]';
        if(Array.isArray(r.photos))r.photos=r.photos.map(p=>(typeof p==='string'&&p.startsWith('data:'))?'[photo]':p);
      });
    });
    // OKR check-in photos: strip base64 the same way (real bytes live in Supabase; targeted writes
    // send them at save time — _okrCheckinRow filters '[photo]' placeholders so they're never pushed).
    (dbCopy.DB.okrCheckins||[]).forEach(c=>{
      if(Array.isArray(c.photos))c.photos=c.photos.map(p=>(typeof p==='string'&&p.startsWith('data:'))?'[photo]':p);
    });
    // §7: strip personal-document base64 bytes (kept in-memory only; metadata persists).
    (dbCopy.DB.users||[]).forEach(u=>{
      const pd=u.hrm&&Array.isArray(u.hrm.personalDocs)?u.hrm.personalDocs:null;
      if(pd)pd.forEach(d=>{if(d.dataUrl&&typeof d.dataUrl==='string'&&d.dataUrl.startsWith('data:'))d.dataUrl=null;});
    });
    localStorage.setItem(LS_KEY,JSON.stringify(dbCopy));
  }catch(e){
    // If still too large, save without submissions — also strip personal-document
    // base64 bytes (mirror the primary path) so the fallback isn't defeated by personalDocs bloat.
    try{
      const slim={DB:{...DB,submissions:[]},uid:S.uid};
      slim.DB.users=(DB.users||[]).map(u=>{
        if(!(u.hrm&&Array.isArray(u.hrm.personalDocs)))return u;
        return {...u,hrm:{...u.hrm,personalDocs:u.hrm.personalDocs.map(d=>(d.dataUrl&&typeof d.dataUrl==='string'&&d.dataUrl.startsWith('data:'))?{...d,dataUrl:null}:d)}};
      });
      localStorage.setItem(LS_KEY,JSON.stringify(slim));
    }catch(e2){
      console.error('[Evarca] localStorage quota exceeded — state not saved:',e2.message);
      try{toast('Storage full — some data may not be saved','err');}catch(_){}
    }
  }
  // Debounce Supabase sync — batch rapid changes into one request every 1.5s
  clearTimeout(_syncTimer);
  _syncTimer=setTimeout(()=>{
    _sync().catch(e=>{
      console.warn('[Evarca] Sync error:',e.message);
    });
  },1500);
}
function loadDB(){
  try{
    const r=localStorage.getItem(LS_KEY);
    if(!r)return false;
    const p=JSON.parse(r);if(!p.DB)return false;DB=p.DB;
    ['users','departments','locations','checklists','submissions','approvals','feedback','audit','notifications','questions','checklists_deleted','questions_deleted','users_deleted','departments_deleted','locations_deleted','hrmAudit','announcements','tmAnswers','tmAnswerEdits','tmFolders','tmDocuments'].forEach(k=>{if(!DB[k])DB[k]=[];});
    if(!DB.tmMeta||typeof DB.tmMeta!=='object')DB.tmMeta={};
    if(!DB.tmClientMeta||typeof DB.tmClientMeta!=='object')DB.tmClientMeta={};
    // OKR v2 migration: drop the retired question-linked OKR model from stale localStorage.
    // Old rows are recognisable by having no metricType (they carried questionId/rollup instead).
    DB.okrs=(DB.okrs||[]).filter(o=>o&&o.metricType);
    delete DB.okrPeriods;
    if(!DB.hrmConfig||typeof DB.hrmConfig!=='object')DB.hrmConfig={};
    if(!DB.roleProfiles||typeof DB.roleProfiles!=='object')DB.roleProfiles={};
    _seedRoleProfiles(); // idempotent — seeds built-in basic/manager/admin presets (frontend-only)
    try{_permsV3Migrate();_permsMicroMigrate();}catch(e){console.warn('[perms] migrate skipped:',e.message);} // perms v3 + v10 micro
    // §4: HR email/notification prefs — defaults merged under saved values. PHASE4b: also synced via
    // workspace_settings (key 'hrm_notif_prefs') so refreshes/devices agree; loadFromSB merges server copy.
    DB.hrmNotifPrefs={..._hrmNotifPrefsDefault(),...(DB.hrmNotifPrefs&&typeof DB.hrmNotifPrefs==='object'?DB.hrmNotifPrefs:{})};
    if(!Array.isArray(DB.drafts))DB.drafts=[]; // PHASE4b: drafts collection for older saved states
    // R7 (sync-integrity): tombstones for user-deletable feed records — a deleted alert/approval/
    // leave record must never resurrect from a concurrent server fetch or a local re-push.
    ['notifications_deleted','approvals_deleted','leaveRequests_deleted','leaveTypes_deleted'].forEach(k=>{if(!Array.isArray(DB[k]))DB[k]=[];});
    try{_seedAppConfig();}catch(e){}
    DB.users.forEach(u=>{
      if(!u.rules)u.rules={past:true,future:true,edit:true};
      // Ensure individual rule fields have proper defaults (true, not false)
      if(u.rules.past===undefined||u.rules.past===null)u.rules.past=true;
      if(u.rules.future===undefined||u.rules.future===null)u.rules.future=true;
      if(u.rules.edit===undefined||u.rules.edit===null)u.rules.edit=true;
      if(!u.approval)u.approval={past:false,future:false,edited:false};
      if(!u.phone)u.phone='';if(!u.position)u.position='';
      if(!u.docAccess)u.docAccess={departments:{},locations:{}};
      if(u.questionsAccess===undefined)u.questionsAccess=false;
      _ensureHrm(u);
    });
    S.uid=p.uid||null;return true;
  }catch(e){return false;}
}

/* ===== STATE ===== */
let S={uid:null,route:'dashboard',search:'',calDate:todayISO(),calWk:0,expandedCl:null,filters:{},filterOpen:false,tvUser:null,tvCalDate:null,tvCalWk:0,tvExpanded:null,afOpen:null};
const me=()=>DB.users.find(u=>u.id===S.uid);
// R20: the legacy role field (Admin/SubAdmin/User) is retired. Access Control is the ONLY role
// system: u.hrm.roleProfileId → DB.roleProfiles. 'superadmin' is the one hard-coded superuser id.
const _pidOf=u=>u?.hrm?.roleProfileId||null;
const isSuperU=u=>_pidOf(u)==='superadmin';
const isAdmin=()=>isSuperU(me());
// Display name of a user's Access Control role (e.g. "Super Admin", "HR", "Basic Employee").
const roleName=u=>{const p=_pidOf(u);return (p&&DB.roleProfiles?.[p]?.name)||'Basic Employee';};
const hasDocAccess=()=>{const u=me();if(!u)return false;if(isAdmin())return true;const da=u.docAccess||{};return Object.values(da.departments||{}).some(p=>p.view)||Object.values(da.locations||{}).some(p=>p.view);};
function subTree(uid,_seen=new Set()){if(_seen.has(uid))return[];_seen.add(uid);const direct=DB.users.filter(u=>u.managerId===uid&&u.id!==uid);return direct.flatMap(u=>[u,...subTree(u.id,_seen)]);}
// ── Date-aware manager lookup (uses managerHistory; falls back to current managerId) ──
function _mgrOfOn(u,date){
  const h=u?.managerHistory;
  if(Array.isArray(h)&&h.length){
    let hit;for(const p of h){if((p.from||'0001-01-01')<=date&&(!p.to||date<p.to))hit=p;}
    if(hit!==undefined)return hit.managerId||null;
  }
  return u?.managerId||null;
}
// Was user uid2 under mgrId (directly or via chain) on a given date?
function _underOn(uid2,mgrId,date){
  let cur=uById(uid2);let g=0;
  while(cur&&g++<12){
    const m=_mgrOfOn(cur,date);
    if(!m)return false;
    if(m===mgrId)return true;
    cur=uById(m);
  }
  return false;
}
const isMgr=()=>DB.users.some(u=>u.managerId===S.uid&&u.id!==S.uid)&&!isAdmin();
function visU(){if(isAdmin())return DB.users;return[me(),...subTree(S.uid)].filter(Boolean);}
// ── HRM role/profile helpers (frontend-only) ──
const isHR=()=>{const u=me();return !!u&&(u.hrm?.isHR===true);};
const _canReport=()=>{const p=me()?.hrm?.reportPerms||{};return Object.values(p).some(Boolean);};
const activeProfile=()=>DB.hrmConfig?.profiles?.[DB.hrmConfig?.activeProfile]||{};
const userProfileId=u=>DB.hrmConfig?.activeProfile||'UAE'; // profiles removed — everyone shares one policy set
// LV-6: resolve the profile config for a SPECIFIC user (grace/autoCloseAt/schedule), not the globally
//   selected profile — mirrors how _leaveYearOf reads userProfileId(u). Falls back to active profile.
const userProfile=u=>DB.hrmConfig?.profiles?.[userProfileId(u)]||activeProfile();
function _ensureHrm(u){
  if(!u)return u;
  if(!u.hrm||typeof u.hrm!=='object')u.hrm={};
  const h=u.hrm;
  if(h.isHR===undefined)h.isHR=false;
  if(h.dob===undefined)h.dob=null;
  if(h.joiningDate===undefined)h.joiningDate=null;
  if(h.locationId===undefined)h.locationId=null;
  // M4: a location delete clears locationId only on the acting device; a stale id on another device
  //   makes _activeGeofence return {misconfigured} → a PERMANENT clock-in block that also masks the
  //   real cause. If the assigned location no longer exists, clear the dangling id so it reads as
  //   "no location" (HR's reassignment then sticks) instead of "misconfigured".
  if(h.locationId&&Array.isArray(DB.locations)&&!locById(h.locationId))h.locationId=null;
  if(!h.schedule||typeof h.schedule!=='object')h.schedule={};
  const s=h.schedule;
  if(!s.in)s.in='09:00';if(!s.out)s.out='18:00';
  if(s.hours===undefined||s.hours===null)s.hours=9;
  if(!s.workWeek)s.workWeek=5;
  if(!Array.isArray(s.offDays))s.offDays=['Sun'];
  if(!h.profileId)h.profileId=DB.hrmConfig?.activeProfile||'UAE';
  // reportPerms is RETIRED for gating (replaced by role profiles). Left in data for back-compat; no longer defaulted.
  if(h.roleProfileId===undefined)h.roleProfileId=null; // null = use base-role floor only (today's behavior)
  // §3a: dedicated HR-controlled comp-off ledger. Each entry: {id,days,reason,expiry,at,by}
  //   positive days = grant, negative days = removal. Remaining computed honoring each grant's own expiry
  //   (independent of carry-over's carriedExpiry). Rides on u.hrm → synced via the user_hrm table.
  if(!Array.isArray(h.compOff))h.compOff=[];
  // HRM build plan: salary & payroll fields (payslips, WPS), probation date, payroll hold (exit flow)
  if(!h.salary||typeof h.salary!=='object')h.salary={basic:0,allow:0,currency:'AED'};
  if(h.salary.housing===undefined)h.salary.housing=0;   // R23: UAE salary structure — housing / transport
  if(h.salary.transport===undefined)h.salary.transport=0; //     join basic + "other" (the old allow field)
  if(h.iban===undefined)h.iban='';
  if(h.molId===undefined)h.molId='';                    // R23: MOL person ID for the WPS SIF file
  if(h.bankRouting===undefined)h.bankRouting='';        // R23: 9-digit agent routing code (SIF)
  if(h.pensionOn===undefined)h.pensionOn=false;         // R23: GPSSA pension (UAE/GCC national)
  if(!Array.isArray(h.payAdjust))h.payAdjust=[];        // R23: {id,kind:'earn'|'deduct',label,amount,month|null,recurring,at,by}
  if(h.probationEnd===undefined)h.probationEnd=null;
  if(h.probationDecision===undefined)h.probationDecision=null; // R22 (Art 9): {status:'confirmed'|'extended'|'notconfirmed',at,by,note,newEnd}
  if(h.payrollHold===undefined)h.payrollHold=false;
  // §7: personal documents (frontend-only). Each entry: {id,name,type,size,uploadedAt,uploadedBy,dataUrl|null}
  //   Metadata persists in localStorage; the base64 dataUrl is STRIPPED in saveDB (mirrors photo stripping)
  //   so localStorage never bloats — real durable bytes are a backend connection point (lost on reload).
  //   Rides on u.hrm → metadata synced via user_hrm; the base64 dataUrl is stripped before upsert (_hrmStrip).
  if(!Array.isArray(h.personalDocs))h.personalDocs=[];
  // §10: announcement read-state. Array of announcement ids the user has read.
  //   Rides on u.hrm → synced via the user_hrm table (also protected by the _savedHrm snapshot on loadFromSB).
  if(!Array.isArray(h.announcementsRead))h.announcementsRead=[];
  // LV-7: per-(user,leaveType) calendar-month accrual marker that SURVIVES leave-year rollover.
  //   Map of leaveTypeId → last-accrued 'YYYY-MM'. The per-year balance row's lastAccruedMonth is reset
  //   to null on an anniversary rollover row, which let a month accrue twice; this global marker prevents it.
  //   Rides on u.hrm → synced via the user_hrm table.
  if(!h.accrualMarks||typeof h.accrualMarks!=='object')h.accrualMarks={};
  return u;
}
/* ═══════════════ end PERMISSIONS SYSTEM ═══════════════ */

function isDesc(a,b){return subTree(b).some(u=>u.id===a);}
const uById=id=>DB.users.find(u=>u.id===id);
const clById=id=>DB.checklists.find(c=>c.id===id);
const locById=id=>DB.locations.find(l=>l.id===id);
function myCls(uid,date){
  const assigned=DB.checklists.filter(c=>(c.assignees||[]).includes(uid)&&clOn(c,date));
  // Sort by deadline time (earlier first), then by name
  return assigned.sort((a,b)=>{
    const ta=a.scheduleTime||'99:99',tb=b.scheduleTime||'99:99';
    if(ta!==tb)return ta.localeCompare(tb);
    return (a.name||'').localeCompare(b.name||'');
  });
}
const subFor=(clId,uid,date)=>DB.submissions.find(s=>s.checklistId===clId&&s.userId===uid&&s.date===date);
/* A run is SHARED in this build: several assignees each answer different questions of the same
   checklist on the same day, and one submission closes it for all of them. So a completed
   submission by ANY assignee counts for everyone — own submission first (so your own mid-edit
   still wins), then any teammate's completed one. */
const subForCl=(c,uid,date)=>{
  const own=subFor(c.id,uid,date);
  if(own)return own;
  return DB.submissions.find(s=>s.checklistId===c.id&&s.date===date&&s.status!=='Editing')||null;
};
// Any submission for this run regardless of who made it or its state (used by the run guard).
const runSub=(clId,date)=>DB.submissions.find(s=>s.checklistId===clId&&s.date===date)||null;

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.log=log;window.LS_KEY=LS_KEY;window.saveDB=saveDB;window.loadDB=loadDB;window.S=S;window.me=me;window.isAdmin=isAdmin;window._pidOf=_pidOf;window.isSuperU=isSuperU;window.roleName=roleName;window.hasDocAccess=hasDocAccess;window.subTree=subTree;window._mgrOfOn=_mgrOfOn;window._underOn=_underOn;window.isMgr=isMgr;window.visU=visU;window.isHR=isHR;window._canReport=_canReport;window.activeProfile=activeProfile;window.userProfileId=userProfileId;window.userProfile=userProfile;window._ensureHrm=_ensureHrm;window.isDesc=isDesc;window.uById=uById;window.clById=clById;window.locById=locById;window.myCls=myCls;window.subFor=subFor;window.subForCl=subForCl;window.runSub=runSub;
