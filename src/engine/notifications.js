/* ════════════════════════════════════════════════════════════════════════════
   NOTIFICATIONS — ONE SOURCE OF TRUTH

   NOTIF_EVENTS below is the whole list. Settings renders its rows straight from
   it, and every place in the app that sends something calls notifyEvent() with
   one of these keys. Add an event here and it appears in Settings with working
   switches automatically; there is no second list to keep in step.

   Every event supports BOTH channels: an in-app row on the bell, and an email
   queued to notif_outbox. A channel is on unless its switch says otherwise, and
   email additionally needs the master email-delivery switch.

   Storage note: the switches live on the synced workspace notification settings (_ns).
   ════════════════════════════════════════════════════════════════════════════ */
const NOTIF_EVENTS=[
  {key:'checklist_assigned',   group:'Checklists',          label:'Checklist assigned',   who:'The person it was assigned to'},
  {key:'submission_submitted', group:'Checklists',          label:'Checklist submitted',  who:'Their manager'},
  {key:'submission_late',      group:'Checklists',          label:'Submitted late',       who:'Their manager'},
  {key:'deadline_reminder',    group:'Checklists',          label:'Deadline approaching', who:'The person who owes it'},
  {key:'waiting_client_stale', group:'Checklists',          label:'Blocked on a client 3+ days', who:'Whoever created the checklist'},
  {key:'client_responded',     group:'Checklists',          label:'Client responded via status link', who:'The checklist creator and every assignee'},
  {key:'approval_requested',   group:'Approvals',           label:'Approval needed',      who:'Whoever can decide it'},
  {key:'approval_decided',     group:'Approvals',           label:'Approval decided',     who:'The person who asked'},
  {key:'submission_approved',  group:'Approvals',           label:'Submission approved',  who:'The person who submitted'},
  {key:'submission_rejected',  group:'Approvals',           label:'Submission rejected',  who:'The person who submitted'},
  {key:'escalation',           group:'Tickets & feedback',  label:'Escalation raised',    who:'Whoever it escalates to'},
  {key:'ticket_assigned',      group:'Tickets & feedback',  label:'Ticket assigned',      who:'The person it goes to'},
  {key:'ticket_resolved',      group:'Tickets & feedback',  label:'Ticket resolved',      who:'Whoever raised it'},
  {key:'feedback_received',    group:'Tickets & feedback',  label:'Feedback received',    who:'The person it is about'},
  {key:'payment_recorded',     group:'Billing',             label:'Payment recorded',     who:'Everyone who can manage billing'},
  {key:'invoice_generated',    group:'Billing',             label:'Invoice generated',    who:'Everyone who can manage billing'},
];
const NOTIF_GROUPS=[...new Set(NOTIF_EVENTS.map(e=>e.group))];
const _evByKey=k=>NOTIF_EVENTS.find(e=>e.key===k)||null;
/* Which in-app kind a bell row is tagged with — drives where tapping it lands. */
const _EVENT_KIND={
  checklist_assigned:'checklist',submission_submitted:'submission',submission_late:'submission',
  deadline_reminder:'checklist',waiting_client_stale:'checklist',client_responded:'checklist',approval_requested:'submission',approval_decided:'submission',
  submission_approved:'submission',submission_rejected:'submission',
  escalation:'ticket',ticket_assigned:'ticket',ticket_resolved:'ticket',
  feedback_received:'feedback',
  payment_recorded:'general',invoice_generated:'general',
};

/* ── channel switches ── */
function evInApp(key){
  const e=_evByKey(key);if(!e)return true;                       // unknown key: never silently swallowed
  return !_ns||_ns['inapp_'+key]!==false;
}
function evEmail(key){
  const e=_evByKey(key);if(!e)return false;
  if(!_ns||_ns.email_enabled===false)return false;               // master delivery switch
  return _ns['email_'+key]!==false;
}

/* ── the one way to send something ──
   Writes the in-app row when that channel is on, and queues the email when that one is,
   independently. Returns true if anything at all went out. */
function notifyEvent(key,userId,text,targetRoute,vars){
  if(!userId||!text)return false;
  const u=uById(userId);if(!u)return false;
  let sent=false;
  if(evInApp(key)){
    DB.notifications.unshift({id:uid('n'),userId,text:String(text).slice(0,500),
      time:new Date().toISOString(),read:false,kind:_EVENT_KIND[key]||'general',targetRoute:targetRoute||null});
    _invalidateNotifCache();sent=true;
  }
  if(evEmail(key)&&u.email&&u.emailEnabled!==false){
    try{queueEmail(key,userId,null,null,vars||{});sent=true;}catch(e){console.warn('[notify email]',e&&e.message);}
  }
  return sent;
}
/* Same, for a list of people, skipping the person who caused it. */
function notifyEventAll(key,userIds,text,targetRoute,vars){
  const seen=new Set();
  (userIds||[]).forEach(id=>{if(!id||id===S.uid||seen.has(id))return;seen.add(id);notifyEvent(key,id,text,targetRoute,vars);});
}

/* ── legacy helpers, kept so older call sites still work ──
   They no longer consult a per-feature master switch: the per-event switches in Settings are
   the only authority in this build, and a feature switch set by the wider platform against the
   same database must not silently mute a notification nobody here can see or turn back on. */
const _inappOn=()=>true;
function notify(userId,text,kind,route){
  if(!userId||!text)return;
  text=String(text).slice(0,500);
  DB.notifications.unshift({id:uid('n'),userId,text,time:new Date().toISOString(),read:false,kind:kind||'general',targetRoute:route||null});
  _invalidateNotifCache();
  const u=uById(userId);
  if(u&&u.email&&u.emailEnabled!==false&&_ns&&_ns.email_enabled!==false){
    sb.from('notif_outbox').insert({id:uid('ob'),to_user:userId,to_email:u.email,subject:text.replace(/[\u{1F300}-\u{1FAFF}]/gu,'').trim().slice(0,140),body:text,kind:kind||'general',status:'queued',created_at:new Date().toISOString()}).then(()=>{}).catch(()=>{});
  }
}
function _notifyOnce(userId,text,kind,route){
  const dup=(DB.notifications||[]).some(n=>n.userId===userId&&n.text===text&&String(n.time||'').slice(0,10)===todayISO());
  if(!dup)notify(userId,text,kind,route);
}
const _mgrOf=u=>u&&u.managerId?uById(u.managerId):null;

/* Nothing in this build seeds the shared config row any more — the notification switches it
   used to hold are per-event now. Kept callable so boot keeps its shape. */
function _seedAppConfig(){DB.hrmConfig=DB.hrmConfig||{};}

/* — auto: expose on window (modules resolve cross-file references via window at call time) — */
window.NOTIF_EVENTS=NOTIF_EVENTS;window.NOTIF_GROUPS=NOTIF_GROUPS;window._evByKey=_evByKey;window._EVENT_KIND=_EVENT_KIND;
window.evInApp=evInApp;window.evEmail=evEmail;window.notifyEvent=notifyEvent;window.notifyEventAll=notifyEventAll;
window.notify=notify;window._notifyOnce=_notifyOnce;window._inappOn=_inappOn;window._mgrOf=_mgrOf;window._seedAppConfig=_seedAppConfig;
