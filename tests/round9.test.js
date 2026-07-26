/* Round 9: the polish round.

   Templates retired; invoice numbers previewed and always automatic; the "Cost used" box
   commits with the answer; a waiting-on-client flag now carries a NOTE ("what exactly do
   we need from you") that the client sees on the link; a cleared flag disappears on every
   device (the reconcile fix); Billing split into view/manage; payments and invoices got
   their own notification events; and billing surfaced on the clients list + dashboards. */
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
  const cfo  = W.__mkUser({ id: 'cfo',  firstName: 'Cy',  lastName: 'Numbers' });
  const ana  = W.__mkUser({ id: 'ana',  firstName: 'Ana', lastName: 'Adams', managerId: 'boss' });
  W.DB.users.push(boss, cfo, ana);
  [boss, cfo, ana].forEach(u => W._ensureHrm(u));
  boss.hrm.roleProfileId = 'superadmin';
  cfo.hrm.roleProfileId = 'admin';
  ana.hrm.roleProfileId = 'basic';
  W._seedRoleProfiles();

  W.DB.departments.push({ id: 'd_ops', name: 'Ops', parentId: null });
  W.DB.locations.push({ id: 'cl_a', name: 'Acme Trading', address: 'Downtown', department: 'Ops', status: 'Active' });
  W.DB.tmClientMeta['cl_a'] = { contactName: 'Priya', contactEmail: 'priya@acme.example', contactPhone: '', reference: '', notes: '' };
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
    startDate: DAYS_AGO(5), endDate: null, locationIds: ['cl_a'], assignees: ['ana'],
    tasks: [], questionIds: ['q1', 'q2'], questionConfigs: {}, scheduleTime: null,
    status: 'Active', anyOne: true, createdBy: 'boss',  // shared case — the toggle decides since round 10
  }, over || {});
  W.DB.checklists.push(c); return c;
}
const asUser = (id, fn) => { const prev = W.S.uid; W.S.uid = id; try { return fn(); } finally { W.S.uid = prev; } };
const SRC = resolve(process.cwd(), 'src');

/* ══ 1 · templates are gone ══ */
describe('1 — Save as template is removed', () => {
  it('no template UI, handlers or loader anywhere in the source', () => {
    const builder = readFileSync(resolve(SRC, 'pages/checklists.js'), 'utf8');
    expect(builder).not.toContain('Save as template');
    expect(builder).not.toContain('Start from a template');
    expect(builder).not.toContain('_tplSaveAsk');
    const supa = readFileSync(resolve(SRC, 'supabase.js'), 'utf8');
    expect(supa).not.toContain('_tplLoad');
  });
  it('the checklist editor renders clean without it', () => {
    W.DB.tmTemplates.push({ id: 'tpl1', name: 'Old template', questionIds: ['q1'], questionConfigs: {} });
    W.App.editCl(null);
    expect(document.body.innerHTML).not.toContain('Start from a template');
    expect(document.body.innerHTML).not.toContain('Old template');
    W.App.closeModal(); W.CLD = null;
  });
});

/* ══ 2 · invoice number: automatic, previewed ══ */
describe('2 — invoice numbering is automatic', () => {
  it('the Generate modal shows the upcoming number, read-only', async () => {
    W.DB.tmInvoiceSettings = { companyName: 'Evarca DMCC', currency: 'AED', taxLabel: 'VAT', taxRate: 5,
      numberPrefix: 'INV-', nextNumber: 8, address: '', phone: '', email: '', trn: '', logo: '', footerText: '', terms: '' };
    await W.App._invGen('cl_a', '');
    const html = document.body.innerHTML;
    expect(html).toContain('INV-0008');
    expect(html).toContain('assigned automatically');
    expect(document.getElementById('iv-amt')).toBeTruthy();   // amount is asked; the number never is
    expect(html).not.toContain('id="iv-number"');
    W.App.closeModal();
  });
});

/* ══ 3 · the cost box commits with the answer ══ */
describe('3 — submitting an answer also saves the typed cost', () => {
  it('a typed-but-not-blurred cost is persisted by Submit', async () => {
    const c = mkCase();
    const cd = W.caseDate(c);
    await asUser('ana', async () => {
      W.RUN[c.id] = { questionResponses: [{ questionId: 'q1', response: 'Yes', comment: '', photos: [] }] };
      document.body.insertAdjacentHTML('beforeend', `<input id="qc-${c.id}-q1" value="750"/>`);
      await W.App._ansSubmit(c.id, TODAY, 'q1');
      delete W.RUN[c.id];
    });
    const a = W._ansFor(c.id, cd, 'q1');
    expect(a && a.locked).toBe(true);
    expect(W.DB.tmQCosts[W._qsKey(c.id, cd, 'q1')].amount).toBe(750);
    expect(W._runUtilized(c.id, TODAY)).toBe(750);
    document.getElementById(`qc-${c.id}-q1`).remove();
  });
});

/* ══ 4 · the waiting note ══ */
describe('4 — "what are we waiting for" rides with the Waiting-on-client flag', () => {
  it('setting the flag asks for the note; saving stores it; the badge carries it', () => {
    const c = mkCase();
    const cd = W.caseDate(c);
    asUser('ana', () => {
      W.App._setQStatus(c.id, TODAY, 'q1', 'waiting_client');
      const box = document.getElementById('wn-note');
      expect(box).toBeTruthy();                                   // the ask appears immediately
      box.value = 'Passport copies of all three partners';
      W.App._waitNoteSave(c.id, TODAY, 'q1');
    });
    expect(W.DB.tmQStatus[W._qsKey(c.id, cd, 'q1')].status).toBe('waiting_client');
    expect(W._waitNoteOf(c.id, TODAY, 'q1').note).toBe('Passport copies of all three partners');
    expect(W._qsBadge(c.id, cd, 'q1')).toContain('Waiting for: Passport copies');
    // the client file's blocked card spells it out
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('waiting for: Passport copies of all three partners');
  });

  it('clearing the flag (or moving to another status) clears the note with it', () => {
    const c = mkCase();
    asUser('ana', () => {
      W.App._setQStatus(c.id, TODAY, 'q1', 'waiting_client');
      document.getElementById('wn-note').value = 'Signed MOA';
      W.App._waitNoteSave(c.id, TODAY, 'q1');
      W.App._setQStatus(c.id, TODAY, 'q1', 'waiting_client');     // tap again = clear
    });
    expect(W._waitNoteOf(c.id, TODAY, 'q1')).toBe(null);
    asUser('ana', () => {
      W.App._setQStatus(c.id, TODAY, 'q2', 'waiting_client');
      document.getElementById('wn-note').value = 'Board resolution';
      W.App._waitNoteSave(c.id, TODAY, 'q2');
      W.App._setQStatus(c.id, TODAY, 'q2', 'waiting_authority');  // moved on — not the client's problem
    });
    expect(W._waitNoteOf(c.id, TODAY, 'q2')).toBe(null);
  });

  it('the client sees the note on the status page, next to the item', async () => {
    W.sb.rpc = async () => ({ data: { ok: true, client: 'Acme Trading', generated_at: new Date().toISOString(),
      allow_respond: true, tickets: null, billing: null,
      cases: [{ checklist_id: 'case1', run_date: DAYS_AGO(5), name: 'Acme — Mainland LLC', done: false, completed_at: null,
        steps: [{ qid: 'q1', label: 'Trade name reserved?', done: false, waiting: 'waiting_client',
          waiting_note: 'Passport copies of all three partners',
          waiting_days: 2, waiting_hours: 50, replied_at: null, can_respond: true }] }] }, error: null });
    await W._pubStatusRender('livetoken12345678', true);
    const html = document.getElementById('app').innerHTML;
    expect(html).toContain('Passport copies of all three partners');
    expect(html).toContain('Tap <b>Respond</b>');
  });
});

/* ══ 5 · the reconcile fix: a flag cleared server-side really disappears ══ */
describe('5 — statuses deleted on the server stop haunting other devices', () => {
  it('_qsLoad drops local rows the server no longer has (inside the fetched window)', async () => {
    const c = mkCase();
    const key = W._qsKey(c.id, W.caseDate(c), 'q1');
    W.DB.tmQStatus[key] = { status: 'waiting_client', changedBy: 'ana', changedAt: HOURS_AGO(3) };
    await W._qsLoad();                                   // the sb stub returns zero rows, no error
    expect(W.DB.tmQStatus[key]).toBeUndefined();
  });
  it('the route loaders refresh replies and costs so the swap happens without a reload', () => {
    const src = String(W._lazyForRoute);
    expect(src).toContain("_repliesLoad");
    expect(src).toContain("r==='locations'");
  });
});

/* ══ 6 · billing view vs manage ══ */
describe('6 — Billing is split: view sees, manage acts', () => {
  beforeEach(() => {
    W.DB.roleProfiles.viewer = { id: 'viewer', name: 'Viewer', description: '', builtin: false,
      perms: { locations: { scope: 'none', actions: { view: true, billingView: true } } } };
    W.DB.users.find(u => u.id === 'ana').hrm.roleProfileId = 'viewer';
    W._billingSave('cl_a', 10000, 'AED');
    W.DB.tmPayments.push({ id: 'p1', clientId: 'cl_a', amount: 7000, paidOn: TODAY, method: 'Bank transfer' });
  });

  it('a view-only holder sees the tab and the numbers but no money buttons', () => {
    asUser('ana', () => {
      expect(W.canBillView()).toBe(true);
      expect(W.canBill()).toBe(false);
      W.S.route = 'locations'; W.S.filters = { locSel: 'cl_a', locTab: 'bill' };
      const html = W.locsPage();
      expect(html).toContain('Balance due');
      expect(html).toContain('View-only');
      expect(html).not.toContain('Record payment');
      expect(html).not.toContain('Invoice template');
    });
  });

  it('the clients LIST shows Balance due to billing eyes only', () => {
    asUser('ana', () => {
      W.S.route = 'locations'; W.S.filters = {};
      expect(W.locsPage()).toContain('AED 3,000');
    });
    W.DB.users.find(u => u.id === 'ana').hrm.roleProfileId = 'basic';
    asUser('ana', () => {
      W.S.filters = {};
      const html = W.locsPage();
      expect(html).not.toContain('Balance due');
      expect(html).not.toContain('AED 3,000');
    });
  });

  it('both actions are offered by the editor and seeded onto superadmin/admin', () => {
    const loc = W._tmAreas().find(a => a.key === 'locations');
    expect(loc.actions).toContain('billing');
    expect(loc.actions).toContain('billingView');
    expect(W.DB.roleProfiles.superadmin.perms.locations.actions.billingView).toBe(true);
    expect(W.DB.roleProfiles.admin.perms.locations.actions.billingView).toBe(true);
  });
});

/* ══ 7 · billing notifications ══ */
describe('7 — payments and invoices notify the billing folks', () => {
  it('both are real events with switches', () => {
    expect(W._evByKey('payment_recorded').group).toBe('Billing');
    expect(W._evByKey('invoice_generated').group).toBe('Billing');
    expect(W.evInApp('payment_recorded')).toBe(true);
    expect(W.evEmail('payment_recorded')).toBe(false);      // email quiet by default
    W._ns.inapp_invoice_generated = false;
    expect(W.evInApp('invoice_generated')).toBe(false);
  });

  it('recording a payment pings the other billing managers, not the actor', () => {
    W._billingSave('cl_a', 10000, 'AED');
    W.App._payAdd('cl_a');
    document.getElementById('pay-amt').value = '7000';
    document.getElementById('pay-inv').checked = false;
    W.App._payAddGo('cl_a');
    const toCfo = W.DB.notifications.find(n => n.userId === 'cfo' && /Payment recorded/.test(n.text));
    expect(toCfo).toBeTruthy();
    expect(toCfo.text).toContain('AED 7,000');
    expect(W.DB.notifications.find(n => n.userId === 'boss' && /Payment recorded/.test(n.text))).toBeUndefined();
  });
});

/* ══ 8 · billing on the dashboards ══ */
describe('8 — dashboards carry the money and the replies', () => {
  it('the Company dashboard strip: totals for billing eyes, silence for others', () => {
    W._billingSave('cl_a', 10000, 'AED');
    W.DB.tmPayments.push({ id: 'p1', clientId: 'cl_a', amount: 7000, paidOn: TODAY });
    asUser('boss', () => {
      const html = W._billingStrip();
      expect(html).toContain('Outstanding');
      expect(html).toContain('AED 3,000');
      expect(html).toContain('Collected this month');
    });
    asUser('ana', () => expect(W._billingStrip()).toBe(''));
  });

  it('"Clients responded" appears for people on that checklist', () => {
    const c = mkCase();
    W.DB.tmClientReplies.push({ id: 'r1', clientId: 'cl_a', checklistId: c.id, date: W.caseDate(c),
      questionId: 'q1', kind: 'document', message: '', files: [{ name: 'passport.pdf', doc_id: 'd1' }],
      submittedAt: HOURS_AGO(2) });
    asUser('ana', () => {
      const html = W._clientRepliesWidget();
      expect(html).toContain('Clients responded');
      expect(html).toContain('Acme Trading');
      expect(html).toContain('1 FILE');
    });
    asUser('cfo', () => expect(W._clientRepliesWidget()).toBe(''));  // not on the checklist
  });
});
