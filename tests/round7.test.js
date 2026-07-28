/* Round 7: the "Any one assignee can complete" toggle actually decides the run model.
   OFF → every assignee fills and submits their OWN copy; a teammate's submission never
   closes yours. ON (or a One-time client case) → the shared run from round 2. */
import { describe, it, expect, beforeEach } from 'vitest';

const W = window;
const TODAY = W.todayISO();

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
  const ben  = W.__mkUser({ id: 'ben',  firstName: 'Ben', lastName: 'Blake', managerId: 'boss' });
  W.DB.users.push(boss, ana, ben);
  [boss, ana, ben].forEach(u => W._ensureHrm(u));
  boss.hrm.roleProfileId = 'superadmin';
  ana.hrm.roleProfileId = 'basic';
  ben.hrm.roleProfileId = 'basic';
  W._seedRoleProfiles();

  W.DB.questions.push(
    { id: 'q1', text: 'Counter clean?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
    { id: 'q2', text: 'Till counted?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
  );
  W.log = () => {};
  W._ns = W._nsDefault();
  W.S.uid = 'ana';
}
beforeEach(seed);

function mkCl(over) {
  const c = Object.assign({
    id: 'r1', name: 'Daily duties', description: '', department: '',
    frequency: 'Daily', schedule: 'Every day', selectedDays: [], selectedDates: [], customDates: [],
    startDate: '', endDate: '', locationIds: [], assignees: ['ana', 'ben'],
    tasks: [], questionIds: ['q1', 'q2'], questionConfigs: {}, scheduleTime: null,
    status: 'Active', anyOne: false, createdBy: 'boss',
  }, over || {});
  W.DB.checklists.push(c); return c;
}
const draftAll = (c) => {
  W.RUN[c.id] = { checklistId: c.id, userId: W.S.uid, date: TODAY, tasks: [], questionResponses: [] };
  W.App._setQR(c.id, 'q1', 'Yes', true);
  W.App._setQR(c.id, 'q2', 'Yes', true);
};

describe('individual (toggle OFF): everyone submits their own copy', () => {
  it('is not shared, and a teammate\'s submission does not close yours', async () => {
    const c = mkCl();
    expect(W.isShared(c)).toBe(false);
    W.S.uid = 'ana';
    draftAll(c);
    await W.App._submitRun(c.id, TODAY);
    expect(W.subFor(c.id, 'ana', TODAY)).toBeTruthy();
    expect(W.subForCl(c, 'ben', TODAY)).toBe(null);        // Ben still owes his
    expect(W.subForCl(c, 'ana', TODAY)).toBeTruthy();      // Ana is done
  });

  it('each person\'s submission carries their own answers', async () => {
    const c = mkCl();
    W.S.uid = 'ana'; draftAll(c);
    await W.App._submitRun(c.id, TODAY);
    W.S.uid = 'ben';
    W.RUN[c.id] = { checklistId: c.id, userId: 'ben', date: TODAY, tasks: [], questionResponses: [] };
    W.App._setQR(c.id, 'q1', 'No', true);
    W.App._setQR(c.id, 'q2', 'Yes', true);
    await W.App._submitRun(c.id, TODAY);
    const anaSub = W.subFor(c.id, 'ana', TODAY), benSub = W.subFor(c.id, 'ben', TODAY);
    expect(anaSub.questionResponses.find(r => r.questionId === 'q1').response).toBe('Yes');
    expect(benSub.questionResponses.find(r => r.questionId === 'q1').response).toBe('No');
    expect(anaSub.questionResponses[0].answeredBy).toBe('ana');
    expect(benSub.questionResponses[0].answeredBy).toBe('ben');
  });

  it('blocks a half-answered individual submit, and never writes shared answers', async () => {
    const c = mkCl();
    W.S.uid = 'ana';
    W.RUN[c.id] = { checklistId: c.id, userId: 'ana', date: TODAY, tasks: [], questionResponses: [] };
    W.App._setQR(c.id, 'q1', 'Yes', true);
    await W.App._submitRun(c.id, TODAY);
    expect(W.subFor(c.id, 'ana', TODAY)).toBeFalsy();      // refused — q2 unanswered
    expect(W.DB.tmAnswers.length).toBe(0);                 // the shared layer stays untouched
  });

  it('the card offers no per-question submit and no status chips; footer reads "answered"', () => {
    const c = mkCl();
    W.S.uid = 'ana';
    W.S.expandedCl = c.id;
    const html = W._clCard(c, TODAY);
    expect(html).not.toContain('Submit answer');
    expect(html).not.toContain('Waiting on client');
    expect(html).toContain('0/2 answered');
    // and the per-question engine refuses individual checklists outright
    expect(W._qCard(c, W.DB.questions[0], TODAY, false)).not.toContain('Submit answer');
  });

  it('escalations still fire from an individual submission', async () => {
    const c = mkCl({ questionConfigs: { q1: { opt_1: 'boss' } } });   // No on q1 escalates
    W.S.uid = 'ana';
    W.RUN[c.id] = { checklistId: c.id, userId: 'ana', date: TODAY, tasks: [], questionResponses: [] };
    W.App._setQR(c.id, 'q1', 'No', true);
    W.App._setQR(c.id, 'q2', 'Yes', true);
    await W.App._submitRun(c.id, TODAY);
    expect(W.DB.tickets.length).toBe(1);
    expect(W.DB.tickets[0].assignedTo).toBe('boss');
  });
});

describe('shared (toggle ON) and cases keep the round-2 model', () => {
  it('anyOne: one person\'s submission closes it for everyone', async () => {
    const c = mkCl({ anyOne: true });
    expect(W.isShared(c)).toBe(true);
    W.S.uid = 'ana';
    W.RUN[c.id] = { checklistId: c.id, userId: 'ana', date: TODAY, tasks: [], questionResponses: [] };
    W.App._setQR(c.id, 'q1', 'Yes', true);
    await W.App._ansSubmit(c.id, TODAY, 'q1');
    W.App._setQR(c.id, 'q2', 'Yes', true);
    await W.App._ansSubmit(c.id, TODAY, 'q2');
    await W.App._submitRun(c.id, TODAY);
    expect(W.subForCl(c, 'ben', TODAY)).toBeTruthy();      // closed for Ben too
  });

  it('a case always uses the shared per-question engine; the toggle only decides closing', () => {
    const on  = mkCl({ id: 'caseA', frequency: 'One-time', schedule: 'One-time', startDate: TODAY, anyOne: true });
    const off = mkCl({ id: 'caseB', frequency: 'One-time', schedule: 'One-time', startDate: TODAY, anyOne: false });
    expect(W.isShared(on)).toBe(true);            // per-question submit / statuses / costs
    expect(W.isShared(off)).toBe(true);           // …exactly the same with the toggle off
    expect(W.needsAllSignoff(on)).toBe(false);    // a case closes on the first sign-off by default
    expect(W.needsAllSignoff(off)).toBe(false);   // the any_one column has no say for cases
    W.DB.tmMeta[off.id] = { requireSignoff: true };
    expect(W.needsAllSignoff(off)).toBe(true);    // opted in deliberately, on tm_checklist_meta
    expect(W.needsAllSignoff(mkCl({ id: 'daily1', anyOne: false }))).toBe(false); // not a case
  });

  it('per-answer submit is refused on an individual checklist', async () => {
    const c = mkCl();
    W.S.uid = 'ana';
    W.RUN[c.id] = { checklistId: c.id, userId: 'ana', date: TODAY, tasks: [], questionResponses: [] };
    W.App._setQR(c.id, 'q1', 'Yes', true);
    await W.App._ansSubmit(c.id, TODAY, 'q1');
    expect(W.DB.tmAnswers.length).toBe(0);
  });
});

/* ═══ round 7b — the four field reports ═══ */
describe('field fixes: end date, edit requests, badges', () => {
  it('an end date is a hard stop — for recurring checklists AND open cases', () => {
    const daily = mkCl({ id: 'r9', endDate: '2000-01-01' });
    expect(W.clOn(daily, TODAY)).toBe(false);
    const c = mkCl({ id: 'case9', frequency: 'One-time', schedule: 'One-time',
      startDate: '1999-12-01', endDate: '2000-01-01', anyOne: false });
    expect(W.clOn(c, TODAY)).toBe(false);         // past its end date, even though unsubmitted
    expect(W.clOn(c, '1999-12-15')).toBe(true);   // was live inside its window
    // timestamps stored by the full platform can't leak it either
    const ts = mkCl({ id: 'r10', endDate: '2000-01-01T00:00:00.000Z' });
    expect(W.clOn(ts, TODAY)).toBe(false);
  });

  it('saving a One-time case keeps its end date now', () => {
    W.App.editCl(null);
    W.CLD.name = 'End dated case'; W.CLD.questionIds = ['q1']; W.CLD.frequency = 'One-time';
    document.getElementById('cn-sd').value = TODAY;
    document.getElementById('cn-ed').value = '2099-01-01';   // save reads the form fields
    W.App._saveCl(false);
    const saved = W.DB.checklists.find(x => x.name === 'End dated case');
    expect(saved.endDate).toBe('2099-01-01');
    W.CLD = null;
  });

  it('deciding an edit request writes a targeted UPDATE, never an upsert', () => {
    const src = String(W.App._ansEditDecide);
    expect(src).toContain(".update(");
    expect(src).not.toContain("_pushRow('tm_answer_edits'");
  });

  it('the approvals badge counts only requests YOU can decide', () => {
    const c = mkCl({ anyOne: true });
    W.DB.tmAnswers.push({ id: W._ansId(c.id, TODAY, 'q1'), checklistId: c.id, date: TODAY,
      questionId: 'q1', response: 'Yes', comment: '', photos: [], submittedBy: 'ana',
      submittedAt: new Date().toISOString(), locked: true, editCount: 0 });
    W.DB.tmAnswerEdits.push({ id: 'ae1', answerId: W._ansId(c.id, TODAY, 'q1'), checklistId: c.id,
      date: TODAY, questionId: 'q1', requestedBy: 'ana', requestedAt: new Date().toISOString(),
      reason: 'typo', status: 'Pending', decidedBy: null, decidedAt: null, decisionNote: '', oldResponse: null, oldComment: null });
    W.S.uid = 'ana';                               // the requester: sees it, but no red count
    expect(W._approvalPendingCount()).toBe(0);
    expect(W._approvalInbox().some(x => x.id === 'ae-ae1')).toBe(true);
    W.S.uid = 'boss';                              // her manager: counts
    expect(W._approvalPendingCount()).toBe(1);
    W.App._ansEditDecide('ae1', 'approve');        // deciding clears it
    expect(W._approvalPendingCount()).toBe(0);
  });

  it('viewing the Alerts page schedules the silent read that clears the bell', () => {
    W.S.uid = 'ana';
    W.notify('ana', 'Test ping', 'general', null);
    expect(W.DB.notifications.some(n => n.userId === 'ana' && !n.read)).toBe(true);
    W.App._silentReadAll();
    expect(W.DB.notifications.some(n => n.userId === 'ana' && !n.read)).toBe(false);
    // and the page render wires the auto-read timer
    expect(String(W.notificationsPage)).toContain('_silentReadAll');
  });

  it('opening the approvals tab refetches the edit-request tables', () => {
    const src = String(W._lazyLoad);
    expect(src).toContain('_ansLoadWindow');
  });
});
