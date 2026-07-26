/* Round 5: the case model for business-setup work. One-time checklists that stay open until
   every question is answered; per-question working status (waiting on client / authority);
   the client file (Progress tab) with share links and nudges; templates; the public status
   page renderer; and the new notification event. */
import { describe, it, expect, beforeEach } from 'vitest';

const W = window;
const TODAY = W.todayISO();
const DAYS_AGO = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

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
  W.S.filters = {}; W.S.search = ''; W.S.expandedCl = null;

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
  W.DB.locations.push({ id: 'cl_a', name: 'Acme Trading', address: 'Downtown', department: 'Ops', status: 'Active' });
  W.DB.tmClientMeta['cl_a'] = { contactName: 'Priya', contactEmail: 'priya@acme.example', contactPhone: '', reference: '', notes: '' };
  W.DB.questions.push(
    { id: 'q1', text: 'Trade name reserved?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
    { id: 'q2', text: 'MOA signed?',          type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
  );
  W.log = () => {};
  W._ns = W._nsDefault();
  W.S.uid = 'boss';
}
beforeEach(seed);

/* A case opened N days ago, still open. */
function mkCase(over) {
  const c = Object.assign({
    id: 'case1', name: 'Acme — Mainland LLC', description: '', department: 'Ops',
    frequency: 'One-time', schedule: 'One-time', selectedDays: [], selectedDates: [], customDates: [],
    startDate: DAYS_AGO(5), endDate: null, locationIds: ['cl_a'], assignees: ['ana', 'ben'],
    tasks: [], questionIds: ['q1', 'q2'], questionConfigs: {}, scheduleTime: null,
    status: 'Active', anyOne: false, createdBy: 'boss',
  }, over || {});
  W.DB.checklists.push(c); return c;
}
const answer = (c, qid, by) => {
  W.DB.tmAnswers.push({ id: W._ansId(c.id, TODAY, qid), checklistId: c.id, date: W.caseDate(c),
    questionId: qid, response: 'Yes', comment: '', photos: [], submittedBy: by || 'ana',
    submittedAt: new Date().toISOString(), locked: true, editCount: 0 });
};

/* ═══ 1 — the case model ═══ */
describe('1 — a case stays open across days until it is submitted', () => {
  it('is on today even though it started five days ago, and on future days too', () => {
    const c = mkCase();
    expect(W.clOn(c, TODAY)).toBe(true);
    expect(W.clOn(c, DAYS_AGO(3))).toBe(true);
    expect(W.clOn(c, DAYS_AGO(-2))).toBe(true);   // still open tomorrow
    expect(W.clOn(c, DAYS_AGO(7))).toBe(false);   // before it opened
  });

  it('reads and writes the SAME run whichever day you look from', () => {
    const c = mkCase();
    answer(c, 'q1');
    // an answer recorded "on the case" is visible from today, yesterday, any day
    expect(W._ansFor(c.id, TODAY, 'q1')).toBeTruthy();
    expect(W._ansFor(c.id, DAYS_AGO(2), 'q1')).toBeTruthy();
    expect(W._ansProgress(c, TODAY).done).toBe(1);
    expect(W._ansProgress(c, DAYS_AGO(2)).done).toBe(1);
  });

  it('closes for everyone on submit, and stops appearing on later days', () => {
    const c = mkCase();
    answer(c, 'q1', 'ana'); answer(c, 'q2', 'ben');
    W.DB.submissions.push({ id: 's1', checklistId: c.id, userId: 'ana', date: W.caseDate(c),
      status: 'On Time', submittedAt: new Date().toISOString(), tasks: [], questionResponses: [], editCount: 0, editHistory: [] });
    expect(W.subForCl(c, 'ben', TODAY)).toBeTruthy();       // Ben sees it closed too
    expect(W.subForCl(c, 'ben', DAYS_AGO(1))).toBeTruthy(); // from any day
    expect(W.clOn(c, TODAY)).toBe(true);                    // shows as done on its completion day
    expect(W.clOn(c, DAYS_AGO(-1))).toBe(false);            // gone from tomorrow's list
  });

  it('a case with a passed final deadline is overdue; without one it never is', () => {
    const c = mkCase();
    expect(W._clOverdue(c, TODAY)).toBe(false);             // no deadline set
    W.DB.tmMeta[c.id] = { deadlineDate: DAYS_AGO(1) };
    expect(W._clOverdue(c, TODAY)).toBe(true);
    W.DB.submissions.push({ id: 's1', checklistId: c.id, userId: 'ana', date: W.caseDate(c),
      status: 'On Time', submittedAt: new Date().toISOString(), tasks: [], questionResponses: [], editCount: 0, editHistory: [] });
    expect(W._clOverdue(c, TODAY)).toBe(false);             // done is done, not late
  });

  it('the builder offers One-time and the run card marks it as a CASE', () => {
    W.App.editCl(null);
    expect(document.body.innerHTML).toContain('One-time — a client case');
    W.App.closeModal();
    const c = mkCase();
    const html = W._clCard(c, TODAY);
    expect(html).toContain('CASE');
    expect(html).toContain('open since');
  });
});

/* ═══ 2 — per-question working status ═══ */
describe('2 — waiting on client / authority', () => {
  it('sets, reads back from any day, and clears on a second tap', () => {
    const c = mkCase();
    W.App._setQStatus(c.id, TODAY, 'q2', 'waiting_client');
    expect(W._qStatusOf(c.id, TODAY, 'q2').status).toBe('waiting_client');
    expect(W._qStatusOf(c.id, DAYS_AGO(2), 'q2').status).toBe('waiting_client'); // same run
    W.App._setQStatus(c.id, TODAY, 'q2', 'waiting_client');   // toggle off
    expect(W._qStatusOf(c.id, TODAY, 'q2')).toBe(null);
  });

  it('shows the chips on an open question card, with days waiting', () => {
    const c = mkCase();
    W.DB.tmQStatus[W._qsKey(c.id, TODAY, 'q2')] = { status: 'waiting_client', changedBy: 'ana', changedAt: new Date(Date.now() - 4 * 86400000).toISOString() };
    W.S.expandedCl = c.id;
    const html = W._clCard(c, TODAY);
    expect(html).toContain('Waiting on client');
    expect(html).toContain('Waiting on authority');
    expect(html).toContain('In progress');
    expect(html).toContain('4d');
  });

  it('is a registered notification event with both channels', () => {
    expect(W._evByKey('waiting_client_stale')).toBeTruthy();
    expect(W.evInApp('waiting_client_stale')).toBe(true);
    W.S.route = 'settings'; W.S.filters = { stab: 'notif' };
    const h = W.settingsPage();
    expect(h).toContain("_nsTog(this,'inapp_waiting_client_stale')");
    expect(h).toContain("_nsTog(this,'email_waiting_client_stale')");
  });

  it('alerts the creator after 3+ days waiting on the client, once per day', () => {
    const c = mkCase();
    W.DB.tmQStatus[W._qsKey(c.id, TODAY, 'q2')] = { status: 'waiting_client', changedBy: 'ana', changedAt: new Date(Date.now() - 4 * 86400000).toISOString() };
    const sent = {};
    expect(W._caseAlerts(c, TODAY, W.nowHM(), sent)).toBe(true);
    const mine = W.DB.notifications.filter(n => n.userId === 'boss' && /waiting on/.test(n.text));
    expect(mine.length).toBe(1);
    expect(mine[0].text).toContain('Acme Trading');
    expect(W._caseAlerts(c, TODAY, W.nowHM(), sent)).toBe(false);   // same day — no duplicate
    expect(W.DB.notifications.filter(n => n.userId === 'boss' && /waiting on/.test(n.text)).length).toBe(1);
  });

  it('an overdue case pings the creator and the assignees\' manager once', () => {
    const c = mkCase();
    W.DB.tmMeta[c.id] = { deadlineDate: DAYS_AGO(1) };
    const sent = {};
    expect(W._caseAlerts(c, TODAY, W.nowHM(), sent)).toBe(true);
    const texts = W.DB.notifications.map(n => n.userId + '|' + n.text);
    expect(texts.some(t => t.startsWith('boss|') && t.includes('Case overdue'))).toBe(true);
    expect(W._caseAlerts(c, TODAY, W.nowHM(), sent)).toBe(false);
  });
});

/* ═══ 3 — the client file ═══ */
describe('3 — the Progress tab answers the phone call', () => {
  it('opens as the default tab on a client', () => {
    W.S.route = 'locations'; W.S.filters = {};
    W.App._openLoc('cl_a');
    expect(W.S.filters.locTab).toBe('prog');
  });

  it('shows the open case, its %, who did what when, next up, and the blocker', () => {
    const c = mkCase();
    answer(c, 'q1', 'ana');
    W.DB.tmQStatus[W._qsKey(c.id, TODAY, 'q2')] = { status: 'waiting_client', changedBy: 'ana', changedAt: new Date(Date.now() - 3 * 86400000).toISOString() };
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('Acme — Mainland LLC');
    expect(html).toContain('1/2 · 50%');
    expect(html).toContain('Ana Adams');            // who submitted q1
    expect(html).toContain('NEXT UP');              // q2 is next
    expect(html).toContain('Waiting on someone');   // the blocked card
    expect(html).toContain('Nudge');                // contact email exists → nudge offered
    expect(html).toContain('Priya');                // the contact strip
  });

  it('moves a submitted case into Completed', () => {
    const c = mkCase();
    answer(c, 'q1'); answer(c, 'q2');
    W.DB.submissions.push({ id: 's1', checklistId: c.id, userId: 'ana', date: W.caseDate(c),
      status: 'On Time', submittedAt: new Date().toISOString(), tasks: [], questionResponses: [], editCount: 0, editHistory: [] });
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('Completed — 1');
    expect(html).toContain('COMPLETED');
    expect(html).not.toContain('Open cases');
  });

  it('nudging queues the email and records it', () => {
    const c = mkCase();
    W.DB.tmQStatus[W._qsKey(c.id, TODAY, 'q2')] = { status: 'waiting_client', changedBy: 'ana', changedAt: new Date().toISOString() };
    const realConfirm = W.confirm; W.confirm = () => true;
    W.App._nudgeClient('cl_a', c.id, 'q2');
    W.confirm = realConfirm;
    expect(W.DB.tmNudges.length).toBe(1);
    expect(W.DB.tmNudges[0].toEmail).toBe('priya@acme.example');
    expect(W.DB.tmNudges[0].note).toBe('MOA signed?');
  });

  it('the clients table carries the progress column', () => {
    const c = mkCase();
    answer(c, 'q1');
    W.S.route = 'locations'; W.S.filters = {};
    const html = W.locsPage();
    expect(html).toContain('Case progress');
    expect(html).toContain('1 open · 50%');
  });
});

/* ═══ 4 — share links ═══ */
describe('4 — the client status link', () => {
  it('creates an enabled link and shows the URL; revoking disables it', () => {
    W.S.route = 'locations'; W.S.filters = { locSel: 'cl_a', locTab: 'prog' };
    W.App._shareCreate('cl_a');
    const link = W.DB.tmShareLinks.find(x => x.clientId === 'cl_a');
    expect(link).toBeTruthy();
    expect(link.enabled).toBe(true);
    expect(link.token.length).toBeGreaterThanOrEqual(16);
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('#status/' + link.token);
    expect(html).toContain('Revoke');
    const realConfirm = W.confirm; W.confirm = () => true;
    W.App._shareRevoke(link.token);
    W.confirm = realConfirm;
    expect(link.enabled).toBe(false);
    expect(W._locProgTab(W.DB.locations[0])).toContain('Create link');
  });

  it('the public boot only accepts a well-formed token hash', () => {
    expect(String(W._pubStatusBoot.toString())).toContain('status');
    // no hash → not a public visit
    window.location.hash = '';
    expect(W._pubStatusBoot()).toBe(false);
  });

  it('renders the public page from RPC data — steps, waiting-on-you, no employee names', async () => {
    const realRpc = W.sb.rpc;
    W.sb.rpc = async () => ({ data: { ok: true, client: 'Acme Trading', generated_at: new Date().toISOString(), cases: [{
      name: 'Mainland LLC', deadline_date: TODAY, deadline_time: null, done: false, completed_at: null,
      steps: [
        { label: 'Trade name reserved?', done: true, done_at: new Date().toISOString(), waiting: null, waiting_days: null },
        { label: 'MOA signed?', done: false, done_at: null, waiting: 'waiting_client', waiting_days: 3 },
      ] }] }, error: null });
    await W._pubStatusRender('abcdefghij1234567890');
    W.sb.rpc = realRpc;
    const html = document.getElementById('app').innerHTML;
    expect(html).toContain('Acme Trading');
    expect(html).toContain('1/2 · 50%');
    expect(html).toContain("We're waiting on you for:");
    expect(html).toContain('MOA signed?');
    expect(html).toContain('WITH YOU');
    expect(html).not.toContain('Ana');            // never a team member's name
  });

  it('a dead token gets the friendly not-active page', async () => {
    const realRpc = W.sb.rpc;
    W.sb.rpc = async () => ({ data: { ok: false }, error: null });
    await W._pubStatusRender('deadtoken123456789');
    W.sb.rpc = realRpc;
    expect(document.getElementById('app').innerHTML).toContain('no longer active');
  });
});

/* ═══ 5 — templates ═══ */
describe('5 — templates make the next client instant', () => {
  it('saves the open checklist as a template and applies it to a new one', () => {
    W.DB.tmTemplates.push({ id: 'tpl1', name: 'Mainland LLC formation', description: '', department: 'Ops',
      questionIds: ['q1', 'q2'], questionConfigs: {}, createdBy: 'boss', createdAt: TODAY });
    W.App.editCl(null);
    expect(document.body.innerHTML).toContain('Start from a template');
    expect(document.body.innerHTML).toContain('Mainland LLC formation');
    W.App._tplApply('tpl1');
    expect(W.CLD.questionIds).toEqual(['q1', 'q2']);
    expect(W.CLD.frequency).toBe('One-time');     // a template starts a case
    expect(W.CLD.department).toBe('Ops');
    W.App.closeModal(); W.CLD = null;
  });

  it('applying a template drops questions that no longer exist', () => {
    W.DB.tmTemplates.push({ id: 'tpl1', name: 'T', description: '', department: '',
      questionIds: ['q1', 'q_gone'], questionConfigs: {}, createdBy: 'boss', createdAt: TODAY });
    W.App.editCl(null);
    W.App._tplApply('tpl1');
    expect(W.CLD.questionIds).toEqual(['q1']);
    W.App.closeModal(); W.CLD = null;
  });
});
