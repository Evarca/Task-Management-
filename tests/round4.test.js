/* Round 4: the client form, removable deadlines, the notification model (every event on both
   channels, no instructional filler), "Assigned to me" in All results, the permission editor
   showing only what this build enforces, no approval toggle on a question, and one shared
   filter bar on every list page. */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const W = window;
const TODAY = W.todayISO();
const SRC = path.resolve(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

function seed() {
  if (!document.getElementById('app')) {
    const d = document.createElement('div'); d.id = 'app'; document.body.appendChild(d);
  }
  W.DB.users.length = 0; W.DB.checklists.length = 0; W.DB.questions.length = 0;
  W.DB.submissions.length = 0; W.DB.approvals.length = 0; W.DB.notifications.length = 0;
  W.DB.tickets.length = 0; W.DB.locations.length = 0; W.DB.departments.length = 0;
  W.DB.tmAnswers = []; W.DB.tmAnswerEdits = []; W.DB.tmMeta = {};
  W.DB.tmFolders = []; W.DB.tmDocuments = []; W.DB.tmClientMeta = {};
  W.S.filters = {}; W.S.search = '';

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
  W.DB.locations.push(
    { id: 'cl_a', name: 'Acme Trading', address: 'Downtown', department: 'Ops', status: 'Active' },
    { id: 'cl_b', name: 'Bright Foods', address: 'Marina', department: '', status: 'Active' },
  );
  W.DB.questions.push({ id: 'q1', text: 'Docs filed?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY });
  const mk = (id, name, locIds, assignees) => ({ id, name, description: '', department: 'Ops',
    frequency: 'Daily', schedule: 'Every day', selectedDays: [], selectedDates: [], customDates: [],
    locationIds: locIds, assignees, tasks: [], questionIds: ['q1'], questionConfigs: {},
    scheduleTime: null, status: 'Active', anyOne: false, createdBy: 'boss' });
  W.DB.checklists.push(mk('c1', 'Acme onboarding', ['cl_a'], ['ana']), mk('c2', 'Bright renewals', ['cl_b'], ['boss']));
  W.log = () => {};
  W._ns = W._nsDefault();
  W.S.uid = 'boss';
}
beforeEach(seed);

/* ═══ 1 — the client form asks client questions ═══ */
describe('1 — creating and editing a client', () => {
  const openForm = (id) => { W.App.editLoc(id); return document.body.innerHTML; };

  it('asks for the things you need about a client, not about an office', () => {
    const h = openForm(null);
    ['Client name', 'Contact person', 'Reference / licence no.', 'Contact email',
     'Contact phone', 'Address', 'Owning department', 'Status', 'Notes'].forEach(label => {
      expect(h).toContain(label);
    });
    expect(h).toContain('Create client');
    W.App.closeModal();
  });

  it('keeps contact details in the new table, leaving `locations` its original shape', () => {
    openForm(null);
    document.getElementById('ln-n').value = 'Zenith Holdings';
    document.getElementById('ln-cn').value = 'Priya N';
    document.getElementById('ln-ce').value = 'priya@zenith.example';
    document.getElementById('ln-cp').value = '+971500000000';
    document.getElementById('ln-ref').value = 'LIC-9931';
    document.getElementById('ln-a').value = 'Business Bay';
    document.getElementById('ln-notes').value = 'Renewal due in March.';
    W.App.saveLoc('');

    const created = W.DB.locations.find(l => l.name === 'Zenith Holdings');
    expect(created).toBeTruthy();
    // The shared `locations` row gained no new columns.
    expect(Object.keys(created).sort()).toEqual(['address', 'department', 'id', 'name', 'status']);
    const meta = W.DB.tmClientMeta[created.id];
    expect(meta.contactName).toBe('Priya N');
    expect(meta.contactEmail).toBe('priya@zenith.example');
    expect(meta.reference).toBe('LIC-9931');
    expect(meta.notes).toBe('Renewal due in March.');
  });

  it('reads the saved details back into the form when you edit', () => {
    W.DB.tmClientMeta['cl_a'] = { contactName: 'Sam Rowe', contactEmail: 's@acme.example', contactPhone: '', reference: 'REF-1', notes: 'Pays late.' };
    const h = openForm('cl_a');
    expect(h).toContain('Sam Rowe');
    expect(h).toContain('REF-1');
    expect(h).toContain('Pays late.');
    W.App.closeModal();
  });
});

/* ═══ 2 — a deadline you can take back off ═══ */
describe('2 — a deadline can be removed once it is set', () => {
  it('offers a remove button beside both the date and the time', () => {
    W.App.editCl('c1');
    const h = document.body.innerHTML;
    expect(h).toContain("App._clearDeadline('date')");
    expect(h).toContain("App._clearDeadline('time')");
    W.App.closeModal();
  });

  it('clears the field and the pending value, so saving writes no deadline', () => {
    W.App.editCl('c1');
    document.getElementById('cn-ddate').value = '2026-08-01';
    document.getElementById('cn-time').value = '17:30';
    W.CLD._deadlineDate = '2026-08-01';
    W.CLD.scheduleTime = '17:30';

    W.App._clearDeadline('date');
    expect(document.getElementById('cn-ddate').value).toBe('');
    expect(W.CLD._deadlineDate).toBe(null);
    // the time is untouched — the two are independent
    expect(W.CLD.scheduleTime).toBe('17:30');

    W.App._clearDeadline('time');
    expect(document.getElementById('cn-time').value).toBe('');
    expect(W.CLD.scheduleTime).toBe(null);
    W.App.closeModal();
  });
});

/* ═══ 3 — notifications: one list, both channels, no filler ═══ */
describe('3 — every notification has an in-app and an email switch', () => {
  it('renders a row per event with both channels, straight from NOTIF_EVENTS', () => {
    W.S.route = 'settings'; W.S.filters = { stab: 'notif' };
    const h = W.settingsPage();
    W.NOTIF_EVENTS.forEach(e => {
      expect(h, e.key + ' label').toContain(W.esc(e.label));
      if (e.store !== 'hnp') {
        expect(h, e.key + ' in-app switch').toContain(`_nsTog(this,'inapp_${e.key}')`);
        expect(h, e.key + ' email switch').toContain(`_nsTog(this,'email_${e.key}')`);
      }
    });
    W.NOTIF_GROUPS.forEach(g => expect(h).toContain(W.esc(g)));
  });

  it('has no "mute a whole feature" section any more', () => {
    W.S.route = 'settings'; W.S.filters = { stab: 'notif' };
    const h = W.settingsPage();
    expect(h).not.toContain('_kindTog');
    expect(h.toLowerCase()).not.toContain('mute');
    expect(W.App._kindTog).toBeUndefined();
  });

  it('sends on both channels independently, and honours each switch', () => {
    const ana = W.uById('ana'); ana.email = 'ana@example.com'; ana.emailEnabled = true;
    W._ns.email_enabled = true;      // master delivery switch (off until an admin turns it on)
    // both on
    expect(W.evInApp('ticket_resolved')).toBe(true);
    expect(W.evEmail('ticket_resolved')).toBe(true);
    // in-app off, email still on
    W._ns.inapp_ticket_resolved = false;
    expect(W.evInApp('ticket_resolved')).toBe(false);
    expect(W.evEmail('ticket_resolved')).toBe(true);
    const before = W.DB.notifications.length;
    W.notifyEvent('ticket_resolved', 'ana', 'Ticket closed', 'tickets', {});
    expect(W.DB.notifications.length).toBe(before); // no bell row
    // master email switch beats the per-event one
    W._ns.email_enabled = false;
    expect(W.evEmail('ticket_resolved')).toBe(false);
  });

  it('an unknown event key is never silently swallowed', () => {
    expect(W.evInApp('something_new_we_forgot')).toBe(true);
  });

  it('drops the instructional filler from the checklist frequency editor', () => {
    W.App.editCl('c1');
    const h = document.body.innerHTML;
    expect(h).not.toContain('To run it on particular days only');
    expect(h).not.toContain('Runs every day.');
    expect(h).not.toContain('cn-daysel'); // Daily offers no sub-choice at all
    W.App.closeModal();
  });
});

/* ═══ 4 — All results shows what is mine ═══ */
describe('4 — "Assigned to me" in All results', () => {
  it('offers the toggle with a count of what I owe today', () => {
    W.S.uid = 'boss'; W.S.route = 'allcl';
    const h = W.allClsPage();
    expect(h).toContain('Assigned to me');
    expect(h).toContain('aclMine');
  });

  it('narrows the page to my own checklists when it is on', () => {
    W.S.uid = 'boss';
    W.S.filters = { aclMine: true, aclDate: TODAY };
    const h = W.allClsPage();
    expect(h).toContain('Bea Boss');            // c2 is assigned to boss
    expect(h).not.toContain('Ana Adams');       // c1 is Ana's, and it is not mine
    expect(h).toContain('Bright Foods');        // ...so only that client's group is shown
    expect(h).toContain('Only the checklists assigned to you');
  });

  it('shows everyone again when it is off', () => {
    W.S.uid = 'boss';
    W.S.filters = { aclDate: TODAY };
    const h = W.allClsPage();
    expect(h).toContain('Bea Boss');
    expect(h).toContain('Ana Adams');
    expect(h).toContain('Bright Foods');
    expect(h).toContain('Acme Trading');
    expect(h).toContain(W.esc("Everyone's checklists"));
  });

  it('marks my own row so I can spot it in a long list', () => {
    W.S.uid = 'boss';
    W.S.filters = { aclDate: TODAY };
    const h = W.allClsPage();
    expect(h).toMatch(/Bea Boss<span[^>]*>You</);
  });
});

/* ═══ 5 — the permission editor only offers what this build enforces ═══ */
describe('5 — permissions are dynamic and honest', () => {
  it('hides actions nothing in this build checks, without touching PERM_AREAS', () => {
    const shown = W._tmAreas();
    const emp = shown.find(a => a.key === 'employees');
    ['manageAssets', 'assign', 'manage'].forEach(x => expect(emp.actions).not.toContain(x));
    ['view', 'create', 'edit', 'resetPassword', 'assignManager', 'assignRole'].forEach(x => expect(emp.actions).toContain(x));
    expect(shown.find(a => a.key === 'checklists').actions).not.toContain('assign');
    expect(shown.find(a => a.key === 'locations').actions).not.toContain('manage');

    // the platform list itself is unchanged — role bundles still round-trip everything
    expect(W._areaByKey('employees').actions).toContain('manageAssets');
    expect(W._areaByKey('locations').actions).toContain('manage');
  });

  it('every action still offered maps to a real gate in the source', () => {
    const source = ['perms.js', 'supabase.js', 'state.js', 'ui/nav.js', 'engine/core.js', 'engine/answers.js']
      .concat(fs.readdirSync(path.join(SRC, 'pages')).map(f => 'pages/' + f))
      .map(read).join('\n');
    const missing = [];
    W._tmAreas().forEach(a => a.actions.forEach(act => {
      if (!source.includes(`can('${a.key}','${act}')`) && !source.includes(`canUser(u,'${a.key}','${act}')`)
          && !source.includes(`'${a.key}','${act}'`)) missing.push(a.key + '.' + act);
    }));
    expect(missing).toEqual([]);
  });

  it('uses this build\'s wording, not the full platform\'s', () => {
    const shown = W._tmAreas();
    expect(shown.find(a => a.key === 'locations').label).toBe('Clients');
    expect(shown.find(a => a.key === 'employees').label).toBe('People');
    expect(shown.find(a => a.key === 'employees').desc).not.toMatch(/asset/i);
  });

  it('saving a role keeps the toggles the editor never showed', () => {
    W.DB.roleProfiles.testrole = { id: 'testrole', name: 'Test', description: '', builtin: false, _v: '3',
      perms: { employees: { scope: 'team', actions: { view: true, manageAssets: true } },
               payroll:   { scope: 'none', actions: { view: true, run: true } } } };
    W.App._rpEdit('testrole');
    W.App._rpT('employees', 'edit');       // one visible change
    W.App._rpSave();
    const saved = W.DB.roleProfiles.testrole;
    expect(saved.perms.employees.actions.edit).toBe(true);
    expect(saved.perms.employees.actions.manageAssets).toBe(true); // hidden action survived
    expect(saved.perms.payroll.actions.run).toBe(true);            // hidden area survived
  });

  it('"all off" for a group never strips a platform-only action', () => {
    W.DB.roleProfiles.testrole = { id: 'testrole', name: 'Test', description: '', builtin: false, _v: '3',
      perms: { employees: { scope: 'team', actions: { view: true, manageAssets: true } } } };
    W.App._rpEdit('testrole');
    W.App._rpGroupSet('People & Org', false);
    W.App._rpSave();
    expect(W.DB.roleProfiles.testrole.perms.employees.actions.view).toBe(false);
    expect(W.DB.roleProfiles.testrole.perms.employees.actions.manageAssets).toBe(true);
  });

  it('the sync gates use actions a role can actually grant', () => {
    const sync = read('supabase.js');
    expect(sync).not.toContain("can('questions','manage')");
    expect(sync).not.toContain("can('tickets','manage')");
    expect(sync).toContain("can('questions','create')");
  });

  it('the office scope is gone but an old bundle still reads back', () => {
    expect(W.SCOPE_CHOICES).not.toContain('location');
    expect(W.SCOPE_ORDER).toContain('location'); // resolution unchanged
  });
});

/* ═══ 6 — the approval toggle is gone from a question ═══ */
describe('6 — questions no longer ask for approval', () => {
  it('does not offer the toggle in the editor', () => {
    W.App._editQuestion(null);
    const h = document.body.innerHTML;
    expect(h).not.toContain("togRow('approval'");
    expect(h).not.toContain('_QED.approval');
    W.App.closeModal();
  });

  it('still round-trips the column, so the full platform keeps its value', () => {
    const src = read('pages/questions.js');
    expect(src).toContain('approval');           // still written on save / CSV
    const sync = read('supabase.js');
    expect(sync).toContain('approval:q.approval');
  });
});

/* ═══ 7 — one filter bar everywhere ═══ */
describe('7 — every list page renders the same filter row', () => {
  const PAGES = ['pages/checklists.js', 'pages/allchecklists.js', 'pages/teamview.js',
                 'pages/tickets.js', 'pages/locations.js', 'pages/users.js',
                 'pages/questions.js', 'pages/audit.js'];

  it('uses the shared primitives rather than a hand-rolled row', () => {
    PAGES.forEach(p => {
      const s = read(p);
      expect(s, p + ' should call filterBar()').toMatch(/filterBar\(/);
      // nobody re-declares the bar or the control size locally any more
      expect(s, p + ' should not hard-code the bar style').not.toContain('align-items:center;padding:10px 12px;margin-bottom:1');
      expect(s, p + ' should not re-declare a select style').not.toMatch(/_?selSt\s*=\s*'font-size/);
    });
  });

  it('renders that row for real on each page', () => {
    W.S.uid = 'boss'; W.S.filters = {};
    const pages = { checklists: W.clsPage, allcl: W.allClsPage, tickets: W.ticketsPage,
                    locations: W.locsPage, users: W.usersPage, questions: W.questionsPage, audit: W.auditPage };
    Object.entries(pages).forEach(([name, fn]) => {
      W.S.route = name;
      const h = fn();
      expect(h, name + ' should render the shared filter bar').toContain(W.FILTER_BAR_ST);
    });
  });
});

/* ═══ 8 — the Client rename reaches every corner ═══ */
describe('8 — nothing user-facing still says "location"', () => {
  it('has no stray Location wording left in the pages', () => {
    const files = fs.readdirSync(path.join(SRC, 'pages')).map(f => 'pages/' + f).concat(['ui/helpers.js', 'ui/nav.js']);
    const offenders = [];
    files.forEach(f => {
      read(f).split('\n').forEach((line, i) => {
        // only user-visible strings: skip identifiers, table names, storage buckets, comments
        const m = line.match(/>[^<>]{0,80}\bLocations?\b[^<>]{0,80}</);
        if (m && !line.trim().startsWith('//') && !line.includes('tm-location-docs')) offenders.push(`${f}:${i + 1} ${m[0].slice(0, 60)}`);
      });
    });
    expect(offenders).toEqual([]);
  });
});
