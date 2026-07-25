
/* ===== ALL CHECKLISTS (Super Admin + Admin role) ===== */
// Read-only question responses block (adapted from team view)
function _roResponses(c,sub,date){
  if(!sub)return`<div style="padding:14px 16px;font-size:13px;color:#9CA3AF">No submission for ${fmtD(date)}</div>`;
  const qResps=sub.questionResponses||[];
  const qs=(c.questionIds||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean);
  if(!qs.length)return`<div style="padding:14px 16px;font-size:13px;color:#9CA3AF">No questions in this checklist</div>`;
  const _escSetRo=_subEscalatedQids(c,sub);
  let h=qs.map(q=>{
    const qr=qResps.find(r=>r.questionId===q.id)||{};
    const resp=qr.response;const hasR=resp!==null&&resp!==undefined&&resp!=='';
    const esc1=_escSetRo.has(q.id);
    const boxBg=esc1?'#EF4444':(hasR?'#10B981':'#E5E7EB');
    const ansClr=esc1?'#BE123C':'#0E9F6E';
    return`<div style="padding:10px 14px;border-bottom:1px solid #F9FAFB;display:flex;align-items:center;gap:10px;${esc1?'background:#FFF5F5':''}">
      <div style="width:18px;height:18px;border-radius:5px;background:${boxBg};display:grid;place-items:center;flex-shrink:0">${esc1?'<span style="color:#fff;font-size:12px;font-weight:800;line-height:1">!</span>':(hasR?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>':'')}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:${hasR?'#15171C':'#9CA3AF'}">${esc(q.text)}${esc1?'<span style="font-size:9px;font-weight:800;color:#BE123C;background:#FFE4E6;padding:1px 6px;border-radius:8px;margin-left:6px;text-transform:uppercase;letter-spacing:.04em">Flagged</span>':''}</div>
        ${hasR?`<div style="font-size:11px;font-weight:700;color:${ansClr};margin-top:2px">${esc(String(resp))}</div>`:'<div style="font-size:11px;color:#D1D5DB;font-style:italic;margin-top:2px">Not answered</div>'}
        ${qr.comment?`<div style="font-size:11px;color:#6B7280;margin-top:2px;font-style:italic">"${esc(qr.comment)}"</div>`:''}
        ${(()=>{const pl=_qrPhotoList(qr);return pl.length?'<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+pl.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(this.src)" style="max-width:100px;max-height:72px;border-radius:8px;object-fit:cover;border:1px solid #E5E7EB;cursor:pointer" title="Click to enlarge"/>').join('')+'</div>':'';})()}
      </div>
    </div>`;
  }).join('');
  const by=sub.userId?uById(sub.userId):null;
  h+=`<div style="padding:10px 16px;font-size:11px;color:#9CA3AF;border-top:1px solid #F3F4F6">Submitted${by?' by <strong>'+esc(fullName(by))+'</strong>':''} ${sub.submittedAt?new Date(sub.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}</div>`;
  return h;
}

function allClsPage(){
  const today=todayISO();
  if(S.filters.aclWk===undefined)S.filters.aclWk=0;
  // Week strip (Mon–Sun) — same as Team view
  const ref=new Date(today+'T00:00:00');
  const dow=ref.getDay();
  ref.setDate(ref.getDate()+(dow===0?-6:1-dow)+S.filters.aclWk*7);
  const week=Array.from({length:7},(_,i)=>{const dd=new Date(ref);dd.setDate(dd.getDate()+i);return dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0');});
  if(!S.filters.aclDate||!week.includes(S.filters.aclDate)){S.filters.aclDate=week.find(x=>x===today)||week[0];}
  const d=S.filters.aclDate;
  const dep=S.filters.aclDep||'';
  const loc=S.filters.aclLoc||'';
  const filtCls=dd=>DB.checklists.filter(c=>clOn(c,dd)&&(!dep||c.department===dep)&&(!loc||(c.locationIds||[]).includes(loc)));
  // ── Hierarchy scope: Super Admin sees everyone; Admin (SubAdmin) / managers see themselves + their tree (users under them, and users under those users) ──
  const _acAll=isAdmin()||scopeOf('checklists')==='everyone';const _acF=scopeFilter('checklists'); // R15: results visibility follows the checklists scope
  const scopeUsers=(_acAll
    ? DB.users
    : DB.users.filter(u=>_acF(u.id)||u.id===S.uid)
  ).filter(u=>u.status==='Active');
  const scopeIds=new Set(scopeUsers.map(u=>u.id));
  const cls=filtCls(d);

  // Strip dots: aggregated across ALL users/checklists (respecting filters)
  const dayDots=dd=>{
    const dcls=filtCls(dd);
    let sub=false,pend=false;
    dcls.forEach(c=>{
      if(c.anyOne){
        if(!_acAll&&!(c.assignees||[]).some(a=>scopeIds.has(a)))return; // R15
        if(DB.submissions.some(x=>x.checklistId===c.id&&x.date===dd&&x.status!=='Editing'))sub=true;else pend=true;
      }
      else (c.assignees||[]).forEach(a=>{if(!scopeIds.has(a))return;if(subFor(c.id,a,dd))sub=true;else pend=true;});
    });
    return{sub,pend,late:pend&&dd<today};
  };

  const BC={'Late':'#F43F5E','Pending Approval':'#F97316','On Time':'#10B981','Submitted':'#10B981','Pending':'#F59E0B','Rejected':'#9F1239','Editing':'#0EA5E9'};

  // One read-only expandable card
  const roCard=(c,sub,key,metaExtra)=>{
    const st=sub?sub.status:(d<today?'Late':'Pending');
    const exp=S.filters.aclExp===key;
    const ansN=sub?(sub.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length:0;
    return`<div style="background:var(--c-surface);border-radius:var(--r-md);border:1px solid var(--c-border);box-shadow:var(--sh-sm);border-left:4px solid ${BC[st]||'#D1D5DB'};overflow:hidden">
      <button onclick="S.filters.aclExp=S.filters.aclExp==='${key}'?null:'${key}';rr()" style="width:100%;text-align:left;padding:12px 14px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700">${esc(c.name)}${c.anyOne?' <span title="Any one assignee can complete" style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;background:#EEF2FF;color:#4338CA">\ud83d\udc65 Any one</span>':''}</div>
          <div style="font-size:12px;color:var(--c-text-3);margin-top:2px">${(c.questionIds||[]).length} question${(c.questionIds||[]).length!==1?'s':''}${c.department?' · '+esc(c.department):''}${metaExtra||''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
          ${sub&&(c.questionIds||[]).length?_subBadges(c,sub,{small:true}):''}
          ${chip(st)}
          <span style="color:var(--c-text-3);transform:rotate(${exp?'90':'0'}deg);transition:transform .2s">${ic('chevR','w-4 h-4')}</span>
        </div>
      </button>
      ${exp?`<div style="border-top:1px solid var(--c-border)">${_roResponses(c,sub,d)}</div>`:''}
    </div>`;
  };

  // ── Render one location's section: group ("any one") checklists, then individual checklists user-by-user.
  //    secKey is prefixed into every expand key so the same checklist/user appearing under two
  //    locations expands independently. Returns '' when this section has nothing to show. ──
  const renderSection=(sectionCls,secKey)=>{
    const sgrp=sectionCls.filter(c=>c.anyOne&&(_acAll||(c.assignees||[]).some(a=>scopeIds.has(a)))); // R15
    const sind=sectionCls.filter(c=>!c.anyOne);
    const sUserMap={};
    sind.forEach(c=>(c.assignees||[]).forEach(uid2=>{if(!scopeIds.has(uid2))return;const u=uById(uid2);if(!u||u.status!=='Active')return;(sUserMap[uid2]=sUserMap[uid2]||[]).push(c);}));
    const sUserIds=Object.keys(sUserMap).sort((a,b)=>fullName(uById(a)).localeCompare(fullName(uById(b))));

    let gHtml='';
    if(sgrp.length){
      gHtml=`<div style="margin-bottom:18px;margin-top:8px">
        <div style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Group checklists — any one can complete</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${sgrp.map(c=>{
            const sub=DB.submissions.find(x=>x.checklistId===c.id&&x.date===d&&x.status!=='Editing')||null;
            const names=(c.assignees||[]).map(a=>uById(a)).filter(Boolean).map(u=>fullName(u));
            const meta=' · '+((c.assignees||[]).length)+' assignee'+((c.assignees||[]).length!==1?'s':'')+(names.length?' ('+esc(names.slice(0,3).join(', '))+(names.length>3?' +'+(names.length-3):'')+')':'');
            return roCard(c,sub,secKey+'|grp|'+c.id,meta);
          }).join('')}
        </div>
      </div>`;
    }

    let uHtml='';
    if(sUserIds.length){
      uHtml=`<div style="margin-top:${sgrp.length?'0':'8px'}">
        <div style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Individual checklists — user by user</div>
        <div style="display:flex;flex-direction:column;gap:8px">
        ${sUserIds.map(uid2=>{
          const u=uById(uid2);
          const uKey=secKey+'|'+uid2;
          const ucls=sUserMap[uid2].slice().sort((a,b)=>(a.scheduleTime||'99:99').localeCompare(b.scheduleTime||'99:99')||(a.name||'').localeCompare(b.name||''));
          const done=ucls.filter(c=>subFor(c.id,uid2,d)).length;
          const uExp=S.filters.aclU===uKey;
          const allDone=done===ucls.length;
          const flaggedN=ucls.filter(c=>{const s=subForCl(c,uid2,d);return s&&_subEscalationCount(c,s)>0;}).length;
          return`<div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid ${uExp?'var(--c-brand)':'var(--c-border)'};box-shadow:var(--sh-sm);overflow:hidden">
            <button onclick="S.filters.aclU=S.filters.aclU==='${uKey}'?null:'${uKey}';S.filters.aclExp=null;rr()" style="width:100%;text-align:left;padding:12px 14px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;gap:10px">
              <span style="color:var(--c-text-3);transform:rotate(${uExp?90:0}deg);transition:transform .2s">${ic('chevR','w-4 h-4')}</span>
              ${avatar(u,'w-9 h-9','text-xs')}
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:700;color:var(--c-text)">${esc(fullName(u))}</div>
                <div style="font-size:12px;color:var(--c-text-3)">${esc(u.position||u.department||'')}${(()=>{const mg=u.managerId?uById(u.managerId):null;return mg?' · under '+esc(fullName(mg)):'';})()}</div>
              </div>
              ${flaggedN?`<span title="${flaggedN} non-compliant submission${flaggedN!==1?'s':''}" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink);margin-right:6px">${ic('alert','w-3 h-3')}${flaggedN}</span>`:''}
              <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${allDone?'var(--c-success-soft)':'var(--c-warn-soft)'};color:${allDone?'var(--c-success-ink)':'var(--c-warn-ink)'}">${done}/${ucls.length} done</span>
            </button>
            ${uExp?`<div style="padding:0 14px 12px 38px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--c-border);padding-top:10px">
              ${ucls.map(c=>roCard(c,subFor(c.id,uid2,d)||null,uKey+'|'+c.id,'')).join('')}
            </div>`:''}
          </div>`;
        }).join('')}
        </div>
      </div>`;
    }
    return gHtml+uHtml;
  };

  // ── Segregate checklists by location: one section per location (Dubai, etc.), then a
  //    "No location" bucket. A checklist tagged with multiple locations appears under each. ──
  let locationsHtml='';
  let anyContent=false;
  const locList=loc?DB.locations.filter(l=>l.id===loc):DB.locations.slice();
  const locHeader=(label,count,muted)=>`<div style="display:flex;align-items:center;gap:7px;margin:18px 0 10px">
      <span style="color:${muted?'var(--c-text-3)':'var(--c-brand)'}">${ic('pin','w-4 h-4')}</span>
      <span style="font-size:15px;font-weight:800;color:${muted?'var(--c-text-2)':'var(--c-text)'}">${esc(label)}</span>
      <span style="font-size:11px;font-weight:700;color:var(--c-text-2);background:var(--c-surface-2);padding:2px 9px;border-radius:20px">${count}</span>
    </div>`;
  locList.forEach(l=>{
    const secCls=cls.filter(c=>(c.locationIds||[]).includes(l.id));
    if(!secCls.length)return;
    const secHtml=renderSection(secCls,'loc'+l.id);
    if(!secHtml)return;
    anyContent=true;
    locationsHtml+=locHeader(l.name,secCls.length,false)+secHtml;
  });
  if(!loc){
    const noLocCls=cls.filter(c=>!(c.locationIds||[]).length);
    if(noLocCls.length){
      const secHtml=renderSection(noLocCls,'locnone');
      if(secHtml){
        anyContent=true;
        locationsHtml+=locHeader('No location',noLocCls.length,true)+secHtml;
      }
    }
  }

  return`<div class="fade">
    ${hdr('All Checklists',"Everyone's checklists and responses")}
    <!-- Filters row -->
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
      <select onchange="S.filters.aclDep=this.value;S.filters.aclExp=null;S.filters.aclU=null;rr()" class="ui-select" style="width:auto;font-weight:600">
        <option value="">All departments</option>
        ${DB.departments.map(x=>`<option value="${esc(x.name)}" ${dep===x.name?'selected':''}>${esc(x.name)}</option>`).join('')}
      </select>
      <select onchange="S.filters.aclLoc=this.value;S.filters.aclExp=null;S.filters.aclU=null;rr()" class="ui-select" style="width:auto;font-weight:600">
        <option value="">All clients</option>
        ${DB.locations.map(x=>`<option value="${x.id}" ${loc===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}
      </select>
    </div>
    <!-- Sticky calendar strip (same as Team view) -->
    <div style="position:sticky;top:52px;z-index:10;background:rgba(247,246,242,.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin:0 -16px;padding:0 16px 10px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
        <span style="font-size:13px;font-weight:600;color:#B8B5AC">${d===today?'Today · ':''}${fmtD(d)}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <button type="button" aria-label="Previous week" onclick="S.filters.aclWk--;S.filters.aclExp=null;rr()" style="width:30px;height:30px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;display:grid;place-items:center;color:var(--c-text-2)">${ic('back','w-3.5 h-3.5')}</button>
          <button type="button" onclick="S.filters.aclWk=0;S.filters.aclDate='${today}';S.filters.aclExp=null;rr()" style="padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:none;background:${S.filters.aclWk===0&&d===today?'var(--c-ink)':'var(--c-surface-2)'};color:${S.filters.aclWk===0&&d===today?'#fff':'var(--c-text-2)'}">Today</button>
          <button type="button" aria-label="Next week" onclick="S.filters.aclWk++;S.filters.aclExp=null;rr()" style="width:30px;height:30px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-surface);cursor:pointer;display:grid;place-items:center;color:var(--c-text-2)">${ic('chevR','w-3.5 h-3.5')}</button>
        </div>
      </div>
      <div class="cal4" style="display:flex;flex-direction:row;flex-wrap:nowrap;width:100%">
        ${week.map(dd=>{
          const dn=DAYS3[new Date(dd+'T00:00:00').getDay()];const num=new Date(dd+'T00:00:00').getDate();
          const isT=dd===today;const isSel=dd===d;
          const dots=dayDots(dd);
          return`<button onclick="S.filters.aclDate='${dd}';S.filters.aclExp=null;rr();App._lazyLoadDate('allcl')" class="cal4-d ${isSel?'sel':''}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;padding:10px 4px 8px;cursor:pointer;border:none;background:${isSel?'#15171C':'transparent'};gap:2px">
            <span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${isSel?'rgba(255,255,255,.4)':'#B8B5AC'}">${dn.slice(0,3)}</span>
            <span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:${isSel?'#fff':isT?'#fff':'#15171C'};background:${isT&&!isSel?'#15171C':'transparent'}">${num}</span>
            <div style="display:flex;gap:2px;height:6px">
              ${dots.sub?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,255,255,.8)':'#10B981'}"></span>`:''}
              ${dots.late?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,180,180,.9)':'#F43F5E'}"></span>`:dots.pend?`<span style="width:5px;height:5px;border-radius:50%;background:${isSel?'rgba(255,220,120,.9)':'#F59E0B'}"></span>`:''}
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>
    ${locationsHtml}
    ${!anyContent?`<div style="padding:60px 20px;text-align:center;background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);margin-top:8px">
      <div style="font-size:40px;margin-bottom:10px">\ud83d\udcc5</div>
      <div class="fd" style="font-size:17px;font-weight:800;color:var(--c-text)">${!_acAll&&scopeUsers.length<=1?'No users in your scope':'No checklists'}</div>
      <p style="font-size:13px;color:var(--c-text-3);margin-top:6px">${!_acAll&&scopeUsers.length<=1
        ?'This tab shows checklists for users in your reporting tree, but nobody reports to this account. Ask a Super Admin to set "Reports to" on your team members — or give the Admin role to the manager they already report to.'
        :`No checklists scheduled for this date${dep||loc?' with the selected filters':''}`}</p>
    </div>`:''}
  </div>`;
}

App._bigImg=(src)=>{openModal(`<div style="padding:10px;position:relative"><button onclick="App.closeModal()" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.6);border:none;border-radius:50%;width:26px;height:26px;color:#fff;cursor:pointer;display:grid;place-items:center;z-index:1;font-size:14px">×</button><img src="${esc(src)}" alt="Enlarged photo" style="width:100%;border-radius:10px;max-height:80vh;object-fit:contain;display:block"/></div>`,'max-w-xl');};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._roResponses=_roResponses;window.allClsPage=allClsPage;
