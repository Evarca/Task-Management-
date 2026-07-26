

App._clearOperational=()=>{
  const cats=[
    {key:'submissions',  label:'Submissions',    icon:'check', desc:'All checklist submission records',    count:()=>DB.submissions.length},
    {key:'checklists',   label:'Checklists',     icon:'list', desc:'All checklist configurations',        count:()=>DB.checklists.length},
    {key:'tickets',      label:'Tickets',        icon:'ticket', desc:'All escalation tickets',              count:()=>(DB.tickets||[]).length},
    {key:'approvals',    label:'Approvals',      icon:'approve', desc:'All approval requests',               count:()=>DB.approvals.length},
    {key:'notifications',label:'Notifications',  icon:'bell', desc:'All in-app notifications',            count:()=>DB.notifications.length},
    {key:'feedback',     label:'Feedback',       icon:'msg', desc:'All manager feedback',                count:()=>(DB.feedback||[]).length},
    {key:'questions',    label:'Questions',      icon:'help', desc:'Question library',                    count:()=>(DB.questions||[]).length},
    {key:'documents',    label:'Documents',      icon:'doc', desc:'Documents and folders',               count:()=>(DB.documents||[]).length},
    {key:'audit',        label:'Audit logs',     icon:'audit', desc:'System audit trail',                  count:()=>(DB.audit||[]).length},
    {key:'users',        label:'Users (except you)', icon:'users', desc:'All user accounts except yours', count:()=>DB.users.filter(u=>u.id!==S.uid).length},
  ];
  const rows=cats.map(cat=>{
    const n=cat.count();
    return '<label id="lbl-clr-'+cat.key+'" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;cursor:pointer;border:1.5px solid #F3F4F6;margin-bottom:6px;transition:all .12s" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">'
      +'<input type="checkbox" id="clr-'+cat.key+'" onchange="this.closest(\'label\').style.borderColor=this.checked?\'#EF4444\':\'#F3F4F6\'" style="width:17px;height:17px;accent-color:#EF4444;cursor:pointer;flex-shrink:0"/>'
      +'<span style="display:grid;place-items:center;color:#6B7280;flex-shrink:0">'+ic(cat.icon,'w-5 h-5')+'</span>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:700;color:#15171C">'+cat.label+'</div>'
      +'<div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+cat.desc+'</div>'
      +'</div>'
      +'<span style="font-size:12px;font-weight:800;background:'+(n?'#FEF2F2':'#F6F7F8')+';color:'+(n?'#DC2626':'#9CA3AF')+';padding:3px 9px;border-radius:20px;flex-shrink:0">'+n+' records</span>'
      +'</label>';
  }).join('');

  openModal(
    '<div style="display:flex;flex-direction:column;max-height:88vh">'
    +'<div style="padding:18px 20px 14px;border-bottom:1px solid #F3F4F6;flex-shrink:0">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div><div style="display:flex;align-items:center;gap:7px;font-size:17px;font-weight:800;font-family:var(--font-display)">'+ic('broom','w-5 h-5')+'Clear Data</div>'
    +'<div style="font-size:12px;color:#9CA3AF;margin-top:2px">Select categories to permanently delete</div></div>'
    +'<button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x')+'</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=true;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#EF4444\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Select all</button>'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=false;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#F3F4F6\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Deselect all</button>'
    +'</div>'
    +'</div>'
    +'<div style="overflow-y:auto;flex:1;padding:14px 20px">'+rows+'</div>'
    +'<div style="padding:14px 20px;border-top:1px solid #F3F4F6;flex-shrink:0;display:flex;gap:10px">'
    +'<button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #E5E7EB;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>'
    +'<button onclick="App._execClear()" style="flex:2;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:12px;border-radius:12px;background:#EF4444;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">'+ic('trash','w-4 h-4')+'Delete selected</button>'
    +'</div>'
    +'</div>',
    'max-w-md'
  );
};

App._execClear=async()=>{
  const catMap={
    submissions: {local:()=>{DB.submissions=[];Object.keys(RUN).forEach(k=>delete RUN[k]);},table:'submissions'},
    checklists:  {local:()=>{DB.checklists=[];DB.checklists_deleted=[];},table:'checklists'},
    tickets:     {local:()=>{DB.tickets=[];},table:'tickets'},
    approvals:   {local:()=>{DB.approvals=[];},table:'approvals'},
    notifications:{local:()=>{DB.notifications=[];_invalidateNotifCache();},table:'notifications'},
    feedback:    {local:()=>{DB.feedback=[];},table:'feedback'},
    questions:   {local:()=>{DB.questions=[];DB.questions_deleted=[];},table:'questions'},
    documents:   {local:()=>{DB.documents=[];DB.folders=[];DB.documents_deleted=[];DB.folders_deleted=[];},table:'documents'},
    audit:       {local:()=>{DB.audit=[];},table:'audit_logs'},
    users:       {local:()=>{DB.users=DB.users.filter(u=>u.id===S.uid);},table:'profiles'},
  };
  const sel=Object.keys(catMap).filter(k=>document.getElementById('clr-'+k)?.checked);
  if(!sel.length){toast('Select at least one category','warn');return;}
  const labels=sel.map(k=>catMap[k].table).join(', ');
  if(!confirm('Permanently delete: '+labels+'?\n\nThis cannot be undone.'))return;
  closeModal();
  // Local deletion
  sel.forEach(k=>catMap[k].local());
  // Supabase deletion in background
  await Promise.allSettled(
    sel.map(k=>sb.from(catMap[k].table).delete().neq('id','00000000-0000-0000-0000-000000000000').then(()=>{}).catch(()=>{}))
  );
  log(fullName(me()),'Cleared data',labels);
  toast('Deleted: '+sel.length+' categor'+(sel.length===1?'y':'ies')+'','ok');
  saveDB();S.route='dashboard';render();
};

// ── Notification Settings (NS) — stored in workspace_settings table ──
const NS_LS='shiftly_ns_v2';

// Default templates — subject + body for every event type
// Variables: {{user_name}} {{checklist_name}} {{date}} {{status}} {{manager_name}} {{action_url}} {{app_url}}
const EMAIL_EVENTS=[
  {key:'checklist_assigned',label:'Checklist assigned',  vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_late',  label:'Submission late',       vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_approved',label:'Submission approved',vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_rejected',label:'Submission rejected',vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'approval_requested',label:'Approval requested',  vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'approval_decided', label:'Approval decided',     vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'feedback_received',label:'Feedback received',    vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'deadline_reminder',label:'Deadline reminder',    vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'waiting_client_stale',label:'Blocked on a client 3+ days', vars:'{{user_name}}, {{checklist_name}}, {{question}}, {{client_name}}, {{days}}, {{action_url}}'},
  {key:'client_nudge',     label:'Client reminder (sent to the CLIENT)', vars:'{{contact_name}}, {{client_name}}, {{checklist_name}}, {{question}}, {{from_name}}'},
  {key:'payment_recorded', label:'Payment recorded',     vars:'{{user_name}}, {{client_name}}, {{amount}}, {{action_url}}'},
  {key:'invoice_generated',label:'Invoice generated',    vars:'{{user_name}}, {{client_name}}, {{invoice_no}}, {{amount}}, {{action_url}}'},
  {key:'escalation',       label:'Escalation raised',    vars:'{{submitter}}, {{checklist_name}}, {{question}}, {{answer}}, {{action_url}}'},
  {key:'ticket_assigned',  label:'Ticket assigned',      vars:'{{user_name}}, {{ticket_title}}, {{action_url}}'},
  {key:'ticket_resolved',  label:'Ticket resolved',      vars:'{{user_name}}, {{ticket_title}}, {{action_url}}'},
];

function _defaultTemplates(){
  return{
    checklist_assigned:{subject:'📋 Checklist assigned: {{checklist_name}}',   body:'Hi {{user_name}},\n\nA checklist has been assigned to you: {{checklist_name}}\n\nOpen Evarca to complete it.\n\n{{action_url}}'},
    submission_late:  {subject:'⏰ Overdue checklist: {{checklist_name}}',        body:'Hi {{user_name}},\n\n{{employee_name}} has not submitted "{{checklist_name}}" and the deadline has now passed. Please follow up.\n\n{{action_url}}'},
    submission_approved:{subject:'✅ Submission approved: {{checklist_name}}',  body:'Hi {{user_name}},\n\nYour submission for {{checklist_name}} has been approved.\n\n{{action_url}}'},
    submission_rejected:{subject:'❌ Submission rejected: {{checklist_name}}',  body:'Hi {{user_name}},\n\nYour submission for {{checklist_name}} has been rejected. Please review and resubmit.\n\n{{action_url}}'},
    approval_requested:{subject:'🔔 Approval needed: {{checklist_name}}',      body:'Hi {{user_name}},\n\nAn approval is pending for {{checklist_name}}.\n\n{{action_url}}'},
    approval_decided: {subject:'Approval update: {{checklist_name}}',          body:'Hi {{user_name}},\n\nYour approval request for {{checklist_name}} has been decided.\n\n{{action_url}}'},
    feedback_received:{subject:'💬 New feedback received',                      body:'Hi {{user_name}},\n\nYou have received new feedback on {{checklist_name}}.\n\n{{action_url}}'},
    deadline_reminder:{subject:'⏳ Reminder: {{checklist_name}} deadline soon', body:'Hi {{user_name}},\n\nYour checklist {{checklist_name}} deadline is approaching soon. Please complete it before the cutoff.\n\n{{action_url}}'},
    waiting_client_stale:{subject:'⏳ Still waiting on {{client_name}} — {{days}} days', body:'Hi {{user_name}},\n\n"{{question}}" on {{checklist_name}} has been waiting on the client for {{days}} days. Consider nudging them from the client page.\n\n{{action_url}}'},
    client_nudge:{subject:'A quick reminder about your {{checklist_name}}',
      body:'Dear {{contact_name}},\n\nWe hope you are well. We are making good progress on your {{checklist_name}}, and there is one item we are currently waiting on from your side:\n\n    •  {{question}}\n\nSending it over at your earliest convenience keeps everything on schedule. If you have any questions, simply reply to this email.\n\nWarm regards,\n{{from_name}}'},
    payment_recorded:{subject:'💰 Payment recorded: {{amount}} — {{client_name}}', body:'Hi {{user_name}},\n\nA payment of {{amount}} was recorded for {{client_name}}.\n\n{{action_url}}'},
    invoice_generated:{subject:'🧾 Invoice {{invoice_no}} — {{client_name}}', body:'Hi {{user_name}},\n\nInvoice {{invoice_no}} ({{amount}}) was generated for {{client_name}}.\n\n{{action_url}}'},
    escalation:{subject:'⚠️ Escalation: {{checklist_name}}',                    body:'An escalation was raised on {{checklist_name}}.\n\nQuestion: {{question}}\nAnswer: {{answer}}\nRaised by: {{submitter}}\n\nOpen Evarca to follow up.\n\n{{action_url}}'},
    ticket_assigned:{subject:'🎫 Ticket assigned to you: {{ticket_title}}',    body:'Hi {{user_name}},\n\nA ticket has been assigned to you: {{ticket_title}}\n\n{{action_url}}'},
    ticket_resolved:{subject:'✅ Ticket resolved: {{ticket_title}}',           body:'Hi {{user_name}},\n\nThe ticket you raised has been resolved: {{ticket_title}}\n\n{{action_url}}'},
  };
}

function _nsDefault(){return{
  email_enabled:false,email_from_name:'Evarca',email_from_address:'',email_reminder_minutes:15,
  inapp_checklist_assigned:true,inapp_submission_submitted:true,
  inapp_submission_late:true,inapp_submission_approved:true,inapp_submission_rejected:true,
  inapp_approval_requested:true,inapp_approval_decided:true,
  inapp_feedback_received:true,inapp_deadline_reminder:true,inapp_escalation:true,inapp_ticket_assigned:true,inapp_ticket_resolved:true,inapp_waiting_client_stale:true,inapp_client_responded:true,inapp_payment_recorded:true,inapp_invoice_generated:true,
  email_checklist_assigned:true,email_submission_submitted:false,
  email_submission_late:true,email_submission_approved:true,email_submission_rejected:true,
  email_approval_requested:true,email_approval_decided:true,
  email_feedback_received:false,email_deadline_reminder:true,email_escalation:true,email_ticket_assigned:true,email_ticket_resolved:true,email_waiting_client_stale:true,email_client_responded:true,email_payment_recorded:false,email_invoice_generated:false,
  templates:{},
};}
window._ns=null;
async function _loadNS(){
  if(_ns)return _ns;
  try{const r=localStorage.getItem(NS_LS);if(r)_ns={..._nsDefault(),...JSON.parse(r)};}catch(e){}
  if(!_ns)_ns=_nsDefault();
  try{const{data,error:wsErr}=await sb.from('workspace_settings').select('value').eq('key','notification_settings').single();
      if(wsErr&&(wsErr.code==='42P01'||wsErr.message?.includes('does not exist'))){console.warn('workspace_settings table missing — using defaults');return _ns;}
    if(data?.value){
      const saved=data.value;
      _ns={..._nsDefault(),...saved};
      // Deep-merge templates — spread would overwrite entire templates obj with saved one, which is correct
      // but if saved has no templates key at all, restore empty object
      if(!_ns.templates)_ns.templates={};
      localStorage.setItem(NS_LS,JSON.stringify(_ns));
    }}catch(e){}
  return _ns;
}
async function _saveNS(){
  if(!_ns)return;
  localStorage.setItem(NS_LS,JSON.stringify(_ns));
  try{await sb.from('workspace_settings').upsert({key:'notification_settings',value:_ns,updated_at:new Date().toISOString()},{onConflict:'key'});}catch(e){console.warn('NS sync:',e.message);}
}

// ── Resolve template variables ──
function _fillTemplate(str, vars){
  return str.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]||'');
}

// ── Render plain text body as HTML — {{action_url}} line becomes a CTA button ──
function _bodyToHtml(fromName, bodyText, actionUrl=''){
  const safeName=String(fromName||'Evarca').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  const rawLines = bodyText.split('\n').map(l=>l.trim());
  // ctaUrl is passed in as 3rd arg — already the resolved URL
  let ctaUrl = actionUrl||'';
  // Strip: the {{action_url}} placeholder, the resolved URL itself (already a button), and any bare https line
  const lines = rawLines
    .filter(l=>l!=='{{action_url}}' && l!==ctaUrl && !/^https?:\/\//.test(l))
    .map(l=>l.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])));
  const ctaLabel=ctaUrl.includes('approvals')?'View Approvals'
    :ctaUrl.includes('mychecklists')?'Open My Checklists'
    :ctaUrl.includes('notifications')?'View Notifications'
    :ctaUrl.includes('settings')?'Open Settings'
    :ctaUrl.includes('analytics')?'View Analytics'
    :ctaUrl.includes('leave')?'View Leave'
    :'Open Evarca';
  return`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F7F6F2;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #ECEDF0;overflow:hidden">
    <div style="background:#15171C;padding:20px 28px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:8px;background:#0E9F6E;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff">${safeName}</span>
    </div>
    <div style="padding:28px">
      ${lines.filter(Boolean).map((l,i)=>i===0
        ?`<p style="font-size:15px;color:#374151;margin:0 0 16px">${l}</p>`
        :`<p style="font-size:14px;color:#6B7280;margin:0 0 8px;line-height:1.6">${l}</p>`
      ).join('')}
      ${ctaUrl?`<div style="margin-top:24px">
        <a href="${ctaUrl}" style="display:inline-block;background:#15171C;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">${ctaLabel} →</a>
        <p style="margin:10px 0 0;font-size:11px;color:#B8B5AC">Or copy: ${ctaUrl}</p>
      </div>`:''}
    </div>
    <div style="padding:16px 28px;background:#F9F8F5;border-top:1px solid #ECEDF0;font-size:11px;color:#9CA3AF">
      ${safeName} · Automated notification · Do not reply
    </div>
  </div></body></html>`;
}

// ── sendEmail: FAST — calls edge function directly, no queue, no extra DB round trip ──
async function sendEmail(eventType, userId, vars){
  const user = userId ? uById(userId) : null;
  if(!user?.email){console.warn('sendEmail: no email for user',userId);return;}
  // Requirement #4: per-user opt-out — skip if this user has email notifications turned off.
  if(user.emailEnabled===false){console.log('sendEmail: user opted out of emails',userId);return;}
  if(!_ns) await _loadNS();
  if(!_ns.email_enabled) return;
  if(_ns['email_'+eventType]===false) return;
  // Build app URL from current window location
  const appUrl = window.location.origin;
  // Each event type links to the most relevant page
  const routeMap = {
    checklist_assigned:'mychecklists',
    submission_late:'teamview', submission_approved:'mychecklists',
    submission_rejected:'mychecklists', approval_requested:'approvals',
    approval_decided:'mychecklists', /* employee-facing: their submission result lives in My Checklists */ feedback_received:'notifications',
    deadline_reminder:'mychecklists', waiting_client_stale:'locations', escalation:'tickets',
    ticket_assigned:'tickets', ticket_resolved:'tickets',
  };
  const actionUrl = appUrl + '/#' + (routeMap[eventType]||'');
  const allVars = {user_name:fullName(user), from_name:_ns.email_from_name||'Evarca', app_url:appUrl, action_url:actionUrl, ...vars};
  const defaults = _defaultTemplates();
  const tpl = {
    subject:(_ns.templates?.[eventType]?.subject)||defaults[eventType]?.subject||eventType,
    body:   (_ns.templates?.[eventType]?.body)   ||defaults[eventType]?.body   ||'',
  };
  const subject  = _fillTemplate(tpl.subject, allVars);
  const bodyHtml = _bodyToHtml(_ns.email_from_name, _fillTemplate(tpl.body, allVars), actionUrl);
  sb.functions.invoke('send-notification',{body:{
    to:user.email, from_name:_ns.email_from_name||'Evarca', subject, html:bodyHtml,
  }}).catch(e=>console.warn('sendEmail invoke failed:',e.message));
}


function _nsTogRow(key,label,desc){
  const on=_ns?(_ns[key]!==false):true;
  return`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #F5F4F0">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:#15171C">${label}</div>
      ${desc?`<div style="font-size:11px;color:#B8B5AC;margin-top:1px">${desc}</div>`:''}
    </div>
    <button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="App._nsTog(this,'${key}')"><span></span></button>
  </div>`;}
App._nsTog=async(btn,key)=>{
  if(!_ns)_ns=_nsDefault();
  const nowOn=btn.classList.contains('off');
  btn.classList.toggle('on',nowOn);btn.classList.toggle('off',!nowOn);
  btn.setAttribute('aria-checked',nowOn?'true':'false');
  _ns[key]=nowOn;await _saveNS();
};
App._nsSaveEmail=async()=>{
  if(!_ns)_ns=_nsDefault();
  const name=($('#ns-from-name')?.value||'').trim();
  const addr=($('#ns-from-addr')?.value||'').trim();
  const mins=parseInt($('#ns-reminder-mins')?.value||String(_ns.email_reminder_minutes||15),10)||15;
  if(!addr){toast('Enter a from email address','err');return;}
  if(!addr.includes('@')){toast('Enter a valid email address','err');return;}
  _ns.email_from_name=name||'Evarca';_ns.email_from_address=addr;
  _ns.email_reminder_minutes=Math.max(5,Math.min(120,mins));
  await _saveNS();toast('Saved');
};
App._testEmail=async()=>{
  if(!_ns) await _loadNS();
  const u=me();
  if(!u?.email){toast('Your user profile has no email address','err');return;}
  const btn=document.getElementById('ns-test-btn');
  if(btn){btn.disabled=true;btn.textContent='Sending…';}
  try{
    const appUrl=window.location.origin;
    const {error}=await sb.functions.invoke('send-notification',{body:{
      to: u.email,
      from_name: _ns.email_from_name||'Evarca',
      subject: '✅ Evarca test email',
      html: _bodyToHtml(_ns.email_from_name||'Evarca',
        'Hi '+u.firstName+',\n\nThis is a test email from Evarca.\n\nIf you received this, your email setup is working correctly. SMTP is connected and emails will be delivered to users based on their profile email address.',
        appUrl+'/#mychecklists'),
    }});
    if(error)throw new Error(error.message||'Function error');
    toast('Test email sent to '+u.email+'','ok');
  }catch(e){
    toast('Failed: '+e.message,'err');
    console.error('Test email error:',e);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Send test email';}
  }
};


function settingsPage(){
  // Workflow tab removed — its 4 toggles were never read by any code. Approval/edit behavior is
  // governed per-checklist and by Access Control. Stale stab==='workflow' falls back to 'inapp'.
  // Old sub-tab names ('inapp', 'email', 'hrmemail', 'workflow') all resolve to the one
  // Notifications tab that replaced them, so a stale link or bookmark still lands somewhere real.
  const _validTabs=['notif','templates'];
  const stab=_validTabs.includes(S.filters.stab)?S.filters.stab:'notif';
  if(!_ns){_loadNS().then(()=>rr());return`<div class="fade">${hdr('Settings','')}${loadingState('Loading settings…')}</div>`;}
  const ns=_ns;
  const TABS=[['notif','Notifications'],['templates','Templates']];
  const tabBar=`<div class="ui-tabs" style="margin-bottom:20px">${TABS.map(([k,ll])=>`<button class="ui-tab${stab===k?' on':''}" onclick="App._setSTab('${k}')">${ll}</button>`).join('')}</div>`;

  /* ── NOTIFICATIONS ──
     Rendered straight from NOTIF_EVENTS (engine/notifications.js), which is also what every
     send site keys off. Add an event there and it shows up here with working switches — there
     is no second list to keep in step, and nothing can appear here that does not actually fire. */
  const emailOn=ns.email_enabled!==false;
  const _evCell=(key,ch)=>{
    const e=_evByKey(key)||{};
    const on=ch==='inapp'?evInApp(key):ns['email_'+key]!==false;
    const call=`App._nsTog(this,'${ch}_${key}')`;
    return `<button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(e.label||key)} ${ch}" class="tog ${on?'on':'off'}" onclick="${call}"><span></span></button>`;
  };
  const notifTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F9F8F5;border-bottom:1px solid #F0EEE9;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:14px;font-weight:700">Notifications</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px">In-app is the bell. Email goes to the address on the person's account.</div>
        </div>
        <label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#374151">Email delivery
          <button role="switch" aria-checked="${emailOn?'true':'false'}" aria-label="Email delivery master switch" class="tog ${emailOn?'on':'off'}" onclick="App._nsTog(this,'email_enabled')"><span></span></button>
        </label>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#FCFCFB">
          <th style="text-align:left;padding:8px 20px;font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.06em">Event</th>
          <th style="width:88px;padding:8px;text-align:center;font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.06em">In-app</th>
          <th style="width:88px;padding:8px 20px 8px 8px;text-align:center;font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.06em">Email</th>
        </tr></thead>
        <tbody>
        ${NOTIF_GROUPS.map(g=>`
          <tr><td colspan="3" style="padding:11px 20px 4px;font-size:10px;font-weight:800;color:#B8B5AC;text-transform:uppercase;letter-spacing:.06em;background:#FCFCFB">${esc(g)}</td></tr>
          ${NOTIF_EVENTS.filter(e=>e.group===g).map(e=>`<tr style="border-top:1px solid #F5F4F0">
            <td style="padding:10px 20px"><div style="font-size:13px;font-weight:600;color:#15171C">${esc(e.label)}</div><div style="font-size:11px;color:#B8B5AC;margin-top:1px">Goes to: ${esc(e.who)}</div></td>
            <td style="padding:10px 8px;text-align:center">${_evCell(e.key,'inapp')}</td>
            <td style="padding:10px 20px 10px 8px;text-align:center">${_evCell(e.key,'email')}</td>
          </tr>`).join('')}
        `).join('')}
        </tbody>
      </table>
    </div>

    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
      <div style="font-size:14px;font-weight:700;margin-bottom:3px">Sender identity</div>
      <div style="font-size:12px;color:#9CA3AF;margin-bottom:12px">The name and address outgoing email is sent from.</div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="ns-from-name" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">From name</label>
          <input id="ns-from-name" value="${esc(ns.email_from_name||'Evarca')}" placeholder="Evarca" style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
        </div>
        <div>
          <label for="ns-from-addr" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">From address</label>
          <input id="ns-from-addr" value="${esc(ns.email_from_address||'')}" placeholder="no-reply@yourcompany.com" style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
        </div>
      </div>
      <div style="margin-top:12px">${btn('Save sender','App._nsSaveEmail()',{variant:'primary',size:'sm'})}</div>
    </div>
  </div>`;

  // ── TEMPLATES TAB ──
  const defaults=_defaultTemplates();
  const expandedTpl=S.filters.tplKey||null;
  const templatesTab=`<div class="space-y-2">
    <div style="padding:4px 0 10px">
      <div style="font-size:13px;color:#9CA3AF;line-height:1.6">
        Customise the subject and body for each email. Use these variables anywhere in your text:
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
          ${['{{user_name}}','{{checklist_name}}','{{date}}','{{status}}','{{manager_name}}','{{action_url}}','{{app_url}}'].map(v=>`<code style="background:#F5F4F0;border-radius:6px;padding:2px 8px;font-size:12px;color:#374151">${v}</code>`).join('')}
        </div>
      </div>
    </div>
    ${EMAIL_EVENTS.map(ev=>{
      const tpl={...(defaults[ev.key]||{}), ...(ns.templates?.[ev.key]||{})};
      const open=expandedTpl===ev.key;
      return`<div style="background:#fff;border-radius:14px;border:1.5px solid ${open?'#0E9F6E':'#ECEDF0'};overflow:hidden;transition:border-color .15s">
        <button onclick="S.filters.tplKey='${open?'':ev.key}';rr()"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:transparent;border:none;cursor:pointer;text-align:left">
          <div>
            <div style="font-size:13px;font-weight:700;color:#15171C">${ev.label}</div>
            <div style="font-size:11px;color:#B8B5AC;margin-top:1px">${ev.vars}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${(ns.templates?.[ev.key])?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#ECFDF5;color:#065F46">Custom</span>`:''}
            <span style="color:#B8B5AC;font-size:16px">${open?'▲':'▼'}</span>
          </div>
        </button>
        ${open?`<div style="padding:0 16px 16px;border-top:1px solid #F5F4F0">
          <div style="margin-bottom:10px">
            <label for="tpl-subj-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px;margin-top:12px">Subject</label>
            <input id="tpl-subj-${ev.key}" value="${esc(tpl.subject||'')}" placeholder="Email subject…"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
          <div>
            <label for="tpl-body-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">Body</label>
            <textarea id="tpl-body-${ev.key}" rows="6"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;resize:vertical;font-family:monospace;line-height:1.6" class="rf">${esc(tpl.body||'')}</textarea>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            ${btn('Reset to default',`App._resetTpl('${ev.key}')`,{variant:'ghost',size:'sm'})}
            ${btn('Save template',`App._saveTpl('${ev.key}')`,{variant:'primary',attrs:'style="flex:1"'})}
          </div>
        </div>`:''}
      </div>`;
    }).join('')}
  </div>`;

  App._saveTpl=async(key)=>{
    if(!_ns)_ns=_nsDefault();
    if(!_ns.templates)_ns.templates={};
    const subj=($('#tpl-subj-'+key)?.value||'').trim();
    const body=($('#tpl-body-'+key)?.value||'').trim();
    if(!subj||!body){toast('Subject and body required','err');return;}
    _ns.templates[key]={subject:subj,body};
    await _saveNS();
    toast('Template saved');rr();
  };
  App._resetTpl=async(key)=>{
    if(!_ns)_ns=_nsDefault();
    if(_ns.templates)delete _ns.templates[key];
    await _saveNS();
    toast('Reset to default');rr();
  };

  // (the Data tab — export / clear / reset — was removed on request; its helpers remain callable)

  const content=stab==='templates'?templatesTab:notifTab;
  return`<div class="fade">${hdr('Settings','')}${tabBar}${content}</div>`;
}

App._exportCSV=()=>{
  let subs=DB.submissions;if(!isAdmin()){const _sc=_reportScopeIds();subs=subs.filter(s=>_sc.has(s.userId));}
  const f=S.filters;const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  if(fArr('users').length)subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return fArr('deps').includes(c?.department);});
  if(fArr('locs').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return fArr('locs').some(l=>(c?.locationIds||[]).includes(l));});
  if(fArr('stats').length)subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1)subs=subs.filter(s=>s.date>=f.dr1);if(f.dr2)subs=subs.filter(s=>s.date<=f.dr2);
  const summaryRows=[['#','User','Email','Phone','Department','Position','Checklist','Dept','Client(s)','Date','Status','Submitted At','Edit Count','Pending Approval','Compliance','Escalations']];
  subs.forEach((s,i)=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return;if(!c&&!s.checklistDeleted)return;const clName=c?c.name:'[Deleted checklist]';const clDept=c?c.department||'':'';const clLocs=c?(c.locationIds||[]).map(id=>DB.locations.find(l=>l.id===id)?.name||'').join('; '):'';const _escN=(c&&(c.questionIds||[]).length)?_subEscalationCount(c,s):0;const _compTxt=(c&&(c.questionIds||[]).length)?(_escN>0?'Non-compliant':'Compliant'):'N/A';summaryRows.push([i+1,fullName(u),u.email||'',u.phone||'',u.department||'',u.position||'',clName,clDept,clLocs,s.date,s.status,s.submittedAt?new Date(s.submittedAt).toLocaleString('en-GB'):'',s.editCount||0,s.status==='Pending Approval'?'Yes':'No',_compTxt,_escN]);});
  // Also export question responses as a second sheet
  const qRows=[['Sub #','User','Email','Checklist','Date','Status','Question','Response','Comment','Escalated']];
  subs.forEach((s,si)=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return;(s.questionResponses||[]).forEach((qr,qi)=>{const q=(DB.questions||[]).find(x=>x.id===qr.questionId);const _esc=(c&&q&&_qrEscalates(c,q,qr))?'Yes':'';qRows.push([si+1,fullName(u),u.email||'',c?c.name:'[Deleted]',s.date,s.status,q?q.text:'Q'+(qi+1),qr.response!==null&&qr.response!==undefined?String(qr.response):'',qr.comment||'',_esc]);});});
  const all=[...summaryRows,[],['=== QUESTION RESPONSES (one row per response) ==='],[],...qRows];
  const csv=all.map(r=>r.map(v=>{let cell=String(v??'');
    // Neutralize CSV formula injection: cells that begin with = + - @ (or tab/CR)
    // are prefixed with a single quote so spreadsheet apps treat them as text.
    if(/^[=+\-@\t\r]/.test(cell))cell="'"+cell;
    return '"'+cell.replace(/"/g,'""')+'"';}).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);a.download='evarca_export_'+todayISO()+'.csv';a.click();
  toast('Exported '+subs.length+' submissions ('+(qRows.length-1)+' question responses)');
};

App._setSTab=(k)=>{S.filters.stab=k;S.filters.tplKey=null;rr();};
/* — auto: expose on window (modules resolve cross-file references via window at call time) — */
window.NS_LS=NS_LS;window.EMAIL_EVENTS=EMAIL_EVENTS;window._defaultTemplates=_defaultTemplates;window._nsDefault=_nsDefault;window._loadNS=_loadNS;window._saveNS=_saveNS;window._fillTemplate=_fillTemplate;window._bodyToHtml=_bodyToHtml;window.sendEmail=sendEmail;window._nsTogRow=_nsTogRow;window.settingsPage=settingsPage;
