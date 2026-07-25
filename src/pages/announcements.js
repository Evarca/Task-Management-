


/* ═══════════════ §10 — COMPANY ANNOUNCEMENTS (FRONTEND-ONLY) ═══════════════
   Data: DB.announcements (array) — never synced to Supabase.
   Per-user read-state: u.hrm.announcementsRead (array of ids) — rides on u.hrm (protected).
   Visibility honours optional dept/location targeting. New announcements in-app-notify + queue
   email per targeted recipient at the single EMAIL CONNECTION POINT below. */
function _visibleAnnouncements(){
  const u=me();if(!u)return[];
  const dep=u.department,loc=u.hrm?.locationId||null;
  return (DB.announcements||[]).filter(a=>(!a.deptTarget||a.deptTarget===dep)&&(!a.locTarget||a.locTarget===loc))
    .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
function _annIsRead(id){const u=me();return !!(u&&Array.isArray(u.hrm?.announcementsRead)&&u.hrm.announcementsRead.includes(id));}
function _unreadAnnouncements(){return _visibleAnnouncements().filter(a=>!_annIsRead(a.id));}
// Recipients of an announcement = targeted users (dept/loc filtered), excluding the creator.
function _annRecipients(a){return DB.users.filter(u=>u.status!=='Inactive'&&(!a.deptTarget||u.department===a.deptTarget)&&(!a.locTarget||(u.hrm?.locationId||null)===a.locTarget)&&u.id!==a.createdBy);}
function _annDate(iso){if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+' · '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
// Top banner: newest unread announcement on every page (dismiss = mark read).
function _annBanner(){
  if(!S.uid||!can('announcements','view'))return'';
  const un=_unreadAnnouncements();if(!un.length)return'';
  const a=un[0];const more=un.length-1;
  return`<div class="fade" style="margin-top:14px;display:flex;align-items:flex-start;gap:12px;background:linear-gradient(90deg,#15171C,#262A33);color:#fff;border-radius:14px;padding:13px 15px">
    <div style="width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.12);display:grid;place-items:center;flex-shrink:0">${ic('msg','w-4 h-4')}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:#9CA3AF;text-transform:uppercase;margin-bottom:1px">Announcement</div>
      <div class="fd" style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.title)}</div>
      <div style="font-size:12px;color:#CBD5E1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${esc((a.body||'').slice(0,120))}${(a.body||'').length>120?'…':''}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      <button onclick="App._readAnnouncement('${a.id}',true)" style="font-size:12px;font-weight:700;background:#fff;color:#15171C;border:none;border-radius:9px;padding:7px 12px;cursor:pointer">Read${more>0?' ('+(more+1)+')':''}</button>
      <button onclick="App._dismissAnnouncement('${a.id}')" title="Dismiss" aria-label="Dismiss announcement" class="ann-x" style="width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;display:grid;place-items:center">${ic('x','w-4 h-4')}</button>
    </div>
  </div>`;
}
function announcementsPage(){
  const all=_visibleAnnouncements();
  const q=(S.filters.annQ||'').toLowerCase();
  const list=q?all.filter(a=>(a.title+' '+a.body).toLowerCase().includes(q)):all;
  const unread=all.filter(a=>!_annIsRead(a.id)).length;
  const head=hdr('Announcements',unread?unread+' unread':(all.length+' total'),can('announcements','create')?btnP('New announcement','App.newAnnouncement()','plus'):'');
  const search=all.length?`<div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <div style="position:relative;flex:1;min-width:200px"><span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--c-text-3);z-index:1">${ic('search','w-4 h-4')}</span><input id="annSearchInput" value="${esc(S.filters.annQ||'')}" oninput="S.filters.annQ=this.value;App._searchRR('annSearchInput')" placeholder="Search announcements…" class="ui-input" style="padding-left:34px"/></div>
    ${unread?btnG('Mark all read','App._readAllAnnouncements()','check'):''}
  </div>`:'';
  const body=!list.length
    ? empty('msg',all.length?'No matches':'No announcements yet',all.length?'Try a different search.':'Company announcements will appear here.')
    : `<div style="display:flex;flex-direction:column;gap:10px">${list.map(a=>{
        const rd=_annIsRead(a.id);
        const tgt=[a.deptTarget?esc(a.deptTarget):'',a.locTarget?esc(locById(a.locTarget)?.name||'(deleted location)'):''].filter(Boolean).join(' · ')||'Everyone';
        return`<div onclick="App._readAnnouncement('${a.id}')" style="cursor:pointer;background:var(--c-surface);border:1px solid ${rd?'var(--c-border)':'var(--c-brand)'};box-shadow:var(--sh-sm);border-radius:var(--r-md);padding:14px 16px;position:relative" onmouseover="this.style.borderColor='var(--c-brand)'" onmouseout="this.style.borderColor='${rd?'var(--c-border)':'var(--c-brand)'}'">
          ${rd?'':'<span style="position:absolute;top:14px;right:14px;width:9px;height:9px;border-radius:50%;background:var(--c-brand)"></span>'}
          <div class="fd" style="font-size:15px;font-weight:700;color:var(--c-text);padding-right:18px">${esc(a.title)}</div>
          <div style="font-size:13px;color:var(--c-text-2);margin-top:5px;white-space:pre-wrap;line-height:1.5">${esc((a.body||'').slice(0,260))}${(a.body||'').length>260?'…':''}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;font-size:11px;color:var(--c-text-3)">
            <span style="font-weight:600;color:var(--c-text-2)">${esc(fullName(uById(a.createdBy))||'HR')}</span>
            <span>·</span><span>${esc(_annDate(a.createdAt))}</span>
            <span style="margin-left:auto;font-weight:700;background:var(--c-surface-2);color:var(--c-text-2);border-radius:99px;padding:2px 9px">${tgt}</span>
            ${(can('announcements','delete')||a.createdBy===S.uid)?`<button onclick="event.stopPropagation();App._delAnnouncement('${a.id}')" title="Delete" aria-label="Delete announcement" style="background:none;border:none;cursor:pointer;color:var(--c-text-3);padding:2px" onmouseover="this.style.color='var(--c-danger)'" onmouseout="this.style.color='var(--c-text-3)'">${ic('trash','w-3.5 h-3.5')}</button>`:''}
          </div>
        </div>`;
      }).join('')}</div>`;
  return`<div class="fade">${head}${search}${body}</div>`;
}
// Open/read an announcement: mark read; optionally open a detail modal.
App._readAnnouncement=(id,fromBanner)=>{
  const a=(DB.announcements||[]).find(x=>x.id===id);if(!a)return;
  const u=me();
  if(u){if(!Array.isArray(u.hrm.announcementsRead))u.hrm.announcementsRead=[];if(!u.hrm.announcementsRead.includes(id)){u.hrm.announcementsRead.push(id);saveDB();}}
  const tgtRaw=[a.deptTarget||'',a.locTarget?(locById(a.locTarget)?.name||'(deleted location)'):''].filter(Boolean).join(' · ')||'Everyone';
  modalShell({title:a.title,sub:'Announcement · '+tgtRaw,size:'max-w-lg',
    body:`<div style="font-size:12px;color:var(--c-text-3);margin-bottom:14px">${esc(fullName(uById(a.createdBy))||'HR')} · ${esc(_annDate(a.createdAt))}</div>
    <div style="font-size:14px;color:var(--c-text);white-space:pre-wrap;line-height:1.6">${esc(a.body||'')}</div>`,
    footer:btnP('Done','App.closeModal()')});
  rr();
};
App._dismissAnnouncement=(id)=>{const u=me();if(u){if(!Array.isArray(u.hrm.announcementsRead))u.hrm.announcementsRead=[];if(!u.hrm.announcementsRead.includes(id))u.hrm.announcementsRead.push(id);saveDB();}rr();};
App._readAllAnnouncements=()=>{const u=me();if(!u)return;if(!Array.isArray(u.hrm.announcementsRead))u.hrm.announcementsRead=[];_visibleAnnouncements().forEach(a=>{if(!u.hrm.announcementsRead.includes(a.id))u.hrm.announcementsRead.push(a.id);});saveDB();toast('All announcements marked read');rr();};
App._delAnnouncement=(id)=>{
  {const _a=(DB.announcements||[]).find(x=>x.id===id);if(_a&&!(can('announcements','delete')||_a.createdBy===S.uid))return toast('You need Announcements → Delete','err');}
  const a=(DB.announcements||[]).find(x=>x.id===id);if(!a)return;
  if(!(isAdmin()||a.createdBy===S.uid||isHR())){toast('Not allowed','err');return;}
  if(!confirm('Delete this announcement for everyone?'))return;
  DB.announcements=(DB.announcements||[]).filter(x=>x.id!==id);
  // DATA-5: prune the deleted id from every user's read-state so the array doesn't grow unbounded.
  DB.users.forEach(u=>{if(u.hrm&&Array.isArray(u.hrm.announcementsRead)&&u.hrm.announcementsRead.includes(id))u.hrm.announcementsRead=u.hrm.announcementsRead.filter(x=>x!==id);});
  _delRow('announcements',id,'announcement'); // PHASE4b: server-backed now
  saveDB();toast('Announcement deleted');rr();
};
App.newAnnouncement=()=>{
  if(!can('announcements','create')){toast('Not allowed','err');return;}
  const deps=DB.departments.map(d=>[d.name,d.name]);
  const locs=DB.locations.filter(l=>l.status!=='Inactive').map(l=>[l.id,l.name]);
  modalShell({title:'New announcement',size:'max-w-lg',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      ${fld('Title','an-t','','text','e.g. New filing deadline on Friday')}
      <div><label for="an-b" class="ui-label">Message</label><textarea id="an-b" rows="5" placeholder="Write your announcement…" class="ui-input rf"></textarea></div>
      ${selF('Target department (optional)','an-dep',[['','Everyone'],...deps])}
      ${selF('Target client (optional)','an-loc',[['','All clients'],...locs])}
      <p style="font-size:11px;color:var(--c-text-3)">Leave targets blank to reach everyone. Targeted users get an in-app notification (and an email if HR email is enabled).</p>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Post','App.postAnnouncement()')});
};
App.postAnnouncement=()=>{
  if(!can('announcements','create')){toast('Not allowed','err');return;}
  const title=($('#an-t')?.value||'').trim();
  const body=($('#an-b')?.value||'').trim();
  if(!title){toast('Title required','err');return;}
  if(!body){toast('Message required','err');return;}
  const deptTarget=$('#an-dep')?.value||null;
  const locTarget=$('#an-loc')?.value||null;
  const a={id:uid('ann'),title,body,deptTarget:deptTarget||null,locTarget:locTarget||null,createdBy:S.uid,createdAt:new Date().toISOString()};
  DB.announcements.unshift(a);
  _pushRow('announcements',_annRow(a),'announcement'); // PHASE4b: server-backed now
  const recipients=_annRecipients(a);
  /* === EMAIL CONNECTION POINT (backend wires sendEmail) ===
     Notify every targeted recipient: in-app (gated by inapp_announcement) + email
     (gated by email_announcement AND the hrm_email_enabled master switch via _hnpEmail).
     queueEmail is the SINGLE place real sending connects — no backend network call added here. */
  recipients.forEach(u=>{
    if(_hnp('inapp_announcement'))_hrmNotify(u.id,'📣 '+title,'announcement');
    if(_hnpEmail('email_announcement'))queueEmail('announcement',u.id,null,null,{title,body});
  });
  saveDB();
  closeModal();
  toast('Announcement posted to '+recipients.length+' '+(recipients.length===1?'person':'people'));
  rr();
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._visibleAnnouncements=_visibleAnnouncements;window._annIsRead=_annIsRead;window._unreadAnnouncements=_unreadAnnouncements;window._annRecipients=_annRecipients;window._annDate=_annDate;window._annBanner=_annBanner;window.announcementsPage=announcementsPage;
