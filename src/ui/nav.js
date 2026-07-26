
/* ===== NAVIGATION ===== */
// Flat lookup used by the mobile bottom bar (route → icon + label).
const NAV_ITEMS=[['dashboard','grid','Dashboard'],['mychecklists','check','My Checklists'],['tickets','ticket','Tickets'],['users','users','Users'],['hierarchy','tree','Hierarchy'],['checklists','list','Create Checklist'],['allcl','list','All Checklists'],['questions','help','Questions'],['approvals','approve','Approvals'],['notifications','bell','Notifications'],['teamview','users','Team'],['analytics','chart','Dashboard'],['locations','pin','Clients'],['departments','dept','Departments'],['settings','cog','Settings'],['audit','audit','Audit'],['accesscontrol','shield','Access Control']];
// Bottom bar: My Day, the day's checklists and tickets are the three things an employee
// opens all day; everything else lives behind More.
const MOB_ADM=['dashboard','mychecklists','tickets','notifications','more'];
const MOB_USR=['dashboard','mychecklists','tickets','notifications','more'];
const MOB_MGR=['dashboard','mychecklists','tickets','notifications','more'];
/* ── NAV (perms-driven) — ONE master list; every entry shows iff the user's toggle allows it.
   No role-based branches: the Super Admin sees exactly what their toggles say (baked = everything). ── */
const NAV_ALL=[
  ['dashboard','grid','Dashboard',()=>true],
  ['mychecklists','check','My Checklists',()=>true],
  ['hub:inbox','bell','Inbox',()=>true],

  ['hub:cl','list','Checklists',()=>!!_hubHome('cl')],
  ['questions','help','Questions',()=>can('questions','view')],
  ['tickets','ticket','Tickets',()=>can('tickets','view')],

  ['hub:people','users','People',()=>!!_hubHome('people')],

  ['hub:admin','shield','Administration',()=>!!_hubHome('admin')],
];
/* ───── HUBS: one sidebar entry, sub-tab strip on every member route ─────
   Routes are UNCHANGED (deep links, notifications, ⌘K, HOW help all keep working).
   A hub only groups them visually: nav shows one entry; each member page renders a
   pill strip at the top. Every pill is permission-gated by the SAME can() rule the
   router already enforces, so access control needs no new areas. */
const HUB_DEF={
  inbox:{label:'Inbox',tabs:[
    ['notifications','Alerts',()=>true],            // Inbox lands on Alerts by default
    ['approvals','Approvals',()=>can('approvals','view')]]},
  dash:{label:'Dashboard',tabs:[
    ['dashboard','My Day',()=>true],
    ['analytics','Company',()=>isAdmin()||can('analytics','view')]]},
  cl:{label:'Checklists',tabs:[
    ['checklists','Builder',()=>can('checklists','create')],
    ['allcl','All results',()=>can('allChecklists','view')],
    ['teamview','Team',()=>can('teamview','view')]]},
  people:{label:'People',tabs:[
    ['users','Directory',()=>can('employees','view')],
    ['hierarchy','Hierarchy',()=>can('hierarchy','view')]]},
  admin:{label:'Administration',tabs:[
    ['settings','Settings',()=>can('settings','view')],
    ['accesscontrol','Access Control',()=>can('accessControl','view')],
    ['departments','Departments',()=>can('departments','view')],
    ['locations','Clients',()=>can('locations','view')],
    ['audit','Audit',()=>can('audit','view')]]},
};
function _hubOf(route){for(const k in HUB_DEF)if(HUB_DEF[k].tabs.some(t=>t[0]===route))return k;return null;}
function _hubTabsAllowed(k){return (HUB_DEF[k]?HUB_DEF[k].tabs:[]).filter(t=>{try{return !!t[2]();}catch(e){return false;}});}
function _hubHome(k){const t=_hubTabsAllowed(k);return t.length?t[0][0]:null;}
function _hubStrip(k){
  const tabs=_hubTabsAllowed(k);if(tabs.length<2)return'';
  return `<div class="hscroll" style="gap:4px;margin-bottom:16px;padding:5px;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:14px;width:fit-content;max-width:100%">${tabs.map(([r,l])=>{const on=S.route===r;
    return `<button onclick="App.go('${r}')" style="flex-shrink:0;padding:8px 15px;border-radius:10px;border:none;background:${on?'var(--c-surface)':'transparent'};box-shadow:${on?'0 1px 3px rgba(21,23,28,.1)':'none'};color:${on?'var(--c-text)':'var(--c-text-2)'};font-size:13px;font-weight:${on?'800':'600'};cursor:pointer;transition:background .15s,color .15s;white-space:nowrap">${l}</button>`;}).join('')}</div>`;
}
const navFor=()=>NAV_ALL.filter(n=>{try{return !!n[3]();}catch(e){return false;}}).map(n=>[n[0],n[1],n[2]]);
/* ───── Grouped nav (presentation only) ─────
   navFor() still returns the FLAT [route,icon,label] array (gating preserved & reused below).
   navSectionsFor() buckets that SAME flat list into Daily + collapsible sections. No route or
   can()-gating logic changes — it only reshapes for rendering. Every flat item lands somewhere
   (unknown keys fall through to a "More" section so nothing is ever dropped). */
const NAV_DAILY=['dashboard','mychecklists','hub:inbox']; // keep the daily strip tiny — everything else lives in named sections
const NAV_SECTION_OF={
  'hub:cl':'Work',questions:'Work',tickets:'Work',
  'hub:people':'People',
  'hub:admin':'Manage',
};
const NAV_SECTION_ORDER=['Work','People','Manage'];
const NAV_SECTION_ICON={Work:'list',People:'users',Manage:'cog'};
function navSectionsFor(){
  const flat=navFor();
  const daily=[],sections={};
  flat.forEach(item=>{
    const r=item[0];
    // notifications becomes the bell; keep it out of the daily strip rendering but reachable in 'More'
    const sec=NAV_SECTION_OF[r];
    if(NAV_DAILY.includes(r)&&(sec==='__daily'||sec===undefined)){daily.push(item);return;}
    const bucket=sec&&sec!=='__daily'?sec:'More';
    (sections[bucket]=sections[bucket]||[]).push(item);
  });
  const ordered=[...NAV_SECTION_ORDER,'More'].filter(s=>sections[s]&&sections[s].length).map(s=>({label:s,icon:NAV_SECTION_ICON[s]||'grid',items:sections[s]}));
  return {daily,sections:ordered};
}
App.toggleNavSec=(name)=>{
  S._navCollapsed=S._navCollapsed||{};
  const {sections}=navSectionsFor();
  const sec=sections.find(x=>x.label===name);
  const hasActive=sec?sec.items.some(it=>it[0]===S.route):false;
  const cur=(name in S._navCollapsed)?!!S._navCollapsed[name]:!hasActive;
  S._navCollapsed[name]=!cur;
  render();
};
App.go=(r)=>{if(r&&String(r).slice(0,4)==='hub:')r=_hubHome(String(r).slice(4))||'dashboard';S.route=r;S.search='';S.expandedCl=null;S.afOpen=null;
  // Preserve analytics filters; preserve questions sub-tab state; reset everything else
  if(r==='analytics'){/* keep filters */}
  else if(r==='questions'){const qTab=S.filters.qTab;const eQ=S.filters.expandedQ;const eL=S.filters.expandedL;S.filters={};if(qTab)S.filters.qTab=qTab;if(eQ)S.filters.expandedQ=eQ;if(eL)S.filters.expandedL=eL;}
  else if(r==='notifications'){const ntab=S.filters.ntab;S.filters={};if(ntab)S.filters.ntab=ntab;}
  else if(r==='accesscontrol'){const au=S.filters.acUser;const aq=S.filters.acQ;const ad=S.filters.acDep;S.filters={};if(au)S.filters.acUser=au;if(aq)S.filters.acQ=aq;if(ad)S.filters.acDep=ad;}
  else if(r==='audit'){const c1=S.filters.audCat;const q1=S.filters.audQ;S.filters={};if(c1)S.filters.audCat=c1;if(q1)S.filters.audQ=q1;}
  else if(r==='settings'){const stab=S.filters.stab;const tplKey=S.filters.tplKey;S.filters={};if(stab)S.filters.stab=stab;if(tplKey)S.filters.tplKey=tplKey;}
  else{S.filters={};}
  if(r!=='teamview')S.tvUser=null;
  // Update URL hash so email deep-links work. Use pushState when the route actually changes so the
  // browser Back/Forward buttons walk the in-app history; skip when the hash already matches (e.g. the
  // hashchange handler below re-entering) to avoid duplicate history entries / loops.
  if(location.hash!=='#'+r){ if(history.pushState)history.pushState(null,'','#'+r); else if(history.replaceState)history.replaceState(null,'','#'+r); }
  render();window.scrollTo(0,0);
  // Lazy-load only the data this tab needs (nothing loads on a timer anymore).
  _lazyForRoute(r);};
App._lazyLoad=_lazyLoad;App._lazyLoadDate=_lazyLoadDate;
// ── Deep-link + Back/Forward support ──────────────────────────────────────────────
// Previously the app read the URL hash ONLY once at boot and never listened for changes, so
// bookmarks/shared "#route" links opened after load, and the browser Back/Forward buttons, did
// nothing. React to hash changes and route to the target (App.go's guarded pushState prevents loops).
window.addEventListener('hashchange',()=>{
  if(!S.uid)return;
  const r=(location.hash||'').replace(/^#/,'').trim();
  if(r&&r!==S.route&&typeof App.go==='function')App.go(r);
});

/* ===== RENDER ===== */
window._lastUserAction=0; // timestamp of last submit/approve/etc — prevents loadFromSB overwriting fresh state
function _touchAction(){_lastUserAction=Date.now();}
function render(){if(!S.uid){$('#app').innerHTML=loginView();return;}
  // Preserve the sidebar's own scroll position across a full re-render. Replacing #app innerHTML
  // rebuilds the sidebar and resets its scrollTop to 0 — which made clicking a lower nav item
  // (or a section header) jump the sidebar back to the top. Snapshot + restore keeps it in place.
  const _sb=document.querySelector('.sidebar');const _sy=_sb?_sb.scrollTop:0;
  $('#app').innerHTML=shell(pageContent());
  const _sb2=document.querySelector('.sidebar');if(_sb2&&_sy)_sb2.scrollTop=_sy;
  setTimeout(_paintCharts,30);}
function rr(){_invalidateNotifCache();const c=$('#content');if(!c)return;
  // A2: rr() is an in-place refresh (filter chips, sub-tabs, toggles, inline edits) — not a route
  //     change. The whole page scrolls via document.scrollingElement (#content has no overflow of
  //     its own; the topbar is sticky). Replacing innerHTML collapses scroll height to 0 and the
  //     browser resets scrollTop, so snapshot/restore it. Route changes keep render()+scrollTo(0,0).
  const sc=document.scrollingElement||document.documentElement;
  const y=sc?sc.scrollTop:0;
  c.innerHTML=pageContent();
  if(sc)sc.scrollTop=y;
  setTimeout(_paintCharts,30);}
App.rr=rr;
// UI-1: live-search helper — rr() rebuilds #content.innerHTML and destroys the typing <input>,
// dropping focus/caret (closes the mobile keyboard each keystroke). Re-render, then restore
// focus + selection on the search input by id so it keeps accepting input mid-type.
App._searchRR=(inputId)=>{const a=document.activeElement;const ss=a?a.selectionStart:null,se=a?a.selectionEnd:null;rr();const el=document.getElementById(inputId);if(el){el.focus();try{if(ss!=null)el.setSelectionRange(ss,se);}catch(e){}}};

function _navBadgeFor(r){
  if(r==='hub:inbox'){let n=0;try{n=_notifCount();}catch(e){}try{if(can('approvals','view'))n+=_approvalPendingCount();}catch(e){}return n?countBadge(n,'danger'):'';}
  if(r==='notifications'){const n=_notifCount();return n?countBadge(n,'danger'):'';}
  if(r==='approvals'){const ab=_approvalPendingCount();return ab?countBadge(ab,'approve'):'';}
  if(r==='tickets'){const tkB=(DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&!(t.viewedBy||[]).includes(S.uid)).length;return tkB?countBadge(tkB,'rose'):'';}
  if(r==='mychecklists'){const _t=todayISO();const n=myCls(S.uid,_t).filter(c=>!subForCl(c,S.uid,_t)).length;return n?countBadge(n,'approve'):'';}
  return '';
}
function _navItemHTML([r,i,l]){
  const act=String(r).slice(0,4)==='hub:'?_hubOf(S.route)===String(r).slice(4):S.route===r;
  return`<button onclick="App.go('${r}')" class="nav-item${act?' on':''}"><span class="nav-ico">${ic(i,'w-[17px] h-[17px]')}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l}</span>${_navBadgeFor(r)}</button>`;
}
function shell(content){
  const u=me();
  // Mobile nav: base array; grouping follows Access Control (team-view rights ⇒ manager layout)
  let mob=isAdmin()?[...MOB_ADM]:(isMgr()||can('teamview','view'))?[...MOB_MGR]:[...MOB_USR];

  const {daily,sections}=navSectionsFor();
  S._navCollapsed=S._navCollapsed||{};
  const dailyHTML=daily.map(_navItemHTML).join('');
  const sectionsHTML=sections.map(sec=>{
    // T1: honor the user's explicit collapse/expand. Only fall back to "auto-expand the
    // section with the active route" when the user hasn't toggled it yet — otherwise a
    // section containing the current page could never be collapsed.
    const hasActive=sec.items.some(it=>it[0]===S.route||(String(it[0]).slice(0,4)==='hub:'&&_hubOf(S.route)===String(it[0]).slice(4)));
    const collapsed=(sec.label in S._navCollapsed)?!!S._navCollapsed[sec.label]:!hasActive;
    const show=!collapsed;
    return`<div class="nav-sec${show?'':' collapsed'}">
      <button class="nav-sec-hdr" onclick="App.toggleNavSec('${sec.label}')"><span class="nav-ico" style="width:14px;height:14px;color:rgba(255,255,255,.45)">${ic(sec.icon,'w-3.5 h-3.5')}</span><span style="flex:1;text-align:left">${sec.label}</span><span class="nav-chev">${ic('chevD','w-3.5 h-3.5')}</span></button>
      <div class="nav-sec-body" style="display:${show?'flex':'none'};flex-direction:column;gap:2px">${sec.items.map(_navItemHTML).join('')}</div>
    </div>`;
  }).join('');

  return`<div style="min-height:100vh;display:flex">
  <aside class="sidebar hidden md:flex flex-col w-56 fixed inset-y-0 left-0 z-30 overflow-y-auto" style="background:linear-gradient(177deg,#1C212B 0%,#14171E 100%);color:#fff;border-right:1px solid rgba(255,255,255,.05)">
    <button onclick="App.go('dashboard')" style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;border-left:none;border-right:none;border-top:none;cursor:pointer;width:100%;text-align:left" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='transparent'">
      <div class="nav-brand">E</div>
      <span class="fd" style="font-weight:800;font-size:18px;letter-spacing:-.5px;color:#fff">Evarca</span>
    </button>
    <nav style="flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px">${dailyHTML}<div style="height:1px;background:rgba(255,255,255,.07);margin:8px 6px"></div>${sectionsHTML}</nav>
    <div style="padding:8px;border-top:1px solid rgba(255,255,255,.06)">
      <button onclick="App.go('profile')" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:transparent;border:none;cursor:pointer;color:#fff;margin-bottom:2px" onmouseover="this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.background='transparent'">
        ${avatar(u,'w-8 h-8','text-[11px]')}
        <div style="min-width:0;text-align:left;flex:1">
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fullName(u))}</div>
          <div style="font-size:11px;color:#A9ADB8;margin-top:1px">${esc(u.position||u.department||'')}</div>
        </div>
        <span style="font-size:10px;color:rgba(255,255,255,.3)">${ic('chevR','w-3 h-3')}</span>
      </button>
      <button onclick="App.logout()" style="width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:transparent;border:none;cursor:pointer;color:#A9ADB8;font-size:12px;font-weight:500" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.color='#A9ADB8';this.style.background='transparent'">
        ${ic('logout','w-3.5 h-3.5')}Sign out
      </button>
    </div>
  </aside>
  <div class="flex flex-col" style="flex:1;min-width:0;margin-left:0" id="main-wrap">
    <header class="topbar sticky top-0 z-20" style="background:rgba(247,248,250,.82);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--c-border)">
      <div style="height:56px;padding:0 18px;display:flex;align-items:center;gap:10px">
        <button onclick="App.moreMenu()" class="md:hidden" aria-label="Open menu" style="width:38px;height:38px;border-radius:10px;border:none;background:transparent;color:var(--c-text);display:grid;place-items:center;cursor:pointer">${ic('menu','w-5 h-5')}</button>
        <div class="md:hidden flex items-center gap-2">
          <div class="nav-brand" style="width:24px;height:24px;font-size:11px">E</div>
          <span class="fd" style="font-weight:800;font-size:15px">Evarca</span>
        </div>
        <div style="flex:1"></div><button onclick="App._cmdk()" class="hidden md:flex" style="align-items:center;gap:8px;width:240px;padding:8px 12px;border-radius:12px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text-3);font-size:12.5px;font-weight:500;cursor:text;box-shadow:inset 0 1px 2px rgba(16,24,40,.04)">${ic('search','w-4 h-4')}<span style="flex:1;text-align:left">Search anything…</span><span style="font-size:10px;font-weight:800;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:6px;padding:1px 6px;color:var(--c-text-3)">⌘K</span></button>
        <button onclick="App.go('notifications')" class="md:hidden" aria-label="Notifications" style="position:relative;width:38px;height:38px;border-radius:10px;border:none;background:transparent;color:var(--c-text);display:grid;place-items:center;cursor:pointer">${ic('bell','w-5 h-5')}${(()=>{const n=_notifCount();return n?`<span style="position:absolute;top:5px;right:5px">${countBadge(n,'danger')}</span>`:'';})()}</button>
        <button onclick="App.go('profile')" class="md:hidden" aria-label="Profile">${avatar(u,'w-8 h-8','text-[11px]')}</button>
      </div>
    </header>
    <main id="content" style="flex:1;padding:22px 20px;padding-bottom:96px;max-width:1152px;width:100%;margin:0 auto" class="md:pb-10">${content}</main>
  </div>
  <nav id="bottom-nav" class="mob-nav md:hidden fixed bottom-0 inset-x-0 z-30" style="background:var(--c-surface);border-top:1px solid var(--c-border);padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -2px 16px rgba(16,24,40,.06)">
    <div style="display:grid;grid-template-columns:repeat(${mob.length},1fr);height:60px">
      ${mob.map(r=>{
        if(r==='more')return`<button onclick="App.moreMenu()" aria-label="More" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:transparent;cursor:pointer;color:var(--c-text-3);min-height:44px">${ic('menu','w-[22px] h-[22px]')}<span style="font-size:10px;font-weight:700">More</span></button>`;
        const m=NAV_ITEMS.find(n=>n[0]===r);if(!m)return'';
        const act=S.route===r;
        let nb=0;
        if(r==='notifications')nb=_notifCount();
        if(r==='tickets')nb=(DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&!(t.viewedBy||[]).includes(S.uid)).length;
        return`<button onclick="App.go('${r}')" aria-label="${esc(m[2])}" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:transparent;cursor:pointer;min-height:44px;color:${act?'var(--c-brand)':'var(--c-text-3)'}">${ic(m[1],'w-[22px] h-[22px]')}${nb?`<span style="position:absolute;top:6px;right:calc(50% - 18px)">${countBadge(nb,'danger')}</span>`:''}<span style="font-size:10px;font-weight:700">${m[2].split(' ')[0]}</span></button>`;
      }).join('')}
    </div>
  </nav></div>`;
}

App.moreMenu=()=>{
  const {daily,sections}=navSectionsFor();
  const u=me();
  const tile=([r,i,l])=>{
    const act=String(r).slice(0,4)==='hub:'?_hubOf(S.route)===String(r).slice(4):S.route===r;const b=_navBadgeFor(r);
    return`<button onclick="App.closeModal();App.go('${r}')" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:14px 8px;min-height:80px;border-radius:14px;border:1px solid ${act?'var(--c-brand)':'var(--c-border)'};background:${act?'var(--c-brand-soft)':'var(--c-surface)'};color:${act?'var(--c-brand-ink)':'var(--c-text)'};cursor:pointer">${b?`<span style="position:absolute;top:7px;right:7px">${b}</span>`:''}${ic(i,'w-[22px] h-[22px]')}<span style="font-size:11px;font-weight:700;text-align:center;line-height:1.2">${esc(l)}</span></button>`;
  };
  const sectionBlock=(label,items)=>`<div style="margin-top:6px"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--c-text-3);margin:14px 2px 8px">${esc(label)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${items.map(tile).join('')}</div></div>`;
  const body=`
    <div style="display:flex;align-items:center;gap:11px;padding:12px;border-radius:14px;background:var(--c-surface-2);margin-bottom:8px">
      ${avatar(u,'w-10 h-10','text-sm')}
      <div style="min-width:0;flex:1"><div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fullName(u))}</div><div style="font-size:12px;color:var(--c-text-2)">${esc(u.position||u.department||'')}</div></div>
      <button onclick="App.closeModal();App.go('profile')" class="ui-btn ui-btn-ghost ui-btn-sm">Profile</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${daily.map(tile).join('')}</div>
    ${sections.map(s=>sectionBlock(s.label,s.items)).join('')}
    <button onclick="App.logout()" class="ui-btn ui-btn-subtle ui-btn-md" style="width:100%;margin-top:16px">${ic('logout','w-4 h-4')}Sign out</button>`;
  modalShell({title:'Menu',body,size:'max-w-md'});
};
/* W1.4 / X3: role-aware quick-add "+" menu. Reuses existing create handlers — no new logic,
   just a single discoverable entry point. Each action is gated by the same can()/role checks
   that gate its page button, so a user only sees actions they can actually perform. */
App.saveProfile=async()=>{
  const u=me();if(!u)return;
  const fn=($('#ep-fn')?.value||'').trim();
  const ln=($('#ep-ln')?.value||'').trim();
  if(!fn||!ln){toast('Name required','err');return;}
  // Update locally immediately
  u.firstName=fn;u.lastName=ln;
  u.phone=($('#ep-ph')?.value||'').trim();
  u.position=($('#ep-pos')?.value||'').trim();
  saveDB();toast('Profile updated');render();
  // Sync to Supabase in background
  sb.from('profiles').update({
    first_name:u.firstName,last_name:u.lastName,
    phone:u.phone,position:u.position
  }).eq('id',u.id).then(({error})=>{
    if(error)console.error('saveProfile sync:',error.message);
  }).catch(()=>{});
};
App.changePw=async()=>{const cur=($('#pw-cur')?.value||'').trim();const nw=($('#pw-new')?.value||'').trim();if(!cur||!nw){toast('Fill both fields','err');return;}if(nw.length<6){toast('Min 6 characters','err');return;}const u=me();const{error:se}=await sb.auth.signInWithPassword({email:u.email,password:cur});if(se){toast('Current password incorrect','err');return;}const{error}=await sb.auth.updateUser({password:nw});if(error){toast(error.message,'err');return;}toast('Password updated');const c=$('#pw-cur'),n=$('#pw-new');if(c)c.value='';if(n)n.value='';};
// _showNotifs removed — now using notificationsPage route
App.logout=()=>{
  try{log(fullName(me()),'Logged out','');saveDB();}catch(e){}
  // Clear state and render immediately — don't wait for Supabase
  S.uid=null;S.route='dashboard';S.filters={};S.expandedCl=null;S.tvUser=null;RUN={};CLD=null;_QED=null;
  closeModal();render();
  // Sign out Supabase in background
  sb.auth.signOut().catch(()=>{});
};

/* ===== ROUTER ===== */
// Routes retired with the HR modules. A saved bookmark, an old email deep-link or a
// notification row pointing at one of these lands on the dashboard instead of a blank page.
const _RETIRED_ROUTES=['attendance','leave','hrmconfig','hrmanalytics','reports','okr','overtime','shifts','lifecycle','letters','discipline','payroll','surveys','reviews','documents','sops','schedule','myschedule','expenses','announcements'];
function _pageInner(){
  const r=S.route;
  if(_RETIRED_ROUTES.includes(r)){S.route='dashboard';return homeDash();}
  if(r==='dashboard'){return _dashboardPage();}
  if(r==='users'){if(can('employees','view'))return usersPage();S.route='dashboard';return homeDash();}
  if(r==='departments'){if(can('departments','view'))return deptsPage();S.route='dashboard';return homeDash();}
  if(r==='locations'){if(can('locations','view'))return locsPage();S.route='dashboard';return homeDash();}
  if(r==='checklists'){if(can('checklists','create'))return clsPage();S.route='dashboard';return homeDash();}
  if(r==='approvals'){if(can('approvals','view'))return unifiedApprovalsPage();S.route='notifications';return notificationsPage();}
  if(r==='notifications')return notificationsPage();
  if(r==='tickets'){if(can('tickets','view'))return ticketsPage();S.route='mychecklists';return myClsPage();}
  if(r==='hierarchy'){if(can('hierarchy','view'))return hierarchyPage();S.route='dashboard';return homeDash();} // was ungated — nav hid it but a typed #hierarchy deep-link opened for anyone
  if(r==='analytics'){if(can('analytics','view'))return analyticsPage();S.route='dashboard';return homeDash();}
  if(r==='audit'){if(can('audit','view'))return auditPage();S.route='dashboard';return homeDash();}
  if(r==='settings'){if(can('settings','view'))return settingsPage();S.route='dashboard';return homeDash();}
  if(r==='questions'){if(can('questions','view'))return questionsPage();return myClsPage();}
  if(r==='mychecklists')return myClsPage();
  if(r==='teamview'){if(can('teamview','view'))return teamViewPage();S.route='mychecklists';return myClsPage();}
  if(r==='allcl'){if(can('allChecklists','view'))return allClsPage();S.route='teamview';return _pageInner();}
  if(r==='profile')return profilePage();
  if(r==='accesscontrol'){if(can('accessControl','view'))return accessControlPage();S.route='dashboard';return homeDash();}
  S.route='dashboard';return homeDash();
}
/* Wrapper: after the inner router settles on the FINAL route (fallbacks may reassign it),
   prepend the hub pill strip when that route belongs to a hub. */
function pageContent(){
  const html=_pageInner();
  const hub=_hubOf(S.route);
  return hub?('<div class="fade">'+_hubStrip(hub)+'</div>'+html):html;
}

/* ── QUICK SEARCH (Ctrl/⌘ K) — jump to any page, person or OKR you're allowed to see ── */
App._cmdk=()=>{
  if(!S.uid)return;
  modalShell({title:'Quick search',sub:'Pages · people · checklists — type, then Enter',size:'max-w-md',
    body:`<div><input id="cmdk-in" class="ui-input rf" placeholder="e.g. tickets, Sara, closing checklist…" oninput="App._cmdkQ(this.value)" onkeydown="if(event.key==='Enter'){const b=document.querySelector('#cmdk-res [data-go]');if(b)b.click();}"/>
      <div id="cmdk-res" style="margin-top:10px;max-height:320px;overflow-y:auto"></div></div>`,
    footer:btnG('Close','App.closeModal()')});
  setTimeout(()=>{const el=document.getElementById('cmdk-in');if(el){el.focus();App._cmdkQ('');}},60);
};
App._cmdkQ=(q)=>{
  const box=document.getElementById('cmdk-res');if(!box)return;
  q=(q||'').toLowerCase().trim();
  const out=[];
  navFor().forEach(([r,i,l])=>{if(!q||l.toLowerCase().includes(q))out.push({icon:i,label:l,sub:'Page',go:`App.closeModal();App.go('${r}')`});});
  Object.keys(HUB_DEF).forEach(k=>{_hubTabsAllowed(k).forEach(([r,l])=>{if(q&&!l.toLowerCase().includes(q))return;out.push({icon:'grid',label:l,sub:HUB_DEF[k].label,go:`App.closeModal();App.go('${r}')`});});});
  if(can('employees','view'))scopedUsers('employees').forEach(u=>{if(q&&fullName(u).toLowerCase().includes(q))out.push({icon:'users',label:fullName(u),sub:(u.position||'Person')+' · '+(u.department||''),go:`App.closeModal();S.search='${esc(fullName(u))}';App.go('users')`});});
  if(can('checklists','view'))(DB.checklists||[]).forEach(c=>{if(q&&(c.name||'').toLowerCase().includes(q))out.push({icon:'list',label:c.name,sub:'Checklist'+(c.department?' · '+c.department:''),go:`App.closeModal();App.go('allcl');S.search='${esc(c.name)}';rr()`});});
  const SUB=[['Roles (Access Control)','accesscontrol','acTab','roles','accessControl'],['People (Access Control)','accesscontrol','acTab','people','accessControl'],['Notifications','settings','stab','notif','settings'],['Email templates','settings','stab','templates','settings'],['Workspace data','settings','stab','data','settings']];
  SUB.forEach(([label,route,fk,fv,area])=>{if(q&&label.toLowerCase().includes(q)&&can(area,'view'))out.push({icon:'cog',label:label,sub:'Screen',go:`App.closeModal();App.go('${route}');S.filters.${fk}='${fv}';rr()`});});
  box.innerHTML=out.slice(0,12).map(r=>`<button data-go onclick="${r.go}" style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">
    <span style="width:30px;height:30px;border-radius:9px;background:var(--c-surface-2);display:grid;place-items:center;color:var(--c-text-2);flex-shrink:0">${ic(r.icon,'w-4 h-4')}</span>
    <span style="min-width:0"><span style="display:block;font-size:13px;font-weight:700;color:var(--c-text)">${esc(r.label)}</span><span style="display:block;font-size:10.5px;color:var(--c-text-3)">${esc(r.sub)}</span></span>
  </button>`).join('')||'<div style="padding:14px;font-size:12.5px;color:var(--c-text-3)">Nothing matches.</div>';
};
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();App._cmdk();}});

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.NAV_ITEMS=NAV_ITEMS;window.MOB_ADM=MOB_ADM;window.MOB_USR=MOB_USR;window.MOB_MGR=MOB_MGR;window.NAV_ALL=NAV_ALL;window.navFor=navFor;window.NAV_DAILY=NAV_DAILY;window.NAV_SECTION_OF=NAV_SECTION_OF;window.NAV_SECTION_ORDER=NAV_SECTION_ORDER;window.NAV_SECTION_ICON=NAV_SECTION_ICON;window.navSectionsFor=navSectionsFor;window.HUB_DEF=HUB_DEF;window._hubOf=_hubOf;window._hubTabsAllowed=_hubTabsAllowed;window._hubHome=_hubHome;window._hubStrip=_hubStrip;window._RETIRED_ROUTES=_RETIRED_ROUTES;window._pageInner=_pageInner;window._touchAction=_touchAction;window.render=render;window.rr=rr;window._navBadgeFor=_navBadgeFor;window._navItemHTML=_navItemHTML;window.shell=shell;window.pageContent=pageContent;
