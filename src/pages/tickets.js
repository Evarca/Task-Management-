

/* ===== ANALYTICS ===== */


/* ===== TICKETS PAGE ===== */
function ticketsPage(){
  // Mark assigned tickets as viewed when page opens (no rr() — already rendering)
  let _dirty=false;
  (DB.tickets||[]).forEach(t=>{
    if(t.assignedTo===S.uid&&!(t.viewedBy||[]).includes(S.uid)){
      if(!t.viewedBy)t.viewedBy=[];
      t.viewedBy.push(S.uid);
      _dirty=true;
    }
  });
  if(_dirty){
    saveDB();
    // Sync viewed_by to Supabase in background — no rr() here (already in a render)
    (DB.tickets||[]).filter(t=>t.assignedTo===S.uid&&(t.viewedBy||[]).includes(S.uid)).forEach(t=>{
      sb.from('tickets').update({viewed_by:t.viewedBy||[]}).eq('id',t.id).then(()=>{}).catch(()=>{});
    });
    // Schedule badge refresh after render completes
    setTimeout(()=>{_invalidateNotifCache();const c=document.getElementById('content');if(c)c.innerHTML=pageContent();},50);
  }
  // Visibility:
  // Admin — sees all tickets
  // Manager — sees tickets assigned to them OR tickets they created (so they can track)
  // User — sees ONLY tickets assigned to them
  let tickets=(DB.tickets||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  // §8: visibility respects scopeOf('tickets'). A user always sees tickets they created or that
  // are assigned to them; within a wider scope (team/dept/location/everyone) they also see tickets
  // assigned to or raised by anyone in scope. Super Admin (everyone) sees all.
  if(!isAdmin()){
    const inScope=scopeFilter('tickets');
    tickets=tickets.filter(t=>t.assignedTo===S.uid||t.createdBy===S.uid||t.submitterId===S.uid||(can('tickets','view')&&(inScope(t.assignedTo)||inScope(t.submitterId)||inScope(t.createdBy))));
  }

  const f=S.filters;
  const statusFilter=f.tkStatus||'';
  const priorityFilter=f.tkPriority||'';
  // R12 (owner request: better filters) — search + assignee + sort on top of status/priority.
  const base=tickets.slice(); // pre-filter snapshot: drives the assignee options + stat cards
  const q=(f.tkQ||'').toLowerCase();
  if(q)tickets=tickets.filter(t=>((t.title||'')+' '+(t.description||'')+' '+(uById(t.assignedTo)?fullName(uById(t.assignedTo)):'')+' '+(uById(t.submitterId)?fullName(uById(t.submitterId)):'')).toLowerCase().includes(q));
  if(statusFilter)tickets=tickets.filter(t=>t.status===statusFilter);
  if(priorityFilter)tickets=tickets.filter(t=>t.priority===priorityFilter);
  if(f.tkAssignee)tickets=tickets.filter(t=>t.assignedTo===f.tkAssignee);
  // A ticket's client comes from the checklist it was raised against; a manually raised ticket
  // has no checklist, so it only shows when no client filter is applied.
  if(f.tkClient)tickets=tickets.filter(t=>matchesClient(clientIdsOfTicket(t),f.tkClient));
  const _priRank={Critical:0,High:1,Medium:2,Low:3};
  const _tkTime=t=>t.createdAt||t.date||'';
  if(f.tkSort==='old')tickets.sort((a,b)=>String(_tkTime(a)).localeCompare(String(_tkTime(b))));
  else if(f.tkSort==='pri')tickets.sort((a,b)=>((_priRank[a.priority]??9)-(_priRank[b.priority]??9))||String(_tkTime(b)).localeCompare(String(_tkTime(a))));
  else tickets.sort((a,b)=>String(_tkTime(b)).localeCompare(String(_tkTime(a)))); // newest first (default)

  const open=base.filter(t=>t.status==='Open').length;
  const inprog=base.filter(t=>t.status==='In Progress').length;
  const resolved=base.filter(t=>t.status==='Resolved'||t.status==='Closed').length;

  const priClr={High:'#DC2626',Medium:'#F59E0B',Low:'#6B7280',Critical:'#7C3AED'};
  const priBg={High:'#FEF2F2',Medium:'#FFFBEB',Low:'#F9FAFB',Critical:'#F5F3FF'};

  function tkCard(t){
    const assignee=uById(t.assignedTo);
    const submitter=uById(t.submitterId);
    const cl=clById(t.checklistId);
    const canResolve=isAdmin()||(isMgr()&&subTree(S.uid).some(u=>u.id===t.submitterId||u.id===t.assignedTo))||(t.assignedTo===S.uid);
    const canDelete=isAdmin();
    return'<div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:11px 14px;border-left:3px solid '+(priClr[t.priority]||'#9CA3AF')+'">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">'+
        '<div style="flex:1;min-width:0">'+
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">'+
            '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;background:'+(priBg[t.priority]||'#F9FAFB')+';color:'+(priClr[t.priority]||'#6B7280')+'">'+esc(t.priority)+'</span>'+
            chip(t.status)+
            (()=>{const _cli=clientIdsOfTicket(t).map(i=>locById(i)?.name).filter(Boolean);
              return _cli.length?'<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;color:#1D4ED8;background:#EFF6FF;padding:2px 9px;border-radius:20px">'+ic('pin','w-3 h-3')+esc(_cli.join(', '))+'</span>':'';})()+
            (cl?'<span style="font-size:11px;color:var(--c-text-3)">'+esc(cl.name)+'</span>':'')+
            '<span style="font-size:11px;color:var(--c-text-3)">'+fmtS(t.date||t.createdAt?.slice(0,10)||'')+'</span>'+
          '</div>'+
          '<div style="font-size:13.5px;font-weight:700;color:var(--c-text);margin-bottom:3px">'+esc(t.title)+'</div>'+
          '<div style="font-size:12px;color:var(--c-text-2);line-height:1.5;white-space:pre-wrap">'+esc(t.description)+'</div>'+
          // Show photo from the linked submission's question response
          (()=>{
            if(!t.questionId||!t.submitterId||!t.date)return'';
            const sub=(DB.submissions||[]).find(s=>s.checklistId===t.checklistId&&s.userId===t.submitterId&&s.date===t.date);
            if(!sub)return'';
            const qr=(sub.questionResponses||[]).find(r=>r.questionId===t.questionId);
            const pl=_qrPhotoList(qr);
            if(!pl.length)return'';
            return'<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'+pl.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(this.src)" style="max-width:160px;max-height:110px;border-radius:10px;object-fit:cover;border:1px solid #E5E7EB;cursor:pointer" title="Response photo"/>').join('')+'</div>';
          })()+
        '</div>'+
        (canDelete?'<button type="button" onclick="App._delTicket(\''+t.id+'\')" aria-label="Delete ticket" style="width:30px;height:30px;display:grid;place-items:center;border-radius:8px;border:none;background:var(--c-danger-soft);cursor:pointer;color:var(--c-danger);flex-shrink:0">'+ic('x','w-3.5 h-3.5')+'</button>':'')+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--c-border)">'+
        '<div style="display:flex;align-items:center;gap:6px">'+
          '<span style="font-size:11px;font-weight:600;color:var(--c-text-3)">Assigned to</span>'+
          '<span style="font-size:12px;font-weight:700;color:var(--c-text)">'+(assignee?esc(fullName(assignee)):'Unknown')+'</span>'+
        '</div>'+
        (submitter?'<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;color:var(--c-text-3)">From</span><span style="font-size:12px;font-weight:700;color:var(--c-text)">'+esc(fullName(submitter))+'</span></div>':'')+
        (cl?'<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:600;color:var(--c-text-3)">Checklist</span><span style="font-size:12px;font-weight:700;color:var(--c-text)">'+esc(cl.name)+'</span></div>':'')+
        '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">'+
          (canResolve&&t.status==='Open'?btn('Start',`App._tkSetStatus(this)`,{variant:'subtle',size:'sm',attrs:`data-id="${t.id}" data-st="In Progress"`}):'')+
          (canResolve&&t.status==='In Progress'?btn('Resolve',`App._resolveTicket('${t.id}')`,{variant:'brand',size:'sm'}):'')+
          (canResolve&&(t.status==='Open'||t.status==='In Progress')?btn('Close',`App._tkSetStatus(this)`,{variant:'ghost',size:'sm',attrs:`data-id="${t.id}" data-st="Closed"`}):'')+
          (isAdmin()&&(t.status==='Resolved'||t.status==='Closed')?btn('Reopen',`App._tkSetStatus(this)`,{variant:'ghost',size:'sm',attrs:`data-id="${t.id}" data-st="Open"`}):'')+
        '</div>'+
      '</div>'+
    '</div>';
  }

  return'<div class="fade">'+
    hdr('Tickets','Raise an issue or track escalation tickets',can('tickets','create')?btnP('New ticket','App.newTicket()','plus'):'')+
    // Stats row — tap a card to filter by that status (tap again via Clear)
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'+
      statCard('Open',open,'#F97316',"App._tkFilter('status','Open')")+
      statCard('In Progress',inprog,'#3B82F6',"App._tkFilter('status','In Progress')")+
      statCard('Resolved',resolved,'#0E9F6E',"App._tkFilter('status','Resolved')")+
    '</div>'+
    // R12 Filters: search · assignee · priority · sort (+ Clear), status pills below (one-line scroll)
    (()=>{
      const _people=[...new Set(base.map(t=>t.assignedTo).filter(Boolean))].map(id=>uById(id)).filter(Boolean).sort((a,b)=>fullName(a).localeCompare(fullName(b)));
      const _active=!!(f.tkQ||statusFilter||priorityFilter||f.tkAssignee||f.tkSort||f.tkClient);
      return filterBar(
         filterSearch('tk-q','tkQ','Search title, description, people…')
        +filterSelect('tkAssignee','All assignees',_people.map(p=>({value:p.id,label:fullName(p)})),f.tkAssignee)
        +clientFilter('tkClient',FILTER_SEL_ST)
        +`<select onchange="App._tkFilter('priority',this.value)" class="ui-select" style="${FILTER_SEL_ST}" aria-label="Any priority"><option value="">Any priority</option>${['Critical','High','Medium','Low'].map(p=>`<option ${priorityFilter===p?'selected':''}>${p}</option>`).join('')}</select>`
        +`<select onchange="S.filters.tkSort=this.value;rr()" class="ui-select" style="${FILTER_SEL_ST}" aria-label="Sort tickets"><option value="">Newest first</option><option value="old" ${f.tkSort==='old'?'selected':''}>Oldest first</option><option value="pri" ${f.tkSort==='pri'?'selected':''}>By priority</option></select>`
        +(_active?filterClear(['tkQ','tkStatus','tkPriority','tkAssignee','tkSort','tkClient']):''))+
      '<div class="hscroll" style="gap:8px;margin-bottom:16px;align-items:center">'+
        ['','Open','In Progress','Resolved','Closed'].map(s=>{const on=statusFilter===s;return`<button type="button" class="ui-tab-pill${on?' on':''}" style="flex-shrink:0" onclick="App._tkFilter('status','${s}')">${s||'All'}</button>`;}).join('')+
        `<span style="flex-shrink:0;font-size:11.5px;color:var(--c-text-3);font-weight:600;margin-left:4px">${tickets.length} ticket${tickets.length===1?'':'s'}</span>`+
      '</div>';
    })()+
    // List
    (tickets.length?
      '<div style="display:flex;flex-direction:column;gap:10px">'+tickets.map(tkCard).join('')+'</div>':
      (_isLoading('tickets')?loadingState('Loading tickets…'):empty('ticket','No tickets','Tickets are created automatically when an escalation answer is submitted.'))
    )+
  '</div>';
}

App._showTeamStat=(uid,type)=>{
  const u=uById(uid);if(!u)return;
  let title='',rows='',empty='';
  if(type==='assigned'){
    title='Assigned checklists — '+esc(fullName(u));
    empty='No checklists assigned.';
    const cls=DB.checklists.filter(c=>(c.assignees||[]).includes(uid));
    rows=cls.map(c=>{
      const today=todayISO();
      const isOn=clOn(c,today);
      return'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--c-border)">'        +'<div><div style="font-size:13px;font-weight:600">'+esc(c.name)+'</div>'        +'<div style="font-size:11px;color:var(--c-text-3);margin-top:2px">'+esc(c.frequency)+(c.department?' · '+esc(c.department):'')+'</div></div>'        +(isOn?badge('Active today','success'):'<span style="font-size:11px;color:var(--c-text-3)">Not today</span>')        +'</div>';
    }).join('');
  } else if(type==='late'){
    title='Late submissions — '+esc(fullName(u));
    empty='No late submissions.';
    const lateSubs=DB.submissions.filter(s=>s.userId===uid&&s.status==='Late'&&!!clById(s.checklistId));
    rows=lateSubs.map(s=>{
      const c=clById(s.checklistId);
      return'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--c-border)">'        +'<div><div style="font-size:13px;font-weight:600">'+(c?esc(c.name):'[Deleted checklist]')+'</div>'        +'<div style="font-size:11px;color:var(--c-text-3);margin-top:2px">'+fmtS(s.date)+(s.submittedAt?' · '+new Date(s.submittedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'')+'</div></div>'        +chip(s.status)+'</div>';
    }).join('');
  } else if(type==='tickets'){
    title='Open tickets — '+esc(fullName(u));
    empty='No open tickets.';
    const tkts=(DB.tickets||[]).filter(t=>t.submitterId===uid&&t.status==='Open');
    rows=tkts.map(t=>{
      const priClr={High:'#DC2626',Medium:'#F59E0B',Low:'#6B7280'};
      return'<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--c-border)">'        +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(t.title)+'</div>'        +'<div style="font-size:11px;color:var(--c-text-3);margin-top:2px">'+fmtS(t.date||t.createdAt?.slice(0,10)||'')+'</div></div>'        +'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:'+(priClr[t.priority]||'#6B7280')+'">'+esc(t.priority)+'</span>'        +'</div>';
    }).join('');
  }
  modalShell({title,size:'max-w-md',
    body:'<div style="overflow-y:auto;max-height:62vh;border:1px solid var(--c-border);border-radius:var(--r-sm)">'
      +(rows||'<div style="font-size:13px;color:var(--c-text-3);text-align:center;padding:24px">'+empty+'</div>')+'</div>'});
};

/* §8 — user-facing ticket create flow with Manager / HR routing.
   Routing is IMPLICIT via `assignedTo` (no new synced column → tickets upsert unaffected).
   A frontend-only `route` marker is kept on the local object for display but is NOT in the
   Supabase insert payload (which mirrors the existing escalation insert columns exactly). */
App.newTicket=()=>{
  if(!can('tickets','create')){toast('Not allowed','err');return;}
  const u=me();
  const hasMgr=!!_mgrOfOn(u,todayISO());
  const hasHR=DB.users.some(x=>x.hrm?.isHR&&x.status==='Active'&&!isSuperU(x));
  const routeOpts=[];
  if(hasMgr)routeOpts.push(['manager','My Manager']);
  if(hasHR)routeOpts.push(['hr','HR']);
  subTree(S.uid).filter(x=>x.status==='Active').forEach(x=>routeOpts.push(['user:'+x.id,'Team: '+fullName(x)]));
  if(!routeOpts.length){toast('No manager or HR is available to receive tickets','err');return;}
  // Optional: tie the ticket to a client's checklist/case, so it shows on the client file
  // and every client filter picks it up.
  const _caseOpts=[['','— Not about a client —']].concat(
    (DB.checklists||[]).filter(c=>c.status!=='Draft'&&(c.locationIds||[]).length)
      .map(c=>{const cli=(c.locationIds||[]).map(i=>locById(i)?.name).filter(Boolean).join(', ');
        return [c.id,(cli?cli+' — ':'')+c.name];}));
  const _pre=window._tkPreCl||'';window._tkPreCl=null;
  modalShell({title:'New ticket',size:'max-w-md',
    body:'<div style="display:flex;flex-direction:column;gap:14px">'
      +fld('Subject','tk-title','','text','What is this about?')
      +'<div><label for="tk-desc" class="ui-label">Description</label><textarea id="tk-desc" rows="4" placeholder="Describe the issue…" class="ui-input rf"></textarea></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+selF('Priority','tk-pri',[['Low','Low'],['Medium','Medium'],['High','High']],'Medium')+selF('Send to','tk-route',routeOpts,routeOpts[0][0])+'</div>'
      +(_caseOpts.length>1?selF('Related client work (optional)','tk-case',_caseOpts,_pre):'')
      +'</div>',
    footer:btnG('Cancel','App.closeModal()')+btnP('Create ticket','App.createTicket()')});
};
/* Open the ticket modal preselecting a client's open case (used from the client file). */
App._newTicketFor=(locId)=>{
  const c=(DB.checklists||[]).find(x=>x.status!=='Draft'&&(x.locationIds||[]).includes(locId)&&isCase(x)&&!caseSub(x))
        ||(DB.checklists||[]).find(x=>x.status!=='Draft'&&(x.locationIds||[]).includes(locId));
  window._tkPreCl=c?c.id:'';
  App.newTicket();
};
App.createTicket=()=>{
  if(!can('tickets','create')){toast('Not allowed','err');return;}
  const title=($('#tk-title')?.value||'').trim().slice(0,200);
  const description=($('#tk-desc')?.value||'').trim().slice(0,5000);
  const priority=$('#tk-pri')?.value||'Medium';
  const route=$('#tk-route')?.value||'manager';
  if(!title){toast('Add a subject','err');return;}
  let assignee=null;
  if(route==='manager'){assignee=_mgrOfOn(me(),todayISO())||me()?.managerId||null;}
  else if(route.startsWith('user:')){assignee=route.slice(5);}
  else{const hr=DB.users.find(x=>x.hrm?.isHR&&x.status==='Active'&&!isSuperU(x));assignee=hr?hr.id:null;}
  if(!assignee){toast(route==='manager'?'You have no manager assigned':'No active HR user found','err');return;}
  const date=todayISO();
  const _caseId=$('#tk-case')?.value||null;
  const ticket={id:uid('tk'),title,description,priority,status:'Open',assignedTo:assignee,createdBy:S.uid,
    checklistId:_caseId,questionId:null,questionText:'',answerGiven:'',submitterId:S.uid,date,
    createdAt:new Date().toISOString(),resolvedAt:null,resolveNote:'',viewedBy:[],
    route /* frontend-only display marker — NOT in the Supabase payload */};
  if(!DB.tickets)DB.tickets=[];
  DB.tickets.unshift(ticket);
  // Mirror the existing escalation insert columns exactly (no `route` column → schema-safe).
  sb.from('tickets').insert({id:ticket.id,title:ticket.title,description:ticket.description,priority:ticket.priority,status:ticket.status,assigned_to:ticket.assignedTo,created_by:ticket.createdBy,checklist_id:ticket.checklistId||null,question_id:null,question_text:'',answer_given:'',submitter_id:ticket.submitterId,date:ticket.date,created_at:ticket.createdAt,resolved_at:null,resolve_note:'',viewed_by:[]})
    .then(({error})=>{if(error)console.error('[ticket insert]',error.message);}).catch(e=>console.error('[ticket insert failed]',e.message));
  notifyEvent('ticket_assigned',assignee,'🎫 New ticket from '+fullName(me())+': '+title,'tickets',{ticket_title:title});
  saveDB();
  App.closeModal();
  toast('Ticket sent to '+(route==='manager'?'your manager':'HR')+'');
  rr();
};
App._tkSetStatus=(el)=>{const id=el.dataset.id,status=el.dataset.st;App._ticketStatus(id,status);};
App._tkFilter=(key,val)=>{if(key==='status')S.filters.tkStatus=val;else S.filters.tkPriority=val;rr();};
App._ticketStatus=(id,status)=>{
  const t=(DB.tickets||[]).find(x=>x.id===id);if(!t)return;
  const _own=t.assignedTo===S.uid||t.createdBy===S.uid;
  if(!_own&&!can('tickets','changeStatus'))return toast('You need Tickets → Change status','err');
  const was=t.status;
  t.status=status;
  if(status==='Resolved'&&!t.resolvedAt)t.resolvedAt=new Date().toISOString(); // resolution timestamp for analytics
  if(status==='Open')t.resolvedAt=null;
  /* The raiser hears about the outcome from HERE too, not only from the resolve modal — a
     status changed straight from the dropdown is the same news to them. */
  if(was!==status&&(status==='Resolved'||status==='Closed'||(status==='Open'&&(was==='Resolved'||was==='Closed'))))
    _tkNotifyOutcome(t,status==='Open'?'Reopened':status,t.resolveNote||'');
  saveDB();rr();
  sb.from('tickets').update({status,resolved_at:t.resolvedAt||null}).eq('id',id).then(()=>{}).catch(e=>console.warn('ticket status:',e.message));
};

App._resolveTicket=(id)=>{
  const t=(DB.tickets||[]).find(x=>x.id===id);if(!t)return;
  modalShell({title:'Resolve ticket',sub:'Add a note explaining how this was resolved.',size:'max-w-sm',
    body:'<textarea id="tk-note" rows="3" placeholder="What was done to resolve this?" class="ui-input rf" style="resize:none"></textarea>',
    footer:btnG('Cancel','App.closeModal()')+btn('Mark Resolved',`App._confirmResolve('${id}')`,{variant:'brand'})});
};

/* Whoever should hear about a ticket's outcome: the person who raised it and, for a ticket
   opened automatically by a failing checklist answer, the person whose answer triggered it.
   Deduped, and never the person doing the resolving. */
function _tkAudience(t){
  const out=new Set();
  if(t.createdBy)out.add(t.createdBy);
  if(t.submitterId)out.add(t.submitterId);
  out.delete(S.uid);
  return [...out].filter(id=>uById(id));
}
function _tkNotifyOutcome(t,status,note){
  const who=_tkAudience(t);if(!who.length)return;
  const title=String(t.title||'Ticket').slice(0,60);
  const txt=(status==='Resolved')?'✅ Resolved: "'+title+'"'+(note?' — '+String(note).slice(0,60):'')
    :(status==='Closed')?'📕 Closed: "'+title+'"'
    :'🔄 Reopened: "'+title+'"';
  notifyEventAll('ticket_resolved',who,txt+' · by '+fullName(me()),'tickets',{ticket_title:title});
}

App._confirmResolve=(id)=>{
  const note=$('#tk-note')?.value?.trim()||'';
  const t=(DB.tickets||[]).find(x=>x.id===id);if(!t)return;
  if(!(t.assignedTo===S.uid||can('tickets','resolve')))return toast('You need Tickets → Resolve','err');
  t.status='Resolved';t.resolvedAt=new Date().toISOString();t.resolveNote=note;
  _tkNotifyOutcome(t,'Resolved',note);
  log(fullName(me()),'Resolved ticket',t.title||'');
  closeModal();saveDB();rr();
  sb.from('tickets').update({status:'Resolved',resolved_at:t.resolvedAt,resolve_note:note}).eq('id',id).then(({error})=>{if(error)_syncErr('ticket resolution')(error);}).catch(_syncErr('ticket resolution'));
};

App._delTicket=(id)=>{
  if(!can('tickets','delete')){toast('You need Tickets → Delete','err');return;}
  DB.tickets=(DB.tickets||[]).filter(t=>t.id!==id);
  saveDB();rr();
  sb.from('tickets').delete().eq('id',id).then(()=>{}).catch(e=>console.warn('del ticket:',e.message));
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.ticketsPage=ticketsPage;
