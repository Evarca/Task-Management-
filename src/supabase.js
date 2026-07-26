
// RLS-aware push: empty row-sets (capability-filtered) never fire a request at all.
const _safeUp=(t,rows,conf)=>{
  if(Array.isArray(rows)&&!rows.length)return Promise.resolve({});
  return sb.from(t).upsert(rows,conf);
};
function _isRlsErr(e){const m=(e&&(e.message||e.error_description||''))+'';return /row-level security|permission denied|violates|not authorized|forbidden|RLS/i.test(m);}
// .catch / .then-error handler for a TARGETED write. Returns a fn so it can be passed directly to .catch.
function _syncErr(label){return (e)=>{
  console.warn('[sync]',label,e?.message||e);
  const rls=_isRlsErr(e);
  toast(rls?('Couldn\'t save '+(label||'changes')+' — you may not have permission'):('Couldn\'t save '+(label||'changes')+' — check your connection'),'err');
};}
// Surface a caught exception from a user-initiated operation (validation already toasts its own message).
function _opErr(e,ctx){console.warn('[op]',ctx,e?.message||e);toast((ctx?(ctx+' failed'):'Something went wrong')+(_isRlsErr(e)?' — permission denied':''),'err');}
// Batch reporter for _sync()'s Promise.allSettled. Debounced so a flapping connection can't spam.
function _reportSyncResults(results,labels){
  const failedLabels=[];
  results.forEach((r,i)=>{
    const err=r.status==='rejected'?r.reason:(r.value&&r.value.error);
    if(err)failedLabels.push(labels[i]||('table '+i));
  });
  if(!failedLabels.length)return;
  console.warn('[sync] failed:',failedLabels.join(', '));
  const now=Date.now();
  if(now-_lastSyncErrToast<10000)return; // debounce: at most one sync-error toast per 10s
  _lastSyncErrToast=now;
  const uniq=[...new Set(failedLabels)];
  const shown=uniq.slice(0,3).join(', ')+(uniq.length>3?(' +'+(uniq.length-3)+' more'):'');
  toast('Some changes didn\'t save ('+shown+') — check your connection or permissions','err');
}


/* ===== SUPABASE CLIENT ===== */
/* R24 (security): the anon key is a PUBLIC (publishable) key — safe in the browser by design;
   RLS is the security boundary. Still, env vars win when set (VITE_SB_URL / VITE_SB_ANON via
   Vercel or .env — see .env.example) so keys can be rotated without a code change.
   The service_role key must NEVER appear anywhere in this repo or the browser. */
const _env=(typeof import.meta!=='undefined'&&import.meta.env)||{};
const SB_URL=_env.VITE_SB_URL||'https://emzgwkvkgojcaqngkatw.supabase.co';
const SB_ANON=_env.VITE_SB_ANON||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtemd3a3ZrZ29qY2FxbmdrYXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTQ4OTUsImV4cCI6MjA5NzUzMDg5NX0.Ng5vNIAA2N7_fvTVJT3Cw5i1FSczMR1Jfv6qp7PGXSk';
if(typeof supabase==='undefined'){var _a=document.getElementById('app');if(_a)_a.innerHTML='<div style="max-width:640px;margin:56px auto;padding:28px;font:15px/1.6 system-ui,-apple-system,sans-serif;color:#1f232b;border:1px solid #e8eaee;border-radius:16px"><h2 style="margin:0 0 10px;font-size:20px">Open Evarca in a web browser</h2><p style="margin:0 0 8px">This app loads Tailwind and Supabase from the internet, so it can\u2019t run inside a preview pane.</p><p style="margin:0">Save this file and open it directly in <b>Chrome</b> or <b>Safari</b> with an internet connection \u2014 it will load normally.</p></div>';throw new Error('Supabase library not loaded (offline or blocked CDN) \u2014 open in a real browser.');}
const sb=supabase.createClient(SB_URL,SB_ANON,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
function _unesc(s){if(!s)return s;let p=String(s),c;do{c=p;p=p.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");}while(p!==c);return p;}
function _mU(r){return(r||[]).map(p=>({id:p.id,firstName:_unesc(p.first_name)||'',lastName:_unesc(p.last_name)||'',email:p.email||'',phone:_unesc(p.phone)||'',position:_unesc(p.position)||'',department:_unesc(p.department)||'',status:p.status||'Active',managerId:p.manager_id||null,managerHistory:p.manager_history||[],rules:p.rules||{past:true,future:true,edit:true},approval:p.approval_settings||{past:false,future:false,edited:false},docAccess:p.doc_access||{departments:{},locations:{}},questionsAccess:p.questions_access||false,emailEnabled:p.email_enabled!==false,cities:Array.isArray(p.cities)?p.cities:[],password:'***'}));}
function _mC(r){return(r||[]).map(c=>({id:c.id,name:c.name||'',description:c.description||'',department:c.department||'',frequency:c.frequency||'Daily',schedule:c.schedule||'',selectedDays:c.selected_days||[],selectedDates:(c.selected_dates||[]).map(x=>x==='L'?'L':Number(x)),customDates:c.custom_dates||[],startDate:c.start_date||'',endDate:c.end_date||'',locationIds:c.location_ids||[],assignees:c.assignees||[],tasks:c.tasks||[],questionIds:c.question_ids||[],questionConfigs:(()=>{const raw=c.question_configs||{};const fixed={};Object.keys(raw).forEach(k=>{const clean=k.startsWith('"')&&k.endsWith('"')?JSON.parse(k):k;fixed[clean]=raw[k];});return fixed;})(),scheduleTime:c.schedule_time||null,status:c.status||'Active',anyOne:c.any_one||false,createdBy:c.created_by||null}));}
function _mS(r){return(r||[]).map(s=>({id:s.id,checklistId:s.checklist_id,userId:s.user_id,date:s.date,status:s.status||'Pending',submittedAt:s.submitted_at||null,tasks:s.tasks||[],questionResponses:s.question_responses||[],editCount:s.edit_count||0,editHistory:s.edit_history||[],checklistDeleted:s.checklist_deleted||false}));}
function _mA(r){return(r||[]).map(a=>({id:a.id,type:a.type||'Submission',requesterId:a.requester_id,checklistId:a.checklist_id||null,date:a.date||null,status:a.status||'Pending',note:a.note||'',createdAt:a.created_at,isResubmit:a.is_resubmit||false,usedAt:a.used_at||null}));}
/* ===== Egress-reduction helpers: 30-day windowing + lazy per-tab loading ===== */
const _DAY_MS=24*60*60*1000;
function _cutoff30ISO(){return new Date(Date.now()-30*_DAY_MS).toISOString();}
function _cutoff30Date(){return _cutoff30ISO().slice(0,10);}
// R7 EGRESS ("cold archive"): boot fetches only the HOT window (last 7 days) for the heavy
// tables; anything older loads on demand when its tab is opened (_lazyCold below).
function _cutoff7ISO(){return new Date(Date.now()-7*_DAY_MS).toISOString();}
function _cutoff7Date(){return _cutoff7ISO().slice(0,10);}
function _mapTk(rows){return(rows||[]).map(t=>({id:t.id,title:t.title||'',description:t.description||'',priority:t.priority||'Medium',status:t.status||'Open',assignedTo:t.assigned_to||null,createdBy:t.created_by||null,checklistId:t.checklist_id||null,questionId:t.question_id||null,questionText:t.question_text||'',answerGiven:t.answer_given||'',submitterId:t.submitter_id||null,date:t.date||null,createdAt:t.created_at,resolvedAt:t.resolved_at||null,resolveNote:t.resolve_note||'',viewedBy:t.viewed_by||[]}));}
/* ── OKR v2 mappers + row builders (hierarchy nodes / check-ins / activity logs) ── */
function _roleCtx(){const _uid=S.uid;const _isAdmin=isAdmin();const _seesAllCl=_isAdmin||scopeOf('checklists')==='everyone';const _seesAllTk=_isAdmin||scopeOf('tickets')==='everyone';const _isMgr=isMgr();const _teamIds=(_isMgr&&!_seesAllCl)?new Set([_uid,...subTree(_uid).map(u=>u.id)]):null;return{_uid,_isAdmin,_seesAllCl,_seesAllTk,_isMgr,_teamIds};}
// Apply helpers — shared by the startup bulk load AND the lazy per-tab loaders so the
// scope-based visibility filtering can never drift between the two paths.
function _applySubmissions(subs,{merge=false}={}){
  const {_uid,_seesAllCl,_isMgr,_teamIds}=_roleCtx();
  const allSubs=_mS(subs||[]);
  let visible;
  if(_seesAllCl){visible=allSubs;}
  else if(_isMgr){const _grpIds=new Set(DB.checklists.filter(c=>c.anyOne&&(c.assignees||[]).includes(_uid)).map(c=>c.id));visible=allSubs.filter(s=>_teamIds.has(s.userId)||_grpIds.has(s.checklistId));}
  else{const _grpIds=new Set(DB.checklists.filter(c=>c.anyOne&&(c.assignees||[]).includes(_uid)).map(c=>c.id));visible=allSubs.filter(s=>s.userId===_uid||_grpIds.has(s.checklistId));}
  if(merge){const byId=new Map((DB.submissions||[]).map(s=>[s.id,s]));visible.forEach(s=>byId.set(s.id,s));DB.submissions=[...byId.values()];}
  else{DB.submissions=visible;}
}
function _applyApprovals(appr){
  const {_uid,_seesAllCl,_isMgr,_teamIds}=_roleCtx();
  const _dead=new Set(DB.approvals_deleted||[]); // R7: deleted approval records never resurrect
  const allAppr=_mA(appr||[]).filter(a=>!_dead.has(a.id));
  if(_seesAllCl){DB.approvals=allAppr;}
  else if(_isMgr){DB.approvals=allAppr.filter(a=>_teamIds.has(a.requesterId)||a.requesterId===_uid);}
  else{DB.approvals=allAppr.filter(a=>a.requesterId===_uid);}
}
function _applyNotifications(notifs){
  const _uid=S.uid;
  const _dead=new Set(DB.notifications_deleted||[]); // R7: locally-deleted alerts never resurrect
  DB.notifications=(notifs||[]).filter(n=>n.user_id===_uid&&!_dead.has(n.id)).map(n=>{const o={id:n.id,userId:n.user_id,text:n.text||'',read:n.read||false,time:n.created_at};if(n.kind)o.kind=n.kind;if(n.target_route)o.targetRoute=n.target_route;return o;});
}
function _applyFeedback(feedbackRows){
  if(!feedbackRows){DB.feedback=DB.feedback||[];return;}
  const {_uid,_seesAllCl,_isMgr,_teamIds}=_roleCtx();
  const allFb=feedbackRows.map(fb=>({id:fb.id,checklistId:fb.checklist_id||null,userId:fb.user_id,managerId:fb.manager_id,date:fb.date||null,title:fb.title||null,type:fb.type||'General',text:fb.text||'',priority:fb.priority||'Low',taskName:fb.task_name||null,level:fb.level||'direct',status:fb.status||'Sent',acknowledged:fb.acknowledged||false,acknowledgedAt:fb.acknowledged_at||null,reply:fb.reply||null,repliedAt:fb.replied_at||null,replies:fb.replies||[],createdAt:fb.created_at}));
  if(_seesAllCl){DB.feedback=allFb;}
  else if(_isMgr){DB.feedback=allFb.filter(fb=>fb.managerId===_uid||_teamIds.has(fb.userId));}
  else{DB.feedback=allFb.filter(fb=>fb.userId===_uid);}
}
function _applyTickets(rows){
  const {_uid,_seesAllTk}=_roleCtx();
  const allTk=_mapTk(rows||[]);
  // Tickets scope 'everyone' sees all; everyone else only tickets assigned to them.
  const visible=_seesAllTk?allTk:allTk.filter(t=>t.assignedTo===_uid);
  // Keep any local-only tickets (just created, or older than the 30-day window) that the
  // server query didn't return — never drop them.
  const fromSB=new Set(allTk.map(t=>t.id));
  const localOnly=(DB.tickets||[]).filter(t=>!fromSB.has(t.id));
  DB.tickets=[...visible,...localOnly];
  _invalidateNotifCache();
}

/* ════════ SHARED WORKSPACE CONFIG ════════
   hrm_config is a single workspace-wide row shared with the full platform. THIS BUILD READS IT
   FOR THE NOTIFICATION SWITCHES ONLY and writes nothing except those switches (see
   _pushNotifKinds below) — every other field on the row is left exactly as the server has it. */
const _HRM_CFG_ID='singleton';
function _applyHrmConfig(row){
  if(!row)return;
  const X=(row.extras&&typeof row.extras==='object')?row.extras:{};
  if(X.emailKinds&&typeof X.emailKinds==='object')DB.hrmConfig.emailKinds=X.emailKinds;
  if(X.inappKinds&&typeof X.inappKinds==='object')DB.hrmConfig.inappKinds=X.inappKinds;
  // Everything else on the row (profiles, alerts, branding, templates, payroll policy) belongs to
  // modules this build doesn't ship. Keep the raw blob so a write-back can round-trip it untouched.
  DB._cfgExtras=X;
  window._appCfgLoaded=true;
}
/* Targeted write for the notification switches. Sends ONLY the `extras` column, and refuses
   to run until the row has actually been read back — so a failed load can never overwrite the
   shared config with local defaults. The other fields inside `extras` are round-tripped verbatim. */
function _pushNotifKinds(){
  if(!window._appCfgLoaded)return; // never write what we haven't read
  if(!can('settings','edit'))return;
  const X={...(DB._cfgExtras||{}),emailKinds:DB.hrmConfig.emailKinds||{},inappKinds:DB.hrmConfig.inappKinds||{}};
  DB._cfgExtras=X;
  sb.from('hrm_config').update({extras:X,updated_at:new Date().toISOString()}).eq('id',_HRM_CFG_ID)
    .then(({error})=>{if(error)_syncErr('notification switches')(error);}).catch(_syncErr('notification switches'));
}
/* ── Announcements (PHASE4b) — previously localStorage-only; now a real table. ── */
/* ── Drafts (PHASE4b) — per-user cross-device saves for checklist runs & OKR check-ins. ── */
function _mDraft(rows){return(rows||[]).map(d=>({id:d.id,userId:d.user_id,kind:d.kind,refId:d.ref_id,date:d.date||null,payload:d.payload||{},updatedAt:d.updated_at}));}
function _draftRow(d){return{id:d.id,user_id:d.userId,kind:d.kind,ref_id:d.refId,date:d.date||null,payload:d.payload||{},updated_at:d.updatedAt||new Date().toISOString()};}
function _hrmStrip(hrm){
  try{
    const h=JSON.parse(JSON.stringify(hrm||{}));
    if(Array.isArray(h.personalDocs))h.personalDocs.forEach(d=>{if(d&&typeof d.dataUrl==='string'&&d.dataUrl.startsWith('data:'))d.dataUrl=null;});
    return h;
  }catch(e){return hrm||{};}
}

// W1.1: a subtle top sync bar reflecting in-flight background loads (no layout shift, no blank flash).
function _syncBar(on){try{let b=document.getElementById('syncbar');if(!b){if(!on)return;b=document.createElement('div');b.id='syncbar';document.body.appendChild(b);}b.classList.toggle('on',!!on);}catch(e){}}
function _anyLoading(){return Object.values(_tabLoading).some(Boolean);}
// _isLoading(kind) — pages call this to decide whether to render a loadingState() skeleton.
function _isLoading(kind){return !!_tabLoading[kind];}
// Per-tab lazy loaders — fetch only the opened tab's data (last 30 days), nothing on a timer.
let _tabLoading={};
async function _lazyLoad(kind){
  if(!S.uid||document.visibilityState==='hidden'||_tabLoading[kind])return;
  _tabLoading[kind]=true;_syncBar(true);
  // Safety net: never let a slow/hung request trap a tab on a loading skeleton forever.
  //   After 9s, clear the flag and re-render so the page shows whatever data is already available.
  const _loadTO=setTimeout(()=>{if(_tabLoading[kind]){_tabLoading[kind]=false;_syncBar(_anyLoading());try{rr();}catch(e){}}},9000);
  try{
    const c=_cutoff30ISO();
    if(kind==='tickets'){const{data,error}=await sb.from('tickets').select('*').gte('created_at',c).order('created_at',{ascending:false});if(error){console.error('[TK] lazy error:',error.message);}else _applyTickets(data);}
    else if(kind==='approvals'){const{data,error}=await sb.from('approvals').select('*').gte('created_at',c).order('created_at',{ascending:false});if(!error)_applyApprovals(data);}
    else if(kind==='notifications'){const{data,error}=await sb.from('notifications').select('*').gte('created_at',c).order('created_at',{ascending:false});if(!error)_applyNotifications(data);}
    else if(kind==='feedback'){const{data,error}=await sb.from('feedback').select('*').gte('created_at',c).order('created_at',{ascending:false});if(!error)_applyFeedback(data);}
    saveDB();
  }catch(e){console.warn('[lazyLoad]',kind,e.message);}
  finally{clearTimeout(_loadTO);_tabLoading[kind]=false;_syncBar(_anyLoading());try{rr();}catch(e){}}
}
async function _lazyLoadDate(view){
  if(!S.uid||document.visibilityState==='hidden')return;
  let d;
  if(view==='mychecklists')d=S.calDate||todayISO();
  else if(view==='teamview')d=S.tvCalDate||todayISO();
  else if(view==='allcl')d=(S.filters&&S.filters.aclDate)||todayISO();
  if(!d)return;
  const key='subs:'+d;
  if(_tabLoading[key])return;_tabLoading[key]=true;_syncBar(true);
  try{
    const{data,error}=await sb.from('submissions').select('*').eq('date',d).order('submitted_at',{ascending:false});
    if(!error)_applySubmissions(data,{merge:true});
    await _ansLoadDate(d);
    saveDB();
  }catch(e){console.warn('[lazyLoadDate]',e.message);}
  finally{_tabLoading[key]=false;_syncBar(_anyLoading());try{rr();}catch(e){}}
}
/* R7 EGRESS ("cold archive"): older-than-a-week data loads ONLY when its tab is opened.
   Each cold load runs once per session (guarded), shows the sync bar, and MERGES into local
   state (never clobbers newer local rows). A few seconds on first open is expected + fine. */
const _coldDone={};
async function _lazyCold(kind){
  if(!S.uid||_coldDone[kind]||_tabLoading['cold:'+kind])return;
  _tabLoading['cold:'+kind]=true;_syncBar(true);
  try{
    if(kind==='audit'){
      const{data,error}=await sb.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(300);
      if(!error){DB.audit=(data||[]).map(l=>({id:l.id,actor:l.actor||'',action:l.action||'',target:l.target||'',time:l.created_at}));_coldDone[kind]=1;}
    }else if(kind==='subs30'){
      const{data,error}=await sb.from('submissions').select('*').gte('date',_cutoff30Date()).order('submitted_at',{ascending:false});
      if(!error){_applySubmissions(data,{merge:true});_coldDone[kind]=1;}
    }else if(kind==='notif90'){
      const{data,error}=await sb.from('notifications').select('*').gte('created_at',new Date(Date.now()-90*_DAY_MS).toISOString()).order('created_at',{ascending:false});
      if(!error){_applyNotifications(data);_invalidateNotifCache();_coldDone[kind]=1;}
    }
  }catch(e){console.warn('[cold]',kind,e.message);}
  finally{_tabLoading['cold:'+kind]=false;_syncBar(_anyLoading());}
  saveDB();rr();
}
App._loadOlderAlerts=()=>{_lazyCold('notif90');};
function _lazyForRoute(r){
  if(document.visibilityState==='hidden'||!S.uid)return;
  if(r==='tickets')_lazyLoad('tickets');
  else if(r==='approvals')_lazyLoad('approvals');
  else if(r==='notifications'){_lazyLoad('notifications');_lazyLoad('feedback');}
  else if(r==='mychecklists')_lazyLoadDate('mychecklists');
  else if(r==='teamview')_lazyLoadDate('teamview');
  else if(r==='allcl')_lazyLoadDate('allcl');
  else if(r==='dashboard'){_lazyLoad('tickets');_lazyLoadDate('mychecklists');_lazyCold('subs30');}
  // Cold windows (older than the boot week) fetch on first open of the tab that needs them.
  else if(r==='audit')_lazyCold('audit');
  else if(r==='analytics')_lazyCold('subs30');
}

/* ── Realtime (Phase 1 leftover): new notifications for ME appear instantly, no reload.
      Guarded + idempotent; if realtime is unavailable the app just behaves as before. ── */
function _startRealtime(){
  try{
    if(window._rtCh||!S.uid||!sb.channel)return;
    window._rtCh=sb.channel('rt-notifs-'+S.uid)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+S.uid},(payload)=>{
        const r=payload&&payload.new;if(!r||!r.id)return;
        if((DB.notifications||[]).some(n=>n.id===r.id))return;
        DB.notifications.unshift({id:r.id,userId:r.user_id,text:r.text||'',time:r.created_at||new Date().toISOString(),read:r.read===true,kind:r.kind||'general',targetRoute:r.target_route||null});
        saveDB();rr();
        // R17: an 'access' ping means an admin changed MY permissions/HR settings — refetch and
        // re-render so this open session drops (or gains) controls immediately, no reload needed.
        if(r.kind==='access'){try{toast(r.text||'Your access was updated','warn');}catch(e){}_refreshMyAccess();}
      })
      /* R17 (owner report: "I removed manage but Lee can still edit his own shift"): access changes
         SAVED fine (R14), but an already-open session kept the OLD permissions in memory until the
         next full reload — so the target user kept seeing (and clicking) controls their role no longer
         grants. Live propagation, verified on the live site:
         — ROLE edits arrive via workspace_settings realtime below (in the publication, RLS read=true).
           The big jsonb value is a TOASTed column, so a payload may arrive WITHOUT it — refetch then.
         — PER-USER edits (role assignment / overrides / HR settings) arrive as a kind='access'
           notification (see the notifications listener above + _acPushHrm), because realtime on
           user_hrm itself proved unreliable (its RLS check drops events). */
      .on('postgres_changes',{event:'*',schema:'public',table:'workspace_settings',filter:'key=eq.role_profiles'},(payload)=>{
        try{
          const v=payload&&payload.new&&payload.new.value;
          const myPid=(me()&&me().hrm||{}).roleProfileId;
          if(v&&typeof v==='object'){
            if(JSON.stringify(DB.roleProfiles)===JSON.stringify(v))return;   // my own edit echoing back
            const mineChanged=myPid&&JSON.stringify((DB.roleProfiles||{})[myPid])!==JSON.stringify(v[myPid]);
            DB.roleProfiles=v;
            saveDB();rr();
            if(mineChanged)toast('Your permissions were just updated','warn');
          }else{
            const before=myPid?JSON.stringify((DB.roleProfiles||{})[myPid]):'';
            _refreshMyAccess().then(ch=>{if(ch&&myPid&&before!==JSON.stringify((DB.roleProfiles||{})[myPid]))toast('Your permissions were just updated','warn');});
          }
        }catch(e){}
      })
      .subscribe();
  }catch(e){console.warn('[realtime]',e.message);}
}
/* R17: pull MY current access from the server (own user_hrm row + role bundles) and apply it to this
   open session. Called when a kind='access' notification lands or a role_profiles event arrives without
   its (TOASTed) value. Safe to call any time; renders only when something actually changed. */
async function _refreshMyAccess(){
  try{
    const[uh,ws]=await Promise.all([
      sb.from('user_hrm').select('hrm').eq('user_id',S.uid).maybeSingle(),
      sb.from('workspace_settings').select('value').eq('key','role_profiles').maybeSingle()
    ]);
    let changed=false;
    const u=uById(S.uid);
    if(u&&uh&&uh.data&&uh.data.hrm&&typeof uh.data.hrm==='object'){
      if(JSON.stringify(_hrmStrip(u.hrm||{}))!==JSON.stringify(uh.data.hrm)){u.hrm=uh.data.hrm;_ensureHrm(u);changed=true;}
    }
    if(ws&&ws.data&&ws.data.value&&typeof ws.data.value==='object'){
      if(JSON.stringify(DB.roleProfiles)!==JSON.stringify(ws.data.value)){DB.roleProfiles=ws.data.value;changed=true;}
    }
    if(changed){saveDB();rr();}
    return changed;
  }catch(e){return false;}
}
window._refreshMyAccess=_refreshMyAccess;
async function loadFromSB(){
  // Check and refresh session before queries — prevents 401 on stale tokens
  try{
    const {data:{session},error}=await sb.auth.getSession();
    if(error||!session){
      const {data:refreshData,error:refreshErr}=await sb.auth.refreshSession();
      if(refreshErr||!refreshData?.session){
        console.warn('[auth] no valid session, skipping loadFromSB');
        return; // Don't loop — user needs to log in again
      }
    }
  }catch(e){console.warn('[auth] session check:',e.message);}

  // Egress control: the big tables load only the last 30 days at startup. Older rows stay
  // in the DB and load on demand when the user opens that day/tab. Small reference tables
  // (departments, locations, checklists, audit_logs, profiles, questions) load fully.
  const _c30=_cutoff30ISO(), _c30d=_cutoff30Date();
  let depts,locs,allCls,subs,appr,audit,notifs,profiles,feedbackRows,qRows;
  try{
    const res=await Promise.all([
      sb.from('departments').select('*').order('name'),
      sb.from('locations').select('*').order('name'),
      sb.from('checklists').select('*').order('created_at',{ascending:false}),
      sb.from('submissions').select('*').gte('date',_cutoff7Date()).order('submitted_at',{ascending:false}), // R7 EGRESS: 7-day hot window; 30d loads when Dashboard/Analytics opens
      sb.from('approvals').select('*').gte('created_at',_c30).order('created_at',{ascending:false}),
      Promise.resolve({data:[]}), // R7 EGRESS: audit log loads when the Audit tab opens (_lazyCold)
      sb.from('notifications').select('*').gte('created_at',_cutoff7ISO()).order('created_at',{ascending:false}), // R7 EGRESS: 7-day hot; older via "Load older" on Alerts
      sb.from('profiles').select('*').order('first_name'),
      sb.from('feedback').select('*').gte('created_at',_c30).order('created_at',{ascending:false}),
      sb.from('questions').select('*').order('created_at',{ascending:false}),
    ]);
  [depts,locs,allCls,subs,appr,audit,notifs,profiles,feedbackRows,qRows]=res.map(r=>r.data||[]);
  }catch(e){
    console.error('loadFromSB failed:',e.message);
    return; // Keep existing cached data
  }
  // ── Scope-based IDs for filtering (R20: Access Control drives visibility) ──
  // NOTE: DB.users is populated below from profiles, but we need it for subTree.
  // Use the already-loaded DB.users from local cache for scope checks here
  // (boot/login await _refreshMyAccess() first, so my hrm + role bundles are current).
  const {_uid,_seesAllCl,_isMgr,_teamIds}=_roleCtx();

  // ── Departments + Locations: everyone sees all ──
  const _delDepts=new Set(DB.departments_deleted||[]);
  DB.departments=(depts||[]).filter(d=>!_delDepts.has(d.id)).map(d=>({id:d.id,name:d.name,parentId:d.parent_id||null}));
  const _delLocs=new Set(DB.locations_deleted||[]);
  DB.locations=(locs||[]).filter(l=>!_delLocs.has(l.id)).map(l=>({id:l.id,name:l.name,address:l.address||'',department:l.department||'',status:l.status||'Active'}));

  // ── Checklists ──
  {
    const _delCls=new Set(DB.checklists_deleted||[]);
    const mapped=_mC(allCls||[]).filter(c=>!_delCls.has(c.id));
    // IDs that came back from Supabase this load
    const _serverIds=new Set(mapped.map(c=>c.id));
    // Local checklists the current user owns that have NOT yet arrived from the server
    // (e.g. an upsert that hasn't completed yet, or one blocked by RLS). These must NOT
    // be wiped on refresh — keep them so the user never loses a checklist they just made.
    const _localPending=(DB.checklists||[]).filter(c=>
      !_serverIds.has(c.id)&&!_delCls.has(c.id)&&
      (c.createdBy===_uid||(c.assignees||[]).includes(_uid))
    );
    let _visible;
    if(mapped.length===0&&DB.checklists.length>0){
      // Nothing from Supabase — keep local cache (RLS may be blocking)
      _visible=DB.checklists.filter(c=>!_delCls.has(c.id));
    } else if(_seesAllCl){
      _visible=mapped;
    } else if(_isMgr){
      // Manager: checklists he created OR assigned to him OR assigned to his team
      _visible=mapped.filter(c=>c.createdBy===_uid||(c.assignees||[]).includes(_uid)||(_teamIds&&(c.assignees||[]).some(a=>_teamIds.has(a))));
    } else {
      // User: checklists assigned to them OR created by them
      _visible=mapped.filter(c=>(c.assignees||[]).includes(_uid)||c.createdBy===_uid);
    }
    // Merge in any local-only checklists the server didn't return, de-duplicated by id.
    const _seen=new Set(_visible.map(c=>c.id));
    DB.checklists=[..._visible,..._localPending.filter(c=>!_seen.has(c.id))];
  }

  // ── Submissions (role filtering via shared helper) ──
  _applySubmissions(subs);

  // ── Approvals (role filtering via shared helper) ──
  _applyApprovals(appr);

  // ── Audit logs: whoever Access Control grants audit.view ──
  if(can('audit','view')){
    DB.audit=(audit||[]).map(l=>({id:l.id,actor:l.actor||'',action:l.action||'',target:l.target||'',time:l.created_at}));
  } else {
    DB.audit=[];
  }

  // ── Notifications: always only for this user (shared helper) ──
  _applyNotifications(notifs);
  // ── Profiles (users): always load ALL users ──
  // subTree(), fullName(), uById(), avatar(), checklist assignee picker all need full user list.
  // Role-based visibility is enforced at the page/UI level, not by restricting DB.users.
  {
    const _savedQAccess={};DB.users.forEach(u=>{if(u.questionsAccess)_savedQAccess[u.id]=true;});
    // ── HRM: _mU() rebuilds DB.users and does NOT carry u.hrm (no Supabase column). Snapshot
    //    and re-merge so schedule/HR/report-perm data survives every background refresh. ──
    const _savedHrm={};DB.users.forEach(u=>{if(u.hrm)_savedHrm[u.id]=u.hrm;});
    const _delUsers=new Set(DB.users_deleted||[]);
    DB.users=_mU(profiles).filter(u=>!_delUsers.has(u.id));
    DB.users.forEach(u=>{if(!u.questionsAccess&&_savedQAccess[u.id])u.questionsAccess=true;});
    DB.users.forEach(u=>{if(_savedHrm[u.id])u.hrm=_savedHrm[u.id];_ensureHrm(u);});
  }

  // ── Questions: load ALL for everyone — needed so checklist cards can show questions ──
  // Questions tab visibility is controlled by nav (users have no tab, manager needs questionsAccess)
  // Questions tab content is filtered by createdBy in questionsPage()
  if(qRows){
    const _delQs=new Set(DB.questions_deleted||[]);
    DB.questions=qRows.filter(q=>!_delQs.has(q.id)).map(q=>({id:q.id,text:q.text||'',type:q.type||'answer',options:q.options||[],photo:q.photo||false,approval:q.approval||false,comment:q.comment||false,isPublic:q.is_public!==false,department:q.department||'',subDepartment:q.sub_department||'',createdBy:q.created_by||null,createdAt:q.created_at}));
  }

  // ── Feedback: role-scoped (shared helper, last-30-day window) ──
  _applyFeedback(feedbackRows);

  // ── Tickets: last 30 days, role-filtered via shared helper ──
  sb.from('tickets').select('*').gte('created_at',_cutoff30ISO()).order('created_at',{ascending:false})
    .then(({data,error})=>{
      if(error){console.error('[TK] error:',error.message);return;}
      _applyTickets(data);saveDB();rr();
    }).catch(e=>console.error('[TK] fetch failed:',e.message));

  // ── Shared checklist answers + edit requests + checklist meta (7-day hot window; the day
  //    being viewed loads on demand via _lazyLoadDate). ──
  _ansLoadWindow(_cutoff7Date()).then(()=>{saveDB();rr();}).catch(()=>{});

  // ── Location folders + documents (new tm_ tables). ──
  _docsLoad().then(()=>{saveDB();rr();}).catch(()=>{});
  _clientMetaLoad().then(()=>{saveDB();rr();}).catch(()=>{});
  // ── Round-5 tables: templates, client share links, nudge log (all small; RLS scopes them). ──
  _tplLoad().then(()=>{saveDB();rr();}).catch(()=>{});
  _shareLoad().then(()=>{rr();}).catch(()=>{});
  _nudgeLoad().then(()=>{rr();}).catch(()=>{});

  // ── Personal drafts (defensive targeted-load pattern: a missing or
  //    RLS-locked table logs a warning and leaves the local array as-is). ──
  [   ['drafts','drafts',_mDraft,(q)=>q.eq('user_id',S.uid)]].forEach(([tbl,key,map,scope])=>{
    let _q=sb.from(tbl).select('*');if(scope)_q=scope(_q);
    _q.then(({data,error})=>{
      if(error){console.warn('['+tbl+'] load skipped:',error.message);return;}
      DB[key]=map(data);saveDB();rr();
    }).catch(e=>console.warn('['+tbl+'] fetch failed:',e.message));
  });

  // ── Workspace-level config: the per-user HR blob (which carries roleProfileId), the shared
  //    role bundles and the notification switches. Runs async (non-blocking) so a slow or locked
  //    table never stalls the rest of the app. The _savedHrm snapshot above already protects
  //    per-user u.hrm; user_hrm is re-merged the same way below. ──
  Promise.allSettled([
    sb.from('hrm_config').select('*').eq('id',_HRM_CFG_ID).maybeSingle(),
    ((can('employees','edit')||can('accessControl','manage')||isHR())?sb.from('user_hrm').select('*'):sb.from('user_hrm').select('*').eq('user_id',S.uid)),
    // Role profiles are read for EVERY user (workspace_settings is read-all-authenticated) so permissions resolve.
    sb.from('workspace_settings').select('value').eq('key','role_profiles').maybeSingle(),
    sb.from('workspace_settings').select('value').eq('key','hrm_notif_prefs').maybeSingle(),
  ]).then(res=>{
    const [cfg,uh,rp,np]=res;
    if(cfg.status==='fulfilled'&&!cfg.value.error&&cfg.value.data)_applyHrmConfig(cfg.value.data);
    // user_hrm: re-merge the server blob onto DB.users, then re-run _ensureHrm so any missing
    //   defaults are backfilled. Never overwrites a user the query didn't return.
    if(uh.status==='fulfilled'&&!uh.value.error&&Array.isArray(uh.value.data)){
      const byId={};uh.value.data.forEach(r=>{if(r&&r.user_id&&r.hrm&&typeof r.hrm==='object')byId[r.user_id]=r.hrm;});
      DB.users.forEach(u=>{if(byId[u.id])u.hrm=byId[u.id];_ensureHrm(u);});
      _permsV3Migrate(); // perms v3: assign roles + translate legacy personal grants
      _permsMicroMigrate(); // perms v10: expand umbrella actions into the per-operation toggles
    }
    // Role profiles: the server is the source of truth for the shared set; merge over the local
    //   copy so an admin's edits (and the seeded built-ins) reach every device. Re-seed afterward
    //   so a missing built-in preset is restored without clobbering server-customised ones.
    if(rp&&rp.status==='fulfilled'&&!rp.value.error&&rp.value.data&&rp.value.data.value&&typeof rp.value.data.value==='object'){
      DB.roleProfiles={...(DB.roleProfiles||{}),...rp.value.data.value};
      _seedRoleProfiles();
    }
    // Notification prefs: merge saved values over defaults (missing keys stay default-on).
    if(np&&np.status==='fulfilled'&&!np.value.error&&np.value.data&&np.value.data.value&&typeof np.value.data.value==='object'){
      DB.hrmNotifPrefs={..._hrmNotifPrefsDefault(),...np.value.data.value};
    }
    saveDB();rr();
  }).catch(e=>console.warn('[config] load failed:',e.message));
}
/* PHASE3-FIX: combine several push promises into one _safeUp-shaped result ({error?}). */
const _syncMerge=(ps)=>ps.length?Promise.allSettled(ps).then(rs=>{for(const r of rs){const e=r.status==='rejected'?r.reason:(r.value&&r.value.error);if(e)return{error:e};}return{};}):Promise.resolve({});
/* PHASE3-FIX: a batched upsert with the SAME id twice = Postgres 21000 ("cannot affect row a second
   time") and the whole batch fails. Deterministic ids (deadline alerts) can duplicate locally. */
const _dedupeById=(rows,key)=>{const k=key||'id';const seen=new Set();return rows.filter(r=>seen.has(r[k])?false:(seen.add(r[k]),true));};
async function _sync(){try{
  if(!S.uid)return; // PHASE3-FIX: never sync while logged out — anon pushes only produce RLS-rejection toasts on the login screen
  // PHASE4-FIX: never push with a stale/absent token. Chrome throttles background tabs, the JWT's
  // auto-refresh window gets missed, and pushes then run as anon → 42501 on random tables → scary
  // toasts. Refresh first; if there is STILL no session, skip quietly — everything stays queued in
  // localStorage and the next sync (after refocus/re-login) delivers it.
  try{
    let {data:{session:_ss}}=await sb.auth.getSession();
    if(!_ss||(((_ss.expires_at||0)*1000)-Date.now())<60000){const _rr2=await sb.auth.refreshSession();_ss=_rr2&&_rr2.data&&_rr2.data.session;}
    if(!_ss)return;
  }catch(e){return;}
  const results=await Promise.allSettled([
    _safeUp('departments',(can('departments','create')||can('departments','edit')?DB.departments:[]).map(d=>({id:d.id,name:d.name,parent_id:d.parentId||null})),{onConflict:'id'}),
    _safeUp('locations',(can('locations','edit')||can('locations','manage')||can('locations','create')?DB.locations:[]).map(l=>({id:l.id,name:l.name,address:l.address||'',department:l.department||'',status:l.status||'Active'})),{onConflict:'id'}),
    _safeUp('checklists',(can('checklists','create')||can('checklists','edit')?DB.checklists:[]).map(c=>({id:c.id,name:c.name,description:c.description||'',department:c.department||'',frequency:c.frequency||'Daily',schedule:c.schedule||'',selected_days:c.selectedDays||[],selected_dates:c.selectedDates||[],custom_dates:c.customDates||[],start_date:c.startDate||null,end_date:c.endDate||null,location_ids:c.locationIds||[],assignees:c.assignees||[],tasks:c.tasks||[],question_ids:c.questionIds||[],question_configs:c.questionConfigs||{},schedule_time:c.scheduleTime||null,status:c.status||'Active',any_one:c.anyOne||false,created_by:c.createdBy||null})),{onConflict:'id'}),
    _safeUp('submissions',DB.submissions.filter(x=>x.userId===S.uid||can('checklists','approve')).map(s=>({id:s.id,checklist_id:s.checklistId,user_id:s.userId,date:s.date,status:s.status,submitted_at:s.submittedAt||null,tasks:s.tasks||[],question_responses:s.questionResponses||[],edit_count:s.editCount||0,edit_history:s.editHistory||[]})),{onConflict:'id'}),
    _safeUp('approvals',DB.approvals.filter(a=>a.requesterId===S.uid||can('checklists','approve')||isAdmin()||isHR()).map(a=>({id:a.id,type:a.type||'Submission',requester_id:a.requesterId,checklist_id:a.checklistId||null,date:a.date||null,status:a.status,note:a.note||'',is_resubmit:a.isResubmit||false,used_at:a.usedAt||null})),{onConflict:'id'}),
    _safeUp('audit_logs',DB.audit.slice(0,200).map(l=>({id:l.id,actor:l.actor,action:l.action,target:l.target||''})),{onConflict:'id',ignoreDuplicates:true}),
    /* PHASE3-FIX: RLS n_i allows INSERTing a notification for anyone, but n_u only allows UPDATING your
       own rows. A plain upsert of an already-delivered foreign row hits the UPDATE path and 403s the whole
       batch. Split: own rows upsert normally (read-flags sync); foreign rows insert with DO NOTHING on
       conflict (delivery works, re-pushes are no-ops, never evaluates the UPDATE policy). */
    (()=>{const _nRow=n=>({id:n.id,user_id:n.userId,text:n.text,read:n.read||false,created_at:n.time||new Date().toISOString(),kind:n.kind||null,target_route:n.targetRoute||null});
      const _dead=new Set(DB.notifications_deleted||[]); // R7: never re-push a deleted alert
      const mine=DB.notifications.filter(n=>!_dead.has(n.id)&&(n.userId===S.uid||isAdmin()));
      const ps=[];if(mine.length)ps.push(_safeUp('notifications',_dedupeById(mine.map(_nRow)),{onConflict:'id'}));
      /* R16 CRITICAL (found in deep live testing): the previous foreign push used
         upsert({ignoreDuplicates:true}). PostgREST STILL evaluates the UPDATE (n_u) WITH CHECK on any
         upsert — and n_u only allows user_id=self OR _is_super(). So a non-super-admin (SubAdmin,
         manager, HR, or employee) creating a notification for ANOTHER user — announcement fan-out,
         "leave approved", checklist/ticket assignment, etc. — was 403'd and the recipient NEVER got the
         bell. Verified live: plain .insert() for another user PASSES the n_i policy; only the upsert
         path failed. Fix: push foreign rows with a plain INSERT (n_i = true for everyone), and remember
         which ids were delivered this session so re-pushes don't duplicate-key. Foreign rows are never
         reloaded into this client's memory (boot filters notifications to user_id=self), so the
         in-session set is all we need. */
      window._nfSent=window._nfSent||new Set();
      const foreign=DB.notifications.filter(n=>!_dead.has(n.id)&&!(n.userId===S.uid||isAdmin())&&!window._nfSent.has(n.id));
      if(foreign.length){const rows=_dedupeById(foreign.map(_nRow));
        ps.push(sb.from('notifications').insert(rows)
          .then(({error})=>{ if(!error||error.code==='23505'){rows.forEach(r=>window._nfSent.add(r.id));return{};} return{error}; })
          .catch(e=>({error:e})));}
      return _syncMerge(ps);})(),
    /* PHASE3-FIX: RLS fb_i (INSERT) = manager|elevated|hr, fb_u (UPDATE) adds user_id. Upserting the
       employee's own (manager-created) rows fails the INSERT check — split like tickets. */
    (()=>{const _fbRow=fb=>({id:fb.id,checklist_id:fb.checklistId||null,user_id:fb.userId,manager_id:fb.managerId,date:fb.date||null,title:fb.title||null,type:fb.type||'General',text:fb.text||'',priority:fb.priority||'Low',task_name:fb.taskName||null,level:fb.level||'direct',status:fb.status||'Sent',acknowledged:fb.acknowledged||false,acknowledged_at:fb.acknowledgedAt||null,reply:fb.reply||null,replied_at:fb.repliedAt||null,replies:fb.replies||[],created_at:fb.createdAt||new Date().toISOString()});
      const canIns=fb=>fb.managerId===S.uid||isAdmin()||isHR();
      const ins=(DB.feedback||[]).filter(canIns);
      const updOnly=(DB.feedback||[]).filter(fb=>!canIns(fb)&&fb.userId===S.uid);
      const ps=[];if(ins.length)ps.push(_safeUp('feedback',_dedupeById(ins.map(_fbRow)),{onConflict:'id'}));
      updOnly.forEach(fb=>ps.push(sb.from('feedback').update(_fbRow(fb)).eq('id',fb.id)));
      return _syncMerge(ps);})(),
    _safeUp('questions',((can('questions','create')||can('questions','edit')||can('questions','delete')||can('questions','import'))?(DB.questions||[]):[]).map(q=>({id:q.id,text:q.text||'',type:q.type||'answer',options:q.options||[],photo:q.photo||false,approval:q.approval||false,comment:q.comment||false,is_public:q.isPublic!==false,department:q.department||'',sub_department:q.subDepartment||'',created_by:q.createdBy||null,created_at:q.createdAt||new Date().toISOString()})),{onConflict:'id'}),
    /* PHASE3-FIX: RLS tk_i (INSERT) = created_by|manage|elevated, tk_u (UPDATE) adds assigned_to. An
       upsert must pass the INSERT check even for existing rows, so an assignee-only row 403s the whole
       batch (and submitter-only rows are not writable at all). Split: insertable rows upsert; rows the
       user can only UPDATE (assigned to them) go as per-row updates; submitter-only rows are skipped. */
    (()=>{if(!DB.tickets||!DB.tickets.length)return Promise.resolve({});
      const _tRow=t=>({id:t.id,title:t.title||'',description:t.description||'',priority:t.priority||'Medium',status:t.status||'Open',assigned_to:t.assignedTo||null,created_by:t.createdBy||null,checklist_id:t.checklistId||null,question_id:t.questionId||null,question_text:t.questionText||'',answer_given:t.answerGiven||'',submitter_id:t.submitterId||null,date:t.date||null,created_at:t.createdAt||new Date().toISOString(),resolved_at:t.resolvedAt||null,resolve_note:t.resolveNote||'',viewed_by:t.viewedBy||[]});
      const canIns=t=>t.createdBy===S.uid||can('tickets','changeStatus')||can('tickets','resolve')||can('tickets','delete')||isAdmin();
      const ins=DB.tickets.filter(canIns);
      const updOnly=DB.tickets.filter(t=>!canIns(t)&&t.assignedTo===S.uid);
      const ps=[];if(ins.length)ps.push(_safeUp('tickets',_dedupeById(ins.map(_tRow)),{onConflict:'id'}));
      updOnly.forEach(t=>ps.push(sb.from('tickets').update(_tRow(t)).eq('id',t.id)));
      return _syncMerge(ps);})(),
    // user_hrm: per-user blob. Strip base64 personalDocs.dataUrl (mirrors saveDB's photo stripping) so the row stays small.
    ((DB.users&&DB.users.length)?_safeUp('user_hrm',DB.users.filter(u=>u.hrm&&(u.id===S.uid||can('employees','edit')||can('accessControl','manage'))).map(u=>({user_id:u.id,hrm:_hrmStrip(u.hrm),updated_at:new Date().toISOString()})),{onConflict:'user_id'}):Promise.resolve()),
    // B2b: role profiles (permission bundles) sync via workspace_settings (key 'role_profiles', jsonb).
    //   WRITE is gated on isAdmin() — only the Super Admin edits Access Control (mirrors workspace_settings
    //   RLS write-elevated + M1 reference-table gating) so ordinary users never fire rejected upserts.
    //   READ happens for everyone in loadFromSB so each user's can() resolves against the latest profiles.
    ((can('accessControl','manage')&&DB.roleProfiles&&Object.keys(DB.roleProfiles).length)?_safeUp('workspace_settings',{key:'role_profiles',value:DB.roleProfiles,updated_at:new Date().toISOString()},{onConflict:'key'}):Promise.resolve()),
  ]);
  // C1: surface persistence failures (RLS rejections / network) to the user, debounced. Labels MUST
  //   match the upsert order above. Resolved-Promise placeholders (gated/empty tables) report no error.
  //   (Announcements, drafts and the notification switches are NOT in this batch — they use
  //   targeted writes at save time, so a stale whole-table upsert can never clobber them.)
  _reportSyncResults(results,['departments','locations','checklists','submissions','approvals','audit log','notifications','feedback','questions','tickets','employee HR data','role profiles']);
}catch(e){console.warn('[Evarca sync error]',e.message);}}
/* ── Targeted writers: one row (or a batch) at save time, outside the debounced _sync batch. ── */
function _pushRow(table,row,label){sb.from(table).upsert(row,{onConflict:'id'}).then(({error})=>{if(error)_syncErr(label)(error);}).catch(_syncErr(label));}
/* R19 (found in final testing): pushing N rows as N separate _pushRow calls in a forEach fired a burst
   of concurrent upserts — under load some silently failed, so a payroll draft persisted only 16 of 24
   lines and the user saw a scary "you may not have permission" toast. _pushRows sends the whole array
   in ONE upsert: atomic on the wire, one round-trip, all-or-nothing error handling. */
function _pushRows(table,rows,label){if(!Array.isArray(rows)||!rows.length)return Promise.resolve({});return sb.from(table).upsert(rows,{onConflict:'id'}).then(({error})=>{if(error)_syncErr(label)(error);return{error};}).catch(e=>{_syncErr(label)(e);return{error:e};});}
function _delRow(table,id,label){sb.from(table).delete().eq('id',id).then(({error})=>{if(error)_syncErr(label)(error);}).catch(_syncErr(label));}

// queueEmail stub — wire up to your email provider (Resend, SendGrid etc.)
/* === EMAIL CONNECTION POINT (backend wires sendEmail) ===
   This is the SINGLE place real email sending connects. Callers (incl. all hrm_* events)
   gate themselves on DB.hrmNotifPrefs via _hnpEmail(...) BEFORE calling queueEmail. The backend
   completes delivery by implementing/replacing sendEmail. No backend network call is added here. */
function queueEmail(eventKey,userId,clId,date,vars){
  // sendEmail is defined later in the file but called here — JS hoisting handles async functions
  if(typeof sendEmail==='function'){
    sendEmail(eventKey,userId,vars||{}).catch(e=>console.warn('[queueEmail] sendEmail failed:',e.message));
  }
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._safeUp=_safeUp;window._isRlsErr=_isRlsErr;window._syncErr=_syncErr;window._opErr=_opErr;window._reportSyncResults=_reportSyncResults;window.SB_URL=SB_URL;window.SB_ANON=SB_ANON;window.sb=sb;window._unesc=_unesc;window._mU=_mU;window._mC=_mC;window._mS=_mS;window._mA=_mA;window._DAY_MS=_DAY_MS;window._cutoff30ISO=_cutoff30ISO;window._cutoff30Date=_cutoff30Date;window._mapTk=_mapTk;window._roleCtx=_roleCtx;window._applySubmissions=_applySubmissions;window._applyApprovals=_applyApprovals;window._applyNotifications=_applyNotifications;window._applyFeedback=_applyFeedback;window._applyTickets=_applyTickets;window._HRM_CFG_ID=_HRM_CFG_ID;window._applyHrmConfig=_applyHrmConfig;window._pushNotifKinds=_pushNotifKinds;window._hrmStrip=_hrmStrip;window._syncBar=_syncBar;window._anyLoading=_anyLoading;window._isLoading=_isLoading;window._tabLoading=_tabLoading;window._lazyLoad=_lazyLoad;window._lazyLoadDate=_lazyLoadDate;window._lazyForRoute=_lazyForRoute;window._lazyCold=_lazyCold;window._startRealtime=_startRealtime;window.loadFromSB=loadFromSB;window._sync=_sync;window._pushRow=_pushRow;window._pushRows=_pushRows;window._delRow=_delRow;window._mDraft=_mDraft;window._draftRow=_draftRow;window.queueEmail=queueEmail;
