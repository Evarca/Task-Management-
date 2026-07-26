/* Round 6 (post-dry-run review): tap-again clears an answer, All results shows live runs,
   Announcements removed, the nudge email uses a real editable template, the ticket flow ties
   into clients, the Company dashboard opens with the client board, and Team lost its filter. */
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
  Object.keys(W.RUN || {}).forEach(k => delete W.RUN[k]);
  W.S.filters = {}; W.S.search = ''; W.S.expandedCl = null;

  const boss = W.__mkUser({ id: 'boss', firstName: 'Bea', lastName: 'Boss' });
  const ana  = W.__mkUser({ id: 'ana',  firstName: 'Ana', lastName: 'Adams', managerId: 'boss' });
  W.DB.users.push(boss, ana);
  [boss, ana].forEach(u => W._ensureHrm(u));
  boss.hrm.roleProfileId = 'superadmin';
  ana.hrm.roleProfileId = 'basic';
  W._seedRoleProfiles();

  W.DB.departments.push({ id: 'd_ops', name: 'Ops', parentId: null });
  W.DB.locations.push({ id: 'cl_a', name: 'Acme Trading', address: '', department: '', status: 'Active' });
  W.DB.tmClientMeta['cl_a'] = { contactName: 'Priya', contactEmail: 'priya@acme.example', contactPhone: '', reference: '', notes: '' };
  W.DB.questions.push(
    { id: 'q1', text: 'Trade name reserved?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
    { id: 'q2', text: 'MOA signed?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
  );
  W.log = () => {};
  W._ns = W._nsDefault();
  W.S.uid = 'boss';
}
beforeEach(seed);

function mkCase(over) {
  const c = Object.assign({
    id: 'case1', name: 'Acme — Mainland LLC', description: '', department: 'Ops',
    frequency: 'One-time', schedule: 'One-time', selectedDays: [], selectedDates: [], customDates: [],
    startDate: DAYS_AGO(2), endDate: null, locationIds: ['cl_a'], assignees: ['boss', 'ana'],
    tasks: [], questionIds: ['q1', 'q2'], questionConfigs: {}, scheduleTime: null,
    status: 'Active', anyOne: false, createdBy: 'boss',
  }, over || {});
  W.DB.checklists.push(c); return c;
}

/* ═══ 1 — tap again to clear ═══ */
describe('1 — an answer can be unselected before submitting', () => {
  it('second tap on the same option clears it; a different option switches', () => {
    const c = mkCase();
    W.RUN[c.id] = { checklistId: c.id, userId: 'boss', date: TODAY, tasks: [], questionResponses: [] };
    W.App._setQR(c.id, 'q1', 'Yes', true);
    expect(W.RUN[c.id].questionResponses[0].response).toBe('Yes');
    W.App._setQR(c.id, 'q1', 'Yes', true);          // same option again → clear
    expect(W.RUN[c.id].questionResponses[0].response).toBe(null);
    W.App._setQR(c.id, 'q1', 'No', true);           // fresh pick works
    expect(W.RUN[c.id].questionResponses[0].response).toBe('No');
    W.App._setQR(c.id, 'q1', 'Yes', true);          // switching does not clear
    expect(W.RUN[c.id].questionResponses[0].response).toBe('Yes');
  });
});

/* ═══ 2 — All results shows the live run ═══ */
describe('2 — a submitted answer is visible in All results before the run closes', () => {
  it('the card reads In progress with the live count, and expanding lists the answers', () => {
    const c = mkCase();
    W.DB.tmAnswers.push({ id: W._ansId(c.id, TODAY, 'q1'), checklistId: c.id, date: W.caseDate(c),
      questionId: 'q1', response: 'Yes', comment: '', photos: [], submittedBy: 'ana',
      submittedAt: new Date().toISOString(), locked: true, editCount: 0 });
    W.S.filters = { aclDate: TODAY, aclU: 'loccl_a|boss' };   // expand Boss's row under the client
    const html = W.allClsPage();
    expect(html).toContain('1/2 answered');
    expect(html).toContain('In progress');
    const detail = W._roResponses(c, null, TODAY);
    expect(detail).toContain('Ana Adams');
    expect(detail).toContain('Trade name reserved?');
  });
});

/* ═══ 3 — announcements are gone ═══ */
describe('3 — announcements removed end to end', () => {
  it('no nav entry, and the old route lands on the dashboard', () => {
    W.S.route = 'announcements';
    const html = W.render() || document.getElementById('app').innerHTML;
    expect(document.getElementById('app').innerHTML).not.toContain('>Announcements<');
    expect(W.S.route).not.toBe('announcements');
  });
  it('no announcement row in Settings, no announcement event, no page function', () => {
    expect(W._evByKey('announcement')).toBe(null);
    W.S.route = 'settings'; W.S.filters = { stab: 'notif' };
    const html = W.settingsPage();
    expect(html).not.toContain('Announcement posted');
    expect(W.announcementsPage).toBeUndefined();
    expect((W.NAV_ALL || []).some(n => n[0] === 'announcements')).toBe(false);
  });
});

/* ═══ 4 — the nudge email is a real, editable template ═══ */
describe('4 — client nudge email formatting', () => {
  it('fills the template with the client, the item, and the sender name', () => {
    const c = mkCase();
    W._ns.email_from_name = 'Evarca Corporate Services';
    W.DB.tmQStatus[W._qsKey(c.id, TODAY, 'q2')] = { status: 'waiting_client', changedBy: 'boss', changedAt: new Date().toISOString() };
    W.App._nudgeClientGo('cl_a', c.id, 'q2');
    expect(W.DB.tmNudges.length).toBe(1);
    // the template exists, is editable in Settings, and fills every variable
    const t = W._defaultTemplates().client_nudge;
    expect(t).toBeTruthy();
    const filled = W._fillTemplate(t.body, { contact_name: 'Priya', client_name: 'Acme Trading',
      checklist_name: c.name, question: 'MOA signed?', from_name: 'Evarca Corporate Services' });
    expect(filled).toContain('Dear Priya');
    expect(filled).toContain('MOA signed?');
    expect(filled).toContain('Warm regards');
    expect(filled).toContain('Evarca Corporate Services');
    expect(filled).not.toContain('{{');
    // and it is offered for editing in the Templates tab
    expect(W.EMAIL_EVENTS.some(e => e.key === 'client_nudge')).toBe(true);
  });
});

/* ═══ 5 — tickets tie into the client flow ═══ */
describe('5 — tickets wired to clients', () => {
  it('the new-ticket modal offers the client cases, and saving carries the link', () => {
    const c = mkCase();
    W.App._newTicketFor('cl_a');
    const html = document.body.innerHTML;
    expect(html).toContain('Related client work');
    expect(html).toContain('Acme Trading — Acme — Mainland LLC');
    document.getElementById('tk-title').value = 'Client sent wrong passport copy';
    W.App.createTicket();
    const t = W.DB.tickets.find(x => x.title === 'Client sent wrong passport copy');
    expect(t).toBeTruthy();
    expect(t.checklistId).toBe(c.id);
    expect(W.clientIdsOfTicket(t)).toContain('cl_a');
  });

  it('the client file lists its open tickets with a raise button', () => {
    const c = mkCase();
    W.DB.tickets.push({ id: 'tk1', title: 'Missing Emirates ID copy', description: '', priority: 'High',
      status: 'Open', assignedTo: 'boss', createdBy: 'ana', submitterId: 'ana', checklistId: c.id,
      questionId: null, date: TODAY, createdAt: new Date().toISOString(), viewedBy: [] });
    const html = W._locProgTab(W.DB.locations[0]);
    expect(html).toContain('Open tickets — 1');
    expect(html).toContain('Missing Emirates ID copy');
    expect(html).toContain('Raise ticket');
  });
});

/* ═══ 6 — the Company dashboard leads with clients ═══ */
describe('6 — client-focused dashboard', () => {
  it('shows the client board: open cases, %, blockers, overdue, next deadline', () => {
    const c = mkCase();
    W.DB.tmMeta[c.id] = { deadlineDate: DAYS_AGO(-3) };   // due in 3 days
    W.DB.tmAnswers.push({ id: W._ansId(c.id, TODAY, 'q1'), checklistId: c.id, date: W.caseDate(c),
      questionId: 'q1', response: 'Yes', comment: '', photos: [], submittedBy: 'ana',
      submittedAt: new Date().toISOString(), locked: true, editCount: 0 });
    W.DB.tmQStatus[W._qsKey(c.id, TODAY, 'q2')] = { status: 'waiting_client', changedBy: 'boss', changedAt: new Date().toISOString() };
    const html = W._clientCasesSection();
    expect(html).toContain('Where each client stands');
    expect(html).toContain('Acme Trading');
    expect(html).toContain('1 open case');
    expect(html).toContain('50%');
    expect(html).toContain('1 blocked');
    expect(html).toContain('Open cases');
    expect(html).toContain('Due in 7 days');
    expect(html).toContain("_openClientFile('cl_a')");
    // and it sits on the Company page
    expect(W.analyticsPage()).toContain('Where each client stands');
  });

  it('renders nothing when no client has an open case', () => {
    expect(W._clientCasesSection()).toBe('');
  });
});

/* ═══ 7 — Team page: no client filter ═══ */
describe('7 — Team is just the team', () => {
  it('renders the people grid without a client filter', () => {
    W.S.route = 'teamview';
    const html = W.teamViewPage();
    expect(html).not.toContain('tvClient');
    expect(html).not.toContain('All clients');
  });
});

/* ═══ 8 — escalations fire per answer, and everything goes red ═══ */
describe('8 — escalation on answer submit', () => {
  function mkEscCase() {
    // q2 "MOA signed?" escalates to boss when answered "No" (yes/no → opt_1 is No)
    return mkCase({ questionConfigs: { q2: { opt_1: 'boss' } } });
  }
  const draft = (c, qid, val) => {
    W.RUN[c.id] = { checklistId: c.id, userId: W.S.uid, date: TODAY, tasks: [], questionResponses: [] };
    W.App._setQR(c.id, qid, val, true);
  };

  it('creates the ticket the moment the escalating answer is submitted', async () => {
    const c = mkEscCase();
    W.S.uid = 'ana';
    draft(c, 'q2', 'No');
    await W.App._ansSubmit(c.id, TODAY, 'q2');
    const t = W.DB.tickets.find(x => x.questionId === 'q2' && x.checklistId === c.id);
    expect(t).toBeTruthy();
    expect(t.status).toBe('Open');
    expect(t.assignedTo).toBe('boss');
    expect(t.priority).toBe('High');            // "No" reads as high priority
    expect(t.answerGiven).toBe('No');
    // and boss heard about it
    expect(W.DB.notifications.some(n => n.userId === 'boss' && /Escalation/.test(n.text))).toBe(true);
  });

  it('does not duplicate the ticket when the run is later submitted — even by someone else', async () => {
    const c = mkEscCase();
    W.S.uid = 'ana';
    draft(c, 'q2', 'No');
    await W.App._ansSubmit(c.id, TODAY, 'q2');
    draft(c, 'q1', 'Yes');
    await W.App._ansSubmit(c.id, TODAY, 'q1');
    expect(W.DB.tickets.length).toBe(1);
    W.S.uid = 'boss';                            // a different person closes the run
    await W.App._submitRun(c.id, TODAY);
    expect(W.DB.tickets.filter(x => x.questionId === 'q2' && x.checklistId === c.id).length).toBe(1);
  });

  it('a non-escalating answer raises nothing', async () => {
    const c = mkEscCase();
    W.S.uid = 'ana';
    draft(c, 'q2', 'Yes');
    await W.App._ansSubmit(c.id, TODAY, 'q2');
    expect(W.DB.tickets.length).toBe(0);
  });

  it('the locked card, All results and the client file all mark it red', async () => {
    const c = mkEscCase();
    W.S.uid = 'ana';
    draft(c, 'q2', 'No');
    await W.App._ansSubmit(c.id, TODAY, 'q2');
    const card = W._qCard(c, W.DB.questions.find(q => q.id === 'q2'), TODAY, false);
    expect(card).toContain('ESCALATED');
    expect(card).toContain('#FEF2F2');           // red container
    const detail = W._roResponses(c, null, TODAY);
    expect(detail).toContain('ESCALATED');
    const file = W._locProgTab(W.DB.locations[0]);
    expect(file).toContain('ESCALATED');
  });
});

/* ═══ 9 — the Data tab is gone ═══ */
describe('9 — settings without the Data tab', () => {
  it('offers Notifications and Templates only, and a stale #data link falls back', () => {
    W.S.route = 'settings'; W.S.filters = { stab: 'data' };
    const html = W.settingsPage();
    expect(html).not.toContain('>Data<');
    expect(html).not.toContain('Reset workspace');
    expect(html).toContain('>Notifications<');
    expect(html).toContain('>Templates<');
  });
});
