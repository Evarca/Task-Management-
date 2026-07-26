/* ════════════════════════════════════════════════════════════════════════════
   TASK MANAGEMENT — CORE ENGINE

   This build is the task-management slice of the platform (checklists, tickets,
   questions, people, approvals, announcements, access control). The HR modules
   (attendance, leave, payroll, shifts, overtime, discipline, lifecycle, letters,
   surveys, reviews, OKRs, HR config) are not part of it.

   The shared helpers those modules used to own — the notification helper, the
   notification-preference store, the local activity log and a couple of small
   formatters — live here now, so nothing in the task-management code depends on
   a module that is no longer shipped.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Local activity log (device-only; distinct from the synced audit_logs table) ── */
function hlog(action,target){
  if(!DB.hrmAudit)DB.hrmAudit=[];
  DB.hrmAudit.unshift({id:uid('lg'),actor:fullName(me()),action,target:target||'',time:new Date().toISOString()});
  if(DB.hrmAudit.length>200)DB.hrmAudit.length=200;
  saveDB();
}

/* ── In-app notification helper ──
   Routing keys off n.kind (_notifClick maps kind → route); an optional targetRoute
   pins ambiguous kinds. Empty-text rows are refused: one undefined-text row 400s the
   batched notifications upsert and blocks ALL notification sync. */
function _hrmNotify(userId,text,kind,targetRoute){
  if(!userId||!text)return;
  /* No feature-level gate: the per-event switches in Settings are the only authority, and
     notifyEvent() is the route every real event takes. This stays for the few internal rows
     that aren't user-configurable events (e.g. an access change ping). */
  const n={id:uid('n'),userId,text,time:new Date().toISOString(),read:false};
  if(kind)n.kind=kind;
  if(targetRoute)n.targetRoute=targetRoute;
  DB.notifications.unshift(n);
  _invalidateNotifCache();
}

/* ════════ NOTIFICATION PREFERENCES ════════
   Stored on DB.notifPrefs and mirrored to workspace_settings (key 'hrm_notif_prefs')
   so a refresh or another device sees the same switches.

   IMPORTANT: this workspace_settings row is shared with the full platform. The
   defaults below therefore keep every key the platform defines — a toggle written
   here merges into the stored object rather than replacing it, so switches that
   belong to modules this build doesn't ship are never dropped. */
function _hrmNotifPrefsDefault(){return{
  hrm_email_enabled:false,
  // in-app toggles (default on)
  inapp_hrm_leave_submitted:true,inapp_hrm_leave_approved:true,inapp_hrm_leave_rejected:true,
  inapp_hrm_late:true,inapp_hrm_missed_clockout:true,inapp_announcement:true,inapp_review_opened:true,inapp_review_results:true,inapp_hrm_wfh:true,
  // email toggles (default on, gated by the master switch)
  email_hrm_leave_submitted:true,email_hrm_leave_approved:true,email_hrm_leave_rejected:true,
  email_hrm_late:true,email_hrm_missed_clockout:true,email_announcement:true,email_review_cycle_opened:true,email_review_results_ready:true,
};}
// Getter: raw value of a notification pref (defaults applied).
function _hnp(key){
  const p=DB.hrmNotifPrefs||(DB.hrmNotifPrefs=_hrmNotifPrefsDefault());
  const d=_hrmNotifPrefsDefault();
  return p[key]!==undefined?!!p[key]:!!d[key];
}
// Email gate: an email_* event fires only when its own toggle AND the master switch are on.
function _hnpEmail(key){return _hnp('hrm_email_enabled')&&_hnp(key);}
App._hnpTog=(btn,key)=>{
  if(!DB.hrmNotifPrefs)DB.hrmNotifPrefs=_hrmNotifPrefsDefault();
  const nowOn=btn.classList.contains('off');
  btn.classList.toggle('on',nowOn);btn.classList.toggle('off',!nowOn);
  btn.setAttribute('aria-checked',nowOn?'true':'false');
  DB.hrmNotifPrefs[key]=nowOn;saveDB();
  if(can('settings','edit'))sb.from('workspace_settings').upsert({key:'hrm_notif_prefs',value:DB.hrmNotifPrefs,updated_at:new Date().toISOString()},{onConflict:'key'}).then(()=>{}).catch(()=>{});
};

/* ── Small formatters the pages share ── */
function _isoAdd(iso,days){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+days);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _r2(n){return Math.round(n*100)/100;}
function _m2hm(m){if(m==null)return'—';m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}

/* ════════ APPROVAL INBOX ════════
   One normalised list of everything waiting on a decision: checklist submissions, and
   requests to change a single already-submitted answer. The shape is kept generic so the
   inbox UI, the badge count and the bulk-approve loop all read one model. */
function _approvalInbox(){
  const items=[];
  // Admins see every approval; everyone else sees their own plus their reporting line.
  const _apprScope=isAdmin()?(DB.approvals||[]):(DB.approvals||[]).filter(a=>subTree(S.uid).some(u=>u.id===a.requesterId)||a.requesterId===S.uid);
  _apprScope.forEach(a=>{
    const u=uById(a.requesterId);if(!u)return;
    const c=clById(a.checklistId);
    const isEdit=a.type==='Edit Request';
    // 'Used' (a resubmitted edit) reads as Approved for filtering.
    const st=a.status==='Used'?'Approved':a.status;
    items.push({
      id:'ap-'+a.id, type:isEdit?'edit':'submission', requestedBy:a.requesterId, assignedTo:u.managerId||null,
      subject:(c?.name||'Checklist')+(a.date?' · '+fmtD(a.date):''),
      payload:a, status:st, decidedBy:null, decidedAt:null,
      location:u.location||'', dept:u.department||'',
      _canDecide:isAdmin()||u.managerId===S.uid||can('checklists','approve'),
      _src:{coll:'approvals',id:a.id}
    });
  });
  // (b) ANSWER EDIT requests — someone wants to change one answer they already submitted.
  //     Visible to whoever can actually decide it: their manager, or a checklist approver.
  (DB.tmAnswerEdits||[]).forEach(e=>{
    const u=uById(e.requestedBy);if(!u)return;
    const mine=e.requestedBy===S.uid;
    if(!(_ansCanDecide(e)||mine))return;
    const c=clById(e.checklistId);
    const q=(DB.questions||[]).find(x=>x.id===e.questionId);
    const st=e.status==='Used'?'Approved':e.status;
    items.push({
      id:'ae-'+e.id, type:'answerEdit', requestedBy:e.requestedBy, assignedTo:u.managerId||null,
      subject:(c?c.name:'Checklist')+' · '+String(q?q.text:'answer').slice(0,48),
      payload:{...e,createdAt:e.requestedAt}, status:st,
      decidedBy:e.decidedBy||null, decidedAt:e.decidedAt||null,
      location:u.location||'', dept:u.department||'',
      _canDecide:_ansCanDecide(e),
      _src:{coll:'tmAnswerEdits',id:e.id}
    });
  });
  return items;
}
/* The red number counts only what YOU can decide. Your own pending request still shows in
   the inbox list, but it is not a badge you have no way to clear. */
function _approvalPendingCount(){return _approvalInbox().filter(x=>x.status==='Pending'&&x._canDecide).length;}

/* ── Boot init (idempotent) ── */
function _hrmInit(){
  // Self-heal: drop malformed empty-text notifications left in a device's local cache —
  // one such row 400s the whole batched notifications upsert and keeps every later
  // notification from syncing (endless "didn't save" toasts on that device).
  DB.notifications=(DB.notifications||[]).filter(n=>n&&n.text&&String(n.text).trim());
  // Self-heal 2: drop duplicate-id notifications (deterministic deadline-checker ids can
  // double-add) — two rows with one id in a batched upsert = Postgres 21000 = batch fails.
  {const _seen=new Set();DB.notifications=DB.notifications.filter(n=>_seen.has(n.id)?false:(_seen.add(n.id),true));}
  if(DB.hrmNotifPrefs){const _d=_hrmNotifPrefsDefault();Object.keys(_d).forEach(k=>{if(DB.hrmNotifPrefs[k]===undefined)DB.hrmNotifPrefs[k]=_d[k];});}
  _seedRoleProfiles();
  DB.users.forEach(_ensureHrm);
  saveDB();
}

/* Attendance is not part of this build — the midnight auto-close hook stays callable
   so the boot timers in main.js keep their shape, and does nothing. */
function _runAutoClose(){}

/* — auto: expose on window (modules resolve cross-file references via window at call time) — */
window.hlog=hlog;window._hrmNotify=_hrmNotify;window._hrmNotifPrefsDefault=_hrmNotifPrefsDefault;window._hnp=_hnp;window._hnpEmail=_hnpEmail;window._isoAdd=_isoAdd;window._r2=_r2;window._m2hm=_m2hm;window._approvalInbox=_approvalInbox;window._approvalPendingCount=_approvalPendingCount;window._hrmInit=_hrmInit;window._runAutoClose=_runAutoClose;
