/* Route sweep + dangling-reference audit for the task-management build.

   Two things are checked here that a `vite build` cannot catch, because every cross-file
   reference in this codebase resolves through `window` at CALL time:

   1. Every route renders for every built-in role without throwing.
   2. Every function name that appears inside a rendered onclick/oninput handler actually
      exists. Removing a module would otherwise leave buttons that throw only when clicked.
*/
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;

// Every route the router knows about, plus the retired ones a stale bookmark could still hit.
const ROUTES = ['dashboard','mychecklists','users','hierarchy','checklists','allcl','questions',
  'approvals','notifications','analytics','locations','departments','settings','audit','teamview',
  'profile','accesscontrol','tickets'];
const RETIRED = ['attendance','leave','hrmconfig','hrmanalytics','reports','okr','overtime','shifts',
  'lifecycle','letters','discipline','payroll','surveys','reviews','documents','sops','schedule',
  'myschedule','expenses','nonsense-route'];

let sa, mgr, emp;

beforeAll(() => {
  sa  = W.__mkUser({ id: 'sa1', firstName: 'Sam',  lastName: 'Admin' });
  mgr = W.__mkUser({ id: 'mg1', firstName: 'Mia',  lastName: 'Manager' });
  emp = W.__mkUser({ id: 'em1', firstName: 'Eli',  lastName: 'Employee', managerId: 'mg1' });
  W.DB.users.push(sa, mgr, emp);
  [sa, mgr, emp].forEach(u => W._ensureHrm(u));
  sa.hrm.roleProfileId  = 'superadmin';
  mgr.hrm.roleProfileId = 'manager';
  emp.hrm.roleProfileId = 'basic';
  W._seedRoleProfiles();
  W._permsV3Migrate();
  W._seedAppConfig();
  W._ns = W._nsDefault();
  W.log = () => {}; // the sb stub can't chain .then().catch() — audit writes are not under test

  // Realistic data so the pages render populated states, not just empty ones.
  W.DB.departments.push({ id: 'd1', name: 'Ops', parentId: null });
  W.DB.locations.push({ id: 'l1', name: 'Main Store', address: '1 High St', status: 'Active' });
  W.DB.questions.push({ id: 'q1', text: 'Fridge temperature?', type: 'number', options: [], photo: true,
    approval: false, comment: true, isPublic: true, department: 'Ops', subDepartment: '', createdBy: 'sa1',
    createdAt: new Date().toISOString() });
  W.DB.checklists.push({ id: 'c1', name: 'Opening checks', description: 'Every morning', department: 'Ops',
    frequency: 'Daily', selectedDays: [], selectedDates: [], customDates: [], locationIds: ['l1'],
    assignees: ['em1', 'mg1'], tasks: [{ id: 't1', name: 'Unlock' }], questionIds: ['q1'], questionConfigs: {},
    scheduleTime: '09:00', status: 'Active', anyOne: false, createdBy: 'sa1' });
  const today = W.todayISO();
  W.DB.submissions.push({ id: 's1', checklistId: 'c1', userId: 'em1', date: today, status: 'Late',
    submittedAt: new Date().toISOString(), tasks: [], questionResponses: [{ questionId: 'q1', response: '4', comment: '' }],
    editCount: 0, editHistory: [] });
  W.DB.approvals.push({ id: 'a1', type: 'Submission', requesterId: 'em1', checklistId: 'c1', date: today,
    status: 'Pending', note: '', isResubmit: false });
  W.DB.approvals.push({ id: 'a2', type: 'Edit Request', requesterId: 'em1', checklistId: 'c1', date: today,
    status: 'Approved', note: '', isResubmit: false });
  W.DB.tickets.push({ id: 'tk1', title: 'Freezer alarm', description: 'Beeping since 6am', priority: 'High',
    status: 'Open', assignedTo: 'mg1', createdBy: 'em1', submitterId: 'em1', date: today,
    createdAt: new Date().toISOString(), viewedBy: [] });
  W.DB.tickets.push({ id: 'tk2', title: 'Till drawer sticks', description: '', priority: 'Low', status: 'Open',
    assignedTo: null, createdBy: 'em1', submitterId: 'em1', date: today, createdAt: new Date().toISOString(), viewedBy: [] });
  W.DB.notifications.push({ id: 'n1', userId: 'sa1', text: 'Freezer alarm ticket raised', read: false,
    time: new Date().toISOString(), kind: 'ticket' });
  if(0)W.DB.announcements.push({ id: 'an1', title: 'New rota', body: 'Starts Monday', deptTarget: null,
    locTarget: null, createdBy: 'sa1', createdAt: new Date().toISOString() });
  W.DB.audit.push({ id: 'lg1', actor: 'Sam Admin', action: 'Created checklist', target: 'Opening checks',
    time: new Date().toISOString() });
  W.DB.feedback.push({ id: 'fb1', checklistId: 'c1', userId: 'em1', managerId: 'mg1', date: today,
    title: 'Nice work', type: 'General', text: 'Good job', priority: 'Low', level: 'direct', status: 'Sent',
    acknowledged: false, replies: [], createdAt: new Date().toISOString() });
});

const asUser = (id, fn) => { const prev = W.S.uid; W.S.uid = id; try { return fn(); } finally { W.S.uid = prev; } };

describe.each([['Super Admin', 'sa1'], ['Manager', 'mg1'], ['Employee', 'em1']])('route sweep (%s)', (_label, uid) => {
  for (const r of ROUTES) {
    it('renders ' + r, () => {
      asUser(uid, () => {
        W.S.route = r; W.S.filters = {}; W.S.search = '';
        const html = W.shell(W.pageContent());
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(200);
        expect(html).not.toContain('undefined is not');
      });
    });
  }
});

describe('retired routes redirect instead of throwing', () => {
  for (const r of RETIRED) {
    it('redirects ' + r, () => {
      asUser('sa1', () => {
        W.S.route = r; W.S.filters = {};
        const html = W.pageContent();
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(20);
        expect(W.S.route).toBe('dashboard'); // landed somewhere real
      });
    });
  }
});

/* ── Dangling-reference audit ──
   Pull every `App.foo(` and bare `_foo(` / `fooPage(` out of the rendered markup's inline
   handlers and assert the target resolves. This is what catches a page that still points at
   a module the build no longer ships. */
const HANDLER_RE = /\son(?:click|change|input|submit|keydown|mouseover|mouseout)\s*=\s*"([^"]*)"/g;
const APP_CALL_RE  = /App\.([A-Za-z_$][\w$]*)\s*\(/g;
// Bare calls are only audited when they follow this codebase's naming for module-level functions
// (a leading underscore, or a `…Page` / `…Dash` renderer). That deliberately skips CSS functions
// like rgba(), DOM methods and JS builtins, which are not what a removed module would break.
const BARE_CALL_RE = /(?<![\w$.])(_[\w$]+|[A-Za-z$][\w$]*(?:Page|Dash|Widget|Modal))\s*\(/g;

function auditHandlers(html, where, missing) {
  let m;
  HANDLER_RE.lastIndex = 0;
  while ((m = HANDLER_RE.exec(html))) {
    const code = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    let c;
    APP_CALL_RE.lastIndex = 0;
    while ((c = APP_CALL_RE.exec(code))) {
      if (typeof (W.App || {})[c[1]] !== 'function') missing.add('App.' + c[1] + '  <- ' + where);
    }
    BARE_CALL_RE.lastIndex = 0;
    while ((c = BARE_CALL_RE.exec(code))) {
      const n = c[1];
      if (typeof W[n] !== 'function' && typeof (W.App || {})[n] !== 'function') missing.add(n + '  <- ' + where);
    }
  }
}

describe('no handler points at a function this build removed', () => {
  it('every inline handler across every route resolves', () => {
    const missing = new Set();
    for (const uid of ['sa1', 'mg1', 'em1']) {
      asUser(uid, () => {
        for (const r of ROUTES) {
          W.S.route = r; W.S.filters = {}; W.S.search = '';
          auditHandlers(W.shell(W.pageContent()), r + ' (' + uid + ')', missing);
        }
      });
    }
    expect([...missing]).toEqual([]);
  });

  it('every modal an admin can open resolves too', () => {
    const missing = new Set();
    asUser('sa1', () => {
      const opens = [
        ['user editor',      () => W.App.editUser('em1')],
        ['new user',         () => W.App.editUser()],
        ['checklist editor', () => W.App.editCl('c1')],
        ['question editor',  () => W.App.editQ && W.App.editQ('q1')],
        ['submission viewer',() => W.App.viewSub('s1')],
        ['approval detail',  () => W.App._inboxOpen('ap-a1')],
        ['role editor',      () => W.App._rpEdit('manager')],
        ['access editor',    () => W.App._acOpen && W.App._acOpen('em1')],
        ['quick search',     () => W.App._cmdk()],
        ['more menu',        () => W.App.moreMenu()],
        ['dashboard drill',  () => W.App._dashDrill('tickets')],
      ];
      for (const [label, open] of opens) {
        try { open(); } catch (e) { missing.add(label + ' threw: ' + e.message); continue; }
        const m = document.getElementById('modal');
        if (m) auditHandlers(m.innerHTML, label, missing);
        try { W.App.closeModal(); } catch (e) {}
      }
    });
    expect([...missing]).toEqual([]);
  });
});

describe('the shared database is not written by retired modules', () => {
  it('_sync never targets an HR table', async () => {
    const hit = [];
    const realFrom = W.sb.from;
    W.sb.from = (t) => { hit.push(t); return realFrom(t); };
    asUser('sa1', async () => {});
    W.S.uid = 'sa1';
    await W._sync();
    W.sb.from = realFrom;
    const forbidden = ['attendance', 'leave_requests', 'leave_balances', 'leave_types', 'holidays',
      'shifts', 'payroll_runs', 'payroll_items', 'okrs', 'okr_checkins', 'okr_logs', 'flows', 'letters',
      'discipline', 'overtime', 'surveys', 'survey_answers', 'review_cycles', 'review_answers',
      'documents', 'doc_folders', 'expenses'];
    expect(hit.filter(t => forbidden.includes(t))).toEqual([]);
  });

  it('the notification-switch write is refused until the shared config row has been read', () => {
    const hit = [];
    const realFrom = W.sb.from;
    W.sb.from = (t) => { hit.push(t); return realFrom(t); };
    W._appCfgLoaded = false;
    W.S.uid = 'sa1';
    W._pushNotifKinds();
    expect(hit).toEqual([]);           // nothing read yet → nothing written
    W._applyHrmConfig({ id: 'singleton', extras: { inappKinds: {}, alerts: { late: true } } });
    W._pushNotifKinds();
    expect(hit).toEqual(['hrm_config']); // now it writes, and only that row
    W.sb.from = realFrom;
  });

  it('round-trips config fields belonging to modules this build does not ship', () => {
    W._applyHrmConfig({ id: 'singleton', extras: { inappKinds: { ticket: false }, alerts: { late: true }, branding: { header: 'Acme' } } });
    expect(W.DB.hrmConfig.inappKinds.ticket).toBe(false);
    expect(W.DB._cfgExtras.alerts.late).toBe(true);      // preserved verbatim for the write-back
    expect(W.DB._cfgExtras.branding.header).toBe('Acme');
  });
});

describe('permission editor scoping', () => {
  it('renders only the task-management areas but keeps the full list for resolution', () => {
    const shown = W._tmAreas().map(a => a.key);
    expect(shown).toContain('tickets');
    expect(shown).toContain('checklists');
    expect(shown).not.toContain('payroll');
    expect(shown).not.toContain('leaveRequests');
    // the resolver still knows every area, so a stored HR toggle is never lost
    expect(W.PERM_AREAS.map(a => a.key)).toContain('payroll');
  });

  it('saving a role preserves toggles for areas the editor never showed', () => {
    W.S.uid = 'sa1';
    W.DB.roleProfiles.tmtest = { id: 'tmtest', name: 'TM Test', description: '', builtin: false,
      perms: { tickets: { scope: 'self', actions: { view: true } }, payroll: { scope: 'none', actions: { view: true, run: true } } } };
    W.App._rpEdit('tmtest');
    W.App._rpT('tickets', 'create');   // an edit the editor can make
    W.App._rpSave();
    const saved = W.DB.roleProfiles.tmtest;
    expect(saved.perms.tickets.actions.create).toBe(true);
    expect(saved.perms.payroll.actions.run).toBe(true); // untouched, not dropped
  });
});
