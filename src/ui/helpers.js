

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
const esc=s=>(s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const nowHM=()=>{const d=new Date();return d.getHours()*60+d.getMinutes();};
const hm2m=t=>{if(!t)return 1440;const[h,m]=t.split(':').map(Number);return h*60+(m||0);};
const WKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS3=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtD=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
const fmtS=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'—';
const initials=u=>((u?.firstName||'?')[0]||'?')+((u?.lastName||'')[0]||'');
const fullName=u=>(u?(u.firstName||'')+' '+(u.lastName||''):'Unknown').trim()||'Unknown';
const dayAbbr=iso=>DAYS3[new Date(iso+'T00:00:00').getDay()].slice(0,3);

/* ── CASES (One-time checklists) ──
   A business-setup engagement is a CASE, not a repeating run: it opens once, stays open across
   days until every question is answered and it is submitted, then it closes. All of its answers
   live on ONE run date — the case date — so progress accumulates instead of resetting at
   midnight. caseDate() is that anchor; effDate() maps any calendar date to it, and the answer /
   submission lookups below call it so every existing page works on cases unchanged. */
const isCase=c=>!!c&&c.frequency==='One-time';
const caseDate=c=>String(c&&(c.startDate||c.createdAt)||todayISO()).slice(0,10);
const effDate=(c,date)=>isCase(c)?caseDate(c):date;
/* The submission that closed a case (any non-editing one on the case date). */
const caseSub=c=>{
  if(!isCase(c))return null;
  const subs=(DB.submissions||[]).filter(s=>s.checklistId===c.id&&s.date===caseDate(c)&&s.status!=='Editing');
  if(!needsAllSignoff(c))return subs[0]||null;               // toggle ON: one sign-off closes it
  const need=(c.assignees||[]);                              // toggle OFF: closed only once EVERYONE signed off
  if(!need.length)return subs[0]||null;
  const have=new Set(subs.map(s=>s.userId));
  if(!need.every(id=>have.has(id)))return null;
  return subs.slice().sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')))[0]||null;
};
/* A case's progress is its QUESTION progress — the answers are shared whatever the toggle says. */
const caseProg=c=>c?_ansProgress(c,caseDate(c)):{total:0,done:0,complete:false};
/* Who has signed off, for a case that needs every assignee to (toggle OFF). */
const caseSignoff=c=>{
  const need=(c&&c.assignees)||[];
  const subs=(DB.submissions||[]).filter(s=>c&&s.checklistId===c.id&&s.date===caseDate(c)&&s.status!=='Editing');
  const have=new Set(subs.map(s=>s.userId));
  const done=need.filter(id=>have.has(id)).length;
  return{done,total:need.length,complete:need.length>0&&done>=need.length,have};
};
/* SHARED vs INDIVIDUAL — the whole rule, in one place.
   Shared: one run for the team; different people answer different questions; one submission
   closes it for everyone. That is what a client CASE is by nature, and what the "Any one
   assignee can complete" toggle asks for on a recurring checklist.
   Individual (toggle off): every assignee fills and submits their OWN copy — a teammate's
   submission never closes yours. */
/* R11: a One-time client CASE always uses the shared per-question engine — per-question
   Submit, working statuses (in progress / waiting on client / waiting on authority), waiting
   notes, per-question costs and the client-facing step list. That engine IS case management;
   the toggle never turns it off.

   What the "Any one assignee can complete" toggle decides:
     - recurring checklist → ON: one shared run. OFF: everyone fills their own copy.
     - One-time CASE      → its own switch, "Every assignee must sign off": OFF (the default)
                            any one assignee closes it; ON every assignee signs off first.
                            Either way they all work the SAME shared questions.

   That case switch lives on tm_checklist_meta, NOT on checklists.any_one: the checklists
   table is written by a whole-table upsert from every client, so a tab holding a stale cache
   silently reverts server-side edits to it. tm_checklist_meta is targeted-write only. */
const isShared=c=>!!c&&(isCase(c)||c.anyOne===true);
const needsAllSignoff=c=>!!c&&isCase(c)&&((DB.tmMeta||{})[c.id]||{}).requireSignoff===true;

function clOn(c,date){if(c.status&&c.status!=='Active')return false;
  if(c.startDate&&date<String(c.startDate).slice(0,10))return false;
  if(c.endDate&&date>String(c.endDate).slice(0,10))return false; // hard stop — cases included
  if(c.frequency==='One-time'){
    // Open: shows every day from the case date on. Closed: shows through its completion day,
    // then stops appearing on later days (it lives on in All results / the client file).
    const cs=caseSub(c);
    if(!cs)return date>=caseDate(c);
    const doneDay=String(cs.submittedAt||'').slice(0,10)||caseDate(c);
    return date>=caseDate(c)&&date<=doneDay;
  }
  const dy=dayAbbr(date);
  const dn=new Date(date+'T00:00:00').getDate();
  if(c.frequency==='Daily'){
    /* Daily means every day. The builder no longer offers a weekday sub-choice, but a row saved
       by an older build (or by the full platform against the same database) can still carry one —
       honour it rather than silently changing that checklist's schedule. Re-saving it here
       normalises it away. */
    if(!c.schedule||c.schedule==='Every day')return true;
    return(c.selectedDays||[]).length?(c.selectedDays||[]).includes(dy):true;
  }
  if(c.frequency==='Weekly')return(c.selectedDays||[]).includes(dy);
  if(c.frequency==='Monthly'){
    const lastDay=new Date(new Date(date+'T00:00:00').getFullYear(),new Date(date+'T00:00:00').getMonth()+1,0).getDate();
    const isLast=dn===lastDay;
    const sdt=(c.selectedDates||[]).map(x=>x==='L'?'L':Number(x));
    return sdt.includes(dn)||(isLast&&sdt.includes('L'));
  }
  if(c.frequency==='Custom')return(c.customDates||[]).includes(date);
  return true;
}

window._toast=undefined;
function toast(msg,type='ok'){
  let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;z-index:500;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));pointer-events:none';document.body.appendChild(t);}
  const bg=type==='ok'?'#15171C':type==='warn'?'#D97706':'#DC2626';
  t.innerHTML=`<div class="pop" style="display:flex;align-items:flex-start;gap:7px;background:${bg};color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.25);max-width:min(92vw,480px);line-height:1.45"><span style="flex-shrink:0;margin-top:1px">${type==='ok'?ic('check','w-3.5 h-3.5'):ic('alert','w-3.5 h-3.5')}</span><span style="min-width:0;overflow-wrap:anywhere">${esc(msg)}</span></div>`;
  clearTimeout(_toast);clearTimeout(_toastAction);_toast=setTimeout(()=>{if(t)t.innerHTML='';},2800);
}
/* toastAction(msg,type,{label,fn,ms}) — a toast with ONE inline action button (Undo / Retry).
   `fn` is a STRING of JS run on click (e.g. "App._undoDel('x')"). Stays up longer (default 6s)
   so the user can act. Presentation-only; reuses #toast so the test harness still reads it. */
window._toastAction=null;
function toastAction(msg,type='ok',{label='Undo',fn='',ms=6000}={}){
  let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;z-index:500;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));pointer-events:none';document.body.appendChild(t);}
  const bg=type==='ok'?'#15171C':type==='warn'?'#D97706':'#DC2626';
  t.innerHTML=`<div class="pop" style="display:flex;align-items:center;gap:14px;background:${bg};color:#fff;padding:10px 12px 10px 18px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.25);pointer-events:auto;max-width:calc(100vw - 32px)"><span style="min-width:0;display:inline-flex;align-items:center;gap:7px">${type==='ok'?ic('check','w-3.5 h-3.5'):ic('alert','w-3.5 h-3.5')}<span>${esc(msg)}</span></span>${fn?`<button onclick="(()=>{const t=document.getElementById('toast');if(t)t.innerHTML='';})();${fn}" style="flex-shrink:0;background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:800;cursor:pointer;min-height:34px">${esc(label)}</button>`:''}</div>`;
  clearTimeout(_toast);clearTimeout(_toastAction);_toastAction=setTimeout(()=>{if(t)t.innerHTML='';},ms);
}

/* ═══════════════ C1 — CONSISTENT ERROR SURFACING ═══════════════
   ONE pattern for save / permission / network failures so handlers never fail silently.
   - _syncErr(label)  → a .catch handler for a targeted single-row Supabase write.
   - _opErr(e,ctx)    → surface a caught exception from a user-initiated op.
   - _reportSyncResults(results,labels) → for the _sync Promise.allSettled batch; toasts ONCE
       (debounced ≤1/10s) naming the table(s) that failed so the user knows their change didn't persist. */
window._lastSyncErrToast=0;

/* ===== ICONS ===== */
const I={
  grid:'<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  dept:'<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  check:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  approve:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
  tree:'<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M12 12H5v4M12 12h7v4"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
  audit:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  cog:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  cam:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevR:'<path d="M9 18l6-6-6-6"/>',
  chevD:'<path d="M6 9l6 6 6-6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
  key:'<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  filter:'<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  help:`<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>`,
  ticket:`<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>`,
  eye:`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  eyeOff:`<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`,
  user:`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  download:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
  upload:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,
  send:`<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,
  shield:`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  refresh:`<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  menu:`<path d="M3 12h18M3 6h18M3 18h18"/>`,
  calendar:`<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>`,
  receipt:`<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7h8M8 11h8M8 15h5"/>`,
  paperclip:`<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>`,
  image:`<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>`,
  sheet:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>`,
  globe:`<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  party:`<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/>`,
  broom:`<path d="M19.4 14.5 17 12m2.4 2.5L12 22l-4-4 7.5-7.4m3.9 3.9L21 13l-3-3-2.6 2.6m-3.9 3.9L7.5 8.6 13 3l3 3-5.4 5.5"/>`,
  info:`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>`,
  link:`<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  mail:`<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`,
};
const ic=(n,cls='w-5 h-5',sw=2)=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[n]||''}</svg>`;
// Map a file extension to an SVG icon (doc/sheet/image/paperclip). cls keeps tiles consistent.
const _fileIcon=(ext,cls='w-5 h-5')=>{ext=(ext||'').toLowerCase();const n=ext==='pdf'?'doc':/xlsx?|csv/.test(ext)?'sheet':/docx?/.test(ext)?'doc':/pptx?/.test(ext)?'sheet':/png|jpe?g|gif|webp|bmp/.test(ext)?'image':'paperclip';return ic(n,cls);};

/* ===== STATUS CHIPS ===== */
const CHIP_STYLE={"On Time":"background:#ECFDF5;color:#047857","Submitted":"background:#ECFDF5;color:#047857","Pending":"background:#FFFBEB;color:#B45309","Late":"background:#FFF1F2;color:#BE123C","Pending Approval":"background:#FFF7ED;color:#C2410C","Rejected":"background:#FFF1F2;color:#9F1239","Active":"background:#ECFDF5;color:#047857","Inactive":"background:#F6F7F8;color:#9CA3AF","Approved":"background:#ECFDF5;color:#047857","Editing":"background:#EFF6FF;color:#1D4ED8","Upcoming":"background:#FAF5FF;color:#7E22CE","Draft":"background:#F6F7F8;color:#9CA3AF","Open":"background:#FFF7ED;color:#C2410C","In Progress":"background:#EFF6FF;color:#1D4ED8","Resolved":"background:#ECFDF5;color:#047857","Closed":"background:#F6F7F8;color:#9CA3AF"};
const CHIP_DOT_C={"On Time":"#10B981","Submitted":"#10B981","Pending":"#F59E0B","Late":"#F43F5E","Pending Approval":"#F97316","Rejected":"#9F1239","Active":"#10B981","Inactive":"#D1D5DB","Approved":"#10B981","Editing":"#3B82F6","Upcoming":"#A855F7","Draft":"#9CA3AF","Open":"#F97316","In Progress":"#3B82F6","Resolved":"#10B981","Closed":"#D1D5DB"};
const chip=s=>{const st=CHIP_STYLE[s]||'background:#FFFBEB;color:#B45309';const dot=CHIP_DOT_C[s]||'#F59E0B';return`<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;${st}"><span style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0"></span>${esc(s)}</span>`;};

/* ===== AVATARS ===== */
const PAL=['bg-rose-100 text-rose-700','bg-amber-100 text-amber-700','bg-emerald-100 text-emerald-700','bg-sky-100 text-sky-700','bg-violet-100 text-violet-700','bg-orange-100 text-orange-700','bg-teal-100 text-teal-700'];
const avatar=(u,sz='w-9 h-9',tx='text-xs')=>{if(!u)return'<div class="'+sz+' bg-ink-200 rounded-full grid place-items-center '+tx+' shrink-0">?</div>';return`<div class="${sz} ${PAL[((u.firstName||'?').charCodeAt(0)+(u.lastName||'?').charCodeAt(0))%PAL.length]} rounded-full grid place-items-center font-semibold ${tx} shrink-0 fd">${esc(initials(u))}</div>`;}

/* ═══════════════ SHARED UI — token-driven design system ═══════════════
   ONE button helper btn() with variants; btnP/btnG kept as thin aliases so every
   existing call site (and the tests) keep working. New code can call btn() directly. */
const hdr=(t,s,a='')=>`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:22px;flex-wrap:wrap"><div style="min-width:0"><h1 class="fd" style="font-size:var(--fs-h1);font-weight:800;letter-spacing:-.6px;line-height:1.15;color:var(--c-text)">${esc(t)}</h1>${s?`<p style="font-size:14px;color:var(--c-text-2);margin-top:4px">${esc(s)}</p>`:''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start">${a}${(typeof HOW!=='undefined'&&S.uid&&HOW[S.route])?`<button onclick="App._howModal()" title="How this entire tab works" aria-label="How this tab works" style="width:34px;height:34px;flex-shrink:0;border-radius:10px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text-2);cursor:pointer;display:grid;place-items:center;font-size:15px;font-weight:800">?</button>`:''}</div></div>`;
const pageHeader=hdr;
function btn(label,onclick,opts={}){
  const v=opts.variant||'primary',sz=opts.size||'md',i=opts.icon||'';
  const dis=opts.disabled?' aria-disabled="true"':'';
  const extra=opts.attrs?(' '+opts.attrs):'';
  return `<button type="button" onclick="${onclick}" class="ui-btn ui-btn-${v} ui-btn-${sz}"${dis}${extra}>${i?ic(i,sz==='sm'?'w-4 h-4':'w-[18px] h-[18px]'):''}${esc(label)}</button>`;
}
const btnP=(l,o,i='')=>btn(l,o,{variant:'primary',icon:i});
const btnG=(l,o,i='')=>btn(l,o,{variant:'ghost',icon:i});
const btnDanger=(l,o,i='')=>btn(l,o,{variant:'danger',icon:i});
const fld=(l,id,v='',t='text',p='')=>`<div><label for="${id}" class="ui-label">${l}</label><input id="${id}" type="${t}" value="${esc(v)}" placeholder="${esc(p)}" class="ui-input rf"/></div>`;
const selF=(l,id,opts,sv='')=>`<div><label for="${id}" class="ui-label">${l}</label><select id="${id}" class="ui-select rf">${opts.map(o=>`<option value="${esc(Array.isArray(o)?o[0]:o)}" ${(Array.isArray(o)?o[0]:o)===sv?'selected':''}>${esc(Array.isArray(o)?o[1]:o)}</option>`).join('')}</select></div>`;
function mkTog(id,on,label){return`<div class="flex items-center justify-between" style="padding:7px 0;min-height:40px"><span style="font-size:14px;color:var(--c-text)">${label}</span><button id="${id}" role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="this.classList.toggle('on');this.classList.toggle('off');this.setAttribute('aria-checked',this.classList.contains('on'))"><span></span></button></div>`;}
/* card(inner,{pad,head,headRight,attrs}) — standard surface */
/* Password field with a show/hide eye. Same shape as fld() so it drops straight in, but the
   input sits in a relative wrapper with the toggle pinned to the right; the button swaps the
   input's type rather than re-rendering, so the caret and any typed value survive. */
function fldPw(label,id,val,ph,hint){
  return `<div>
    <label for="${id}" class="block text-xs font-semibold text-ink-500 mb-1.5">${esc(label)}</label>
    <div style="position:relative">
      <input id="${id}" type="password" value="${esc(val||'')}" placeholder="${esc(ph||'')}" autocomplete="new-password"
        class="w-full bg-white border-2 border-ink-200 rounded-xl px-3 py-2.5 text-sm rf" style="padding-right:44px"/>
      <button type="button" tabindex="-1" aria-label="Show password" title="Show password"
        onclick="App._togPw('${id}',this)"
        style="position:absolute;right:6px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:grid;place-items:center;border:none;background:transparent;color:var(--c-text-3);cursor:pointer;border-radius:8px">${ic('eye','w-4 h-4')}</button>
    </div>
    ${hint?`<p class="text-[11px] text-ink-400 mt-1">${esc(hint)}</p>`:''}
  </div>`;
}
/* ── CLIENTS ──
   A client is attached to a CHECKLIST (c.locationIds). Everything else — a submission, a
   ticket, an answer — reaches its client through the checklist it belongs to, which is why
   these three helpers exist rather than a client field on every record. */
const clientsOf=c=>(((c&&c.locationIds)||[]).map(id=>locById(id)).filter(Boolean));
const clientIdsOf=c=>(((c&&c.locationIds)||[]).slice());
const clientIdsOfTicket=t=>{const c=(t&&t.checklistId)?clById(t.checklistId):null;return c?clientIdsOf(c):[];};
/* True when the record belongs to the selected client (empty selection = no filtering). */
const matchesClient=(ids,sel)=>!sel||(ids||[]).includes(sel);
/* ── ONE FILTER BAR, EVERY LIST PAGE ──
   Checklists, All results, Team, Tickets, Clients, People, Questions and Audit all render their
   filter row through these. Same card, same padding, same control height everywhere, so no page
   drifts on its own the next time one of them is edited. A test asserts every list page uses
   FILTER_BAR_ST rather than hand-rolling the row. */
const FILTER_BAR_ST='display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;margin-bottom:12px';
const FILTER_SEL_ST='font-size:12.5px;padding:6px 26px 6px 10px;min-height:0;height:34px;width:auto';
const filterBar=inner=>`<div class="ui-card" style="${FILTER_BAR_ST}">${inner}</div>`;
const filterLabel=t=>`<span style="font-size:11.5px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">${esc(t||'Filter')}</span>`;
/* Search box for a filter bar. `filterKey` is the S.filters key it writes; the debounced re-render
   keeps the caret where the user left it (App._searchRR). */
const filterSearch=(id,filterKey,placeholder)=>`<div style="position:relative;flex:1;min-width:170px">
    <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-text-3);pointer-events:none">${ic('search','w-4 h-4')}</span>
    <input id="${esc(id)}" value="${esc((S.filters||{})[filterKey]||'')}" oninput="S.filters.${filterKey}=this.value;App._searchRR('${esc(id)}')" placeholder="${esc(placeholder||'Search…')}" class="ui-input" style="padding-left:34px;min-height:0;height:34px;font-size:13px"/>
  </div>`;
const filterSelect=(filterKey,allLabel,opts,cur)=>`<select onchange="S.filters.${filterKey}=this.value;rr()" class="ui-select" style="${FILTER_SEL_ST}" aria-label="${esc(allLabel)}">
    <option value="">${esc(allLabel)}</option>
    ${(opts||[]).map(o=>{const v=(o&&o.value!==undefined)?o.value:o,l=(o&&o.label!==undefined)?o.label:o;return `<option value="${esc(v)}" ${String(cur||'')===String(v)?'selected':''}>${esc(l)}</option>`;}).join('')}
  </select>`;
const filterClear=keys=>`<button onclick="[${(keys||[]).map(k=>"'"+k+"'").join(',')}].forEach(k=>delete S.filters[k]);rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`;
const filterCount=text=>`<span style="font-size:11.5px;color:var(--c-text-3);font-weight:600;margin-left:auto">${esc(text)}</span>`;

/* One consistent Client <select> for every filter bar. */
function clientFilter(filterKey,style){
  const opts=(DB.locations||[]).filter(l=>l.status!=='Inactive').sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  if(!opts.length)return'';
  const cur=(S.filters||{})[filterKey]||'';
  return `<select onchange="S.filters.${filterKey}=this.value;rr()" class="ui-select" style="${style||'font-size:12.5px;padding:6px 26px 6px 10px;min-height:0;height:34px;width:auto'}" aria-label="Filter by client">
    <option value="">All clients</option>
    ${opts.map(l=>`<option value="${esc(l.id)}" ${cur===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}
  </select>`;
}

function card(inner,opts={}){
  const head=opts.head?`<div class="ui-card-head"><span class="ui-card-title">${opts.head}</span>${opts.headRight||''}</div>`:'';
  const body=opts.pad===false?inner:`<div class="ui-card-pad">${inner}</div>`;
  return `<div class="ui-card"${opts.attrs?(' '+opts.attrs):''}>${head}${body}</div>`;
}
/* countBadge(n,tone) — unifies the 3x hand-written nav badges */
const COUNT_TONE={danger:'#EF4444',approve:'#F97316',rose:'#E11D48',brand:'#0E9F6E'};
const countBadge=(n,tone='danger',extra='')=>!n?'':`<span class="ui-count" style="background:${COUNT_TONE[tone]||tone};${extra}">${n}</span>`;
/* badge(text,tone) — generic soft pill */
const BADGE_TONE={brand:['var(--c-brand-soft)','var(--c-brand-ink)'],success:['var(--c-success-soft)','var(--c-success-ink)'],warn:['var(--c-warn-soft)','var(--c-warn-ink)'],danger:['var(--c-danger-soft)','var(--c-danger-ink)'],info:['var(--c-info-soft)','var(--c-info-ink)'],neutral:['var(--c-surface-2)','var(--c-text-2)']};
const badge=(text,tone='neutral')=>{const[bg,fg]=BADGE_TONE[tone]||BADGE_TONE.neutral;return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:var(--r-pill);font-size:12px;font-weight:700;background:${bg};color:${fg}">${esc(text)}</span>`;};
/* chipBar(items,activeKey,fnName,opts) — ONE tab/segment bar.
   items: [[key,label,count?],...]  fnName is a STRING like 'App.x' called as fnName('key').
   opts.style: 'segment'(default)|'pill'. Preserves existing onclick strings via fnName. */
function chipBar(items,activeKey,fnName,opts={}){
  const pill=opts.style==='pill';
  const cls=pill?'ui-tab-pill':'ui-tab';
  const inner=items.map(it=>{const[k,l,c]=Array.isArray(it)?it:[it,it];const on=k===activeKey;
    return `<button type="button" class="${cls}${on?' on':''}" onclick="${fnName}('${k}')">${esc(l)}${c?`<span style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border-radius:var(--r-pill);padding:1px 6px;min-width:16px;background:${on?'rgba(255,255,255,.22)':'var(--c-border)'};color:${on?'#fff':'var(--c-text-2)'}">${c}</span>`:''}</button>`;
  }).join('');
  return pill?`<div style="display:flex;gap:8px;flex-wrap:wrap;overflow-x:auto;-webkit-overflow-scrolling:touch">${inner}</div>`:`<div class="ui-tabs">${inner}</div>`;
}
const togV=id=>{const el=$(`#${id}`);if(!el)return false;return el.classList?.contains('on')||false;};
const STAT_C={sky:'#0284C7',brand:'#0E9F6E',rose:'#E11D48',amber:'#D97706',orange:'#EA580C',emerald:'#059669'};
const statCard=(t,v,c='sky',oc='')=>{
  const col=STAT_C[c]||c||'#0284C7';
  const base='background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px';
  const lbl='<div style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">'+t+'</div>';
  const val='<div class="fd" style="font-size:30px;font-weight:800;line-height:1;color:'+col+'">'+v+'</div>';
  if(oc){
    return '<div class="stat-card-click" onclick="'+oc+'" data-col="'+col+'" style="'+base+';cursor:pointer;transition:border-color .15s,box-shadow .15s">'
      +lbl+val
      +'<div style="font-size:12px;color:var(--c-text-3);margin-top:8px;display:flex;align-items:center;gap:3px">Details '+ic('chevR','w-3 h-3')+'</div>'
      +'</div>';
  }
  return '<div style="'+base+'">'+lbl+val+'</div>';
};
const empty=(i,t,s)=>`<div style="text-align:center;padding:40px 24px"><div style="width:56px;height:56px;border-radius:var(--r-lg);background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center;margin:0 auto 14px">${ic(i,'w-6 h-6')}</div><p class="fd" style="font-weight:700;color:var(--c-text);font-size:15.5px">${esc(t)}</p>${s?`<p style="font-size:13px;color:var(--c-text-3);margin-top:5px;max-width:340px;margin-left:auto;margin-right:auto;line-height:1.55">${esc(s)}</p>`:''}</div>`;
const emptyState=empty;
/* emptyCTA(icon,title,sub,ctaLabel,onclick) — X7: an empty state WITH a primary call-to-action.
   Use where the user can do something about the emptiness (e.g. "No leave yet → Apply for leave"). */
const emptyCTA=(i,t,s,ctaLabel,onclick)=>`<div style="text-align:center;padding:48px 24px"><div style="width:52px;height:52px;border-radius:var(--r-lg);background:var(--c-surface-2);color:var(--c-text-3);display:grid;place-items:center;margin:0 auto 14px">${ic(i,'w-6 h-6')}</div><p class="fd" style="font-weight:700;color:var(--c-text-2);font-size:15px">${esc(t)}</p>${s?`<p style="font-size:13px;color:var(--c-text-3);margin-top:5px;max-width:340px;margin-left:auto;margin-right:auto">${esc(s)}</p>`:''}${ctaLabel?`<div style="margin-top:16px">${btn(ctaLabel,onclick,{variant:'primary',size:'sm',icon:'plus'})}</div>`:''}</div>`;
/* loadingState — skeleton/spinner block */
const loadingState=(label='Loading…')=>`<div style="text-align:center;padding:48px 24px"><div style="display:flex;flex-direction:column;gap:10px;max-width:360px;margin:0 auto 16px"><div class="ui-skel" style="height:14px;width:60%"></div><div class="ui-skel" style="height:48px"></div><div class="ui-skel" style="height:48px"></div></div><p style="font-size:13px;color:var(--c-text-3)">${esc(label)}</p></div>`;
/* errorState(title,sub,retryOnclick) — inline error panel for a failed lazy load */
const errorState=(t='Something went wrong',s='',retry='')=>`<div style="text-align:center;padding:48px 24px"><div style="width:52px;height:52px;border-radius:var(--r-lg);background:var(--c-danger-soft);color:var(--c-danger);display:grid;place-items:center;margin:0 auto 14px">${ic('alert','w-6 h-6')}</div><p class="fd" style="font-weight:700;color:var(--c-text);font-size:15px">${esc(t)}</p>${s?`<p style="font-size:13px;color:var(--c-text-2);margin-top:5px">${esc(s)}</p>`:''}${retry?`<div style="margin-top:16px">${btn('Try again',retry,{variant:'ghost',size:'sm',icon:'refresh'})}</div>`:''}</div>`;

/* ===== MODAL ===== */
window._modalLastFocus=null;
function openModal(html,size='max-w-lg'){
  let m=$('#modal');
  // In-place re-render detection: if a dialog is already open, this is a rebuild (a field inside the
  // modal triggered a re-render). Preserve its scroll position and skip the auto-focus so the view
  // doesn't jump back to the top on every change.
  const _prevDlg=m&&m.firstElementChild, _reentry=!!_prevDlg, _prevScroll=_prevDlg?_prevDlg.scrollTop:0;
  if(!m){m=document.createElement('div');m.id='modal';document.body.appendChild(m);}
  _modalLastFocus=document.activeElement;
  m.className='fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6';m.style.cssText='background:rgba(10,11,14,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';
  m.innerHTML=`<div role="dialog" aria-modal="true" aria-label="Dialog" class="pop w-full ${size} md:rounded-[20px] rounded-t-[22px] max-h-[92vh] overflow-y-auto" style="background:var(--c-surface);border:1px solid var(--c-border);box-shadow:var(--sh-pop)">${html}</div>`;
  m.onclick=e=>{if(e.target===m)closeModal();};
  // Focus management: focus the dialog (or first input), Esc to close, basic focus trap.
  const dlg=m.firstElementChild;
  if(_reentry&&_prevScroll)dlg.scrollTop=_prevScroll; // keep scroll position across the rebuild
  m.onkeydown=e=>{
    if(e.key==='Escape'){closeModal();return;}
    if(e.key!=='Tab')return;
    const f=[...dlg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
    if(!f.length)return;const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  // Only auto-focus on a FRESH open — re-renders keep the user where they were (no scroll jump).
  if(!_reentry)setTimeout(()=>{const fi=dlg.querySelector('input,select,textarea,button');try{(fi||dlg).focus({preventScroll:true});}catch(_){(fi||dlg).focus&&(fi||dlg).focus();}},30);
}
const closeModal=()=>{const m=$('#modal');if(m&&m.remove)m.remove();try{if(_modalLastFocus&&_modalLastFocus.focus)_modalLastFocus.focus();}catch(e){}_modalLastFocus=null;};
/* modalShell({title,body,footer,size}) — consistent header(X)+scroll body+footer row.
   Existing call sites that hand-roll headers still work; new code uses this. */
function modalShell({title='',sub='',body='',footer='',size='max-w-lg'}={}){
  openModal(`<div style="position:sticky;top:0;z-index:2;background:var(--c-surface);border-bottom:1px solid var(--c-border);padding:16px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-radius:20px 20px 0 0">
    <div style="min-width:0"><h2 class="fd" style="font-size:18px;font-weight:800;color:var(--c-text)">${esc(title)}</h2>${sub?`<p style="font-size:13px;color:var(--c-text-2);margin-top:2px">${esc(sub)}</p>`:''}</div>
    <button type="button" onclick="App.closeModal()" aria-label="Close" style="flex-shrink:0;width:34px;height:34px;border-radius:10px;border:none;background:var(--c-surface-2);color:var(--c-text-2);cursor:pointer;display:grid;place-items:center">${ic('x','w-4 h-4')}</button>
  </div>
  <div style="padding:20px">${body}</div>
  ${footer?`<div style="position:sticky;bottom:0;background:var(--c-surface);border-top:1px solid var(--c-border);padding:14px 20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">${footer}</div>`:''}`,size);
}
/* confirmModal({title,body,confirmLabel,danger,onConfirm}) — a styled confirm dialog to replace
   raw confirm(). `onConfirm` is a STRING of JS executed on confirm (after closing the modal). */
function confirmModal({title='Are you sure?',body='',confirmLabel='Confirm',cancelLabel='Cancel',danger=false,onConfirm=''}={}){
  modalShell({title,body:`<p style="font-size:14px;color:var(--c-text-2);line-height:1.55">${body}</p>`,size:'max-w-sm',
    footer:`${btn(cancelLabel,'App.closeModal()',{variant:'ghost',size:'md'})}${btn(confirmLabel,`App.closeModal();${onConfirm}`,{variant:danger?'danger':'primary',size:'md'})}`});
}
const App={};window.App=App;App.closeModal=closeModal;App.confirmModal=confirmModal;

window._notifCache={uid:null,count:0,ts:0};
function _notifCount(){
  const uid=S.uid;if(!uid)return 0;
  const now=Date.now();
  // Cache for 3 seconds to avoid recalculating on every rr()
  if(_notifCache.uid===uid&&now-_notifCache.ts<3000)return _notifCache.count;
  let count=0;
  // The approvals component uses the inbox count, so the nav/notif badge reflects every
  // pending decision rather than just the ones on this page.
  count+=_approvalPendingCount();
  count+=DB.notifications.filter(n=>n.userId===uid&&!n.read).length;
  // Count unviewed tickets assigned to me
  const unviewedTickets=(DB.tickets||[]).filter(t=>t.assignedTo===uid&&!(t.viewedBy||[]).includes(uid)).length;
  count+=unviewedTickets;
  _notifCache={uid,count,ts:now};
  return count;
}
function _invalidateNotifCache(){_notifCache.ts=0;}

// B11 fix: recover submissions stuck in 'Editing' if RUN cache lost
function _recoverEditingSubmissions(){
  if(!DB.submissions)return;
  DB.submissions.forEach(s=>{
    if(s.status==='Editing'){
      if(RUN[s.checklistId]){
        // Already has an active RUN — restore questionResponses into it
        if(!RUN[s.checklistId].questionResponses&&s.questionResponses)
          RUN[s.checklistId].questionResponses=JSON.parse(JSON.stringify(s.questionResponses||[]));
      } else {
        // No active RUN — reset status
        const today=todayISO();
        const cl=clById(s.checklistId);const late=s.date<today||(s.date===today&&cl?.scheduleTime&&nowHM()>hm2m(cl.scheduleTime));
        s.status=s.editCount>0?(late?'Late':'On Time'):(late?'Late':'Pending');
        console.info('Recovered stuck submission:',s.id,'→',s.status);
      }
    }
  });
}

/* ── "HOW THIS WORKS" bars — every complex page explains itself in one sentence,
      with chips linking to the tabs it feeds / reads from. ── */
const HOW={
  dashboard:{t:'Your day at a glance: what needs you, what is still open, and quick actions. Most people never need another tab.',d:['Cards show today\'s checklists and the tickets on you — tap either to act.','“My record” is your own submission history over a date range you pick.','Managers and admins also see where the whole team stands today.'],l:[['mychecklists','My Checklists'],['approvals','Approvals']]},
  mychecklists:{t:'Everything assigned to YOU, day by day. Pick a date on the strip; submit each card.',d:['Miss the due time → the card turns LATE (red) and analytics record it.','Whether you may submit past/future dates or edit comes from your Personal settings.','A checklist set to “any one can complete” counts as done once a teammate submits it.'],l:[['tickets','Tickets'],['approvals','Approvals']]},
  tickets:{t:'Issues raised by people or auto-created when a checklist answer breaches a rule.',d:['Bad answers on escalation questions open tickets automatically and re-escalate while open.','Resolve with a note — the submitter is notified.'],l:[['mychecklists','My Checklists'],['questions','Questions']]},
  teamview:{t:'Live board of your team: today\'s checklist status, lates and open tickets per person. Click someone to drill into their calendar.',l:[['users','Users'],['approvals','Approvals']]},
  users:{t:'The people directory: identity, manager, workplace and status.',d:['“Reports to” decides who approves this person\'s submissions and who sees them in Team.','Access is NOT set here — one role per person in Access Control.','Deactivating someone unassigns their open tickets so nothing sits in an unwatched queue.'],l:[['accesscontrol','Access Control'],['hierarchy','Hierarchy']]},
  hierarchy:{t:'The reporting tree, drawn from each person\'s “Reports to”. Fix structure in Users.',l:[['users','Users']]},
  checklists:{t:'Build recurring task lists: frequency, assignees, questions, due time.',d:['On due days they appear in each assignee\'s My Checklists; late submissions are flagged.','Attach questions to capture numbers/photos — escalation rules can open tickets.'],l:[['questions','Questions'],['allcl','All Checklists']]},
  allcl:{t:'Every checklist in the company in one list — edit, duplicate or reassign.',l:[['checklists','Create Checklist']]},
  questions:{t:'The reusable question bank checklists pull from — with types, photo/comment rules and escalation.',d:['An escalation rule turns a bad answer into a ticket automatically.','Questions can be shared company-wide or kept to one department.'],l:[['checklists','Create Checklist'],['tickets','Tickets']]},
  approvals:{t:'One inbox for every checklist decision waiting on you: submissions and edit requests.',d:['Approve/reject inline; the requester is notified instantly.','Filter by type and use “Approve all” for bulk.'],l:[['teamview','Team'],['mychecklists','My Checklists']]},
  notifications:{t:'Every alert lands here (and is queued for email once a provider is connected). Tap one to jump to the right tab.',l:[['settings','Settings']]},
  analytics:{t:'The company view: on-time rate, submissions by department and person, compliance and tickets — with CSV export.',d:['Every chart is clickable — tap a slice or bar to see the rows behind it.','Filters at the top drive every chart and the export together.'],l:[['allcl','All Checklists'],['tickets','Tickets']]},
  locations:{t:'Your clients. Attach one or more to a checklist so it only runs for that client, and keep their folders and documents here.',d:['Filter any list by client to see just that account’s work.','Each client holds its own folders and files under the Documents tab.'],l:[['checklists','Create Checklist'],['allcl','All Checklists']]},
  departments:{t:'Departments and sub-departments — the grouping behind checklist scope, question sharing and reporting.',l:[['users','Users'],['questions','Questions']]},
  settings:{t:'Notification switches, email templates and the workspace data export.',d:['“In-App” and “Email” toggle individual events; “Feature switches” silences a whole feature at once.','Templates control the wording of every email the app sends.'],l:[['notifications','Notifications']]},
  audit:{t:'Every action anyone takes, filterable by person, department and tab. If you wonder “who changed this?” — the answer is here.',l:[['accesscontrol','Access Control']]},
  profile:{t:'Your own details and password.',l:[]},
  accesscontrol:{t:'One rule runs everything: a ROLE is a bundle of switches (which tabs, which buttons) — give each person ONE role, done. “Personal” only holds personal facts: past/future submission rights, cities and folders.',d:['Edit a role → everyone with it changes instantly.','You can never remove the last person holding Access Control.','Preview shows exactly what a person can open and do before you save.'],l:[['users','Users'],['audit','Audit']]},
};

App._howModal=()=>{
  const h=HOW[S.route];if(!h)return;
  const nav=navFor().find(n=>n[0]===S.route);
  modalShell({title:'How this tab works',sub:nav?nav[2]:'',size:'max-w-md',
    body:`<div style="font-size:13.5px;color:var(--c-text);line-height:1.65">${h.t}</div>
      ${h.d?`<div style="margin-top:12px;border-top:1px dashed var(--c-border);padding-top:10px">${h.d.map(x=>`<div style="display:flex;gap:8px;font-size:12.5px;color:var(--c-text-2);line-height:1.55;padding:4px 0"><span style="color:var(--c-brand-ink);font-weight:800;flex-shrink:0">→</span><span>${x}</span></div>`).join('')}</div>`:''}
      ${h.l&&h.l.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;align-items:center"><span style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase">Linked tabs:</span>${h.l.filter(x=>navFor().some(n=>n[0]===x[0])).map(x=>`<button onclick="App.closeModal();App.go('${x[0]}')" class="ui-btn ui-btn-ghost ui-btn-sm">${x[1]} →</button>`).join('')}</div>`:''}`,
    footer:btnP('Got it','App.closeModal()')});
};
/* ════════ REFERENTIAL-INTEGRITY DELETE GUARDS ════════
   guardDelete(type,id,label) → true when the record has no LIVE links and deletion may proceed.
   Otherwise it opens a modal naming every link (grouped, first 5 names + count) and returns false.
   Wire it at the TOP of a delete handler, before the confirm() prompt.
   Live links only: pure history (past submissions, decided approvals, finished leave) never
   blocks — for people, 'Disable' remains the way to retire someone while keeping history. */
function _refLinks(type,id){
  const L=[];const today=todayISO();
  const add=(label,names,hint)=>{const nn=(names||[]).filter(Boolean);if(nn.length)L.push({label,names:nn,hint:hint||''});};
  if(type==='user'){
    const u=uById(id);
    add('Manages people',DB.users.filter(x=>x.managerId===id).map(x=>fullName(x)),'Reassign their manager in the user editor first');
    add('Assigned to checklists',DB.checklists.filter(c=>(c.assignees||[]).includes(id)).map(c=>c.name),'Unassign them in the checklist editor');
    add('Pending approvals',(DB.approvals||[]).filter(a=>a.requesterId===id&&a.status==='Pending').map(a=>(a.type||'Approval')+(a.date?' · '+fmtS(a.date):'')),'Decide them in the Approvals inbox');
    add('Open tickets assigned to them',(DB.tickets||[]).filter(t=>t.assignedTo===id&&(t.status==='Open'||t.status==='In Progress')).map(t=>t.title||'Ticket'),'Reassign or resolve those tickets first');
    add('Assets not returned',((u&&u.hrm&&u.hrm.assets)||[]).filter(a=>a.status!=='Returned').map(a=>a.name),'Mark the asset returned (or remove the record) in the user editor');
    add('Active lifecycle flows',(DB.flows||[]).filter(f=>f.userId===id&&f.status!=='Completed').map(f=>f.kind||'Flow'),'Complete or remove the flow in Lifecycle');
    add('Open tickets assigned',(DB.tickets||[]).filter(t=>t.assignedTo===id&&t.status==='Open').map(t=>t.title||('#'+String(t.id||'').slice(-6))),'Resolve or reassign the ticket');
    add('Letters awaiting action',(DB.letters||[]).filter(l=>l.userId===id&&l.status==='Requested').map(l=>l.title||l.type),'Decide the letter request first');
    add('Pending expense claims',(DB.expenses||[]).filter(x=>x.userId===id&&x.status==='pending').map(x=>(x.category||'Expense')+(x.amount?' · '+x.amount:'')),'Approve or reject the claim');
    add('Active SOP / onboarding instances',(DB.sopInstances||[]).filter(i=>i.userId===id&&i.status!=='Completed').map(i=>{const t=(DB.sopTemplates||[]).find(x=>x.id===i.templateId);return(t&&t.name)||'SOP';}),'Complete or remove the instance');
  }else if(type==='department'){
    const d=DB.departments.find(x=>x.id===id);const nm=d?d.name:'';
    add('Sub-departments',subDepts(id).map(k=>k.name),'Delete or re-parent them first');
    add('People in this department',DB.users.filter(x=>x.department===nm).map(x=>fullName(x)),'Move them to another department');
    add('Checklists targeting it',DB.checklists.filter(c=>c.department===nm).map(c=>c.name),'Edit the checklist’s department');
  }else if(type==='location'){
    add('Checklists attached to it',(DB.checklists||[]).filter(c=>(c.locationIds||[]).includes(id)).map(c=>c.name),'Detach the client in the checklist editor');
    add('Folders held against it',(DB.tmFolders||[]).filter(f=>f.locationId===id).map(f=>f.name),'Delete the folders first — their files go with them');
    add('Files held against it',(DB.tmDocuments||[]).filter(d=>d.locationId===id).map(d=>d.name),'Delete the files first');
  }else if(type==='checklist'){
    const c=clById(id);
    add('Assigned to people',((c&&c.assignees)||[]).map(x=>{const au=uById(x);return au?fullName(au):null;}),'Unassign everyone in the checklist editor first');
  }else if(type==='question'){
    add('Used by checklists',DB.checklists.filter(c=>(c.questionIds||[]).includes(id)).map(c=>c.name),'Remove the question from the checklist first');
  }else if(type==='folder'){
    const kids=[];(function rec(fid){(DB.folders||[]).filter(x=>x.parentId===fid).forEach(k=>{kids.push(k);rec(k.id);});})(id);
    add('Sub-folders inside',kids.map(k=>k.name),'Delete or empty them first');
    const fids=[id,...kids.map(k=>k.id)];
    add('Documents inside',(DB.documents||[]).filter(x=>fids.includes(x.folderId)).map(x=>x.name),'Delete or move the files first');
  }else if(type==='role'){
    add('People assigned this role',DB.users.filter(x=>x.hrm&&x.hrm.roleProfileId===id).map(x=>fullName(x)),'Give them another role in Access Control → People');
  }
  return L;
}
function guardDelete(type,id,label){
  const links=_refLinks(type,id);
  if(!links.length)return true;
  const body='<div style="display:flex;flex-direction:column;gap:10px">'
    +'<p style="font-size:13px;color:var(--c-text-2);line-height:1.55;margin:0">This can’t be deleted while other records still point to it. Remove or reassign everything below, then delete it.</p>'
    +links.map(l=>{
      const shown=l.names.slice(0,5).map(n=>esc(String(n))).join(', ');
      const more=l.names.length>5?' <span style="color:var(--c-text-3)">+'+(l.names.length-5)+' more</span>':'';
      return '<div style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:12px;padding:10px 12px">'
        +'<div style="font-size:12.5px;font-weight:800;color:#BE123C">'+esc(l.label)+' ('+l.names.length+')</div>'
        +'<div style="font-size:12.5px;color:var(--c-text);margin-top:3px">'+shown+more+'</div>'
        +(l.hint?'<div style="font-size:11px;color:var(--c-text-3);margin-top:4px">→ '+esc(l.hint)+'</div>':'')
        +'</div>';
    }).join('')
    +'</div>';
  modalShell({title:'Can’t delete '+(label||'this'),sub:'It’s still linked to other records',body,footer:btnP('OK, got it','App.closeModal()')});
  return false;
}

/* ════════ DRAFTS (PHASE4b) — per-user, server-backed saves for checklist runs & OKR check-ins.
   One draft per (kind, refId, date). Saved to the `drafts` table immediately (targeted write, not
   the debounced batch) so a phone-saved draft appears on the desktop. Deleted on submit. Photos
   are stripped from payloads (same rule as saveDB) so rows stay small. ════════ */
function _draftStrip(payload){
  const p=JSON.parse(JSON.stringify(payload||{}));
  (p.questionResponses||[]).forEach(r=>{
    if(r.photo&&String(r.photo).startsWith('data:'))r.photo='[photo]';
    if(Array.isArray(r.photos))r.photos=r.photos.map(x=>(typeof x==='string'&&x.startsWith('data:'))?'[photo]':x);
  });
  if(Array.isArray(p.photos))p.photos=[]; // OKR check-in photos never ride a draft
  return p;
}
function _draftFor(kind,refId,date){
  return(DB.drafts||[]).find(d=>d.userId===S.uid&&d.kind===kind&&d.refId===refId&&((date||null)===(d.date||null)));
}
function _draftSave(kind,refId,date,payload){
  if(!Array.isArray(DB.drafts))DB.drafts=[];
  const id='dr_'+S.uid+'_'+kind+'_'+refId+(date?'_'+String(date).replace(/-/g,''):'');
  let d=DB.drafts.find(x=>x.id===id);
  const clean=_draftStrip(payload);
  if(d){d.payload=clean;d.updatedAt=new Date().toISOString();}
  else{d={id,userId:S.uid,kind,refId,date:date||null,payload:clean,updatedAt:new Date().toISOString()};DB.drafts.push(d);}
  saveDB();
  _pushRow('drafts',_draftRow(d),'draft');
  return d;
}
function _draftDelete(kind,refId,date){
  const d=_draftFor(kind,refId,date);if(!d)return;
  DB.drafts=(DB.drafts||[]).filter(x=>x.id!==d.id);
  saveDB();
  _delRow('drafts',d.id,'draft');
}

App._togPw=(id,btn)=>{
  const el=document.getElementById(id);if(!el)return;
  const show=el.type==='password';
  el.type=show?'text':'password';
  btn.setAttribute('aria-label',show?'Hide password':'Show password');
  btn.setAttribute('title',show?'Hide password':'Show password');
  btn.innerHTML=ic(show?'eyeOff':'eye','w-4 h-4');
  btn.style.color=show?'var(--c-brand-ink)':'var(--c-text-3)';
  try{el.focus();const n=el.value.length;el.setSelectionRange(n,n);}catch(e){}
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._draftStrip=_draftStrip;window._draftFor=_draftFor;window._draftSave=_draftSave;window._draftDelete=_draftDelete;
window._refLinks=_refLinks;window.guardDelete=guardDelete;
window.$=$;window.$$=$$;window.uid=uid;window.esc=esc;window.todayISO=todayISO;window.nowHM=nowHM;window.hm2m=hm2m;window.WKDAYS=WKDAYS;window.DAYS3=DAYS3;window.fmtD=fmtD;window.fmtS=fmtS;window.initials=initials;window.fullName=fullName;window.dayAbbr=dayAbbr;window.clOn=clOn;window.isCase=isCase;window.caseDate=caseDate;window.effDate=effDate;window.caseSub=caseSub;window.caseProg=caseProg;window.caseSignoff=caseSignoff;window.isShared=isShared;window.needsAllSignoff=needsAllSignoff;window.toast=toast;window.toastAction=toastAction;window.I=I;window.ic=ic;window._fileIcon=_fileIcon;window.CHIP_STYLE=CHIP_STYLE;window.CHIP_DOT_C=CHIP_DOT_C;window.chip=chip;window.PAL=PAL;window.avatar=avatar;window.hdr=hdr;window.pageHeader=pageHeader;window.btn=btn;window.btnP=btnP;window.btnG=btnG;window.btnDanger=btnDanger;window.fld=fld;window.fldPw=fldPw;window.selF=selF;window.mkTog=mkTog;window.card=card;window.clientsOf=clientsOf;window.clientIdsOf=clientIdsOf;window.clientIdsOfTicket=clientIdsOfTicket;window.matchesClient=matchesClient;window.clientFilter=clientFilter;window.FILTER_BAR_ST=FILTER_BAR_ST;window.FILTER_SEL_ST=FILTER_SEL_ST;window.filterBar=filterBar;window.filterLabel=filterLabel;window.filterSearch=filterSearch;window.filterSelect=filterSelect;window.filterClear=filterClear;window.filterCount=filterCount;window.COUNT_TONE=COUNT_TONE;window.countBadge=countBadge;window.BADGE_TONE=BADGE_TONE;window.badge=badge;window.chipBar=chipBar;window.togV=togV;window.STAT_C=STAT_C;window.statCard=statCard;window.empty=empty;window.emptyState=emptyState;window.emptyCTA=emptyCTA;window.loadingState=loadingState;window.errorState=errorState;window.openModal=openModal;window.closeModal=closeModal;window.modalShell=modalShell;window.confirmModal=confirmModal;window.App=App;window._notifCount=_notifCount;window._invalidateNotifCache=_invalidateNotifCache;window._recoverEditingSubmissions=_recoverEditingSubmissions;window.HOW=HOW;

/* Human hours: 2.83 → "2h 50m" (decimals confuse people; CSV exports keep the numbers). */
function fmtH(h){h=Number(h)||0;const neg=h<0?'-':'';h=Math.abs(h);let H=Math.floor(h),M=Math.round((h-H)*60);if(M===60){H++;M=0;}return neg+H+'h'+(M?' '+M+'m':'');}
window.fmtH=fmtH;
