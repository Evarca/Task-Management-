
/* ===== LOGIN ===== */
function loginView(){return`<div class="min-h-screen flex" style="background:var(--c-bg)">
  <div class="hidden lg:flex flex-col justify-between" style="width:44%;background:linear-gradient(160deg,#1C212B 0%,#13161D 100%);color:#fff;padding:56px;position:relative;overflow:hidden">
    <div style="position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(14,159,110,.4),transparent 70%);filter:blur(40px)"></div>
    <div style="position:absolute;left:-80px;bottom:-100px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(2,132,199,.22),transparent 70%);filter:blur(50px)"></div>
    <div class="flex items-center gap-3 relative"><div class="nav-brand" style="width:40px;height:40px;border-radius:12px;font-size:20px">E</div><span class="fd font-bold text-2xl">Evarca</span></div>
    <div class="relative"><h1 class="fd text-4xl font-bold" style="line-height:1.12;letter-spacing:-1px">Every shift,<br>every check,<br><span style="color:var(--c-brand)">accounted for.</span></h1><p style="color:rgba(255,255,255,.65);margin-top:18px;line-height:1.6;font-size:14.5px;max-width:380px">Team checklists with question-based responses, escalation into tickets, and real-time approvals.</p>
      <div style="display:flex;gap:20px;margin-top:32px">
        <div><div class="fd" style="font-size:22px;font-weight:800">Checklists</div><div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">scheduled &amp; on-time</div></div>
        <div style="width:1px;background:rgba(255,255,255,.12)"></div>
        <div><div class="fd" style="font-size:22px;font-weight:800">Approvals</div><div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">one unified inbox</div></div>
      </div></div>
    <div style="font-size:12px;color:rgba(255,255,255,.4)">© 2026 Evarca</div>
  </div>
  <div class="flex-1 flex items-center justify-center p-6"><div class="w-full max-w-sm fade">
    <div class="lg:hidden flex items-center gap-2 mb-8 justify-center"><div class="nav-brand">E</div><span class="fd font-bold text-xl">Evarca</span></div>
    <h2 class="fd" style="font-size:26px;font-weight:800;letter-spacing:-.5px;margin-bottom:4px">Welcome back</h2>
    <p style="color:var(--c-text-2);font-size:14px;margin-bottom:24px">Sign in to your workspace.</p>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label for="li-e" class="ui-label">Email address</label>
        <input id="li-e" type="email" autocomplete="email" placeholder="you@company.com" class="ui-input"
          onkeydown="if(event.key==='Enter')document.getElementById('li-p').focus()"/>
      </div>
      <div>
        <label for="li-p" class="ui-label">Password</label>
        <input id="li-p" type="password" autocomplete="current-password" placeholder="Enter your password" class="ui-input"
          onkeydown="if(event.key==='Enter')App.login()"/>
      </div>
    </div>
    <button onclick="App.login()" class="ui-btn ui-btn-primary ui-btn-md" style="width:100%;margin-top:22px">Sign in</button>
  </div></div></div>`;}
App.login=async()=>{
  const email=($('#li-e')?.value||'').trim().toLowerCase();
  const pw=($('#li-p')?.value||'').trim();
  if(!email||!pw){toast('Enter your email and password','err');return;}
  // Rate limit: 5 failed attempts → locked for 15 minutes on this device.
  // (Supabase Auth also rate-limits server-side — this is the visible first line.)
  if(email.length>254||pw.length>128){toast('Input too long','err');return;}
  try{
    const RL=JSON.parse(localStorage.getItem('bridge_login_rl')||'{}');
    if(RL.until&&Date.now()<RL.until){toast('Too many attempts — try again in '+Math.ceil((RL.until-Date.now())/60000)+' min','err');return;}
  }catch(e){}
  const btn=document.querySelector('button[onclick="App.login()"]');
  if(btn){btn.disabled=true;btn.textContent='Signing in…';}
  try{
    const{data,error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error){
      try{
        const RL=JSON.parse(localStorage.getItem('bridge_login_rl')||'{}');
        const n=(RL.n||0)+1;
        localStorage.setItem('bridge_login_rl',JSON.stringify(n>=5?{n:0,until:Date.now()+15*60000}:{n}));
        if(n>=5)toast('5 failed attempts — sign-in locked for 15 minutes','err');
      }catch(e){}
      throw error;
    }
    try{localStorage.removeItem('bridge_login_rl');}catch(e){}
    // Render from cache immediately so UI appears fast
    const cachedUser=DB.users.find(x=>(x.email||'').toLowerCase()===email);
    if(cachedUser&&cachedUser.status==='Active'){
      S.uid=cachedUser.id;
      S.route='dashboard'; // W2.1: dashboard is now role-aware (admin→adminDash, mgr→mgrDash, employee→homeDash)
      render(); // show page instantly
    }
    // Load fresh profile in background
    const{data:profile}=await sb.from('profiles').select('*').eq('id',data.user.id).single();
    if(!profile){await sb.auth.signOut();S.uid=null;render();throw new Error('Profile not found');}
    if(profile.status==='Inactive'){await sb.auth.signOut();S.uid=null;render();throw new Error('Account inactive — contact admin');}
    const u={id:profile.id,firstName:_unesc(profile.first_name)||'',lastName:_unesc(profile.last_name)||'',email:profile.email||'',phone:_unesc(profile.phone)||'',position:_unesc(profile.position)||'',department:_unesc(profile.department)||'',status:profile.status,managerId:profile.manager_id||null,managerHistory:profile.manager_history||[],rules:profile.rules||{past:true,future:true,edit:true},approval:profile.approval_settings||{past:false,future:false,edited:false},docAccess:profile.doc_access||{departments:{},locations:{}},questionsAccess:profile.questions_access||false,emailEnabled:profile.email_enabled!==false,cities:Array.isArray(profile.cities)?profile.cities:[],password:'***'};
    const idx=DB.users.findIndex(x=>x.id===u.id);
    if(idx>-1){u.hrm=DB.users[idx].hrm;DB.users[idx]=u;}else DB.users.push(u); // keep cached hrm until the fresh copy lands
    _ensureHrm(u);
    S.uid=u.id;
    if(!S.route||S.route==='login')S.route='dashboard'; // W2.1: role-aware home
    // R20: my Access Control assignment (user_hrm + role bundles) now decides ALL visibility —
    // pull it BEFORE the big load so a cold-cache login never filters with an empty hrm.
    try{await _refreshMyAccess();}catch(e){}
    saveDB();render();
    // Load full data in background — don't block UI
    loadFromSB().then(()=>{saveDB();if(Date.now()-_lastUserAction>3000)render();}).catch(()=>{});
  }catch(err){
    const em=(err&&err.message)||'Sign in failed';
    const msg=em.includes('Invalid')||em.includes('credentials')||em.includes('invalid_grant')
      ?'Incorrect email or password':em;
    toast(msg,'err');
    // The original button may have been replaced by a render() in the cached fast-path,
    // so re-query before re-enabling rather than touching a detached node.
    const b=document.querySelector('button[onclick="App.login()"]')||btn;
    if(b){b.disabled=false;b.textContent='Sign in';}
  }
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.loginView=loginView;
