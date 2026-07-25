

/* ===== AUDIT / NOTIF / PROFILE / SETTINGS ===== */

function auditPage(){
  // v2: filterable — by person (actor), department (actor's), and tab/category (derived from the action text).
  const F=S.filters;
  const cat=l=>{const s2=((l.action||'')+' '+(l.target||'')).toLowerCase();
    if(s2.includes('checklist')||s2.includes('submission'))return 'Checklists';
    if(s2.includes('approval')||s2.includes('approved')||s2.includes('rejected'))return 'Approvals';
    if(s2.includes('access')||s2.includes('role'))return 'Access Control';
    if(s2.includes('user')||s2.includes('password'))return 'Users';
    if(s2.includes('ticket'))return 'Tickets';
    if(s2.includes('question'))return 'Questions';
    if(s2.includes('department'))return 'Departments';
    if(s2.includes('location')||s2.includes('client'))return 'Clients';
    if(s2.includes('announcement'))return 'Announcements';
    if(s2.includes('setting'))return 'Settings';
    return 'Other';};
  // Audit surface: the synced audit log plus this device's local activity log. Rows written by
  // the wider platform against the same database still appear — they simply land in "Other".
  const all=[...(DB.audit||[]),...(DB.hrmAudit||[])].sort((a,b)=>String(b.time||'').localeCompare(String(a.time||'')));
  const actors=[...new Set(all.map(l=>l.actor).filter(Boolean))].sort();
  const cats=[...new Set(all.map(cat))].sort();
  const deptOfActor=name=>{const u=DB.users.find(x=>fullName(x)===name);return u?u.department:null;};
  const q=(F.audQ||'').toLowerCase();
  let rows=all.filter(l=>{
    if(F.audActor&&l.actor!==F.audActor)return false;
    if(F.audDept&&deptOfActor(l.actor)!==F.audDept)return false;
    if(F.audCat&&cat(l)!==F.audCat)return false;
    if(q&&!(((l.actor||'')+' '+(l.action||'')+' '+(l.target||'')).toLowerCase().includes(q)))return false;
    return true;
  });
  const fActive=!!(F.audActor||F.audDept||F.audCat||F.audQ);

  const catColor={'Checklists':'#0EA5E9','Approvals':'#8B5CF6','Access Control':'#BE123C','Users':'#4338CA','Tickets':'#C2410C','Questions':'#0369A1','Departments':'#0E9F6E','Clients':'#F59E0B','Announcements':'#6B7280','Settings':'#64748B','Other':'#9CA3AF'};
  const list=rows.map(l=>{const c=cat(l);const u=DB.users.find(x=>fullName(x)===l.actor);
    return `<div style="display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--c-border);font-size:13.5px">
      ${u?avatar(u,'w-7 h-7','text-[10px]'):'<span style="width:7px;height:7px;border-radius:99px;background:var(--c-brand);flex-shrink:0"></span>'}
      <div style="flex:1;min-width:0"><span style="font-weight:700;color:var(--c-text)">${esc(l.actor)}</span> <span style="color:var(--c-text-2)">${esc((l.action||'').toLowerCase())}</span>${l.target?` <span style="font-weight:600;color:var(--c-text)">${esc(l.target)}</span>`:''}
        ${u&&u.department?`<span style="font-size:10.5px;color:var(--c-text-3)"> · ${esc(u.department)}</span>`:''}</div>
      <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:${(catColor[c]||'#9CA3AF')}18;color:${catColor[c]||'#9CA3AF'};flex-shrink:0">${esc(c)}</span>
      <span style="font-size:11px;color:var(--c-text-3);flex-shrink:0">${new Date(l.time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
    </div>`;}).join('');
  return`<div class="fade">${hdr('Audit Logs','Every action taken in the workspace')}
    ${filterBar(
       filterSearch('aud-q','audQ','Search actions…')
      +filterSelect('audActor','All people',actors,F.audActor)
      +filterSelect('audDept','All departments',DB.departments.map(d=>d.name),F.audDept)
      +filterSelect('audCat','All tabs',cats,F.audCat)
      +(fActive?filterClear(['audQ','audActor','audDept','audCat']):'')
      +filterCount(rows.length+' of '+all.length))}
    ${rows.length?card(`<div style="max-height:70vh;overflow-y:auto">${list}</div>`,{pad:false}):card(empty('audit',fActive?'Nothing matches':'No logs yet',fActive?'Try clearing a filter.':'Actions will appear here as people use the app.'),{pad:false})}</div>`;
}
App._goNotifFeedback=()=>{S.route="notifications";S.search="";S.expandedCl=null;S.afOpen=null;S.tvUser=null;S.filters={ntab:"Feedback"};render();window.scrollTo(0,0);};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.auditPage=auditPage;
