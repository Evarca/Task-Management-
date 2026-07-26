/* ════════════════════════════════════════════════════════════════════════════
   CLIENT BILLING, INVOICES & PER-QUESTION COSTS  (round 8)

   Money on a client is three numbers: the TOTAL agreed for the engagement
   (tm_billing), what the client has PAID so far (tm_payments — one row per
   payment), and what the team has UTILIZED doing the work (tm_q_costs — one
   row per question per run, entered right on the run card).

   Balance due  = total − paid.
   Utilized     = Σ per-question costs across the client's checklists.

   Every payment can become an INVOICE (tm_invoices). The company template —
   header, logo, TRN, footer, terms, currency, tax — lives once in
   tm_invoice_settings, is edited from the client's Billing tab, and is
   SNAPSHOTTED onto each invoice at issue time, so editing the template later
   never rewrites a document that was already sent. Numbering (INV-0001…) is
   allocated atomically by the tm_next_invoice_no RPC.

   Who can do what: everything money is behind the new Clients → Billing
   permission (`can('locations','billing')`; admins pass, and the RLS on every
   tm_ billing table enforces the same rule server-side). The one exception is
   the per-question utilized cost, which any assignee on that run can enter —
   it is part of doing the work, not of managing the account.

   All writes are TARGETED (insert/update/upsert of one row at save time) —
   nothing here is added to the debounced _sync() whole-table batch.
   ════════════════════════════════════════════════════════════════════════════ */

const canBill=()=>can('locations','billing')||isAdmin();          // manage: record payments, invoices, totals, template
const canBillView=()=>can('locations','billingView')||canBill();   // view: see totals / paid / balance / utilized

/* ── mappers ── */
function _mPay(rows){return(rows||[]).map(p=>({id:p.id,clientId:p.client_id,amount:Number(p.amount)||0,paidOn:p.paid_on,method:p.method||'',reference:p.reference||'',notes:p.notes||'',recordedBy:p.recorded_by||null,createdAt:p.created_at}));}
function _payRow(p){return{id:p.id,client_id:p.clientId,amount:p.amount,paid_on:p.paidOn,method:p.method||'',reference:p.reference||'',notes:p.notes||'',recorded_by:p.recordedBy||null,created_at:p.createdAt||new Date().toISOString()};}
function _mInv(rows){return(rows||[]).map(v=>({id:v.id,clientId:v.client_id,number:v.number,paymentId:v.payment_id||null,amount:Number(v.amount)||0,taxRate:Number(v.tax_rate)||0,taxAmount:Number(v.tax_amount)||0,total:Number(v.total)||0,currency:v.currency||'AED',issuedOn:v.issued_on,notes:v.notes||'',snapshot:v.snapshot||{},status:v.status||'Issued',createdBy:v.created_by||null,createdAt:v.created_at}));}
function _invRow(v){return{id:v.id,client_id:v.clientId,number:v.number,payment_id:v.paymentId||null,amount:v.amount,tax_rate:v.taxRate||0,tax_amount:v.taxAmount||0,total:v.total,currency:v.currency||'AED',issued_on:v.issuedOn,notes:v.notes||'',snapshot:v.snapshot||{},status:v.status||'Issued',created_by:v.createdBy||null,created_at:v.createdAt||new Date().toISOString()};}
function _mInvSettings(r){if(!r)return null;return{companyName:r.company_name||'',address:r.address||'',phone:r.phone||'',email:r.email||'',trn:r.trn||'',logo:r.logo||'',footerText:r.footer_text||'',terms:r.terms||'',currency:r.currency||'AED',taxLabel:r.tax_label||'VAT',taxRate:Number(r.tax_rate)||0,numberPrefix:r.number_prefix||'INV-',nextNumber:Number(r.next_number)||1};}

/* ── money formatting: "AED 7,000" (currency is free text — whatever was configured) ── */
function fmtMoney(n,cur){
  const v=Number(n)||0;
  const s=v.toLocaleString('en-US',{minimumFractionDigits:(v%1?2:0),maximumFractionDigits:2});
  return (cur||_invDefaults().currency||'AED')+' '+s;
}
/* Company defaults for currency/tax when a client has no explicit setting yet. */
function _invDefaults(){return DB.tmInvoiceSettings||{currency:'AED',taxLabel:'VAT',taxRate:0,numberPrefix:'INV-'};}

/* ── rollups ── */
function _cliBilling(clientId){return(DB.tmBilling||{})[clientId]||null;}
function _cliCurrency(clientId){const b=_cliBilling(clientId);return(b&&b.currency)||_invDefaults().currency||'AED';}
function _cliPaid(clientId){return(DB.tmPayments||[]).filter(p=>p.clientId===clientId).reduce((s,p)=>s+(Number(p.amount)||0),0);}
function _cliBalance(clientId){const b=_cliBilling(clientId);return(b?Number(b.total)||0:0)-_cliPaid(clientId);}
/* Utilized = Σ tm_q_costs across every run of every checklist attached to this client. */
function _cliUtilized(clientId){
  let sum=0;
  Object.entries(DB.tmQCosts||{}).forEach(([key,rec])=>{
    const clId=key.split('|')[0];
    const c=clById(clId);
    if(c&&(c.locationIds||[]).includes(clientId))sum+=Number(rec.amount)||0;
  });
  return sum;
}
/* Utilized on ONE run (a case's accumulating total, or one day of a recurring checklist). */
function _runUtilized(clId,date){
  date=_normD(clId,date);
  let sum=0;
  Object.entries(DB.tmQCosts||{}).forEach(([key,rec])=>{
    const[k1,k2]=key.split('|');
    if(k1===clId&&k2===date)sum+=Number(rec.amount)||0;
  });
  return sum;
}
function _qCostOf(clId,date,qId){return(DB.tmQCosts||{})[_qsKey(clId,date,qId)]||null;}

/* ── per-question cost: any assignee on the run, or a billing holder ── */
App._qCostSet=(clId,date,qId,val)=>{
  date=_normD(clId,date);
  const c=clById(clId);if(!c)return;
  const mine=(c.assignees||[]).includes(S.uid);
  if(!mine&&!canBill()){toast('Only people on this checklist (or Billing holders) can set costs','err');return;}
  const key=_qsKey(clId,date,qId);
  DB.tmQCosts=DB.tmQCosts||{};
  const raw=String(val??'').trim();
  if(raw===''){ // clearing the field removes the record
    if(DB.tmQCosts[key]){delete DB.tmQCosts[key];sb.from('tm_q_costs').delete().eq('id',key).then(({error})=>{if(error)_syncErr('question cost')(error);}).catch(_syncErr('question cost'));saveDB();rr();}
    return;
  }
  const amt=Math.max(0,Number(raw)||0);
  const prev=DB.tmQCosts[key];
  if(prev&&Number(prev.amount)===amt)return;
  DB.tmQCosts[key]={amount:amt,setBy:S.uid,setAt:new Date().toISOString()};
  sb.from('tm_q_costs').upsert({id:key,checklist_id:clId,run_date:date,question_id:qId,amount:amt,set_by:S.uid,set_at:new Date().toISOString()},{onConflict:'id'})
    .then(({error})=>{if(error)_syncErr('question cost')(error);}).catch(_syncErr('question cost'));
  saveDB();rr();
};

/* ── billing master record (the client's total) ── */
function _billingSave(clientId,total,currency){
  DB.tmBilling=DB.tmBilling||{};
  DB.tmBilling[clientId]={total:Math.max(0,Number(total)||0),currency:(currency||'AED').trim()||'AED'};
  sb.from('tm_billing').upsert({client_id:clientId,total:DB.tmBilling[clientId].total,currency:DB.tmBilling[clientId].currency,updated_by:S.uid,updated_at:new Date().toISOString()},{onConflict:'client_id'})
    .then(({error})=>{if(error)_syncErr('client billing')(error);}).catch(_syncErr('client billing'));
}

/* ── payments ── */
App._payAdd=(locId)=>{
  if(!canBill())return toast('You need Clients → Billing & invoices','err');
  const cur=_cliCurrency(locId);
  const bal=_cliBalance(locId);
  modalShell({title:'Record a payment',sub:(locById(locId)||{}).name||'',size:'max-w-sm',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      ${fld('Amount received ('+esc(cur)+') *','pay-amt',bal>0?bal:'','number','e.g. 7000')}
      ${fld('Date received','pay-date',todayISO(),'date','')}
      <div class="grid grid-cols-2 gap-3">
        ${selF('Method','pay-method',['','Bank transfer','Cash','Cheque','Card','Online'],'')}
        ${fld('Reference','pay-ref','','text','Txn / cheque no. (optional)')}
      </div>
      ${fld('Note','pay-note','','text','Optional')}
      <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--c-text-2);cursor:pointer">
        <input type="checkbox" id="pay-inv" checked style="width:16px;height:16px;accent-color:#15803D"/> Generate an invoice for this payment now
      </label>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save payment',`App._payAddGo('${esc(locId)}')`)});
};
App._payAddGo=(locId)=>{
  if(!canBill())return;
  const amt=Number($('#pay-amt')?.value);
  if(!(amt>0))return toast('Enter the amount received','err');
  const p={id:uid('pay'),clientId:locId,amount:amt,paidOn:$('#pay-date')?.value||todayISO(),
    method:$('#pay-method')?.value||'',reference:($('#pay-ref')?.value||'').trim(),notes:($('#pay-note')?.value||'').trim(),
    recordedBy:S.uid,createdAt:new Date().toISOString()};
  const wantInv=!!$('#pay-inv')?.checked;
  DB.tmPayments=DB.tmPayments||[];DB.tmPayments.unshift(p);
  sb.from('tm_payments').insert(_payRow(p)).then(({error})=>{if(error)_syncErr('payment')(error);}).catch(_syncErr('payment'));
  const _cliNm=(locById(locId)||{}).name||'a client';
  log(fullName(me()),'Recorded payment',fmtMoney(amt,_cliCurrency(locId))+' · '+_cliNm);
  _notifyBillingFolks('payment_recorded','💰 Payment recorded: '+fmtMoney(amt,_cliCurrency(locId))+' from '+_cliNm+' — by '+fullName(me()),{client_name:_cliNm,amount:fmtMoney(amt,_cliCurrency(locId))});
  saveDB();closeModal();toast('Payment recorded');rr();
  if(wantInv)App._invGen(locId,p.id);
};
App._payDel=(payId)=>{
  if(!canBill())return toast('You need Clients → Billing & invoices','err');
  const p=(DB.tmPayments||[]).find(x=>x.id===payId);if(!p)return;
  const inv=(DB.tmInvoices||[]).find(v=>v.paymentId===payId&&v.status!=='Void');
  confirmModal({title:'Delete this payment?',body:esc(fmtMoney(p.amount,_cliCurrency(p.clientId)))+' received '+fmtS(String(p.paidOn||''))
      +(inv?'<br><b>Note:</b> invoice '+esc(inv.number)+' was generated from it and stays on file (void it separately if needed).':''),
    confirmLabel:'Delete payment',danger:true,onConfirm:`App._payDelGo('${esc(payId)}')`});
};
App._payDelGo=(payId)=>{
  if(!canBill())return;
  DB.tmPayments=(DB.tmPayments||[]).filter(x=>x.id!==payId);
  _delRow('tm_payments',payId,'payment');
  log(fullName(me()),'Deleted payment',payId);
  saveDB();closeModal();toast('Payment deleted','warn');rr();
};

/* ── invoice settings (the ONE company template) ── */
async function _invSettingsEnsure(){
  if(DB.tmInvoiceSettings)return DB.tmInvoiceSettings;
  try{
    const {data,error}=await sb.from('tm_invoice_settings').select('*').eq('id',1).maybeSingle();
    if(!error&&data)DB.tmInvoiceSettings=_mInvSettings(data);
  }catch(e){}
  return DB.tmInvoiceSettings||_mInvSettings({});
}
App._invSettings=async()=>{
  if(!canBill())return toast('You need Clients → Billing & invoices','err');
  const s=(await _invSettingsEnsure())||{};
  window._invLogoDraft=s.logo||'';
  modalShell({title:'Invoice template',sub:'One company-wide design — header, footer and defaults for every invoice',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      ${fld('Company name','ivs-name',s.companyName||'','text','As it should appear on the invoice')}
      <div><label style="display:block;font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Address</label>
        <textarea id="ivs-addr" rows="2" class="ui-input rf" placeholder="Office address">${esc(s.address||'')}</textarea></div>
      <div class="grid grid-cols-2 gap-3">
        ${fld('Phone','ivs-phone',s.phone||'','tel','+971…')}
        ${fld('Email','ivs-email',s.email||'','email','billing@company.com')}
      </div>
      <div class="grid grid-cols-2 gap-3">
        ${fld('Tax registration no. (TRN)','ivs-trn',s.trn||'','text','Optional')}
        ${fld('Invoice number prefix','ivs-prefix',s.numberPrefix||'INV-','text','INV-')}
      </div>
      <div class="grid grid-cols-3 gap-3">
        ${fld('Currency','ivs-cur',s.currency||'AED','text','AED')}
        ${fld('Tax label','ivs-taxlabel',s.taxLabel||'VAT','text','VAT')}
        ${fld('Tax rate %','ivs-taxrate',(s.taxRate??0),'number','5')}
      </div>
      <div><label style="display:block;font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Logo</label>
        <div style="display:flex;align-items:center;gap:10px">
          <span id="ivs-logo-prev">${s.logo?`<img src="${esc(s.logo)}" alt="Logo" style="height:40px;border-radius:6px"/>`:'<span style="font-size:12px;color:var(--c-text-3)">No logo</span>'}</span>
          <label class="ui-btn ui-btn-ghost ui-btn-sm" style="cursor:pointer;margin:0">Upload<input type="file" accept="image/*" style="display:none" onchange="App._invLogoPick(this)"/></label>
          <button type="button" class="ui-btn ui-btn-ghost ui-btn-sm" onclick="App._invLogoClear()">Remove</button>
        </div></div>
      <div><label style="display:block;font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Footer text</label>
        <textarea id="ivs-footer" rows="2" class="ui-input rf" placeholder="e.g. Thank you for your business.">${esc(s.footerText||'')}</textarea></div>
      <div><label style="display:block;font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Terms</label>
        <textarea id="ivs-terms" rows="2" class="ui-input rf" placeholder="Payment terms, bank details… (optional)">${esc(s.terms||'')}</textarea></div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save template','App._invSettingsSave()')});
};
/* Logo → small data URL (kept in the settings row itself, so the invoice window needs no
   signed URL and the print view works offline). Downscaled to ≤360px wide. */
App._invLogoPick=(input)=>{
  const f=input&&input.files&&input.files[0];if(input)input.value='';if(!f)return;
  if(!/^image\//.test(f.type||''))return toast('Pick an image file','err');
  const rd=new FileReader();
  rd.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const scale=Math.min(1,360/(img.width||360));
        const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*scale));cv.height=Math.max(1,Math.round(img.height*scale));
        cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
        window._invLogoDraft=cv.toDataURL(f.type==='image/png'?'image/png':'image/jpeg',0.85);
        const el=document.getElementById('ivs-logo-prev');
        if(el)el.innerHTML=`<img src="${esc(window._invLogoDraft)}" alt="Logo" style="height:40px;border-radius:6px"/>`;
      }catch(e){toast('Could not read that image','err');}
    };
    img.src=rd.result;
  };
  rd.readAsDataURL(f);
};
App._invLogoClear=()=>{window._invLogoDraft='';const el=document.getElementById('ivs-logo-prev');if(el)el.innerHTML='<span style="font-size:12px;color:var(--c-text-3)">No logo</span>';};
App._invSettingsSave=()=>{
  if(!canBill())return;
  const s={
    companyName:($('#ivs-name')?.value||'').trim(),
    address:($('#ivs-addr')?.value||'').trim(),
    phone:($('#ivs-phone')?.value||'').trim(),
    email:($('#ivs-email')?.value||'').trim(),
    trn:($('#ivs-trn')?.value||'').trim(),
    logo:window._invLogoDraft||'',
    footerText:($('#ivs-footer')?.value||'').trim(),
    terms:($('#ivs-terms')?.value||'').trim(),
    currency:(($('#ivs-cur')?.value||'AED').trim()||'AED'),
    taxLabel:(($('#ivs-taxlabel')?.value||'VAT').trim()||'VAT'),
    taxRate:Math.max(0,Number($('#ivs-taxrate')?.value)||0),
    numberPrefix:(($('#ivs-prefix')?.value||'INV-').trim()||'INV-'),
  };
  DB.tmInvoiceSettings={...(DB.tmInvoiceSettings||{}),...s};
  sb.from('tm_invoice_settings').upsert({id:1,company_name:s.companyName,address:s.address,phone:s.phone,email:s.email,
    trn:s.trn,logo:s.logo,footer_text:s.footerText,terms:s.terms,currency:s.currency,tax_label:s.taxLabel,tax_rate:s.taxRate,
    number_prefix:s.numberPrefix,updated_by:S.uid,updated_at:new Date().toISOString()},{onConflict:'id'})
    .then(({error})=>{if(error)_syncErr('invoice template')(error);}).catch(_syncErr('invoice template'));
  log(fullName(me()),'Edited invoice template','');
  saveDB();closeModal();toast('Invoice template saved');rr();
};

/* ── generating an invoice ── */
App._invGen=async(locId,payId)=>{
  if(!canBill())return toast('You need Clients → Billing & invoices','err');
  const s=(await _invSettingsEnsure())||{};
  const pay=payId?(DB.tmPayments||[]).find(p=>p.id===payId):null;
  const cur=_cliCurrency(locId);
  const amt=pay?pay.amount:Math.max(0,_cliBalance(locId));
  modalShell({title:'Generate invoice',sub:(locById(locId)||{}).name||'',size:'max-w-sm',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      ${pay?`<div style="background:var(--c-surface-2);border-radius:10px;padding:9px 12px;font-size:12.5px;color:var(--c-text-2)">For the payment of <b>${esc(fmtMoney(pay.amount,cur))}</b> received ${fmtS(String(pay.paidOn||''))}.</div>`:''}
      ${fld('Amount ('+esc(cur)+') *','iv-amt',amt||'','number','e.g. 7000')}
      ${fld('Description','iv-note',pay?('Payment received'+(pay.method?' — '+pay.method:'')):'Professional services','text','One line on the invoice')}
      <div class="grid grid-cols-2 gap-3">
        ${fld(esc(s.taxLabel||'VAT')+' rate %','iv-tax',(s.taxRate??0),'number','0 for none')}
        ${fld('Issue date','iv-date',todayISO(),'date','')}
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:var(--c-surface-2);border-radius:9px;padding:8px 11px">
        <span style="font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Invoice no.</span>
        <span style="font-size:13px;font-weight:800">${esc((s.numberPrefix||'INV-')+String(s.nextNumber||1).padStart(4,'0'))}</span>
        <span style="font-size:11px;color:var(--c-text-3)">assigned automatically</span>
      </div>
      <div style="font-size:11.5px;color:var(--c-text-3)">The current company template is stamped onto this invoice — edit it under “Invoice template”.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Create invoice',`App._invGenGo('${esc(locId)}','${esc(payId||'')}')`)});
};
App._invGenGo=async(locId,payId)=>{
  if(!canBill())return;
  const amt=Number($('#iv-amt')?.value);
  if(!(amt>0))return toast('Enter the invoice amount','err');
  const taxRate=Math.max(0,Number($('#iv-tax')?.value)||0);
  const notes=($('#iv-note')?.value||'').trim();
  const issuedOn=$('#iv-date')?.value||todayISO();
  const s=(await _invSettingsEnsure())||{};
  const l=locById(locId)||{};const m=(DB.tmClientMeta||{})[locId]||{};
  let number=null;
  try{const r=await sb.rpc('tm_next_invoice_no');if(r.error)throw r.error;number=r.data;}catch(e){
    toast('Could not allocate an invoice number — check your permission and connection','err');return;
  }
  if(DB.tmInvoiceSettings)DB.tmInvoiceSettings.nextNumber=(Number(DB.tmInvoiceSettings.nextNumber)||1)+1; // keep the preview honest for the next one
  const taxAmount=Math.round(amt*taxRate)/100;
  const v={id:uid('inv'),clientId:locId,number,paymentId:payId||null,amount:amt,taxRate,taxAmount,
    total:amt+taxAmount,currency:_cliCurrency(locId),issuedOn,notes,
    snapshot:{companyName:s.companyName||'',address:s.address||'',phone:s.phone||'',email:s.email||'',trn:s.trn||'',
      logo:s.logo||'',footerText:s.footerText||'',terms:s.terms||'',taxLabel:s.taxLabel||'VAT',
      client:{name:l.name||'',contact:m.contactName||'',email:m.contactEmail||'',phone:m.contactPhone||'',reference:m.reference||'',address:l.address||''}},
    status:'Issued',createdBy:S.uid,createdAt:new Date().toISOString()};
  DB.tmInvoices=DB.tmInvoices||[];DB.tmInvoices.unshift(v);
  sb.from('tm_invoices').insert(_invRow(v)).then(({error})=>{if(error)_syncErr('invoice')(error);}).catch(_syncErr('invoice'));
  log(fullName(me()),'Generated invoice',number+' · '+fmtMoney(v.total,v.currency)+' · '+(l.name||''));
  _notifyBillingFolks('invoice_generated','🧾 Invoice '+number+' ('+fmtMoney(v.total,v.currency)+') — '+(l.name||'a client')+' — by '+fullName(me()),{client_name:l.name||'',invoice_no:number,amount:fmtMoney(v.total,v.currency)});
  saveDB();closeModal();toast('Invoice '+number+' created');rr();
  App._invView(v.id);
};
App._invVoid=(invId)=>{
  if(!canBill())return toast('You need Clients → Billing & invoices','err');
  const v=(DB.tmInvoices||[]).find(x=>x.id===invId);if(!v||v.status==='Void')return;
  confirmModal({title:'Void invoice '+esc(v.number)+'?',body:'It stays on file marked VOID; its number is never reused.',
    confirmLabel:'Void invoice',danger:true,onConfirm:`App._invVoidGo('${esc(invId)}')`});
};
App._invVoidGo=(invId)=>{
  if(!canBill())return;
  const v=(DB.tmInvoices||[]).find(x=>x.id===invId);if(!v)return;
  v.status='Void';
  sb.from('tm_invoices').update({status:'Void'}).eq('id',invId)
    .then(({error})=>{if(error)_syncErr('invoice')(error);}).catch(_syncErr('invoice'));
  log(fullName(me()),'Voided invoice',v.number);
  saveDB();closeModal();toast('Invoice voided','warn');rr();
};

/* ── the printable invoice (standalone document — print → save as PDF) ──
   One clean A4 page: company block + logo top-left, big INVOICE + number top-right,
   a Billed-to / Details two-column band, one item line with a right-aligned totals
   stack, and quiet terms + footer at the bottom. Everything renders from the SNAPSHOT
   taken at issue time, so this document never changes after the fact. */
function _invHtml(v){
  const sn=v.snapshot||{};const cl=sn.client||{};
  const money=n=>fmtMoney(n,v.currency);
  const pay=v.paymentId?(DB.tmPayments||[]).find(p=>p.id===v.paymentId):null;
  const issued=fmtS(String(v.issuedOn||''));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.number)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#15171C;margin:0;background:#F2F1EE}
    .page{max-width:790px;margin:26px auto;background:#fff;border-top:4px solid #15171C;padding:52px 56px 44px;min-height:960px;position:relative;box-shadow:0 1px 12px rgba(15,15,15,.07)}
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
    .co{font-size:16px;font-weight:800;letter-spacing:.01em}
    .muted{color:#7A7F87;font-size:12px;line-height:1.55}
    .h1{font-size:30px;font-weight:300;letter-spacing:.28em;color:#15171C;text-align:right}
    .no{font-size:14px;font-weight:800;text-align:right;margin-top:2px}
    .pill{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.08em;padding:3px 11px;border-radius:99px;margin-top:8px}
    .band{display:flex;justify-content:space-between;gap:24px;margin:40px 0 8px;padding:18px 20px;background:#FAFAF8;border-radius:12px}
    .lbl{font-size:9.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px}
    .who{font-size:15px;font-weight:800}
    .kv{font-size:12.5px;line-height:1.7}
    .kv b{display:inline-block;min-width:86px;color:#7A7F87;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-top:26px}
    th{text-align:left;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:#9CA3AF;border-bottom:1.5px solid #15171C;padding:0 2px 9px}
    td{padding:14px 2px;border-bottom:1px solid #EEEDE9;font-size:13.5px}
    .r{text-align:right}
    .tots{margin-left:auto;width:280px;margin-top:6px}
    .tots .row{display:flex;justify-content:space-between;padding:7px 2px;font-size:13px;color:#4B5563}
    .tots .grand{border-top:2px solid #15171C;margin-top:6px;padding-top:11px;font-size:16.5px;font-weight:800;color:#15171C}
    .paidline{margin-top:14px;text-align:right;font-size:12px;font-weight:700;color:#0B7A55}
    .foot{position:absolute;left:56px;right:56px;bottom:40px}
    .terms{font-size:11.5px;color:#7A7F87;line-height:1.6;white-space:pre-wrap;border-top:1px solid #EEEDE9;padding-top:14px}
    .thanks{font-size:12px;color:#4B5563;margin-top:10px;white-space:pre-wrap}
    .void{position:absolute;top:36%;left:0;right:0;text-align:center;font-size:120px;font-weight:900;color:rgba(220,38,38,.10);transform:rotate(-18deg);letter-spacing:.12em;pointer-events:none}
    .noprint{position:fixed;top:14px;right:14px}
    @media print{.noprint{display:none}body{background:#fff}.page{margin:0;box-shadow:none;max-width:none;min-height:auto}}
  </style></head><body>
  <div class="noprint"><button onclick="window.print()" style="padding:9px 18px;border-radius:9px;border:none;background:#15171C;color:#fff;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18)">Print / Save PDF</button></div>
  <div class="page">
    ${v.status==='Void'?'<div class="void">VOID</div>':''}
    <div class="top">
      <div>
        ${sn.logo?`<img src="${esc(sn.logo)}" alt="" style="max-height:52px;max-width:210px;object-fit:contain;margin-bottom:12px;display:block"/>`:''}
        <div class="co">${esc(sn.companyName||'')}</div>
        <div class="muted" style="margin-top:4px;white-space:pre-wrap">${esc(sn.address||'')}</div>
        <div class="muted">${esc([sn.phone,sn.email].filter(Boolean).join('  ·  '))}</div>
        ${sn.trn?`<div class="muted">TRN ${esc(sn.trn)}</div>`:''}
      </div>
      <div>
        <div class="h1">INVOICE</div>
        <div class="no">${esc(v.number)}</div>
        <div style="text-align:right">
          ${v.status==='Void'?'<span class="pill" style="background:#FEE2E2;color:#B91C1C">VOID</span>'
            :pay?'<span class="pill" style="background:#DCFCE7;color:#0B7A55">PAID</span>'
            :'<span class="pill" style="background:#F3F4F6;color:#4B5563">ISSUED</span>'}
        </div>
      </div>
    </div>
    <div class="band">
      <div style="flex:1;min-width:0">
        <div class="lbl">Billed to</div>
        <div class="who">${esc(cl.name||'')}</div>
        <div class="muted" style="margin-top:3px">
          ${cl.contact?esc('Attn: '+cl.contact)+'<br/>':''}
          ${cl.address?esc(cl.address)+'<br/>':''}
          ${esc([cl.email,cl.phone].filter(Boolean).join('  ·  '))}
          ${cl.reference?'<br/>'+esc('Ref: '+cl.reference):''}
        </div>
      </div>
      <div style="flex:0 0 240px">
        <div class="lbl">Details</div>
        <div class="kv">
          <div><b>Invoice no.</b> ${esc(v.number)}</div>
          <div><b>Issue date</b> ${esc(issued)}</div>
          <div><b>Currency</b> ${esc(v.currency||'')}</div>
          ${pay&&pay.method?`<div><b>Paid via</b> ${esc(pay.method)}${pay.reference?esc(' · '+pay.reference):''}</div>`:''}
        </div>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="r" style="width:170px">Amount</th></tr></thead>
      <tbody><tr><td>${esc(v.notes||'Professional services')}</td><td class="r" style="font-weight:700">${esc(money(v.amount))}</td></tr></tbody>
    </table>
    <div class="tots">
      <div class="row"><span>Subtotal</span><span>${esc(money(v.amount))}</span></div>
      ${v.taxRate?`<div class="row"><span>${esc(sn.taxLabel||'VAT')} (${v.taxRate}%)</span><span>${esc(money(v.taxAmount))}</span></div>`:''}
      <div class="row grand"><span>Total</span><span>${esc(money(v.total))}</span></div>
    </div>
    ${pay?`<div class="paidline">Received ${esc(fmtS(String(pay.paidOn||'')))} — thank you.</div>`:''}
    <div class="foot">
      ${sn.terms?`<div class="terms"><span class="lbl" style="display:block">Terms</span>${esc(sn.terms)}</div>`:''}
      ${sn.footerText?`<div class="thanks">${esc(sn.footerText)}</div>`:''}
    </div>
  </div>
  </body></html>`;
}
App._invView=(invId)=>{
  const v=(DB.tmInvoices||[]).find(x=>x.id===invId);if(!v)return;
  if(!canBillView())return toast('You need Clients → Billing','err');
  try{
    const w=window.open('','_blank');
    if(!w){toast('Allow pop-ups to view invoices','warn');return;}
    w.document.open();w.document.write(_invHtml(v));w.document.close();
  }catch(e){toast('Could not open the invoice window','err');}
};

/* ── billing notifications: payments and invoices ping everyone who manages billing ── */
function _notifyBillingFolks(key,txt,vars){
  try{
    const ids=(DB.users||[]).filter(u=>u.status==='Active'&&(isSuperU(u)||canUser(u,'locations','billing'))).map(u=>u.id);
    notifyEventAll(key,ids,txt,'locations',vars||{});
  }catch(e){console.warn('[billing notify]',e&&e.message);}
}

/* ── the "what we're waiting for" note that rides with a Waiting-on-client flag ──
   Stored in tm_wait_notes (same composite key as tm_q_status); shown to the team on the
   run card and client file, and to the CLIENT on the status page. Cleared automatically
   when the client responds, or when the flag itself is cleared. */
function _waitNoteOf(clId,date,qId){return(DB.tmWaitNotes||{})[_qsKey(clId,date,qId)]||null;}
App._waitNoteAsk=(clId,date,qId)=>{
  date=_normD(clId,date);
  const q=(DB.questions||[]).find(x=>x.id===qId);
  const cur=_waitNoteOf(clId,date,qId);
  modalShell({title:'What are we waiting for?',sub:q?q.text:'',size:'max-w-sm',
    body:`<div>
      <textarea id="wn-note" rows="3" class="ui-input rf" maxlength="300" placeholder="e.g. Passport copies of all three partners">${esc((cur&&cur.note)||'')}</textarea>
      <p style="font-size:11.5px;color:var(--c-text-3);margin-top:8px;line-height:1.5">This line is shown to the client on their status page, right under the item — so they know exactly what to send. Leave it empty to show nothing.</p>
    </div>`,
    footer:btnG('Skip','App.closeModal()')+btnP('Save',`App._waitNoteSave('${esc(clId)}','${esc(date)}','${esc(qId)}')`)});
  setTimeout(()=>{const el=document.getElementById('wn-note');if(el)el.focus();},60);
};
App._waitNoteSave=(clId,date,qId)=>{
  date=_normD(clId,date);
  const key=_qsKey(clId,date,qId);
  const note=(document.getElementById('wn-note')?.value||'').trim().slice(0,300);
  DB.tmWaitNotes=DB.tmWaitNotes||{};
  if(!note){
    if(DB.tmWaitNotes[key]){delete DB.tmWaitNotes[key];
      sb.from('tm_wait_notes').delete().eq('id',key).then(({error})=>{if(error)_syncErr('waiting note')(error);}).catch(_syncErr('waiting note'));}
    closeModal();rr();return;
  }
  DB.tmWaitNotes[key]={note,setBy:S.uid,setAt:new Date().toISOString()};
  sb.from('tm_wait_notes').upsert({id:key,checklist_id:clId,run_date:date,question_id:qId,note,set_by:S.uid,set_at:new Date().toISOString()},{onConflict:'id'})
    .then(({error})=>{if(error)_syncErr('waiting note')(error);}).catch(_syncErr('waiting note'));
  saveDB();closeModal();toast('Saved — the client will see this on their status page');rr();
};
function _waitNoteClear(clId,date,qId){
  date=_normD(clId,date);
  const key=_qsKey(clId,date,qId);
  if((DB.tmWaitNotes||{})[key]){delete DB.tmWaitNotes[key];
    sb.from('tm_wait_notes').delete().eq('id',key).then(()=>{}).catch(()=>{});}
}

/* ── share-link preferences (what the client's status page shows / allows) ── */
function _sharePrefsOf(clientId){
  const p=(DB.tmSharePrefs||{})[clientId]||{};
  return{showTickets:p.showTickets===true,showBilling:p.showBilling===true,allowRespond:p.allowRespond!==false};
}
App._sharePref=(locId,key)=>{
  if(!can('locations','edit')&&!isAdmin())return toast('You need Clients → Edit','err');
  DB.tmSharePrefs=DB.tmSharePrefs||{};
  const cur=_sharePrefsOf(locId);
  const next={...cur,[key]:!cur[key]};
  DB.tmSharePrefs[locId]=next;
  sb.from('tm_share_prefs').upsert({client_id:locId,show_tickets:next.showTickets,show_billing:next.showBilling,
    allow_respond:next.allowRespond,updated_by:S.uid,updated_at:new Date().toISOString()},{onConflict:'client_id'})
    .then(({error})=>{if(error)_syncErr('link settings')(error);}).catch(_syncErr('link settings'));
  log(fullName(me()),'Changed client link settings',(locById(locId)||{}).name||locId);
  saveDB();rr();
};

/* ── what the client sent back ── */
function _repliesFor(clientId){return(DB.tmClientReplies||[]).filter(r=>r.clientId===clientId).sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')));}
function _replyForQ(clId,date,qId){
  date=_normD(clId,date);
  return(DB.tmClientReplies||[]).filter(r=>r.checklistId===clId&&r.date===date&&r.questionId===qId)
    .sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')))[0]||null;
}
/* "2m ago" / "5h ago" / "3d ago" — used for reply stamps and waiting durations. */
function _agoLabel(iso){
  if(!iso)return'';
  const ms=Date.now()-new Date(iso).getTime();if(!(ms>0))return 'just now';
  const m=Math.floor(ms/60000);if(m<60)return (m||1)+'m ago';
  const h=Math.floor(m/60);if(h<24)return h+'h ago';
  const d=Math.floor(h/24);return d+'d '+(h%24)+'h ago';
}
/* Days+hours a status has been waiting ("2d 5h", "6h"). */
function _qsDur(st){
  if(!st||!st.changedAt)return'';
  const h=Math.max(0,Math.floor((Date.now()-new Date(st.changedAt).getTime())/3600000));
  const d=Math.floor(h/24);
  return d>0?d+'d '+(h%24)+'h':h+'h';
}

/* ── "Clients responded" — the compact card both dashboards show (round 9) ──
   Recent replies (7 days) on checklists I'm on or created; tapping a row opens the client file. */
function _clientRepliesWidget(){
  const cutoff=new Date(Date.now()-7*86400000).toISOString();
  const mine=(DB.tmClientReplies||[]).filter(r=>{
    if(String(r.submittedAt||'')<cutoff)return false;
    const c=clById(r.checklistId);
    return !!c&&((c.assignees||[]).includes(S.uid)||c.createdBy===S.uid);
  }).slice(0,3);
  if(!mine.length)return'';
  return `<div class="ui-card" style="border-left:3px solid #0EA5E9;padding:9px 14px;margin-bottom:12px">
    <div style="font-size:11.5px;font-weight:800;margin-bottom:3px">${ic('send','w-3.5 h-3.5 inline')} Clients responded</div>
    ${mine.map(r=>{const q=(DB.questions||[]).find(x=>x.id===r.questionId);const l=locById(r.clientId);
      return `<div onclick="App._openClientFile('${esc(r.clientId)}')" style="display:flex;align-items:center;gap:7px;font-size:12px;padding:2px 0;cursor:pointer">
        <span style="font-weight:700;flex-shrink:0">${esc(l?l.name:'Client')}</span>
        <span style="flex:1;min-width:0;color:var(--c-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q?q.text:'')}${r.message?' — “'+esc(String(r.message).slice(0,60))+'”':''}</span>
        <span style="font-size:10px;font-weight:800;color:#1D4ED8;background:#DBEAFE;border-radius:99px;padding:1px 7px;flex-shrink:0">${(r.files||[]).length?(r.files||[]).length+' FILE'+((r.files||[]).length===1?'':'S'):r.kind==='confirm'?'CONFIRMED':'REPLY'}</span>
        <span style="font-size:10px;color:var(--c-text-3);flex-shrink:0">${esc(_agoLabel(r.submittedAt))}</span>
      </div>`;}).join('')}
  </div>`;
}

/* ── loaders (all tolerant: an RLS-blocked table simply leaves its local copy empty) ── */
async function _billingLoad(){
  try{
    const [bl,pay,inv,ivs,sp,cr]=await Promise.all([
      sb.from('tm_billing').select('*'),
      sb.from('tm_payments').select('*').order('paid_on',{ascending:false}),
      sb.from('tm_invoices').select('*').order('created_at',{ascending:false}),
      sb.from('tm_invoice_settings').select('*').eq('id',1).maybeSingle(),
      sb.from('tm_share_prefs').select('*'),
      sb.from('tm_client_replies').select('*').order('submitted_at',{ascending:false}).limit(400),
    ]);
    if(!bl.error&&Array.isArray(bl.data)){DB.tmBilling={};bl.data.forEach(r=>{DB.tmBilling[r.client_id]={total:Number(r.total)||0,currency:r.currency||'AED'};});}
    if(!pay.error&&Array.isArray(pay.data))DB.tmPayments=_mPay(pay.data);
    if(!inv.error&&Array.isArray(inv.data))DB.tmInvoices=_mInv(inv.data);
    if(!ivs.error&&ivs.data)DB.tmInvoiceSettings=_mInvSettings(ivs.data);
    if(!sp.error&&Array.isArray(sp.data)){DB.tmSharePrefs={};sp.data.forEach(r=>{DB.tmSharePrefs[r.client_id]={showTickets:r.show_tickets===true,showBilling:r.show_billing===true,allowRespond:r.allow_respond!==false};});}
    if(!cr.error&&Array.isArray(cr.data))DB.tmClientReplies=_mReplies(cr.data);
  }catch(e){console.warn('[billing] load skipped:',e&&e.message);}
  _qcLoad();
}
function _mReplies(rows){return(rows||[]).map(r=>({id:r.id,clientId:r.client_id,checklistId:r.checklist_id,date:r.run_date,questionId:r.question_id,kind:r.kind,message:r.message||'',files:Array.isArray(r.files)?r.files:[],submittedAt:r.submitted_at}));}
/* Refreshed on its own whenever the user lands on My Checklists or a client file — this is
   what makes a client's reply (and the cleared waiting badge) appear without a full reload. */
async function _repliesLoad(){
  try{
    const {data,error}=await sb.from('tm_client_replies').select('*').order('submitted_at',{ascending:false}).limit(400);
    if(!error&&Array.isArray(data))DB.tmClientReplies=_mReplies(data);
  }catch(e){}
}
/* Per-question costs: recent window + every open case's anchor date (mirrors _qsLoad). */
async function _qcLoad(){
  try{
    const from=new Date(Date.now()-35*86400000).toISOString().slice(0,10);
    const _t0=Date.now(); // rows written locally AFTER this can't be in the snapshot below
    const caseDates=[...new Set((DB.checklists||[]).filter(c=>isCase(c)).map(c=>caseDate(c)))];
    const qs=[sb.from('tm_q_costs').select('*').gte('run_date',from),
              sb.from('tm_wait_notes').select('*').gte('run_date',from)];
    if(caseDates.length){qs.push(sb.from('tm_q_costs').select('*').in('run_date',caseDates));
                         qs.push(sb.from('tm_wait_notes').select('*').in('run_date',caseDates));}
    const rs=await Promise.all(qs);
    DB.tmQCosts=DB.tmQCosts||{};DB.tmWaitNotes=DB.tmWaitNotes||{};
    const _seenCost={},_seenNote={};
    rs.forEach(r=>{if(!r.error)(r.data||[]).forEach(row=>{
      if(row.amount!==undefined){_seenCost[row.id]=1;DB.tmQCosts[row.id]={amount:Number(row.amount)||0,setBy:row.set_by||null,setAt:row.set_at||null};}
      else if(row.note!==undefined){_seenNote[row.id]=1;DB.tmWaitNotes[row.id]={note:row.note||'',setBy:row.set_by||null,setAt:row.set_at||null};}
    });});
    // Rows deleted server-side (a client responded, a colleague cleared a cost) must also
    // disappear locally — but only reconcile inside the windows we actually fetched, and only
    // when every query succeeded, so a network hiccup can never wipe good local state.
    if(rs.every(r=>!r.error)){
      const _inWin=d=>d>=from||caseDates.includes(d);
      const _fresh=rec=>{const t=rec&&(rec.setAt||rec.changedAt);return t&&Date.parse(t)>=_t0-15000;}; // in-flight guard (see _qsLoad)
      Object.keys(DB.tmWaitNotes).forEach(k=>{const d=String(k).split('|')[1];if(_inWin(d)&&!_seenNote[k]&&!_fresh(DB.tmWaitNotes[k]))delete DB.tmWaitNotes[k];});
      Object.keys(DB.tmQCosts).forEach(k=>{const d=String(k).split('|')[1];if(_inWin(d)&&!_seenCost[k]&&!_fresh(DB.tmQCosts[k]))delete DB.tmQCosts[k];});
    }
  }catch(e){console.warn('[q costs] load skipped:',e&&e.message);}
}

/* — auto: expose on window (modules resolve cross-file references via window at call time) — */
window.canBill=canBill;window._mPay=_mPay;window._payRow=_payRow;window._mInv=_mInv;window._invRow=_invRow;window._mInvSettings=_mInvSettings;
window.fmtMoney=fmtMoney;window._invDefaults=_invDefaults;window._cliBilling=_cliBilling;window._cliCurrency=_cliCurrency;
window._cliPaid=_cliPaid;window._cliBalance=_cliBalance;window._cliUtilized=_cliUtilized;window._runUtilized=_runUtilized;window._qCostOf=_qCostOf;
window._billingSave=_billingSave;window._invSettingsEnsure=_invSettingsEnsure;window._invHtml=_invHtml;
window._sharePrefsOf=_sharePrefsOf;window._repliesFor=_repliesFor;window._replyForQ=_replyForQ;window._agoLabel=_agoLabel;window._qsDur=_qsDur;
window._clientRepliesWidget=_clientRepliesWidget;window._billingLoad=_billingLoad;window._qcLoad=_qcLoad;window._repliesLoad=_repliesLoad;window._mReplies=_mReplies;window.canBillView=canBillView;window._notifyBillingFolks=_notifyBillingFolks;window._waitNoteOf=_waitNoteOf;window._waitNoteClear=_waitNoteClear;
