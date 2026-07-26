/* Round 8: money on the client, and the status link becoming two-way.

   Billing: an engagement total + currency on each client (set right on the client form,
   with an optional initial payment), payments and auto-numbered invoices behind the new
   Clients → Billing & invoices permission, the ONE company invoice template snapshotted
   onto every issued invoice, and a per-question "cost used" field on run cards that rolls
   up into Utilized on the client file.

   The link: per-link switches (respond / tickets / billing summary), waiting durations in
   days AND hours, and the client answering straight from the page — reply, confirm or
   upload — which clears the waiting flag and notifies creator + assignees. */
import { describe, it, expect, beforeEach } from 'vitest';

const W = window;
const TODAY = W.todayISO();
const DAYS_AGO = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const HOURS_AGO = n => new Date(Date.now() - n * 3600000).toISOString();

function seed() {
  if (!document.getElementById('app')) {
    const d = document.createElement('div'); d.id = 'app'; document.body.appendChild(d);
  }
  W.DB.users.length = 0; W.DB.checklists.length = 0; W.DB.questions.length = 0;
  W.DB.submissions.length = 0; W.DB.approvals.length = 0; W.DB.notifications.length = 0;
  W.DB.tickets.length = 0; W.DB.locations.length = 0; W.DB.departments.length = 0;
  W.DB.tmAnswers = []; W.DB.tmAnswerEdits = []; W.DB.tmMeta = {};
  W.DB.tmFolders = []; W.DB.tmDocuments = []; W.DB.tmClientMeta = {};
  W.DB.tmQStatus = {}; W.DB.tmTemplates = []; W.DB.tmShareLinks = []; W.DB.tmNudges = [];
  W.DB.tmBilling = {}; W.DB.tmPayments = []; W.DB.tmInvoices = []; W.DB.tmInvoiceSettings = null;
  W.DB.tmQCosts = {}; W.DB.tmSharePrefs = {}; W.DB.tmClientReplies = [];
  W.S.filters = {}; W.S.search = ''; W.S.expandedCl = null;
  W._pubFormOpen = null; W._pubFiles = []; W._pubData = null; W._pubBusy = false;

  const boss = W.__mkUser({ id: 'boss', firstName: 'Bea', lastName: 'Boss' });
  const ana  = W.__mkUser({ id: 'ana',  firstName: 'Ana', lastName: 'Adams', managerId: 'boss' });
  const eve  = W.__mkUser({ id: 'eve',  firstName: 'Eve', lastName: 'Ester', managerId: 'boss' });
  W.DB.users.push(boss, ana, eve);
  [boss, ana, eve].forEach(u => W._ensureHrm(u));
  boss.hrm.roleProfileId = 'superadmin';
  ana.hrm.roleProfileId = 'basic';
  eve.hrm.roleProfileId = 'basic';
  W._seedRoleProfiles();

  W.DB.departments.push({ id: 'd_ops', name: 'Ops', parentId: null });
  W.DB.locations.push({ id: 'cl_a', name: 'Acme Trading', address: 'Downtown', department: 'Ops', status: 'Active' });
  W.DB.tmClientMeta['cl_a'] = { contactName: 'Priya', contactEmail: 'priya@acme.example', contactPhone: '', reference: 'TL-991', notes: '' };
  W.DB.questions.push(
    { id: 'q1', text: 'Trade name reserved?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
    { id: 'q2', text: 'MOA signed?',          type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
  );
  W.log = () => {};
  W._ns = W._nsDefault();
  W.S.uid = 'boss';
  W.open = () => null;   // jsdom's window.open logs "Not implemented" — the app guards a null return
}
beforeEach(seed);

function mkCase(over) {
  const c = Object.assign({
    id: 'case1', name: 'Acme — Mainland LLC', description: '', department: 'Ops',
    frequency: 'One-time', schedule: 'One-time', selectedDays: [], selectedDates: [], customDates: [],
    startDate: DAYS_AGO(5), endDate: null, locationIds: ['cl_a'], assignees: ['ana'],
    tasks: [], questionIds: ['q1', 'q2'], questionConfigs: {}, scheduleTime: null,
    status: 'Active', anyOne: true, createdBy: 'boss',  // shared case — the toggle decides since round 10
  }, over || {});
  W.DB.checklists.push(c); return c;
}
const asUser = (id, fn) => { const prev = W.S.uid; W.S.uid = id; try { return fn(); } finally { W.S.uid = prev; } };

/* ══ 1 · the money model ══ */
describe('1 — billing rollups', () => {
  it('total / paid / balance / utilized add up', () => {
    W._billingSave('cl_a', 10000, 'AED');
    expect(W.DB.tmBilling.cl_a.total).toBe(10000);
    W.DB.tmPayments.push({ id: 'p1', clientId: 'cl_a', amount: 4000, paidOn: TODAY },
                         { id: 'p2', clientId: 'cl_a', amount: 3000, paidOn: TODAY });
    expect(W._cliPaid('cl_a')).toBe(7000);
    expect(W._cliBalance('cl_a')).toBe(3000);
    const c = mkCase();
    const cd = W.caseDate(c);
    W.DB.tmQCosts[W._qsKey(c.id, cd, 'q1')] = { amount: 400, setBy: 'ana', setAt: new Date().toISOString() };
    W.DB.tmQCosts[W._qsKey(c.id, cd, 'q2')] = { amount: 350, setBy: 'ana', setAt: new Date().toISOString() };
    expect(W._runUtilized(c.id, TODAY)).toBe(750);   // asked about today, lands on the case date
    expect(W._cliUtilized('cl_a')).toBe(750);
    expect(W.fmtMoney(3000, 'AED')).toBe('AED 3,000');
    expect(W.fmtMoney(1234.5, 'USD')).toBe('USD 1,234.50');
  });

  it('the client form takes the full cost and the initial payment (Billing holders only)', () => {
    W.App.editLoc();
    expect(document.getElementById('ln-total')).toBeTruthy();
    document.getElementById('ln-n').value = 'Zen Consulting';
    document.getElementById('ln-total').value = '10000';
    document.getElementById('ln-cur').value = 'AED';
    document.getElementById('ln-init').value = '7000';
    W.App.saveLoc('');
    const nl = W.DB.locations.find(l => l.name === 'Zen Consulting');
    expect(nl).toBeTruthy();
    expect(W.DB.tmBilling[nl.id].total).toBe(10000);
    const pay = W.DB.tmPayments.find(p => p.clientId === nl.id);
    expect(pay.amount).toBe(7000);
    expect(pay.notes).toBe('Initial payment');
    expect(W._cliBalance(nl.id)).toBe(3000);
    W.App.closeModal();
  });

  it('no Billing permission → no money fields on the form, no Billing tab, no money on the file', () => {
    W._billingSave('cl_a', 10000, 'AED');
    W.DB.tmPayments.push({ id: 'p1', clientId: 'cl_a', amount: 7000, paidOn: TODAY });
    const c = mkCase();
    W.DB.tmQCosts[W._qsKey(c.id, W.caseDate(c), 'q1')] = { amount: 400, setBy: 'ana', setAt: new Date().toISOString() };
    asUser('ana', () => {
      expect(W.canBill()).toBe(false);
      W.App.editLoc('cl_a');
      expect(document.getElementById('ln-total')).toBeFalsy();
      W.App.closeModal();
      W.S.route = 'locations'; W.S.filters = { locSel: 'cl_a' };
      const html = W.locsPage();
      expect(html).not.toContain('Billing');          // no tab, no strip
      expect(html).not.toContain('AED 400');           // no per-step cost chip
      expect(W._locBillTab(W.DB.locations[0])).toBe('');
    });
    asUser('boss', () => {
      W.S.filters = { locSel: 'cl_a' };
      const html = W.locsPage();
      expect(html).toContain('Billing');
      expect(html).toContain('Utilized');
      expect(html).toContain('AED 400');
      W.S.filters = { locSel: 'cl_a', locTab: 'bill' };
      const bill = W.locsPage();
      expect(bill).toContain('Record payment');
      expect(bill).toContain('Balance due');
      expect(bill).toContain('Invoice template');
      expect(bill).toContain('AED 3,000');             // balance due
    });
  });
});

/* ══ 2 · per-question costs on the run ══ */
describe('2 — cost used, entered on the question', () => {
  it('an assignee sets it, it lands on the case date, clearing removes it', () => {
    const c = mkCase();
    asUser('ana', () => W.App._qCostSet(c.id, TODAY, 'q1', '450'));
    const key = W._qsKey(c.id, W.caseDate(c), 'q1');
    expect(W.DB.tmQCosts[key].amount).toBe(450);
    expect(key).toContain(DAYS_AGO(5));                // normalised to the case anchor
    asUser('ana', () => W.App._qCostSet(c.id, TODAY, 'q1', '600'));
    expect(W.DB.tmQCosts[key].amount).toBe(600);
    asUser('ana', () => W.App._qCostSet(c.id, TODAY, 'q1', ''));
    expect(W.DB.tmQCosts[key]).toBeUndefined();
  });

  it('someone who is neither assigned nor a Billing holder is refused', () => {
    const c = mkCase();
    asUser('eve', () => W.App._qCostSet(c.id, TODAY, 'q1', '999'));
    expect(Object.keys(W.DB.tmQCosts)).toHaveLength(0);
    asUser('boss', () => W.App._qCostSet(c.id, TODAY, 'q1', '999')); // billing holder, not assigned — fine
    expect(Object.keys(W.DB.tmQCosts)).toHaveLength(1);
  });

  it('the run card carries the field only when a client is attached', () => {
    const c = mkCase();
    const naked = mkCase({ id: 'case2', name: 'Internal drill', locationIds: [] });
    asUser('ana', () => {
      expect(W._qCostRow(c, W.DB.questions[0], TODAY)).toContain('Cost used');
      expect(W._qCostRow(naked, W.DB.questions[0], TODAY)).toBe('');
    });
    asUser('eve', () => {                                   // not on it, no billing → nothing
      expect(W._qCostRow(c, W.DB.questions[0], TODAY)).toBe('');
    });
  });
});

/* ══ 3 · invoices ══ */
describe('3 — invoices: numbering, tax, snapshot, void', () => {
  beforeEach(() => {
    W.DB.tmInvoiceSettings = { companyName: 'Evarca DMCC', address: 'JLT, Dubai', phone: '+971', email: 'billing@evarca.example',
      trn: '100200300', logo: '', footerText: 'Thank you.', terms: 'Due on receipt', currency: 'AED', taxLabel: 'VAT',
      taxRate: 5, numberPrefix: 'INV-' };
    W.sb.rpc = async () => ({ data: 'INV-0007', error: null });
    W._billingSave('cl_a', 10000, 'AED');
  });

  it('generates with the RPC number, the configured tax, and a frozen template snapshot', async () => {
    await W.App._invGen('cl_a', '');
    document.getElementById('iv-amt').value = '7000';
    document.getElementById('iv-tax').value = '5';
    document.getElementById('iv-note').value = 'Mainland licence — first payment';
    await W.App._invGenGo('cl_a', '');
    const v = W.DB.tmInvoices[0];
    expect(v.number).toBe('INV-0007');
    expect(v.taxAmount).toBe(350);
    expect(v.total).toBe(7350);
    expect(v.snapshot.companyName).toBe('Evarca DMCC');
    expect(v.snapshot.client.name).toBe('Acme Trading');
    expect(v.snapshot.client.reference).toBe('TL-991');
    // editing the template later must NOT rewrite the issued document
    W.DB.tmInvoiceSettings.companyName = 'Renamed LLC';
    const html = W._invHtml(v);
    expect(html).toContain('Evarca DMCC');
    expect(html).not.toContain('Renamed LLC');
    expect(html).toContain('INV-0007');
    expect(html).toContain('AED 7,350');
    expect(html).toContain('VAT (5%)');
    expect(html).toContain('TRN 100200300');
  });

  it('void keeps it on file, watermarked, number never reused', async () => {
    await W.App._invGen('cl_a', '');
    document.getElementById('iv-amt').value = '1000';
    document.getElementById('iv-tax').value = '0';
    await W.App._invGenGo('cl_a', '');
    const v = W.DB.tmInvoices[0];
    W.App._invVoidGo(v.id);
    expect(v.status).toBe('Void');
    expect(W._invHtml(v)).toContain('VOID');
    expect(W.DB.tmInvoices).toHaveLength(1);
  });

  it('a failed number allocation creates nothing', async () => {
    W.sb.rpc = async () => ({ data: null, error: { message: 'not allowed' } });
    await W.App._invGen('cl_a', '');
    document.getElementById('iv-amt').value = '1000';
    await W.App._invGenGo('cl_a', '');
    expect(W.DB.tmInvoices).toHaveLength(0);
  });

  it('recording a payment can hand straight off to invoice generation', () => {
    W.App._payAdd('cl_a');
    expect(document.getElementById('pay-amt').value).toBe('10000'); // prefilled with the balance
    document.getElementById('pay-amt').value = '7000';
    document.getElementById('pay-inv').checked = false;              // no invoice this time
    W.App._payAddGo('cl_a');
    expect(W.DB.tmPayments[0].amount).toBe(7000);
    expect(W._cliBalance('cl_a')).toBe(3000);
  });
});

/* ══ 4 · the permission itself ══ */
describe('4 — Clients → Billing & invoices is a real, granular permission', () => {
  it('is offered by the editor, seeded ON for superadmin/admin, OFF for everyone else', () => {
    const loc = W._tmAreas().find(a => a.key === 'locations');
    expect(loc.actions).toContain('billing');
    expect(W.PERM_ACTION_LABEL.billing).toContain('Billing');
    expect(loc.actions).toContain('billingView');   // round 9: view/manage split
    expect(W.DB.roleProfiles.superadmin.perms.locations.actions.billing).toBe(true);
    expect(W.DB.roleProfiles.admin.perms.locations.actions.billing).toBe(true);
    expect(!!W.DB.roleProfiles.manager.perms.locations?.actions?.billing).toBe(false);
    expect(!!W.DB.roleProfiles.basic.perms.locations?.actions?.billing).toBe(false);
  });

  it('granting it on a custom role switches the whole feature on for that person', () => {
    W.DB.roleProfiles.accounts = { id: 'accounts', name: 'Accounts', description: '', builtin: false,
      perms: { locations: { scope: 'none', actions: { view: true, billing: true } } } };
    W.DB.users.find(u => u.id === 'eve').hrm.roleProfileId = 'accounts';
    asUser('eve', () => {
      expect(W.can('locations', 'billing')).toBe(true);
      expect(W.canBill()).toBe(true);
    });
    asUser('ana', () => expect(W.can('locations', 'billing')).toBe(false));
  });
});

/* ══ 5 · link preferences ══ */
describe('5 — per-link switches', () => {
  it('defaults: respond ON, tickets and billing summary OFF', () => {
    const p = W._sharePrefsOf('cl_a');
    expect(p.allowRespond).toBe(true);
    expect(p.showTickets).toBe(false);
    expect(p.showBilling).toBe(false);
  });

  it('toggling round-trips, and only Clients-edit holders may touch them', () => {
    W.App._sharePref('cl_a', 'showBilling');
    W.App._sharePref('cl_a', 'allowRespond');
    expect(W._sharePrefsOf('cl_a').showBilling).toBe(true);
    expect(W._sharePrefsOf('cl_a').allowRespond).toBe(false);
    asUser('ana', () => W.App._sharePref('cl_a', 'showTickets'));   // basic: refused
    expect(W._sharePrefsOf('cl_a').showTickets).toBe(false);
  });

  it('the share card renders the switches once a link exists', () => {
    W.DB.tmShareLinks.push({ token: 'tok123456789012345', clientId: 'cl_a', enabled: true, createdBy: 'boss', createdAt: TODAY });
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('Can respond & upload');
    expect(html).toContain('Open tickets');
    expect(html).toContain('Billing summary');
  });
});

/* ══ 6 · the public page, now two-way ══ */
describe('6 — the status page: durations, respond box, optional sections, no names ever', () => {
  const PAYLOAD = () => ({ ok: true, client: 'Acme Trading', generated_at: new Date().toISOString(),
    allow_respond: true,
    tickets: [{ title: 'Chase immigration card', status: 'Open', priority: 'High', created_at: new Date().toISOString() }],
    billing: { total: 10000, paid: 7000, balance: 3000, currency: 'AED' },
    cases: [{ checklist_id: 'case1', run_date: DAYS_AGO(5), name: 'Acme — Mainland LLC',
      deadline_date: null, deadline_time: null, done: false, completed_at: null,
      steps: [
        { qid: 'q1', label: 'Trade name reserved?', done: false, waiting: 'waiting_client',
          waiting_since: HOURS_AGO(50), waiting_days: 2, waiting_hours: 50, replied_at: null, replied_kind: null, can_respond: true },
        { qid: 'q2', label: 'MOA signed?', done: false, waiting: null,
          replied_at: HOURS_AGO(3), replied_kind: 'document', can_respond: false },
      ] }] });

  let rpcCalls;
  beforeEach(() => {
    rpcCalls = [];
    W.sb.rpc = async (fn, args) => {
      rpcCalls.push([fn, args]);
      if (fn === 'tm_client_status_v2') return { data: PAYLOAD(), error: null };
      if (fn === 'tm_client_respond') return { data: { ok: true, submitted_at: new Date().toISOString(), files: 0 }, error: null };
      return { data: null, error: null };
    };
  });

  it('renders durations, the respond button, tickets, billing — and never a team name', async () => {
    await W._pubStatusRender('livetoken12345678', true);
    const html = document.getElementById('app').innerHTML;
    expect(html).toContain('waiting 2d 2h');
    expect(html).toContain('WITH YOU · 2d 2h');
    expect(html).toContain('Respond');
    expect(html).toContain('Account summary');
    expect(html).toContain('AED 3,000');                 // balance due
    expect(html).toContain('Chase immigration card');    // tickets switch on
    expect(html).toContain('SENT');                      // the client's own earlier response
    expect(html).not.toContain('Bea');                   // never who on the team did what
    expect(html).not.toContain('Ana');
    expect(W._pubWaitLabel({ waiting_hours: 5 })).toBe('5h');
    expect(W._pubWaitLabel({ waiting_hours: 50 })).toBe('2d 2h');
  });

  it('hides money and tickets when their switches are off', async () => {
    const p = PAYLOAD(); p.billing = null; p.tickets = null;
    W.sb.rpc = async () => ({ data: p, error: null });
    await W._pubStatusRender('livetoken12345678', true);
    const html = document.getElementById('app').innerHTML;
    expect(html).not.toContain('Account summary');
    expect(html).not.toContain('Chase immigration card');
  });

  it('opens the respond box from cache (no refetch), sends a reply with the right shape', async () => {
    await W._pubStatusRender('livetoken12345678', true);
    expect(rpcCalls.filter(c => c[0] === 'tm_client_status_v2')).toHaveLength(1);
    W.App._pubForm('case1', 'q1');
    expect(rpcCalls.filter(c => c[0] === 'tm_client_status_v2')).toHaveLength(1); // cache render
    const box = document.getElementById('pub-msg');
    expect(box).toBeTruthy();
    box.value = 'Signed MOA attached to the courier — done today';
    await W.App._pubSubmit('case1', 'q1', null);
    const sent = rpcCalls.find(c => c[0] === 'tm_client_respond')[1];
    expect(sent.p_token).toBe('livetoken12345678');
    expect(sent.p_checklist).toBe('case1');
    expect(sent.p_question).toBe('q1');
    expect(sent.p_kind).toBe('reply');                    // no files → a reply
    expect(sent.p_message).toContain('Signed MOA');
    expect(sent.p_files).toEqual([]);
    expect(W._pubFormOpen).toBe(null);                    // closed after success
    expect(rpcCalls.filter(c => c[0] === 'tm_client_status_v2').length).toBeGreaterThan(1); // refreshed
  });

  it('"Just confirm" needs no message; an empty send is refused client-side', async () => {
    await W._pubStatusRender('livetoken12345678', true);
    W.App._pubForm('case1', 'q1');
    await W.App._pubSubmit('case1', 'q1', null);          // nothing typed, nothing attached
    expect(rpcCalls.find(c => c[0] === 'tm_client_respond')).toBeUndefined();
    expect(document.getElementById('pub-form-err').textContent).toContain('Just confirm');
    await W.App._pubSubmit('case1', 'q1', 'confirm');
    expect(rpcCalls.find(c => c[0] === 'tm_client_respond')[1].p_kind).toBe('confirm');
  });

  it('a revoked token gets the dead-link page', async () => {
    W.sb.rpc = async () => ({ data: { ok: false }, error: null });
    W._pubData = null;
    await W._pubStatusRender('deadtoken12345678', true);
    expect(document.getElementById('app').innerHTML).toContain('no longer active');
  });
});

/* ══ 7 · what the team sees when the client answers ══ */
describe('7 — the reply on the team side', () => {
  it('shows on the client file, the waiting badge is gone, docs note where files land', () => {
    const c = mkCase();
    const cd = W.caseDate(c);
    // the step WAS waiting on the client…
    W.DB.tmQStatus[W._qsKey(c.id, cd, 'q1')] = { status: 'waiting_client', changedBy: 'ana', changedAt: HOURS_AGO(50) };
    expect(W._qsBadge(c.id, cd, 'q1')).toContain('Waiting on client');
    // …then the RPC cleared tm_q_status and wrote the reply — mirror its effect locally
    delete W.DB.tmQStatus[W._qsKey(c.id, cd, 'q1')];
    W.DB.tmClientReplies.push({ id: 'cr1', clientId: 'cl_a', checklistId: c.id, date: cd, questionId: 'q1',
      kind: 'document', message: 'Passport copies attached', files: [{ name: 'passport.pdf', doc_id: 'doc_x', path: 'client-uploads/t/1_passport.pdf', size: 12345 }],
      submittedAt: HOURS_AGO(2) });
    expect(W._replyForQ(c.id, TODAY, 'q1').kind).toBe('document');   // date-normalised lookup
    W.S.filters.locRepliesOpen = true;                                // round 10: the card collapses by default
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('From the client');
    expect(html).toContain('CLIENT REPLIED');
    expect(html).toContain('passport.pdf');
    expect(html).toContain('under “From client”');
    expect(W._qStatusOf(c.id, cd, 'q1')).toBe(null);                  // nothing waiting any more
    expect(W._qsBadge(c.id, cd, 'q1')).toBe('');                      // and no badge either
  });

  it('the run card shows the reply chip next to the status row', () => {
    const c = mkCase();
    W.DB.tmClientReplies.push({ id: 'cr2', clientId: 'cl_a', checklistId: c.id, date: W.caseDate(c), questionId: 'q1',
      kind: 'confirm', message: '', files: [], submittedAt: HOURS_AGO(1) });
    asUser('ana', () => {
      W.RUN[c.id] = { questionResponses: [] };
      const card = W._qCardShared ? W._qCardShared(c, W.DB.questions[0], TODAY) : null;
      if (card !== null) expect(card).toContain('CLIENT REPLIED');
      else { // renderer is internal — assert through the page
        W.S.route = 'mychecklists'; W.S.calDate = TODAY; W.S.expandedCl = c.id;
        expect(W.myClsPage()).toContain('CLIENT REPLIED');
      }
      delete W.RUN[c.id];
    });
  });

  it('client_responded is a real event with both channels and honoured switches', () => {
    const ev = W._evByKey('client_responded');
    expect(ev).toBeTruthy();
    expect(ev.group).toBe('Checklists');
    expect(W.evInApp('client_responded')).toBe(true);
    expect(W.evEmail('client_responded')).toBe(false);     // master email switch is off by default
    W._ns.email_enabled = true;
    expect(W.evEmail('client_responded')).toBe(true);
    W._ns.email_client_responded = false;
    expect(W.evEmail('client_responded')).toBe(false);
    W._ns.inapp_client_responded = false;
    expect(W.evInApp('client_responded')).toBe(false);
  });

  it('waiting durations read in days AND hours on the team side too', () => {
    expect(W._qsDur({ changedAt: HOURS_AGO(50) })).toBe('2d 2h');
    expect(W._qsDur({ changedAt: HOURS_AGO(6) })).toBe('6h');
    expect(W._agoLabel(HOURS_AGO(2))).toBe('2h ago');
  });
});
