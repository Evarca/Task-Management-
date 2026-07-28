/* Round 10.

   The "Any one assignee can complete" toggle now decides the run model for One-time client
   cases too (existing cases were stamped any_one=true by migration, so nothing in flight
   changed). Individual cases get people-based progress everywhere — client file, clients
   list, status link. Plus: per-client Outstanding math on the Company dashboard, billing
   refreshed on route changes, a collapsible "From the client" card, invoice DELETE for
   billing managers, three low-value charts removed, and the client link wearing the
   COMPANY's brand instead of the product's. */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  W.DB.tmQCosts = {}; W.DB.tmSharePrefs = {}; W.DB.tmClientReplies = []; W.DB.tmWaitNotes = {};
  W.S.filters = {}; W.S.search = ''; W.S.expandedCl = null;
  W._pubFormOpen = null; W._pubFiles = []; W._pubData = null; W._pubBusy = false;

  const boss = W.__mkUser({ id: 'boss', firstName: 'Bea', lastName: 'Boss' });
  const ana  = W.__mkUser({ id: 'ana',  firstName: 'Ana', lastName: 'Adams', managerId: 'boss' });
  const ben  = W.__mkUser({ id: 'ben',  firstName: 'Ben', lastName: 'Blake', managerId: 'boss' });
  W.DB.users.push(boss, ana, ben);
  [boss, ana, ben].forEach(u => W._ensureHrm(u));
  boss.hrm.roleProfileId = 'superadmin';
  ana.hrm.roleProfileId = 'basic';
  ben.hrm.roleProfileId = 'basic';
  W._seedRoleProfiles();

  W.DB.departments.push({ id: 'd_ops', name: 'Ops', parentId: null });
  W.DB.locations.push({ id: 'cl_a', name: 'Acme Trading', address: 'Downtown', department: 'Ops', status: 'Active' },
                      { id: 'cl_b', name: 'Beta FZE', address: '', department: '', status: 'Active' });
  W.DB.tmClientMeta['cl_a'] = { contactName: 'Priya', contactEmail: 'p@acme.example', contactPhone: '', reference: '', notes: '' };
  W.DB.questions.push(
    { id: 'q1', text: 'Trade name reserved?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
    { id: 'q2', text: 'MOA signed?',          type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
  );
  W.log = () => {};
  W._ns = W._nsDefault();
  W.S.uid = 'boss';
  W.open = () => null;
}
beforeEach(seed);

function mkCase(over) {
  const c = Object.assign({
    id: 'case1', name: 'Acme — Mainland LLC', description: '', department: 'Ops',
    frequency: 'One-time', schedule: 'One-time', selectedDays: [], selectedDates: [], customDates: [],
    startDate: DAYS_AGO(5), endDate: null, locationIds: ['cl_a'], assignees: ['ana', 'ben'],
    tasks: [], questionIds: ['q1', 'q2'], questionConfigs: {}, scheduleTime: null,
    status: 'Active', anyOne: true, createdBy: 'boss',
  }, over || {});
  W.DB.checklists.push(c); return c;
}
const submitBy = (c, uid2) => W.DB.submissions.push({ id: 's_' + uid2, checklistId: c.id, userId: uid2,
  date: W.caseDate(c), status: 'On Time', submittedAt: new Date().toISOString(), tasks: [],
  questionResponses: [], editCount: 0, editHistory: [] });
const signoffMode = c => { W.DB.tmMeta[c.id] = Object.assign({}, W.DB.tmMeta[c.id], { requireSignoff: true }); return c; };
const answer = (c, qid, by) => W.DB.tmAnswers.push({ id: W._ansId(c.id, TODAY, qid), checklistId: c.id,
  date: W.caseDate(c), questionId: qid, response: 'Yes', comment: '', photos: [], submittedBy: by || 'ana',
  submittedAt: new Date().toISOString(), locked: true, editCount: 0 });
const asUser = (id, fn) => { const prev = W.S.uid; W.S.uid = id; try { return fn(); } finally { W.S.uid = prev; } };
const SRC = resolve(process.cwd(), 'src');

/* ══ 1 · a case keeps the per-question engine; the toggle decides CLOSING ══ */
describe('1 — the toggle is a closing rule, never a feature switch', () => {
  it('every case uses the shared per-question engine, whatever the toggle says', () => {
    expect(W.isShared(mkCase({ id: 'cA', anyOne: true }))).toBe(true);
    expect(W.isShared(signoffMode(mkCase({ id: 'cB', anyOne: false })))).toBe(true);
    expect(W.needsAllSignoff(W.clById('cB'))).toBe(true);
    expect(W.needsAllSignoff(W.clById('cA'))).toBe(false);   // the any_one column has no say for cases
    expect(W.isShared(mkCase({ id: 'cC', frequency: 'Daily', anyOne: false }))).toBe(false); // recurring: unchanged
    expect(W.needsAllSignoff(mkCase({ id: 'cD', anyOne: false }))).toBe(false);  // a case defaults to any-one-closes
  });

  it('per-question submit works on a case with the toggle OFF', async () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    await asUser('ana', async () => {
      W.RUN[c.id] = { questionResponses: [{ questionId: 'q1', response: 'Yes', comment: '', photos: [] }] };
      await W.App._ansSubmit(c.id, TODAY, 'q1');
      delete W.RUN[c.id];
    });
    const a = W._ansFor(c.id, W.caseDate(c), 'q1');
    expect(a && a.locked).toBe(true);                       // the answer landed and locked
    expect(W.caseProg(c)).toMatchObject({ done: 1, total: 2 });
  });

  it('working statuses and per-question costs are available on a toggle-OFF case', () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    asUser('ana', () => {
      W.App._setQStatus(c.id, TODAY, 'q1', 'waiting_client');
      W.App._waitNoteSave(c.id, TODAY, 'q1');               // no note typed — just clears the modal
      W.App._qCostSet(c.id, TODAY, 'q1', '400');
    });
    expect(W._qStatusOf(c.id, W.caseDate(c), 'q1').status).toBe('waiting_client');
    expect(W.DB.tmQCosts[W._qsKey(c.id, W.caseDate(c), 'q1')].amount).toBe(400);
    asUser('ana', () => {
      W.RUN[c.id] = { questionResponses: [] };
      const card = W._qCard(c, W.DB.questions[0], TODAY, false);
      expect(card).toContain('Waiting on client');          // the chips are back
      expect(card).toContain('Waiting on authority');
      expect(card).toContain('Cost used');
      expect(card).toContain('Submit answer');              // per-question submit is back
      delete W.RUN[c.id];
    });
  });

  it('toggle OFF: the case closes only once EVERY assignee signs off', () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    expect(W.caseSub(c)).toBe(null);
    submitBy(c, 'ana');
    expect(W.caseSub(c)).toBe(null);                        // Ben has not signed
    expect(W.clOn(c, TODAY)).toBe(true);                    // …so it stays on the day
    expect(W.caseSignoff(c)).toMatchObject({ done: 1, total: 2, complete: false });
    expect(W.subForCl(c, 'ben', TODAY)).toBe(null);         // Ana's sign-off is not Ben's
    submitBy(c, 'ben');
    expect(W.caseSub(c)).toBeTruthy();
    expect(W.caseSignoff(c).complete).toBe(true);
  });

  it('default (no sign-off flag): the first submission closes it for everyone', () => {
    const c = mkCase({ anyOne: true });
    submitBy(c, 'ana');
    expect(W.caseSub(c)).toBeTruthy();
    expect(W.subForCl(c, 'ben', TODAY)).toBeTruthy();
  });

  it('the run footer asks for a sign-off, and reports how many are in', () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    answer(c, 'q1'); answer(c, 'q2');
    asUser('ana', () => {
      expect(W._clFooter(c, W.caseDate(c), null, false, false, W.me())).toContain('Sign off');
      submitBy(c, 'ana');
      const mine = W.subForCl(c, 'ana', TODAY);
      const foot = W._clFooter(c, W.caseDate(c), mine, false, false, W.me());
      expect(foot).toContain('You signed off');
      expect(foot).toContain('waiting on 1 more');
    });
  });

  it('the client file shows every question with its status and cost — plus who signed off', () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    answer(c, 'q1');
    asUser('ana', () => W.App._qCostSet(c.id, TODAY, 'q2', '400'));
    W.DB.tmQStatus[W._qsKey(c.id, W.caseDate(c), 'q2')] = { status: 'waiting_client', changedBy: 'ana', changedAt: HOURS_AGO(30) };
    submitBy(c, 'ana');
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('Trade name reserved?');         // every question is listed…
    expect(html).toContain('MOA signed?');
    expect(html).toContain('Waiting on client');            // …with its working status…
    expect(html).toContain('AED 400');                      // …and its utilized cost
    expect(html).toContain('1/2 · 50%');                    // question-based progress
    expect(html).toContain('Sign-off 1/2');                 // and the sign-off strip
    expect(html).toContain('Ben Blake');
  });

  it('the clients list progress column counts questions', () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    answer(c, 'q1');
    W.S.route = 'locations'; W.S.filters = {};
    expect(W.locsPage()).toContain('1 open · 50%');
  });

  it('the builder note explains the closing rule, not a feature switch', () => {
    const builder = readFileSync(resolve(SRC, 'pages/checklists.js'), 'utf8');
    expect(builder).not.toContain('always worked as one shared run');
  });
});

/* ══ 1b · the exact production shape that broke: any_one=false, no sign-off flag ══ */
describe('1b — a legacy case (any_one=false, untouched meta) has every feature', () => {
  it('renders per-question submit, all three status chips and the cost box', () => {
    const c = mkCase({ anyOne: false });          // no signoffMode() — straight from the DB
    expect(W.needsAllSignoff(c)).toBe(false);     // closes on the first sign-off, as it always did
    asUser('ana', () => {
      W.RUN[c.id] = { questionResponses: [] };
      const card = W._qCard(c, W.DB.questions[0], TODAY, false);
      expect(card).toContain('Submit answer');
      expect(card).toContain('In progress');
      expect(card).toContain('Waiting on client');
      expect(card).toContain('Waiting on authority');
      expect(card).toContain('Cost used');
      delete W.RUN[c.id];
    });
  });

  it('the client file lists every question with its status and utilized cost', () => {
    const c = mkCase({ anyOne: false });
    answer(c, 'q1');
    asUser('ana', () => W.App._qCostSet(c.id, TODAY, 'q2', '400'));
    W.DB.tmQStatus[W._qsKey(c.id, W.caseDate(c), 'q2')] =
      { status: 'waiting_client', changedBy: 'ana', changedAt: HOURS_AGO(30) };
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('Trade name reserved?');
    expect(html).toContain('MOA signed?');
    expect(html).toContain('Waiting on client');
    expect(html).toContain('AED 400');
    expect(html).toContain('1/2 · 50%');
    expect(html).not.toContain('Sign-off');       // not opted in, so no sign-off strip
  });
});

/* ══ 2 · money on the Company dashboard: right, and per-client ══ */
describe('2 — dashboard revenue math + freshness', () => {
  it('Outstanding is summed per client — an overpaid client never hides dues', () => {
    W._billingSave('cl_a', 10000, 'AED');                  // owes 7k after 3k paid
    W.DB.tmPayments.push({ id: 'p1', clientId: 'cl_a', amount: 3000, paidOn: TODAY });
    W.DB.tmPayments.push({ id: 'p2', clientId: 'cl_b', amount: 5000, paidOn: TODAY }); // no engagement total
    asUser('boss', () => {
      const html = W._billingStrip();
      expect(html).toContain('AED 7,000');                 // NOT max(0, 10k − 8k) = 2k
      expect(html).toContain('AED 8,000');                 // collected, all time
    });
  });

  it('opening Company / My Day / a client file refreshes billing from the server', () => {
    const src = String(W._lazyForRoute);
    expect((src.match(/_billingLoad/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(src).toContain("r==='analytics'");
    expect(src).toContain("r==='locations'");
  });
});

/* ══ 3 · replies card collapses ══ */
describe('3 — "From the client" is collapsible', () => {
  beforeEach(() => {
    const c = mkCase();
    W.DB.tmClientReplies.push(
      { id: 'r1', clientId: 'cl_a', checklistId: c.id, date: W.caseDate(c), questionId: 'q1',
        kind: 'reply', message: 'Sending the MOA today', files: [], submittedAt: HOURS_AGO(2) },
      { id: 'r2', clientId: 'cl_a', checklistId: c.id, date: W.caseDate(c), questionId: 'q2',
        kind: 'confirm', message: '', files: [], submittedAt: HOURS_AGO(5) });
  });
  it('collapsed by default with a one-line summary; expands on toggle', () => {
    W.S.filters = { locSel: 'cl_a' };
    let html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('From the client — 2');
    expect(html).toContain('latest 2h ago');
    expect(html).not.toContain('CONFIRMED');               // list hidden while collapsed
    W.S.filters.locRepliesOpen = true;
    html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('CONFIRMED');
    expect(html).toContain('Sending the MOA today');
    expect(html).toContain('under “From client”');
  });
});

/* ══ 4 · invoices can be deleted — by billing managers only ══ */
describe('4 — invoice delete', () => {
  beforeEach(() => {
    W.DB.tmInvoices.push({ id: 'inv1', clientId: 'cl_a', number: 'INV-0003', paymentId: null,
      amount: 1000, taxRate: 0, taxAmount: 0, total: 1000, currency: 'AED', issuedOn: TODAY,
      notes: '', snapshot: {}, status: 'Issued', createdBy: 'boss', createdAt: new Date().toISOString() });
  });
  it('a manager deletes; the row is gone', () => {
    W.App._invDelGo('inv1');
    expect(W.DB.tmInvoices).toHaveLength(0);
  });
  it('view-only holders get no delete (or void) — and the button is not rendered', () => {
    W.DB.roleProfiles.viewer = { id: 'viewer', name: 'Viewer', description: '', builtin: false,
      perms: { locations: { scope: 'none', actions: { view: true, billingView: true } } } };
    W.DB.users.find(u => u.id === 'ana').hrm.roleProfileId = 'viewer';
    asUser('ana', () => {
      W.App._invDelGo('inv1');
      expect(W.DB.tmInvoices).toHaveLength(1);             // refused
      W.S.route = 'locations'; W.S.filters = { locSel: 'cl_a', locTab: 'bill' };
      const html = W.locsPage();
      expect(html).toContain('INV-0003');
      expect(html).not.toContain('Delete invoice');
      expect(html).not.toContain('>Void<');
    });
    asUser('boss', () => {
      W.S.filters = { locSel: 'cl_a', locTab: 'bill' };
      expect(W.locsPage()).toContain('Delete invoice');
    });
  });
});

/* ══ 5 · leaner boards ══ */
describe('5 — three charts removed', () => {
  it('department / tickets-pie / weekday canvases are gone; core charts stay', () => {
    const page = readFileSync(resolve(SRC, 'pages/analytics.js'), 'utf8');
    expect(page).not.toContain('aChartDept');
    expect(page).not.toContain('aChartTickets');
    expect(page).not.toContain('aChartWeekday');
    expect(page).toContain('aChartStatus');
    expect(page).toContain('aChartTrend');
    const charts = readFileSync(resolve(SRC, 'ui/charts.js'), 'utf8');
    expect(charts).not.toContain("mk('aChartDept'");
    expect(charts).not.toContain("mk('aChartTickets'");
    expect(charts).not.toContain("mk('aChartWeekday'");
  });
  it('Compliance survived the pruning, and the phantom emp chart is gone for good', () => {
    expect(readFileSync(resolve(SRC, 'pages/analytics.js'), 'utf8')).toContain('aChartCompliance');
    expect(readFileSync(resolve(SRC, 'ui/charts.js'), 'utf8')).not.toContain('aChartEmp'); // threw on a dataset that never existed
  });
});

/* ══ 5b · the today widgets tell the truth about individual cases ══ */
describe('5b — overview widgets honour the individual model', () => {
  it('an individual case is not "submitted" until everyone handed in', () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    submitBy(c, 'ana');
    const rows = asUser('boss', () => W._clOverview(TODAY));
    const row = rows.find(r => r.c.id === c.id);
    expect(row.submitted).toBe(false);
    submitBy(c, 'ben');
    const row2 = asUser('boss', () => W._clOverview(TODAY)).find(r => r.c.id === c.id);
    expect(row2.submitted).toBe(true);
  });
  it('deleting a client takes its money out of the dashboard strip', () => {
    W._billingSave('cl_b', 5000, 'AED');
    W.DB.tmPayments.push({ id: 'pB', clientId: 'cl_b', amount: 1000, paidOn: TODAY });
    W.DB.locations.splice(W.DB.locations.findIndex(l => l.id === 'cl_b'), 1); // ghost rows left behind
    asUser('boss', () => {
      W._billingSave('cl_a', 100, 'AED');
      const html = W._billingStrip();
      expect(html).not.toContain('AED 5,000');   // ghost engagement not counted
      expect(html).not.toContain('AED 1,000');   // ghost payment not counted
    });
  });
});

/* ══ 6 · the link wears the client-facing COMPANY brand ══ */
describe('6 — brand on the status page', () => {
  const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
  const payload = over => Object.assign({ ok: true, client: 'Acme Trading',
    generated_at: new Date().toISOString(), allow_respond: true, tickets: null, billing: null,
    brand: { name: 'Hushare Corporate Services', logo: LOGO },
    cases: [{ checklist_id: 'case1', run_date: DAYS_AGO(5), name: 'Acme — Mainland LLC',
      any_one: false, people_total: 2, people_done: 1, done: false, completed_at: null,
      steps: [{ qid: 'q1', label: 'Trade name reserved?', done: false, waiting: null }] }] }, over || {});

  it('shows the company logo + name, never the product brand', async () => {
    W.sb.rpc = async () => ({ data: payload(), error: null });
    await W._pubStatusRender('livetoken12345678', true);
    const html = document.getElementById('app').innerHTML;
    expect(html).toContain(LOGO);
    expect(html).toContain('Hushare Corporate Services');
    expect(html).not.toContain('icon-192.png');
    expect(html).not.toContain('>Evarca<');
    expect(document.title).toContain('Hushare Corporate Services');
  });

  it('no template configured → neutral monogram, still no product logo', async () => {
    W.sb.rpc = async () => ({ data: payload({ brand: null }), error: null });
    W._pubData = null;
    await W._pubStatusRender('livetoken12345678', true);
    const html = document.getElementById('app').innerHTML;
    expect(html).not.toContain('icon-192.png');
    expect(html).toContain('Client status');
  });

  it('the client always sees the step list, whatever the internal closing rule is', async () => {
    W.sb.rpc = async () => ({ data: payload(), error: null });
    W._pubData = null;
    await W._pubStatusRender('livetoken12345678', true);
    const html = document.getElementById('app').innerHTML;
    expect(html).toContain('Trade name reserved?');        // steps are never hidden from the client
    expect(html).toContain('0/1 · 0%');                    // step-based progress
    expect(html).not.toContain('individual submissions');  // internal sign-off is not client-facing
  });
});

/* ══ 7 · costs stay available on individual client work ══ */
describe('7 — cost box on individual cards', () => {
  it('the own-copy card carries Cost used for client-attached checklists', () => {
    const c = signoffMode(mkCase({ anyOne: false }));
    asUser('ana', () => {
      W.RUN[c.id] = { questionResponses: [] };
      const card = W._qCard(c, W.DB.questions[0], TODAY, false);
      expect(card).toContain('Cost used');
      delete W.RUN[c.id];
    });
  });
});
