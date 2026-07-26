/* The new flows: shared per-question answers, the submit gate, per-answer edit requests,
   the optional deadline, and the location documents.

   These assert BEHAVIOUR, not markup — what a second person sees after the first answers,
   what the gate does with a half-finished run, who is allowed to decide an edit. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const W = window;
const TODAY = W.todayISO();

/* The env's sb stub returns {data:[],error:null} for everything, which is what we want for
   writes. Reads are irrelevant here — every test seeds DB directly. */
function seed() {
  // render() writes into #app — give it one so the real submit path can run end to end.
  if (!document.getElementById('app')) {
    const d = document.createElement('div'); d.id = 'app'; document.body.appendChild(d);
  }
  W.DB.users.length = 0; W.DB.checklists.length = 0; W.DB.questions.length = 0;
  W.DB.submissions.length = 0; W.DB.approvals.length = 0; W.DB.notifications.length = 0;
  W.DB.tmAnswers = []; W.DB.tmAnswerEdits = []; W.DB.tmMeta = {};
  W.DB.tmFolders = []; W.DB.tmDocuments = []; W.DB.locations.length = 0;

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
    { id: 'q1', text: 'Fridge temp?', type: 'number', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
    { id: 'q2', text: 'Floor clean?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY },
  );
  W.DB.checklists.push({ id: 'c1', name: 'Opening checks', description: '', department: 'Ops',
    frequency: 'Daily', selectedDays: [], selectedDates: [], customDates: [], locationIds: [],
    assignees: ['ana', 'ben'], tasks: [], questionIds: ['q1', 'q2'], questionConfigs: {},
    // These suites describe the SHARED-run behaviour, which since round 7 is what the
    // "Any one assignee can complete" toggle switches on (cases are always shared).
    scheduleTime: null, status: 'Active', anyOne: true, createdBy: 'boss' });
  W.DB.locations.push({ id: 'l1', name: 'Main Store', address: '', department: '', status: 'Active' });
  W.log = () => {};
  W._ns = W._nsDefault();
}

const as = (id) => { W.S.uid = id; };
/* Type a value into the local run the same way the inputs do, then press Submit. */
async function answer(clId, qId, value, comment) {
  W.RUN[clId] = W.RUN[clId] || { checklistId: clId, userId: W.S.uid, date: TODAY, tasks: [], questionResponses: [] };
  W.RUN[clId].date = TODAY;
  // RUN persists across tests; drop any stale draft for this question so setting the same
  // value again is a SET, not the tap-again-to-clear toggle the UI now offers.
  W.RUN[clId].questionResponses = (W.RUN[clId].questionResponses || []).filter(r => r.questionId !== qId);
  W.App._setQR(clId, qId, value, true);
  if (comment !== undefined) W.App._setQRComment(clId, qId, comment);
  await W.App._ansSubmit(clId, TODAY, qId);
}

beforeEach(seed);

describe('shared run — several people, one checklist', () => {
  it('stamps each answer with who submitted it and when', async () => {
    as('ana');
    await answer('c1', 'q1', '4');
    const a = W._ansFor('c1', TODAY, 'q1');
    expect(a).toBeTruthy();
    expect(a.response).toBe('4');
    expect(a.submittedBy).toBe('ana');
    expect(a.locked).toBe(true);
    expect(Date.parse(a.submittedAt)).not.toBeNaN();
  });

  it("a second person answers a DIFFERENT question in the same run", async () => {
    as('ana'); await answer('c1', 'q1', '4');
    as('ben'); await answer('c1', 'q2', 'Yes');
    expect(W._ansFor('c1', TODAY, 'q1').submittedBy).toBe('ana');
    expect(W._ansFor('c1', TODAY, 'q2').submittedBy).toBe('ben');
    expect(W._ansProgress(W.clById('c1'), TODAY)).toEqual({ total: 2, done: 2, complete: true });
    expect(W._ansContributors('c1', TODAY).map(u => u.id)).toEqual(['ana', 'ben']);
  });

  it('refuses a second answer to a question someone already submitted', async () => {
    as('ana'); await answer('c1', 'q1', '4');
    as('ben'); await answer('c1', 'q1', '99');
    expect(W._ansFor('c1', TODAY, 'q1').response).toBe('4');      // unchanged
    expect(W._ansFor('c1', TODAY, 'q1').submittedBy).toBe('ana'); // still hers
  });

  it('refuses an empty answer', async () => {
    as('ana');
    await answer('c1', 'q1', '');
    expect(W._ansFor('c1', TODAY, 'q1')).toBeNull();
  });

  it('enforces a required photo and a required comment', async () => {
    W.DB.questions.find(q => q.id === 'q1').photo = true;
    as('ana');
    await answer('c1', 'q1', '4');
    expect(W._ansFor('c1', TODAY, 'q1')).toBeNull(); // blocked: no photo
    W.DB.questions.find(q => q.id === 'q1').photo = false;
    W.DB.questions.find(q => q.id === 'q1').comment = true;
    await answer('c1', 'q1', '4', '   ');
    expect(W._ansFor('c1', TODAY, 'q1')).toBeNull(); // blocked: blank comment
    await answer('c1', 'q1', '4', 'chiller reading');
    expect(W._ansFor('c1', TODAY, 'q1').comment).toBe('chiller reading');
  });
});

describe('the checklist submits only when every question is answered', () => {
  it('blocks the run submit while a question is still open', async () => {
    as('ana'); await answer('c1', 'q1', '4');
    await W.App._submitRun('c1', TODAY);
    expect(W.runSub('c1', TODAY)).toBeNull();
  });

  it('goes through once the last answer lands, and carries the per-answer attribution', async () => {
    as('ana'); await answer('c1', 'q1', '4');
    as('ben'); await answer('c1', 'q2', 'Yes');
    await W.App._submitRun('c1', TODAY);
    const sub = W.runSub('c1', TODAY);
    expect(sub).toBeTruthy();
    expect(sub.status).toBe('On Time');
    const byQ = Object.fromEntries(sub.questionResponses.map(r => [r.questionId, r]));
    expect(byQ.q1.response).toBe('4');
    expect(byQ.q1.answeredBy).toBe('ana');
    expect(byQ.q2.answeredBy).toBe('ben');
  });

  it('closes the run for EVERYONE assigned, not just the submitter', async () => {
    as('ana'); await answer('c1', 'q1', '4');
    as('ben'); await answer('c1', 'q2', 'Yes');
    await W.App._submitRun('c1', TODAY);
    const c = W.clById('c1');
    expect(W.subForCl(c, 'ben', TODAY)).toBeTruthy();
    expect(W.subForCl(c, 'ana', TODAY)).toBeTruthy();
  });

  it('refuses a second submit of the same run', async () => {
    as('ana'); await answer('c1', 'q1', '4');
    as('ben'); await answer('c1', 'q2', 'Yes');
    await W.App._submitRun('c1', TODAY);
    as('ben'); await W.App._submitRun('c1', TODAY);
    expect(W.DB.submissions.filter(s => s.checklistId === 'c1' && s.date === TODAY).length).toBe(1);
  });
});

describe('editing a submitted answer needs a manager', () => {
  async function requestEdit() {
    as('ana'); await answer('c1', 'q1', '4');
    W.App._ansEditAsk('c1', TODAY, 'q1');
    const el = document.getElementById('ans-edit-why'); if (el) el.value = 'wrong reading';
    W.App._ansEditSend('c1', TODAY, 'q1');
    return W.DB.tmAnswerEdits[0];
  }

  it('the answer stays locked while the request is pending', async () => {
    const e = await requestEdit();
    expect(e.status).toBe('Pending');
    expect(e.reason).toBe('wrong reading');
    expect(W._ansFor('c1', TODAY, 'q1').locked).toBe(true);
  });

  it('a colleague cannot decide it', async () => {
    const e = await requestEdit();
    as('ben');
    W.App._ansEditDecide(e.id, 'approve');
    expect(e.status).toBe('Pending');
    expect(W._ansFor('c1', TODAY, 'q1').locked).toBe(true);
  });

  it("the requester's manager can, and that unlocks the one answer", async () => {
    const e = await requestEdit();
    as('boss');
    expect(W._ansCanDecide(e)).toBe(true);
    W.App._ansEditDecide(e.id, 'approve');
    expect(e.status).toBe('Approved');
    expect(W._ansFor('c1', TODAY, 'q1').locked).toBe(false);
    // ...and only that one: the other answer is untouched.
    as('ben'); await answer('c1', 'q2', 'Yes');
    expect(W._ansFor('c1', TODAY, 'q2').locked).toBe(true);
  });

  it('rejecting leaves it locked', async () => {
    const e = await requestEdit();
    as('boss');
    W.App._ansEditDecide(e.id, 'reject');
    expect(e.status).toBe('Rejected');
    expect(W._ansFor('c1', TODAY, 'q1').locked).toBe(true);
  });

  it('an unlocked answer can be re-submitted, and re-locks with the new value', async () => {
    const e = await requestEdit();
    as('boss'); W.App._ansEditDecide(e.id, 'approve');
    as('ana');
    delete W.RUN.c1;
    await answer('c1', 'q1', '7');
    const a = W._ansFor('c1', TODAY, 'q1');
    expect(a.response).toBe('7');
    expect(a.locked).toBe(true);
    expect(a.editCount).toBe(1);
    expect(e.status).toBe('Used');
    expect(e.oldResponse).toBe('4'); // the previous value is kept on the request
  });

  it('shows up in the approvals inbox for the manager and not for a bystander', async () => {
    await requestEdit();
    as('boss');
    const mine = W._approvalInbox().filter(x => x.type === 'answerEdit');
    expect(mine.length).toBe(1);
    expect(mine[0].status).toBe('Pending');
    as('ben');
    expect(W._approvalInbox().filter(x => x.type === 'answerEdit').length).toBe(0);
  });

  it('an approver can unlock directly without a request', async () => {
    as('ana'); await answer('c1', 'q1', '4');
    as('boss');
    W.App._ansUnlock('c1', TODAY, 'q1');
    expect(W._ansFor('c1', TODAY, 'q1').locked).toBe(false);
  });
});

describe('deadline — date and time are both optional', () => {
  it('with neither, a run is never late', () => {
    const c = W.clById('c1');
    expect(W._clDeadlineLabel(c)).toBe('');
    expect(W._clOverdue(c, TODAY)).toBe(false);
  });

  it('a time alone is the daily cut-off', () => {
    const c = W.clById('c1');
    c.scheduleTime = '23:59';
    expect(W._clOverdue(c, TODAY)).toBe(false);
    c.scheduleTime = '00:00';
    expect(W._clOverdue(c, TODAY)).toBe(true);
    expect(W._clDeadlineLabel(c)).toContain('00:00');
  });

  it('a date alone pins the deadline to that day', () => {
    const c = W.clById('c1');
    const past = W._isoAdd(TODAY, -1), future = W._isoAdd(TODAY, 3);
    W.DB.tmMeta.c1 = { deadlineDate: future };
    expect(W._clOverdue(c, TODAY)).toBe(false);
    W.DB.tmMeta.c1 = { deadlineDate: past };
    expect(W._clOverdue(c, TODAY)).toBe(true);
  });

  it('both together read as one deadline', () => {
    const c = W.clById('c1');
    c.scheduleTime = '17:00';
    W.DB.tmMeta.c1 = { deadlineDate: W._isoAdd(TODAY, 2) };
    const label = W._clDeadlineLabel(c);
    expect(label).toContain('17:00');
    expect(label).toContain('·');
    expect(W._clOverdue(c, TODAY)).toBe(false); // the due day hasn't arrived
  });
});

describe('dashboard reads the work, not the people', () => {
  it('reports each checklist state rather than per-employee scores', async () => {
    as('boss');
    const before = W._clOverview(TODAY);
    expect(before.length).toBe(1);
    expect(before[0].state).toBe('Not started');
    as('ana'); await answer('c1', 'q1', '4');
    as('boss');
    expect(W._clOverview(TODAY)[0].state).toBe('In progress');
    as('ben'); await answer('c1', 'q2', 'Yes');
    await W.App._submitRun('c1', TODAY);
    as('boss');
    const after = W._clOverview(TODAY)[0];
    expect(after.state).toBe('Submitted');
    expect(after.pct).toBe(100);
    expect(after.contributors.map(u => u.id).sort()).toEqual(['ana', 'ben']);
  });

  it('marks a run overdue once its deadline has passed', () => {
    W.clById('c1').scheduleTime = '00:00';
    as('boss');
    expect(W._clOverview(TODAY)[0].state).toBe('Overdue');
  });
});

describe('location documents', () => {
  it('folders nest and the breadcrumb trail walks back up', () => {
    as('boss');
    W.DB.tmFolders.push(
      { id: 'f1', locationId: 'l1', parentId: null, name: 'Licences', createdBy: 'boss', createdAt: TODAY },
      { id: 'f2', locationId: 'l1', parentId: 'f1', name: '2026', createdBy: 'boss', createdAt: TODAY },
      { id: 'f3', locationId: 'l1', parentId: null, name: 'Floor plans', createdBy: 'boss', createdAt: TODAY },
    );
    expect(W._foldersIn('l1', null).map(f => f.id)).toEqual(['f3', 'f1']); // alphabetical
    expect(W._foldersIn('l1', 'f1').map(f => f.id)).toEqual(['f2']);
    expect(W._folderTrail('f2').map(f => f.name)).toEqual(['Licences', '2026']);
    expect(W._folderSubtree('l1', 'f1').sort()).toEqual(['f1', 'f2']);
  });

  it('files list under the folder they belong to', () => {
    W.DB.tmFolders.push({ id: 'f1', locationId: 'l1', parentId: null, name: 'Licences', createdBy: 'boss', createdAt: TODAY });
    W.DB.tmDocuments.push(
      { id: 'd1', locationId: 'l1', folderId: 'f1', name: 'trade-licence.pdf', storagePath: 'l1/f1/d1_x.pdf', fileType: 'application/pdf', fileSize: 2048, uploadedBy: 'boss', uploaderName: 'Bea Boss', uploadedAt: TODAY },
      { id: 'd2', locationId: 'l1', folderId: null, name: 'notes.txt', storagePath: 'l1/root/d2_n.txt', fileType: 'text/plain', fileSize: 12, uploadedBy: 'boss', uploaderName: 'Bea Boss', uploadedAt: TODAY },
    );
    expect(W._docsIn('l1', 'f1').map(d => d.id)).toEqual(['d1']);
    expect(W._docsIn('l1', null).map(d => d.id)).toEqual(['d2']);
    expect(W._fmtBytes(2048)).toBe('2 KB');
  });

  it('deleting a folder takes its subtree and the files inside', () => {
    as('boss');
    W.DB.tmFolders.push(
      { id: 'f1', locationId: 'l1', parentId: null, name: 'Licences', createdBy: 'boss', createdAt: TODAY },
      { id: 'f2', locationId: 'l1', parentId: 'f1', name: '2026', createdBy: 'boss', createdAt: TODAY },
    );
    W.DB.tmDocuments.push({ id: 'd1', locationId: 'l1', folderId: 'f2', name: 'a.pdf', storagePath: 'p', fileType: '', fileSize: 1, uploadedBy: 'boss', uploaderName: '', uploadedAt: TODAY });
    const confirmSpy = vi.spyOn(W, 'confirm').mockReturnValue(true);
    W.App._docDelFolder('f1');
    confirmSpy.mockRestore();
    expect(W.DB.tmFolders.length).toBe(0);
    expect(W.DB.tmDocuments.length).toBe(0);
  });

  it('a client opens on Progress, with Documents beside it and no checklist tab', () => {
    as('boss');
    W.S.route = 'locations'; W.S.filters = {};
    W.App._openLoc('l1');
    const html = W.pageContent();
    expect(html).toContain('Progress');
    expect(html).toContain('Documents');
    expect(html).not.toContain('>Checklists<');
    expect(W.S.filters.locTab).toBe('prog');
  });
});
