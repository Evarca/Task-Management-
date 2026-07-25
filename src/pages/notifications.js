



function _feedbackTabContent(uid){
  const myFb=DB.feedback.filter(fb=>fb.userId===uid).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!myFb.length)return empty('msg','No feedback yet','Feedback from your manager appears here.');
  return'<div style="display:flex;flex-direction:column;gap:10px">'+myFb.map(fb=>{
    const mgr=uById(fb.managerId);const cl=clById(fb.checklistId);
    const bc=fb.acknowledged?'#E5E7EB':'#BFDBFE';
    const priClr=fb.priority==='High'||fb.priority==='Critical'?'#DC2626':'#92400E';
    const priBg=fb.priority==='High'||fb.priority==='Critical'?'#FEE2E2':'#FEF9C3';
    return'<div style="background:#fff;border-radius:16px;border:1px solid '+bc+';padding:16px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div>'
      +'<div style="font-size:14px;font-weight:700">'+(cl?esc(cl.name):'General feedback')+'</div>'
      +'<div style="font-size:12px;color:#9CA3AF;margin-top:2px">From '+(mgr?esc(fullName(mgr)):'Manager')+(fb.date||fb.createdAt?' &middot; '+fmtD((fb.date||fb.createdAt||'').slice(0,10)):'')+'</div>'
      +'</div>'
      +(fb.priority&&fb.priority!=='Low'?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+priBg+';color:'+priClr+'">'+fb.priority+'</span>':'')
      +'</div>'
      +'<p style="font-size:13px;line-height:1.6;margin:0 0 10px">'+esc(fb.text)+'</p>'
      +(fb.reply?'<div style="background:#F0FDF4;border-radius:10px;padding:10px 12px;margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:#059669;margin-bottom:4px">Your reply</div><p style="font-size:13px;color:#374151;margin:0">'+esc(fb.reply)+'</p></div>':'')
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +(!fb.acknowledged?'<button onclick="App._ackFb(this.dataset.id)" data-id="'+fb.id+'" style="padding:6px 14px;border-radius:8px;background:#1D4ED8;color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer">Acknowledge</button>':'<span style="font-size:12px;font-weight:600;color:#0E9F6E">&#10003; Acknowledged</span>')
      +(!fb.reply?'<button onclick="App._replyFb(this.dataset.id)" data-id="'+fb.id+'" style="padding:6px 14px;border-radius:8px;background:#F3F4F6;color:#374151;font-size:12px;font-weight:600;border:none;cursor:pointer">Reply</button>':'')
      +((fb.managerId===S.uid||isAdmin()||isHR())?'<button onclick="App._delFeedback(this.dataset.id)" data-id="'+fb.id+'" title="Delete this feedback" style="padding:6px 14px;border-radius:8px;background:#FFF1F2;color:#BE123C;font-size:12px;font-weight:600;border:none;cursor:pointer">Delete</button>':'')
      +'</div></div>';
  }).join('')+'</div>';
}


function notificationsPage(){
  const uid=S.uid;
  const notifs=DB.notifications.filter(n=>n.userId===uid).sort((a,b)=>(b.time||'').localeCompare(a.time||'')).slice(0,80);
  // Track which were unread BEFORE marking them (so the dot shows on this render)
  const unreadIds=new Set(notifs.filter(n=>!n.read).map(n=>n.id));
  const hadUnread=unreadIds.size>0;
  // A1: opening the inbox must NOT mark everything read. Single-row reads happen on tap
  //     (App._notifClick → _markNotifRead); a whole-list flip is only via "Mark all read".
  // Feedback for this user
  const myFb=DB.feedback.filter(fb=>fb.userId===uid).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const unackFb=myFb.filter(fb=>!fb.acknowledged);

  const tab=S.filters.ntab||'All';
  const TABS=['All','Approvals','Escalations','Feedback'];

  function notifType(text,kind){
    // N7/E2: prefer the structured kind; fall back to text matching for legacy kind-less rows.
    if(kind){
      const K={feedback:'feedback',escalation:'escalation',ticket:'escalation',
        submission:'approval',edit:'edit',document:'approval',leave:'approval'};
      if(K[kind])return K[kind];
    }
    if(!text)return'general';
    if(text.includes('💬')||text.includes('replied')||text.includes('reply'))return'feedback';
    if(text.includes('Feedback')||text.includes('feedback'))return'feedback';
    
    if(text.includes('Escalation')||text.includes('escalation'))return'escalation';
    if(text.includes('Approved')||text.includes('approved'))return'approval';
    if(text.includes('Rejected')||text.includes('rejected'))return'approval';
    if(text.includes('pproval')||text.includes('pprove'))return'approval';
    if(text.includes('Edit')||text.includes('edit request')||text.includes('resubmit'))return'edit';
    if(text.includes('Re-submitted')||text.includes('Resubmit'))return'edit';
    if(text.includes('overdue')||text.includes('Late')||text.includes('late'))return'late';
    return'general';
  }
  const TYPE_CLR={approval:'#8B5CF6',edit:'#0EA5E9',escalation:'#F97316',feedback:'#3B82F6',late:'#EF4444',general:'#6B7280'};
  const TYPE_BG={approval:'#EDE9FE',edit:'#E0F2FE',escalation:'#FFF7ED',feedback:'#EFF6FF',late:'#FEF2F2',general:'#F6F7F8'};
  const TYPE_ICON={approval:'approve',edit:'edit',escalation:'alert',feedback:'msg',late:'clock',general:'bell'};

  const filteredNotifs=tab==='All'?notifs
    :tab==='Approvals'?notifs.filter(n=>['approval','edit'].includes(notifType(n.text,n.kind)))
    :tab==='Feedback'?notifs.filter(n=>notifType(n.text,n.kind)==='feedback')
    :tab==='Escalations'?notifs.filter(n=>notifType(n.text,n.kind)==='escalation')
    :notifs;

  const counts={
    All:notifs.length,
    Approvals:notifs.filter(n=>['approval','edit'].includes(notifType(n.text,n.kind))).length,
    Escalations:notifs.filter(n=>notifType(n.text,n.kind)==='escalation').length,
    Feedback:notifs.filter(n=>notifType(n.text,n.kind)==='feedback').length+myFb.filter(fb=>!fb.acknowledged).length,

  };

  return '<div class="fade">'+hdr('Alerts','Updates, reminders and everything sent to you')
    // A1: explicit "Mark all read" — the ONLY whole-list flip. Shown only when unread exist.
    // Owner request: "Clear all" deletes every alert (own rows only; confirmed).
    +'<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
      +'<button class="ui-btn ui-btn-subtle ui-btn-sm" title="Fetch alerts older than a week (cold archive)" onclick="App._loadOlderAlerts()">'+ic('clock','w-4 h-4')+'Load older</button>'
      +(hadUnread?'<button class="ui-btn ui-btn-subtle ui-btn-sm" onclick="App._markAllNotifsRead()">'+ic('approve','w-4 h-4')+'Mark all read</button>':'')
      +(notifs.length?'<button class="ui-btn ui-btn-subtle ui-btn-sm" style="color:var(--c-danger-ink)" onclick="App._clearAllNotifs()">'+ic('trash','w-4 h-4')+'Clear all</button>':'')
      +'</div>'
    // Tabs
    +'<div class="ui-tabs" style="margin-bottom:16px">'
    +TABS.map(t=>{
      const active=tab===t;
      const cb=counts[t]?(' <span style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;padding:1px 6px;min-width:16px;border-radius:99px;margin-left:6px;background:'+(active?'rgba(255,255,255,.22)':'var(--c-border)')+';color:'+(active?'#fff':'var(--c-text-2)')+'">'+counts[t]+'</span>'):'';
      return '<button class="ui-tab'+(active?' on':'')+'" onclick="App._setNTab(this.dataset.t)" data-t="'+t+'">'+t+cb+'</button>';
    }).join('')
    +'</div>'
    // Feedback section (when tab=Feedback)
    +(tab==='Feedback'
      ? _feedbackTabContent(uid)
      // Notification timeline for other tabs
      : (filteredNotifs.length
        ? '<div style="background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden">'
          +'<div style="display:flex;flex-direction:column">'
          +filteredNotifs.map((n,idx)=>{
              const type=notifType(n.text,n.kind);
              const clr=TYPE_CLR[type];const bg=TYPE_BG[type];const ico=TYPE_ICON[type];
              const isNew=unreadIds.has(n.id);
              // Parse deep-link target from notification text
              return '<div style="display:flex;align-items:flex-start;gap:12px;padding:13px 16px;border-bottom:1px solid #F9F8F5;cursor:pointer;'+(isNew?'background:#FAFFFE':'background:#fff')+'" onclick="App._notifClick(this.dataset.id)" data-id="'+n.id+'">'
                +'<div style="width:36px;height:36px;border-radius:10px;background:'+bg+';display:grid;place-items:center;flex-shrink:0;margin-top:1px">'+ic(ico,'w-4 h-4 text-['+clr+']')+'</div>'
                +'<div style="flex:1;min-width:0">'
                +'<p style="font-size:13px;color:#111110;margin:0;line-height:1.5;font-weight:'+(isNew?'600':'400')+'">'+esc(n.text)+'</p>'
                +'<p style="font-size:11px;color:#B8B5AC;margin-top:3px">'+(n.time?new Date(n.time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'')+' · '+type.charAt(0).toUpperCase()+type.slice(1)+'</p>'
                +'</div>'
                +(isNew?'<div style="width:7px;height:7px;border-radius:50%;background:#0E9F6E;flex-shrink:0;margin-top:6px"></div>':'')
                +'<button onclick="event.stopPropagation();App._delNotif(this.dataset.id)" data-id="'+n.id+'" title="Delete this alert" aria-label="Delete this alert" style="width:26px;height:26px;display:grid;place-items:center;border-radius:7px;border:none;background:transparent;color:#C8C5BD;cursor:pointer;flex-shrink:0" onmouseover="this.style.color=\'#BE123C\'" onmouseout="this.style.color=\'#C8C5BD\'">'+ic('x','w-3.5 h-3.5')+'</button>'
                +'</div>';
            }).join('')
          +'</div></div>'
        : (_isLoading('notifications')?loadingState('Loading notifications…'):empty('bell','All clear','No notifications yet.'))
      )
    )
    +'</div>';
}
App._setNTab=(t)=>{S.filters.ntab=t;rr();};
/* Owner request: delete one alert / clear all my alerts (server rows removed too — RLS: own rows). */
const _tomb=(key,ids)=>{DB[key]=DB[key]||[];ids.forEach(i=>{if(!DB[key].includes(i))DB[key].push(i);});if(DB[key].length>800)DB[key]=DB[key].slice(-800);};
App._delNotif=(id)=>{
  const n=(DB.notifications||[]).find(x=>x.id===id);if(!n||n.userId!==S.uid)return;
  DB.notifications=DB.notifications.filter(x=>x.id!==id);
  _tomb('notifications_deleted',[id]); // R7: never resurrect from a concurrent fetch/push
  _invalidateNotifCache();saveDB();rr();
  sb.from('notifications').delete().eq('id',id).then(()=>{}).catch(()=>{});
};
App._clearAllNotifs=()=>{
  const mine=(DB.notifications||[]).filter(n=>n.userId===S.uid);
  if(!mine.length)return;
  if(!confirm('Delete all '+mine.length+' of your alerts? This cannot be undone.'))return;
  _tomb('notifications_deleted',mine.map(n=>n.id)); // R7
  DB.notifications=DB.notifications.filter(n=>n.userId!==S.uid);
  _invalidateNotifCache();saveDB();toast('All alerts cleared','warn');rr();
  sb.from('notifications').delete().eq('user_id',S.uid).then(()=>{}).catch(()=>{});
};
/* Owner request: delete a feedback record — sender (manager), HR or admin only. Logged. */
App._delFeedback=(id)=>{
  const fb=(DB.feedback||[]).find(x=>x.id===id);if(!fb)return;
  if(!(fb.managerId===S.uid||isAdmin()||isHR())){toast('Only the sender, HR or an admin can delete feedback','err');return;}
  if(!confirm('Delete this feedback for both sides? This cannot be undone.'))return;
  DB.feedback=DB.feedback.filter(x=>x.id!==id);
  log(fullName(me()),'Deleted feedback',(uById(fb.userId)?fullName(uById(fb.userId)):'')+(fb.title?' · '+fb.title:''));
  saveDB();toast('Feedback deleted','warn');rr();
  sb.from('feedback').delete().eq('id',id).then(()=>{}).catch(()=>{});
};
// A1: mark ONE notification read with a targeted server write — never re-upsert the whole array.
function _markNotifRead(id){
  const n=DB.notifications.find(x=>x.id===id);if(!n||n.read)return;
  n.read=true;_invalidateNotifCache();saveDB();
  sb.from('notifications').update({read:true}).eq('id',id)
    .then(({error})=>{if(error)console.warn('[notif read]',error.message);})
    .catch(e=>console.warn('[notif read]',e.message));
}
App._markAllNotifsRead=()=>{
  const uid=S.uid;
  const mine=DB.notifications.filter(n=>n.userId===uid&&!n.read);
  if(!mine.length)return;
  mine.forEach(n=>n.read=true);
  _invalidateNotifCache();saveDB();
  // ONE scoped server-side update — no per-row map.
  sb.from('notifications').update({read:true}).eq('user_id',uid).eq('read',false)
    .then(({error})=>{if(error){console.warn('[notif mark-all]',error.message);toast("Couldn't sync — check your connection",'err');}})
    .catch(e=>{console.warn('[notif mark-all]',e.message);toast("Couldn't sync — check your connection",'err');});
  toast('All marked read');rr();
};
// Navigate to a route from a notification with a clean nav state, then set its filters.
function _navNotif(route,filters){
  S.route=route;S.search='';S.expandedCl=null;S.afOpen=null;S.tvUser=null;
  S.filters=filters||{};render();window.scrollTo(0,0);
}
// kind → target route map. Approval-NEEDED kinds land on the Approvals inbox; OUTCOME
// notifications carry an explicit n.targetRoute set at creation, which wins over this map.
// A kind or targetRoute belonging to a module this build doesn't ship (an older row, or one
// written by the full platform against the same database) falls through to the alert list
// rather than routing nowhere.
const _NOTIF_ROUTE={
  checklist:'mychecklists', submission:'mychecklists', submission_late:'teamview',
  approval:'approvals', ticket:'tickets', question:'questions',
  announcement:'announcements', feedback:'notifications', access:'profile',
  general:'notifications',
};
App._notifClick=(id)=>{
  const n=DB.notifications.find(x=>x.id===id);if(!n)return;
  _markNotifRead(id);
  const t=n.text||'';
  // ── 1. STRUCTURED routing FIRST (kind / targetRoute) — deterministic, runs before any text
  //    matching so e.g. a document "needs your approval" goes to Approvals, never to Leave. ──
  // 1a. explicit targetRoute (set at creation for decided/outcome notifs) wins outright.
  if(n.targetRoute){
    if(n.targetRoute==='feedback'){App._goNotifFeedback();return;}
    if(n.targetRoute==='approvals'){_navNotif('approvals',{atab:'Pending'});return;}
    if(!_RETIRED_ROUTES.includes(n.targetRoute)){App._setNTab&&App._setNTab('All');App.go(n.targetRoute);return;}
  }
  // 1b. structured kind → route map.
  if(n.kind&&_NOTIF_ROUTE[n.kind]){
    const r=_NOTIF_ROUTE[n.kind];
    if(r==='feedback'){App._goNotifFeedback();return;}
    if(r==='leave'){_navNotif('leave',{});return;}
    if(r==='approvals'){_navNotif('approvals',{atab:'Pending'});return;}
    App._setNTab&&App._setNTab('All');App.go(r);return;
  }
  // ── 2. TEXT FALLBACK (legacy rows without kind/targetRoute, incl. cross-device) ──
  if(t.includes('💬')||t.includes('replied')||t.includes('Feedback')){
    App._goNotifFeedback();return;
  }
  // Route tickets + escalations BEFORE the generic approved/approval checks so a ticket or
  // escalation whose text happens to contain those words still opens the Tickets page.
  if(t.includes('🎫')||t.includes('Ticket')||t.includes('ticket')){ App._setNTab&&App._setNTab('All');App.go('tickets'); return; }
  if(t.includes('Escalation')||t.includes('escalation')){ App._setNTab&&App._setNTab('All');App.go('tickets'); return; }
  if(t.includes('approved')||t.includes('Approved')){ _navNotif('approvals',{atab:'Approved'}); return; }
  if(t.includes('rejected')||t.includes('Rejected')){ _navNotif('approvals',{atab:'Rejected'}); return; }
  if(t.includes('approval')||t.includes('Pending')){ _navNotif('approvals',{atab:'Pending'}); return; }
  if(t.includes('submitted')||t.includes('resubmit')||t.includes('Re-submitted')){ _navNotif('approvals',{atab:'Pending'}); return; }
  if(t.includes('Checklist removed')||t.includes('no longer assigned')){ App.go('mychecklists'); return; }
  // Default: go to notifications
  App._setNTab('All');App.go('notifications');
};

App._replyFb=(id)=>{
  modalShell({title:'Reply to feedback',size:'max-w-sm',
    body:'<textarea id="rfb-t" rows="4" placeholder="Write your reply…" class="ui-input rf"></textarea>',
    footer:btnG('Cancel','App.closeModal()')
      +'<button type="button" onclick="App._saveReplyFb(this.dataset.id)" data-id="'+id+'" class="ui-btn ui-btn-primary">Send reply</button>'});
};
App._saveReplyFb=(id)=>{
  const text=$('#rfb-t')?.value?.trim();if(!text){toast('Write something first','err');return;}
  const fb=DB.feedback.find(x=>x.id===id);if(!fb)return;
  fb.reply=text;fb.status='Responded';fb.repliedAt=new Date().toISOString();
  fb.replies=fb.replies||[];
  fb.replies.push({text,from:S.uid,at:new Date().toISOString()});
  // Notify manager — text must contain 'Feedback reply' so notifType detects it
  const mgr=uById(fb.managerId);
  if(mgr&&_inappOn('feedback'))DB.notifications.unshift({id:uid('n'),userId:mgr.id,
    text:'💬 Feedback reply from '+fullName(me())+': "'+text.slice(0,60)+(text.length>60?'...':'')+'"',
    time:new Date().toISOString(),read:false,fbId:id,kind:'feedback'});
  _invalidateNotifCache();toast('Reply sent');closeModal();saveDB();render();
};

App._openSendFeedback=(userId)=>{
  const u=uById(userId);if(!u)return;
  // Store userId on App object (not window) — cleared when modal closes
  App._sfbCls=DB.checklists.filter(c=>(c.assignees||[]).includes(userId));
  const clOptions=App._sfbCls.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
  const _lbl='display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-2);margin-bottom:6px';
  modalShell({title:'Send Feedback',size:'max-w-md',
    body:''
    // User chip
    +'<div style="display:flex;align-items:center;gap:10px;background:var(--c-brand-soft);border:1px solid var(--c-brand);border-radius:12px;padding:10px 14px;margin-bottom:16px">'
    +avatar(u,'w-10 h-10','text-xs')
    +'<div><div style="font-size:14px;font-weight:700;color:var(--c-text)">'+esc(fullName(u))+'</div>'
    +'<div style="font-size:12px;color:var(--c-text-2)">'+esc(u.position||u.department)+'</div></div>'
    +'</div>'
    // Type selector
    +'<div style="margin-bottom:14px"><label style="'+_lbl+'">Feedback type</label>'
    +'<input type="hidden" id="sfb-type-val" value="General">'+'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
    +['General','Checklist','Performance'].map((t,i)=>'<button type="button" onclick="App._sfbSelectType(this)" data-type="'+t+'" style="padding:8px;border-radius:9px;border:1.5px solid '+(i===0?'#15171C':'#E5E7EB')+';background:'+(i===0?'#15171C':'#fff')+';color:'+(i===0?'#fff':'#6B7280')+';font-size:13px;font-weight:600;cursor:pointer">'+t+'</button>').join('')
    +'</div></div>'
    // Checklist dropdown
    +'<div id="sfb-cl-wrap" style="margin-bottom:14px"><label for="sfb-cl" style="'+_lbl+'">Checklist <span style="color:var(--c-text-3);text-transform:none;font-weight:400">(optional)</span></label>'
    +'<select id="sfb-cl" onchange="App._sfbClChange(this.value)" class="ui-select rf"><option value="">Select checklist…</option>'+clOptions+'</select></div>'
    // Priority + title in one row
    +'<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div><label for="sfb-title" style="'+_lbl+'">Title</label>'
    +'<input id="sfb-title" type="text" placeholder="e.g. Great work on opening" class="ui-input rf"/></div>'
    +'<div><label for="sfb-pri" style="'+_lbl+'">Priority</label>'
    +'<select id="sfb-pri" class="ui-select rf"><option>Low</option><option>Medium</option><option>High</option></select></div>'
    +'</div>'
    // Comment
    +'<div><label for="sfb-text" style="'+_lbl+'">Comment</label>'
    +'<textarea id="sfb-text" rows="4" placeholder="Write your feedback…" class="ui-input rf"></textarea></div>',
    footer:'<button type="button" onclick="App._saveSendFeedback(this.dataset.uid)" data-uid="'+userId+'" class="ui-btn ui-btn-primary" style="width:100%">Send feedback</button>'});
};
App._sfbSelectType=(btn)=>{
  document.querySelectorAll('[data-type]').forEach(b=>{
    const active=b===btn;
    b.style.background=active?'#15171C':'#fff';
    b.style.color=active?'#fff':'#6B7280';
    b.style.borderColor=active?'#15171C':'#E5E7EB';
  });
  const type=btn.dataset.type;
  // Store in hidden input for reliable reading
  const hid=document.getElementById('sfb-type-val');if(hid)hid.value=type;
  // Show/hide the checklist picker based on feedback type — use explicit wrapper ID
  const clWrap=document.getElementById('sfb-cl-wrap');
  if(clWrap)clWrap.style.display=(type==='Performance'||type==='General')?'none':'';
};
App._sfbClChange=(clId)=>{ /* no-op: kept for the checklist <select> onchange binding */ };
App._saveSendFeedback=(userId)=>{
  if(!userId){toast('No user selected','err');return;}
  const title=$('#sfb-title')?.value?.trim();
  const text=$('#sfb-text')?.value?.trim();
  if(!text){toast('Write a comment','err');return;}
  const clId=$('#sfb-cl')?.value||null;
  const type=(document.getElementById('sfb-type-val')?.value)||'General';
  const priority=$('#sfb-pri')?.value||'Low';
  if(!DB.feedback)DB.feedback=[];
  if(typeof queueEmail==='function')queueEmail('feedback_received',userId,clId||null,null,{from_name_person:fullName(me())});
  DB.feedback.push({
    id:uid('fb'),title:title||type+' Feedback',type,
    checklistId:clId||null,userId,managerId:S.uid,
    date:todayISO(),text,priority,taskName:taskName||null,
    level:'direct',acknowledged:false,status:'Sent',
    createdAt:new Date().toISOString()
  });
  if(_inappOn('feedback')&&(!_ns||_ns.inapp_feedback_received!==false))DB.notifications.unshift({id:uid('n'),userId,text:'Feedback from '+fullName(me())+': "'+( title||text.slice(0,40))+'"',time:new Date().toISOString(),read:false,kind:'feedback'});
  _invalidateNotifCache();log(fullName(me()),'Sent feedback',fullName(uById(userId)));
  toast('Feedback sent');closeModal();saveDB();render();
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._feedbackTabContent=_feedbackTabContent;window.notificationsPage=notificationsPage;window._markNotifRead=_markNotifRead;window._navNotif=_navNotif;window._NOTIF_ROUTE=_NOTIF_ROUTE;
