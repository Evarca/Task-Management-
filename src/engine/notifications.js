/* ── Unified notify: an in-app row plus an email queued to notif_outbox. Both sides are
      gated per feature by switches that live in Settings → Notifications and are
      independent of each other (a feature can be in-app only, email only, or neither). ── */

// One shared feature list drives BOTH switch rows in Settings → Notifications.
const NOTIF_KINDS=[['checklist','Checklists'],['ticket','Tickets'],['question','Questions'],['announcement','Announcements'],['general','Everything else']];
// A kind that isn't its own feature (e.g. 'submission', 'access', 'feedback') maps to
// the 'general' switch — the same rule the email gate has always used.
const _kindKey=k=>NOTIF_KINDS.some(([kk])=>kk===k)?k:'general';
// Shared gate for every in-app insert (notify(), _hrmNotify(), direct page pushes):
// true unless that feature's in-app switch is off.
const _inappOn=k=>((DB.hrmConfig&&DB.hrmConfig.inappKinds)||{})[_kindKey(k||'general')]!==false;

function notify(userId,text,kind,route){
  if(!userId||!text)return;
  text=String(text).slice(0,500); // oversized-input guard
  const IK=(DB.hrmConfig&&DB.hrmConfig.inappKinds)||{};
  if(IK[_kindKey(kind||'general')]!==false){
    DB.notifications.unshift({id:uid('n'),userId:userId,text:text,time:new Date().toISOString(),read:false,kind:kind||'general',targetRoute:route||null});
  }
  const u=uById(userId);
  const EK=(DB.hrmConfig&&DB.hrmConfig.emailKinds)||{};
  if(EK[_kindKey(kind||'general')]===false)return;
  if(u&&u.email&&u.emailEnabled!==false){
    sb.from('notif_outbox').insert({id:uid('ob'),to_user:userId,to_email:u.email,subject:text.replace(/[\u{1F300}-\u{1FAFF}]/gu,'').trim().slice(0,140),body:text,kind:kind||'general',status:'queued',created_at:new Date().toISOString()}).then(()=>{}).catch(()=>{});
  }
}
// Same-day dedupe — a trigger that runs on every device must not stack identical rows.
function _notifyOnce(userId,text,kind,route){
  const dup=(DB.notifications||[]).some(n=>n.userId===userId&&n.text===text&&String(n.time||'').slice(0,10)===todayISO());
  if(!dup)notify(userId,text,kind,route);
}
const _mgrOf=u=>u&&u.managerId?uById(u.managerId):null;

/* ── Config seeds ──
   The notification switches live in the workspace-wide hrm_config row, which this build
   SHARES with the full platform. Every seed below is fill-if-absent: an existing stored
   value always wins, so booting this app can never reset a switch set elsewhere.
   `_appCfgLoaded` is set once the row has actually been read back from the server; the
   targeted write in supabase.js refuses to push until then, so a failed read can never
   overwrite the live config with local defaults. */
window._appCfgLoaded=false;
function _seedAppConfig(){
  const C=DB.hrmConfig=DB.hrmConfig||{};
  if(!C.emailKinds||typeof C.emailKinds!=='object')C.emailKinds={};
  if(!C.inappKinds||typeof C.inappKinds!=='object')C.inappKinds={};
}

/* — auto: expose on window (modules resolve cross-file references via window at call time) — */
window.notify=notify;window._notifyOnce=_notifyOnce;window.NOTIF_KINDS=NOTIF_KINDS;window._kindKey=_kindKey;window._inappOn=_inappOn;window._mgrOf=_mgrOf;window._seedAppConfig=_seedAppConfig;
