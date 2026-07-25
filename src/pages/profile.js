

function profilePage(){
  const u=me();
  return`<div class="fade max-w-xl">
  ${hdr('Profile','')}
  <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 mb-4">
    <div class="flex items-center gap-4 mb-5">
      ${avatar(u,'w-14 h-14','text-xl')}
      <div>
        <h2 class="fd text-xl font-bold">${esc(fullName(u))}</h2>
        <p class="text-ink-400 text-sm">${esc(roleName(u))} · ${esc(u.department||'')}</p>
        <div class="mt-1.5">${chip(u.status)}</div>
      </div>
    </div>
    <div class="grid sm:grid-cols-2 gap-x-6 gap-y-3 border-t border-ink-100 pt-4 mb-4">
      ${[['Email',u.email],['Phone',u.phone||'—'],['Department',u.department||'—'],['Role',roleName(u)],
         ['Reports to',u.managerId?fullName(uById(u.managerId)):'—'],
         ['Direct reports',subTree(u.id).length]].map(([k,v])=>`
        <div><div class="text-[10px] font-bold text-ink-400 uppercase tracking-wide">${k}</div>
        <div class="font-medium text-sm mt-0.5">${esc(String(v))}</div></div>`).join('')}
    </div>
    <!-- Edit form -->
    <div class="border-t border-ink-100 pt-4">
      <h3 class="fd font-semibold text-sm mb-3">Edit profile</h3>
      <div class="grid sm:grid-cols-2 gap-3 mb-3">
        ${fld('First name','ep-fn',u.firstName||'')}
        ${fld('Last name','ep-ln',u.lastName||'')}
        ${fld('Phone','ep-ph',u.phone||'','tel')}
        ${fld('Position','ep-pos',u.position||'')}
      </div>
      <button type="button" id="ep-save-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent='Saving…';App.saveProfile().finally(()=>{const b=document.getElementById('ep-save-btn');if(b){b.disabled=false;b.textContent='Save changes';}})" class="ui-btn ui-btn-primary">Save changes</button>
    </div>
  </div>
  <!-- Change password -->
  <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 mb-4">
    <h3 class="fd font-semibold text-sm mb-3">Change password</h3>
    <div class="space-y-2">
      ${fld('Current password','pw-cur','','password','')}
      ${fld('New password','pw-new','','password','min 6 characters')}
      <button type="button" id="pw-save-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent='Updating…';App.changePw().finally(()=>{const b=document.getElementById('pw-save-btn');if(b){b.disabled=false;b.textContent='Update password';}})" class="ui-btn ui-btn-primary" style="margin-top:8px">Update password</button>
    </div>
  </div>
  <!-- Feedback history -->
  ${(()=>{
    const myFb=DB.feedback.filter(fb=>fb.userId===S.uid).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5);
    if(!myFb.length)return '';
    return '<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 mb-4">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      +'<h3 class="fd font-semibold text-sm">Recent Feedback</h3>'
      +'<button type="button" onclick="App._goNotifFeedback()" style="font-size:12px;font-weight:600;color:var(--c-brand);background:none;border:none;cursor:pointer">View all</button>'
      +'</div>'
      +myFb.map(fb=>{
        const mgr=uById(fb.managerId);
        const stClr=fb.status==='Responded'?'#059669':fb.status==='Acknowledged'?'#0EA5E9':'#3B82F6';
        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #F3F4F6">'
          +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:13px;font-weight:600">'+(fb.title||fb.type+' Feedback')+'</div>'
          +'<div style="font-size:11px;color:#9CA3AF;margin-top:2px">From '+(mgr?esc(fullName(mgr)):'Manager')+' · '+fmtD(fb.date||fb.createdAt?.slice(0,10))+'</div>'
          +'</div>'
          +'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#F6F7F8;color:'+stClr+';flex-shrink:0">'+(fb.status||'Sent')+'</span>'
          +'</div>';
      }).join('')
      +'</div>';
  })()}
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.profilePage=profilePage;
