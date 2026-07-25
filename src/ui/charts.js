

/* ===== LIVE DASHBOARD CHARTS (Chart.js) =====
   _AData / _HData are filled by analyticsPage() / homeDash() during render; the canvases are then
   painted by _paintCharts(), which render()/rr() call after the DOM is in place. Charts are destroyed
   and rebuilt on every render so they always reflect the current filters. */
function _aChartTheme(){
  // PRO-VIZ: one visual language for every chart — inherited font, dark rounded tooltips,
  // circular legend markers, soft dashed grid, gentle ease-out animation, consistent palette.
  if(typeof Chart!=='undefined'&&!Chart.__bridged){Chart.__bridged=1;
    try{
      // R10 CRITICAL: MUTATE Chart.js v4 defaults property-by-property — NEVER replace the nested
      // defaults objects. v4's defaults nodes carry non-enumerable resolver descriptors; replacing
      // them (old code used {...spread} reassignment) broke tooltip/hover animations with
      // "Uncaught TypeError: this._fn is not a function", which killed the shared animation loop —
      // one HOVER blanked every chart on the page (the "shows 1 sec then empty" bug).
      Chart.defaults.font.family="'Hanken Grotesk',system-ui,sans-serif";
      Chart.defaults.font.weight='600';Chart.defaults.color='#787D89';
      Chart.defaults.animation.duration=600;
      // R16 CRITICAL (verified live): the initial 600ms load animation is safe, but Chart.js v4's
      // per-interaction HOVER transitions ('active' etc.) still spun up an interpolation whose
      // resolved descriptor threw "Uncaught TypeError: this._fn is not a function" on every hover —
      // 8 uncaught exceptions per hover in the console, and the latent cause of the intermittent
      // "graph shows for a second then goes empty" reports. Disabling ONLY the interaction-transition
      // durations (not the load animation) removes the throw entirely with no visual change: hover
      // highlight/offset is simply instant. Confirmed on the live site: hovering every chart type
      // afterwards produced ZERO console errors.
      Chart.defaults.transitions=Chart.defaults.transitions||{};
      ['active','resize','hide','show'].forEach(k=>{
        Chart.defaults.transitions[k]=Chart.defaults.transitions[k]||{};
        Chart.defaults.transitions[k].animation=Chart.defaults.transitions[k].animation||{};
        Chart.defaults.transitions[k].animation.duration=0;
      });
      const tt=Chart.defaults.plugins.tooltip;
      tt.backgroundColor='rgba(21,23,28,0.94)';tt.titleColor='#fff';tt.bodyColor='#D7DBE2';
      tt.titleFont={size:12,weight:'800'};tt.bodyFont={size:11.5,weight:'600'};
      tt.padding={top:10,bottom:10,left:12,right:12};tt.cornerRadius=10;tt.displayColors=true;
      tt.boxPadding=5;tt.usePointStyle=true;tt.caretSize=5;
      const ll=Chart.defaults.plugins.legend.labels;
      ll.usePointStyle=true;ll.pointStyle='circle';ll.boxWidth=7;ll.boxHeight=7;ll.padding=14;ll.font={size:11,weight:'700'};
      const eb=Chart.defaults.elements.bar;eb.borderRadius=7;eb.borderSkipped=false;
      const el=Chart.defaults.elements.line;el.borderWidth=2.5;el.tension=0.42;
      const ep=Chart.defaults.elements.point;ep.radius=0;ep.hoverRadius=5;ep.hoverBorderWidth=2;ep.hoverBorderColor='#fff';
    }catch(e){console.warn('[charts theme]',e&&e.message);}}
  return {tick:'#8A93A3',grid:'rgba(138,147,163,0.13)',brand:'#0E9F6E',mint:'#34D399',soft:'#C9F3E3',neutral:'#E4E7EC',amber:'#F59E0B',rose:'#F43F5E',blue:'#38BDF8',sky:'#0EA5E9',violet:'#8B5CF6',indigo:'#6366F1',slate:'#94A3B8'};
}
/* PRO-VIZ: scriptable vertical gradient — line fills & vertical bars fade to transparent. */
function _vfill(hex,top){return(c)=>{const{ctx,chartArea:a}=c.chart;if(!a)return hex+'22';
  const g=ctx.createLinearGradient(0,a.top,0,a.bottom);g.addColorStop(0,hex+(top||'66'));g.addColorStop(1,hex+'06');return g;};}
/* WEB-LOOK: center label inside doughnuts (big value + small caption), like the site's donut. */
const _ctp={id:'ctp',afterDraw(c){const t=c.config&&c.config.options&&c.config.options._center;if(!t)return;
  const {ctx,chartArea:a}=c;if(!a)return;const x=(a.left+a.right)/2,y=(a.top+a.bottom)/2;
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font="800 20px 'Schibsted Grotesk','Hanken Grotesk',sans-serif";ctx.fillStyle='#15171C';ctx.fillText(t.v,x,y-7);
  ctx.font="700 9.5px 'Hanken Grotesk',sans-serif";ctx.fillStyle='#8A93A3';ctx.fillText(String(t.l||'').toUpperCase(),x,y+12);ctx.restore();}};
function _destroyACharts(){_aCharts.forEach(c=>{try{c.destroy();}catch(e){}});_aCharts=[];}
function _paintCharts(){try{
  const need=document.getElementById('aChartStatus')||document.getElementById('hChartMyWork');
  // R9: if Chart.js hasn't arrived from the CDN yet, retry for ~3s, then say so VISIBLY instead of
  // leaving silent blank boxes (owner report "all graphs empty" — a blocked CDN looks exactly like that).
  if(need&&typeof Chart==='undefined'){
    _paintCharts._r=(_paintCharts._r||0)+1;
    if(_paintCharts._r<12){setTimeout(_paintCharts,250);return;}
    document.querySelectorAll('canvas[id^="aChart"],canvas[id^="hChart"]').forEach(cv=>{const p=cv.parentElement;if(p)p.innerHTML='<div style="height:100%;display:grid;place-items:center;color:var(--c-text-3);font-size:12px;text-align:center;padding:0 14px;line-height:1.5">Charts library didn\'t load —<br>check the connection / ad-blocker (cdn.jsdelivr.net), then refresh.</div>';});
    return;
  }
  _paintCharts._r=0;
  if(document.getElementById('aChartStatus'))_drawAnalyticsCharts();
  else if(document.getElementById('hChartMyWork'))_drawHomeCharts();
  else _destroyACharts();
}catch(e){console.warn('[charts]',e&&e.message);}}
function _aClick(fn){return (e,els)=>{if(els&&els.length)fn(els[0].index,els[0].datasetIndex);};}
function _aHover(e,els){try{e.native.target.style.cursor=(els&&els.length)?'pointer':'default';}catch(_){}}
// When a chart has no data, show a tidy "No data" panel instead of empty axes/blank rings.
function _allZero(a){return !a||!a.length||a.every(v=>!v);}
function _emptyChart(id){const cv=document.getElementById(id);if(!cv)return;const p=cv.parentElement;if(p)p.innerHTML='<div style="height:100%;display:grid;place-items:center;color:var(--c-text-3);font-size:12.5px;text-align:center;padding:0 14px">No data for this range</div>';}
function _drawAnalyticsCharts(){
  if(typeof Chart==='undefined'||!_AData)return;
  _destroyACharts();
  const T=_aChartTheme(),A=_AData;
  const mk=(id,empty,cfg)=>{const cv=document.getElementById(id);if(!cv)return;if(empty){_emptyChart(id);return;}try{_aCharts.push(new Chart(cv.getContext('2d'),cfg));}catch(e){}};
  const legB={legend:{position:'bottom',labels:{color:T.tick}}};
  mk('aChartStatus',_allZero(A.status.data),{type:'doughnut',plugins:[_ctp],data:{labels:A.status.labels,datasets:[{data:A.status.data,backgroundColor:A.status.colors,borderWidth:0,hoverOffset:8,borderRadius:6,spacing:3}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',_center:(()=>{const tot=A.status.data.reduce((a,b)=>a+b,0);const on=A.status.data[Math.max(0,A.status.labels.indexOf('On Time'))]||0;return{v:(tot?Math.round(on/tot*100):0)+'%',l:'on time'};})(),plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('status',A.status.labels[i]))}});
  mk('aChartTrend',_allZero(A.trend.sub),{type:'line',data:{labels:A.trend.labels,datasets:[{label:'Submitted',data:A.trend.sub,borderColor:T.sky,backgroundColor:_vfill(T.sky),fill:true},{label:'On time',data:A.trend.ontime,borderColor:T.brand,fill:false},{label:'Late',data:A.trend.late,borderColor:T.rose,fill:false,borderDash:[5,4]}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('date',A.trend.labels[i])),scales:{x:{ticks:{color:T.tick,font:{size:10},maxRotation:0,autoSkip:true,maxTicksLimit:8},grid:{display:false}},y:{beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}}}}});
  mk('aChartDept',!A.dept.labels.length,{type:'bar',data:{labels:A.dept.labels,datasets:[{label:'On time',data:A.dept.onTime,backgroundColor:T.brand,maxBarThickness:18},{label:'Total',data:A.dept.total,backgroundColor:T.neutral,maxBarThickness:18}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('dept',A.dept.labels[i])),scales:{x:{beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}},y:{ticks:{color:T.tick,font:{size:11}},grid:{display:false}}}}});
  // PRO-VIZ: tickets as a classic PIE (mix of chart families across the dashboard).
  mk('aChartTickets',_allZero(A.tickets.data),{type:'pie',data:{labels:A.tickets.labels,datasets:[{data:A.tickets.data,backgroundColor:A.tickets.colors,borderColor:'#fff',borderWidth:2,hoverOffset:9}]},options:{responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('ticket',A.tickets.labels[i]))}});
  // PRO-VIZ: submissions by weekday — vertical gradient bars.
  if(A.weekday)mk('aChartWeekday',_allZero(A.weekday.data),{type:'bar',data:{labels:A.weekday.labels,datasets:[{label:'Submissions',data:A.weekday.data,backgroundColor:_vfill(T.violet,'CC'),hoverBackgroundColor:T.violet,maxBarThickness:34,borderRadius:9}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:T.tick,font:{size:11}},grid:{display:false}},y:{beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}}}}});
  mk('aChartEmp',!A.emp.labels.length,{type:'bar',data:{labels:A.emp.labels,datasets:[{label:'On time',data:A.emp.onTime,backgroundColor:T.brand,maxBarThickness:16},{label:'Late',data:A.emp.late,backgroundColor:T.rose,maxBarThickness:16},{label:'Pending',data:A.emp.pend,backgroundColor:T.amber,maxBarThickness:16}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:_aClick(i=>{const id=A.emp.ids[i];if(id)App._userDrill(id);}),scales:{x:{stacked:true,beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}},y:{stacked:true,ticks:{color:T.tick,font:{size:11}},grid:{display:false}}}}});
  mk('aChartCompliance',_allZero(A.compliance.data),{type:'doughnut',plugins:[_ctp],data:{labels:A.compliance.labels,datasets:[{data:A.compliance.data,backgroundColor:A.compliance.colors,borderWidth:0,hoverOffset:8,borderRadius:6,spacing:3}]},options:{responsive:true,maintainAspectRatio:false,cutout:'74%',_center:(()=>{const tot=A.compliance.data.reduce((a,b)=>a+b,0);return{v:(tot?Math.round((A.compliance.data[0]||0)/tot*100):0)+'%',l:'compliant'};})(),plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('compliance',A.compliance.labels[i]))}});
}
function _drawHomeCharts(){
  if(typeof Chart==='undefined'||!_HData)return;
  _destroyACharts();
  const T=_aChartTheme();
  const mk=(id,empty,cfg)=>{const cv=document.getElementById(id);if(!cv)return;if(empty){_emptyChart(id);return;}try{_aCharts.push(new Chart(cv.getContext('2d'),cfg));}catch(e){}};
  // "My record" — how this person's own checklist submissions landed over the selected range.
  if(_HData.myWork)mk('hChartMyWork',_allZero(_HData.myWork.data),{type:'doughnut',plugins:[_ctp],data:{labels:_HData.myWork.labels,datasets:[{data:_HData.myWork.data,backgroundColor:[T.brand,T.amber,T.violet,T.rose,'#94A3B8'],borderWidth:0,hoverOffset:8,borderRadius:6,spacing:3}]},options:{responsive:true,maintainAspectRatio:false,cutout:'70%',_center:{v:_HData.myWork.done+'/'+_HData.myWork.assigned,l:'submitted'},plugins:{legend:{position:'bottom',labels:{color:T.tick}}}}});
}
// Export every visible chart as a PNG (white background) plus the data CSV.
function _pngWithBg(cv){const c=document.createElement('canvas');c.width=cv.width||cv.clientWidth;c.height=cv.height||cv.clientHeight;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,c.width,c.height);x.drawImage(cv,0,0);return c.toDataURL('image/png');}
App._exportReport=()=>{
  const cvs=Array.from(document.querySelectorAll('canvas[data-chart]'));
  toast(cvs.length?('Exporting '+cvs.length+' chart'+(cvs.length!==1?'s':'')+' + data…'):'Exporting data…');
  cvs.forEach((cv,i)=>setTimeout(()=>{try{const a=document.createElement('a');a.href=_pngWithBg(cv);a.download='evarca_'+(cv.dataset.chart||'chart')+'_'+todayISO()+'.png';document.body.appendChild(a);a.click();a.remove();}catch(e){}},i*400));
  setTimeout(()=>{try{App._exportCSV();}catch(e){}},cvs.length*400+250);
};
// ── Click-to-drill: clicking any analytics chart opens the underlying rows in a popup ──
function _subListModal(title,subs){
  const rows=subs.slice().sort((a,b)=>(b.submittedAt||b.date||'').localeCompare(a.submittedAt||a.date||'')).slice(0,300);
  modalShell({title,sub:subs.length+' item'+(subs.length!==1?'s':''),size:'max-w-lg',
    body:rows.length?rows.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);return `<div onclick="App.closeModal();App.viewSub('${s.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);cursor:pointer">${avatar(u,'w-8 h-8','text-[11px]')}<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(u?fullName(u):'—')}</div><div style="font-size:11px;color:var(--c-text-3);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(c?c.name:'[deleted checklist]')} · ${fmtS(s.date)}</div></div>${chip(s.status)}</div>`;}).join(''):'<p style="font-size:13px;color:var(--c-text-3);text-align:center;padding:20px">No items.</p>'});
}
function _missedDrillModal(missed){
  const rows=(missed||[]).slice(0,300);
  modalShell({title:'Missed checklists',sub:(missed||[]).length+' missed',size:'max-w-lg',
    body:rows.length?rows.map(m=>{const u=uById(m.userId),c=clById(m.checklistId);return `<div onclick="App.closeModal();App._userDrill('${m.userId}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);cursor:pointer">${avatar(u,'w-8 h-8','text-[11px]')}<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text)">${esc(u?fullName(u):'—')}</div><div style="font-size:11px;color:var(--c-text-3)">${esc(c?c.name:'[deleted]')} · ${fmtS(m.date)}</div></div><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-warn-soft);color:var(--c-warn-ink)">Missed</span></div>`;}).join(''):'<p style="font-size:13px;color:var(--c-text-3);text-align:center;padding:20px">No missed checklists in range.</p>'});
}
function _ticketDrillModal(key,tickets){
  const m={'Open':t=>t.status==='Open','In Progress':t=>t.status==='In Progress','Resolved':t=>t.status==='Resolved'||t.status==='Closed'};
  const list=(tickets||[]).filter(m[key]||(()=>true));
  modalShell({title:key+' tickets',sub:list.length+' ticket'+(list.length!==1?'s':''),size:'max-w-lg',
    body:list.length?list.slice(0,300).map(t=>{const u=uById(t.assignedTo);return `<div onclick="App.closeModal();App.go('tickets')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);cursor:pointer"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(t.title||'Ticket')}</div><div style="font-size:11px;color:var(--c-text-3)">${esc(t.priority||'')}${u?' · '+esc(fullName(u)):''}</div></div>${chip(t.status)}</div>`;}).join(''):'<p style="font-size:13px;color:var(--c-text-3);text-align:center;padding:20px">No tickets.</p>'});
}
App._chartDrill=(kind,key)=>{
  const D=_AFiltered||{};
  if(kind==='status'){
    if(key==='Missed')return _missedDrillModal(D.missed);
    return _subListModal(key+' submissions',(D.subs||[]).filter(s=>s.status===key));
  }
  if(kind==='date'){const full=(D.dateMap||{})[key]||key;return _subListModal('Submissions · '+fmtS(full),(D.subs||[]).filter(s=>s.date===full));}
  if(kind==='dept')return _subListModal(key+' · submissions',(D.subs||[]).filter(s=>{const c=clById(s.checklistId);return c&&(c.department||'—')===key;}));
  if(kind==='compliance')return _subListModal(key+' submissions',key==='Compliant'?(D.compliant||[]):(D.nonCompliant||[]));
  if(kind==='ticket')return _ticketDrillModal(key,D.tickets);
};
/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._aChartTheme=_aChartTheme;window._vfill=_vfill;window._ctp=_ctp;window._destroyACharts=_destroyACharts;window._paintCharts=_paintCharts;window._aClick=_aClick;window._aHover=_aHover;window._allZero=_allZero;window._emptyChart=_emptyChart;window._drawAnalyticsCharts=_drawAnalyticsCharts;window._drawHomeCharts=_drawHomeCharts;window._pngWithBg=_pngWithBg;window._subListModal=_subListModal;window._missedDrillModal=_missedDrillModal;window._ticketDrillModal=_ticketDrillModal;
