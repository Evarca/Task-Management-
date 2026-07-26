import './vendor.js';   // pinned supabase-js + chart.js — must load before every other module
import './styles.css';
import './ui/helpers.js';
import './supabase.js';
import './state.js';
import './perms.js';
import './engine/notifications.js';
import './engine/core.js';
import './engine/answers.js';
import './engine/billing.js';
import './ui/nav.js';
import './ui/charts.js';
import './pages/login.js';
import './pages/dashboard.js';
import './pages/users.js';
import './pages/departments.js';
import './pages/locations.js';
import './pages/documents.js';
import './pages/checklists.js';
import './pages/mychecklists.js';
import './pages/teamview.js';
import './pages/allchecklists.js';
import './pages/approvals.js';
import './pages/questions.js';
import './pages/notifications.js';
import './pages/hierarchy.js';
import './pages/tickets.js';
import './pages/analytics.js';
import './pages/audit.js';
import './pages/profile.js';
import './pages/settings.js';
import './pages/accesscontrol.js';

/* ===== BOOT (moved from mid-file; runs after all modules above are loaded) ===== */

/* ===== BOOT ===== */
(async function boot(){
  // The client's read-only status page: #status/<token> renders BEFORE any auth — the token,
  // verified server-side by the RPC, is the whole key. Nothing else of the app loads for it.
  if(_pubStatusBoot())return;
  const _hashRoute=(window.location.hash||'').replace('#','').trim();
  const VALID_ROUTES=['dashboard','mychecklists','users','hierarchy','checklists','allcl','questions','approvals','notifications','analytics','locations','departments','settings','audit','teamview','profile','accesscontrol','tickets'];
  const _deepLink=VALID_ROUTES.includes(_hashRoute)?_hashRoute:null;
  try{const{data:{session}}=await sb.auth.getSession();if(session){
      // Load local cache first for instant UI
      const hadLocal=loadDB();
      if(S.uid){_hrmInit();S.route=_deepLink||S.route||'dashboard';_recoverEditingSubmissions();render();}
      const{data:profile}=await sb.from('profiles').select('*').eq('id',session.user.id).single();
      if(profile&&profile.status==='Active'){
        const mapped={id:profile.id,firstName:_unesc(profile.first_name)||'',lastName:_unesc(profile.last_name)||'',email:profile.email||'',phone:_unesc(profile.phone)||'',position:_unesc(profile.position)||'',department:_unesc(profile.department)||'',status:profile.status,managerId:profile.manager_id||null,rules:profile.rules||{past:true,future:true,edit:true},approval:profile.approval_settings||{past:false,future:false,edited:false},docAccess:profile.doc_access||{departments:{},locations:{}},questionsAccess:profile.questions_access||false,emailEnabled:profile.email_enabled!==false,cities:Array.isArray(profile.cities)?profile.cities:[],password:'***'};
        const idx=DB.users.findIndex(x=>x.id===mapped.id);if(idx>-1){mapped.hrm=DB.users[idx].hrm;DB.users[idx]=mapped;}else DB.users.push(mapped);
        _ensureHrm(mapped);
        S.uid=mapped.id;
        if(_deepLink)S.route=_deepLink;
        else if(!S.route||S.route==='login')S.route='dashboard'; // W2.1: role-aware home
        // R20: my access (u.hrm.roleProfileId + role bundles) now decides ALL visibility, and it
        // lives in user_hrm/workspace_settings — pull it BEFORE the big load so the scope-based
        // filtering inside loadFromSB resolves correctly even on a cold cache.
        try{await _refreshMyAccess();}catch(e){}
        // CRITICAL: Always load from Supabase FIRST before any sync
        // This prevents empty local state from overwriting real server data
        await loadFromSB();
        _seedAppConfig();
        try{_startRealtime();}catch(e){}
        _hrmInit();
        saveDB();
        render();
        // R9-FIX: a deep link / refresh lands directly on a route WITHOUT App.go, so the per-tab
        // cold loads (30-day submissions, 90-day attendance, audit, okr logs) never fired — the
        // analytics trend then only showed the 7-day hot window. Trigger them for the landing route.
        try{_lazyForRoute(S.route);}catch(e){}
        return;
      }
      await sb.auth.signOut();
    }
    loadDB();S.uid=null;render();
  }catch(e){try{loadDB();}catch(e2){}S.uid=null;render();console.error('Boot error:',e);if(e.message&&!e.message.includes('JWT'))toast('Connection error — check your internet connection','err');}
})();

// ── Session keepalive: refresh the auth token every 10 minutes to prevent 401 ──
// NOTE: this no longer re-downloads all data on a timer (that was the main egress drain).
// Data now loads per-tab on click (see _lazyForRoute) and on tab refocus (visibilitychange).
setInterval(async()=>{
  if(!S.uid)return;
  if(document.visibilityState==='hidden')return; // paused while tab is backgrounded
  try{
    const{data:{session},error}=await sb.auth.getSession();
    if(error||!session){
      // Session gone — try refresh
      const{data,error:re}=await sb.auth.refreshSession();
      if(re){console.warn('[auth] session expired, reloading');render();return;}
    }
  }catch(e){console.warn('[keepalive]',e.message);}
  _runDeadlineChecks();
},10*60*1000); // every 10 minutes

// ── Refresh the active tab's data when the user returns to a backgrounded tab ──
// While hidden, nothing downloads; on return we refresh only the current route once.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||!S.uid)return;
  _runDeadlineChecks();
  _lazyForRoute(S.route);
});

// ── Midnight rollover ────────────────────────────────────────────────────────
// Checklists are day-scoped, so an open tab left running overnight would keep showing
// yesterday's list. Re-render just after 00:00 so the day flips without a manual reload.
// Re-arms itself daily.
(function _armMidnightRollover(){
  const arm=()=>{
    const now=new Date();
    const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,40); // 00:00:40 — clock skew cushion
    setTimeout(()=>{try{if(S.uid&&Date.now()-_lastUserAction>3000){S.calDate=todayISO();rr();}}catch(e){}arm();},Math.max(30000,next-now));
  };
  arm();
})();

// ── Checklist deadline → manager alert (client-side) ───────────────────────────
// If a checklist isn't submitted by its deadline + grace, email the assignee's MANAGER once.
// Frontend-only: this fires whenever an admin / sub-admin / manager has Evarca open. A shared dedup
// set (workspace_settings key 'cl_deadline_alerts', read-all-authenticated) keeps it to ONCE per
// (date, checklist, employee) across devices, and a deterministic notification id is idempotent too.
const DEADLINE_GRACE_MIN=15; // requirement: deadline + 15 minutes
window._dlSent=null;window._dlSaveT=null;window._dlRunning=false;
async function _loadDlSent(){
  if(_dlSent)return _dlSent;
  _dlSent={};
  try{const{data}=await sb.from('workspace_settings').select('value').eq('key','cl_deadline_alerts').maybeSingle();
    if(data&&data.value&&typeof data.value==='object')_dlSent={...data.value};}catch(e){/* row/table may not exist yet */}
  return _dlSent;
}
function _persistDlSent(){
  const cut=Date.now()-7*86400000; // prune keys older than 7 days
  Object.keys(_dlSent).forEach(k=>{if((_dlSent[k]||0)<cut)delete _dlSent[k];});
  clearTimeout(_dlSaveT);
  _dlSaveT=setTimeout(()=>{sb.from('workspace_settings').upsert({key:'cl_deadline_alerts',value:_dlSent,updated_at:new Date().toISOString()},{onConflict:'key'}).then(()=>{},e=>console.warn('[deadline] persist:',e&&e.message));},1500);
}
async function _runDeadlineChecks(){
  if(_dlRunning||!S.uid)return;
  const _allCl=isAdmin()||scopeOf('checklists')==='everyone'; // R20: scope-driven, mirrors _roleCtx
  if(!(_allCl||isMgr()))return; // only people who hold the needed submission data run it
  _dlRunning=true;
  try{
    await _loadDlSent();
    if(!_ns)await _loadNS();
    const today=todayISO(),nowM=nowHM();
    const adminish=_allCl;
    const teamSet=adminish?null:new Set(subTree(S.uid).map(u=>u.id)); // a manager only holds their reports' data
    let changed=false;
    (DB.checklists||[]).forEach(c=>{
      /* ── CASES: one FINAL deadline + stale-blocker alerts (logic lives in answers.js) ── */
      if(isCase(c)){
        if(_caseAlerts(c,today,nowM,_dlSent))changed=true;
        return; // the per-day logic below is for recurring checklists only
      }
      if(!c.scheduleTime||!clOn(c,today))return;                  // no deadline / not active today
      if(nowM<hm2m(c.scheduleTime)+DEADLINE_GRACE_MIN)return;     // deadline + grace not reached yet
      (c.assignees||[]).forEach(aid=>{
        if(!adminish&&!(teamSet&&teamSet.has(aid)))return;         // manager: only their own reports
        if(subForCl(c,aid,today))return;                          // already submitted ("any one" handled)
        const emp=uById(aid);if(!emp)return;
        const mgrId=emp.managerId;if(!mgrId)return;                // nobody to notify
        const key=today+'|'+c.id+'|'+aid;
        if(_dlSent[key])return;                                    // already alerted
        _dlSent[key]=Date.now();changed=true;
        const mgr=uById(mgrId);
        // Email (sendEmail respects the global toggle, per-event toggle and the recipient's opt-out).
        // Deterministic id → idempotent upsert, so the same overdue day never alerts twice.
        if(evEmail('submission_late'))sendEmail('submission_late',mgrId,{checklist_name:c.name,employee_name:fullName(emp)});
        if(evInApp('submission_late')){
          const nid='dlm_'+today.replace(/-/g,'')+'_'+c.id+'_'+aid;
          const txt='⏰ Overdue: '+fullName(emp)+' has not submitted "'+c.name+'"'+(c.scheduleTime?' (due '+c.scheduleTime+')':'');
          const t=new Date().toISOString();
          sb.from('notifications').upsert({id:nid,user_id:mgrId,text:txt,read:false,created_at:t,kind:'submission',target_route:'teamview'},{onConflict:'id'}).then(()=>{},()=>{});
          if(mgrId===S.uid)DB.notifications.unshift({id:nid,userId:mgrId,text:txt,read:false,time:t,kind:'submission',targetRoute:'teamview'});
        }
      });
    });
    if(changed){_invalidateNotifCache();_persistDlSent();if(Date.now()-_lastUserAction>3000)rr();}
  }catch(e){console.warn('[deadline] check failed:',e.message);}
  finally{_dlRunning=false;}
}
// Kick off once shortly after boot, then piggyback on the keepalive interval + tab refocus.
setTimeout(()=>{try{_runDeadlineChecks();}catch(e){}},8000);

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.DEADLINE_GRACE_MIN=DEADLINE_GRACE_MIN;window._loadDlSent=_loadDlSent;window._persistDlSent=_persistDlSent;window._runDeadlineChecks=_runDeadlineChecks;


