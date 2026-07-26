/* This round's changes: ticket-resolved notifications, the Client rename and filters,
   the password eye, the Settings consolidation, and Daily meaning every day. */
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
  W.DB.tmFolders = []; W.DB.tmDocuments = [];
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

  W.DB.locations.push(
    { id: 'cl_a', name: 'Acme Trading', address: 'Downtown', department: '', status: 'Active' },
    { id: 'cl_b', name: 'Bright Foods', address: 'Marina', department: '', status: 'Active' },
  );
  W.DB.questions.push({ id: 'q1', text: 'Docs filed?', type: 'yesno', options: [], photo: false, approval: false, comment: false, isPublic: true, department: '', subDepartment: '', createdBy: 'boss', createdAt: TODAY });
  const mk = (id, name, locIds, assignees) => ({ id, name, description: '', department: 'Ops',
    frequency: 'Daily', schedule: 'Every day', selectedDays: [], selectedDates: [], customDates: [],
    locationIds: locIds, assignees, tasks: [], questionIds: ['q1'], questionConfigs: {},
    scheduleTime: null, status: 'Active', anyOne: false, createdBy: 'boss' });
  W.DB.checklists.push(mk('c1', 'Acme onboarding', ['cl_a'], ['ana']), mk('c2', 'Bright renewals', ['cl_b'], ['ben']));
  W.log = () => {};
  W._ns = W._nsDefault();
  W.S.uid = 'boss';
}
beforeEach(seed);

describe('1 — the person who raised a ticket hears when it is resolved', () => {
  function raise(by, over) {
    const t = Object.assign({ id: 'tk1', title: 'Portal down', description: '', priority: 'High',
      status: 'Open', assignedTo: 'boss', createdBy: by, submitterId: by, checklistId: null,
      date: TODAY, createdAt: new Date().toISOString(), viewedBy: [] }, over || {});
    W.DB.tickets.push(t); return t;
  }
  const notesFor = (uid) => W.DB.notifications.filter(n => n.userId === uid);

  it('notifies them when it is resolved from the modal', () => {
    raise('ana');
    W.S.uid = 'boss';
    document.body.insertAdjacentHTML('beforeend', '<textarea id="tk-note">swapped the router</textarea>');
    W.App._confirmResolve('tk1');
    document.getElementById('tk-note').remove();
    const n = notesFor('ana');
    expect(n.length).toBe(1);
    expect(n[0].text).toContain('Resolved');
    expect(n[0].text).toContain('Portal down');
    expect(n[0].text).toContain('swapped the router');
    expect(n[0].kind).toBe('ticket');
  });

  it('notifies them when the status is changed straight from the dropdown', () => {
    raise('ana');
    W.S.uid = 'boss';
    W.App._ticketStatus('tk1', 'Resolved');
    expect(notesFor('ana').length).toBe(1);
    expect(notesFor('ana')[0].text).toContain('Resolved');
  });

  it('notifies on reopen too, and never notifies the person doing it', () => {
    raise('ana');
    W.S.uid = 'boss';
    W.App._ticketStatus('tk1', 'Resolved');
    W.App._ticketStatus('tk1', 'Open');
    const n = notesFor('ana');
    expect(n.length).toBe(2);
    expect(n[0].text).toContain('Reopened');
    expect(notesFor('boss').length).toBe(0);
  });

  it('reaches BOTH the raiser and the original submitter of an escalated ticket', () => {
    // an escalation opens the ticket "as" the person whose answer failed
    raise('ana', { createdBy: 'ana', submitterId: 'ben' });
    W.S.uid = 'boss';
    W.App._ticketStatus('tk1', 'Resolved');
    expect(notesFor('ana').length).toBe(1);
    expect(notesFor('ben').length).toBe(1);
  });

  it('says nothing when the status has not actually changed', () => {
    raise('ana');
    W.S.uid = 'boss';
    W.App._ticketStatus('tk1', 'Open');
    expect(notesFor('ana').length).toBe(0);
  });
});

describe('2 — Locations read as Clients, and people are no longer assigned an office', () => {
  it('the nav entry and permission label say Client', () => {
    W.S.uid = 'boss';
    expect(W.HUB_DEF.admin.tabs.find(t => t[0] === 'locations')[1]).toBe('Clients');
    expect(W.NAV_ITEMS.find(n => n[0] === 'locations')[2]).toBe('Clients');
    expect(W.PERM_AREAS.find(a => a.key === 'locations').label).toBe('Clients');
  });

  it('the page header and empty state say Client', () => {
    W.S.uid = 'boss'; W.S.route = 'locations'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('Clients');
    expect(html).not.toContain('Physical sites');
  });

  it('the user editor no longer offers an office field', () => {
    W.S.uid = 'boss';
    W.App.editUser('ana');
    const m = document.getElementById('modal');
    expect(m.innerHTML).not.toContain('u-loc');
    expect(m.innerHTML).not.toContain('Office location');
    W.App.closeModal();
  });

  it('saving a user keeps their stored blob intact even though the field is gone', () => {
    const ana = W.uById('ana');
    ana.hrm.locationId = 'cl_a';
    ana.hrm.salary = { basic: 5000, currency: 'AED' };
    const out = W._readHrmFromForm(ana.hrm);
    expect(out.locationId).toBe('cl_a');   // untouched, not wiped
    expect(out.salary.basic).toBe(5000);
  });

  it('the office scope is not offered any more, but a stored one still reads back', () => {
    expect(W.SCOPE_CHOICES).not.toContain('location');
    expect(W.SCOPE_ORDER).toContain('location');           // resolver still understands it
    expect(W._scopeOpts('location')).toContain('selected'); // and the editor shows it if set
    expect(W._scopeOpts('team')).not.toContain('>Their office<');
  });
});

describe('3 — password fields have a show/hide eye', () => {
  it('renders an eye button next to a password input', () => {
    const html = W.fldPw('New password', 'pw-x', '', 'Set a password');
    expect(html).toContain('type="password"');
    expect(html).toContain("App._togPw('pw-x'");
    expect(html).toContain('Show password');
  });

  it('the toggle flips the input type both ways', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="pwwrap">' + W.fldPw('P', 'pw-x', '', '') + '</div>');
    const input = document.getElementById('pw-x');
    const btn = document.querySelector('#pwwrap button');
    expect(input.type).toBe('password');
    W.App._togPw('pw-x', btn);
    expect(input.type).toBe('text');
    expect(btn.getAttribute('aria-label')).toBe('Hide password');
    W.App._togPw('pw-x', btn);
    expect(input.type).toBe('password');
    document.getElementById('pwwrap').remove();
  });

  it('both the create-user and reset-password forms use it', () => {
    W.S.uid = 'boss';
    W.App.editUser();                       // new user
    expect(document.getElementById('modal').innerHTML).toContain("App._togPw('u-pw'");
    W.App.closeModal();
    W.App.resetPw('ana');
    expect(document.getElementById('modal').innerHTML).toContain("App._togPw('rp-pw'");
    W.App.closeModal();
  });
});

describe('4 — every list can be filtered by Client', () => {
  it('the shared filter renders one option per client', () => {
    const html = W.clientFilter('xClient');
    expect(html).toContain('All clients');
    expect(html).toContain('Acme Trading');
    expect(html).toContain('Bright Foods');
  });

  it('resolves a ticket to its client through the checklist it came from', () => {
    const t = { id: 'tk9', checklistId: 'c1' };
    expect(W.clientIdsOfTicket(t)).toEqual(['cl_a']);
    expect(W.matchesClient(W.clientIdsOfTicket(t), 'cl_a')).toBe(true);
    expect(W.matchesClient(W.clientIdsOfTicket(t), 'cl_b')).toBe(false);
    expect(W.matchesClient(W.clientIdsOfTicket(t), '')).toBe(true); // no filter = everything
  });

  it('filters the checklist builder', () => {
    W.S.uid = 'boss'; W.S.route = 'checklists';
    W.S.filters = { clbClient: 'cl_a' };
    const html = W.pageContent();
    expect(html).toContain('Acme onboarding');
    expect(html).not.toContain('Bright renewals');
  });

  it('filters the tickets list', () => {
    W.DB.tickets.push(
      { id: 't1', title: 'Acme issue', description: '', priority: 'Low', status: 'Open', assignedTo: 'ana', createdBy: 'ana', submitterId: 'ana', checklistId: 'c1', date: TODAY, createdAt: new Date().toISOString(), viewedBy: [] },
      { id: 't2', title: 'Bright issue', description: '', priority: 'Low', status: 'Open', assignedTo: 'ben', createdBy: 'ben', submitterId: 'ben', checklistId: 'c2', date: TODAY, createdAt: new Date().toISOString(), viewedBy: [] },
    );
    W.S.uid = 'boss'; W.S.route = 'tickets';
    W.S.filters = { tkClient: 'cl_b' };
    const html = W.pageContent();
    expect(html).toContain('Bright issue');
    expect(html).not.toContain('Acme issue');
  });

  it.skip('filters the team picker to people who work that client (retired: Team filter removed in round 6)', () => {
    W.S.uid = 'boss'; W.S.route = 'teamview'; W.S.tvUser = null;
    W.S.filters = { tvClient: 'cl_a' };
    const html = W.pageContent();
    expect(html).toContain('Ana');
    expect(html).not.toContain('Ben Blake');
  });

  it('offers the filter on the Clients page itself and narrows by search', () => {
    W.S.uid = 'boss'; W.S.route = 'locations';
    W.S.filters = { clQ: 'bright' };
    const html = W.pageContent();
    expect(html).toContain('Bright Foods');
    expect(html).not.toContain('Acme Trading');
  });
});

describe('5 — Settings shows each switch once', () => {
  it('has two tabs, none of them a duplicate channel list', () => {
    W.S.uid = 'boss'; W.S.route = 'settings'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('>Notifications<');
    expect(html).toContain('>Templates<');
    expect(html).not.toContain('>Data<');   // export/clear/reset removed on request
    expect(html).not.toContain('>In-App<');
    expect(html).not.toContain('>HR Email<');
    expect(html).not.toContain('>Feature switches<');
  });

  it('renders one row per event with an in-app and an email switch', () => {
    W.S.uid = 'boss'; W.S.route = 'settings'; W.S.filters = {};
    const html = W.pageContent();
    // each event name appears exactly once as a row label
    ['Checklist assigned', 'Approval needed', 'Ticket resolved'].forEach(label => {
      expect(html.split('>' + label + '<').length - 1).toBe(1);
    });
    expect(html).toContain("App._nsTog(this,'inapp_checklist_assigned')");
    expect(html).toContain("App._nsTog(this,'email_checklist_assigned')");
  });

  it.skip('routes the announcement row to the store that actually owns it (retired: announcements removed)', () => {
    W.S.uid = 'boss'; W.S.route = 'settings'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain("App._hnpTog(this,'inapp_announcement')");
    expect(html).toContain("App._hnpTog(this,'email_announcement')");
  });

  it('a stale sub-tab from the old layout still lands somewhere real', () => {
    W.S.uid = 'boss'; W.S.route = 'settings';
    ['inapp', 'email', 'hrmemail', 'workflow'].forEach(t => {
      W.S.filters = { stab: t };
      const html = W.pageContent();
      expect(html).toContain('>Notifications<');
    });
  });
});

describe('7 — Daily means every day', () => {
  it('the builder no longer offers a weekday sub-choice under Daily', () => {
    W.S.uid = 'boss';
    W.App.editCl('c1');
    const m = document.getElementById('modal');
    expect(m.innerHTML).not.toContain('Selected weekdays');
    expect(m.innerHTML).not.toContain('cn-daysel');   // the weekday picker is gone entirely
    W.App.closeModal();
    expect(typeof W.App._dailySched).toBe('undefined');
  });

  it('a Daily checklist runs on every day of the week', () => {
    const c = W.clById('c1');
    for (let i = 0; i < 7; i++) expect(W.clOn(c, W._isoAdd(TODAY, i))).toBe(true);
  });

  it('a checklist saved by an older build with a weekday list is still honoured', () => {
    const c = W.clById('c1');
    c.schedule = 'Selected weekdays';
    c.selectedDays = [W.dayAbbr(TODAY)];
    expect(W.clOn(c, TODAY)).toBe(true);
    expect(W.clOn(c, W._isoAdd(TODAY, 1))).toBe(false);
  });

  it('re-saving it normalises the leftover half-state away', () => {
    W.S.uid = 'boss';
    W.App.editCl('c1');
    W.CLD.schedule = 'Selected weekdays';
    W.CLD.selectedDays = ['Mon'];
    W.App._saveCl(true);
    const c = W.clById('c1');
    expect(c.schedule).toBe('Every day');
    expect(c.selectedDays).toEqual([]);
  });
});
