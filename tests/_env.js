/* Test environment: recreate the classic-script global world the app expects.
   Stubs the CDN libs (supabase, Chart), then imports every module in the exact
   main.js order — but NOT the boot block, so no network/session code runs. */

function chain() {
  return new Proxy(function () {}, {
    get(_t, k) {
      // .then(cb) must stay chainable (`.then(...).catch(...)` is used by _pushRow/log/etc.),
      // so invoke the callback but return another chain — like a real promise returns a promise.
      if (k === 'then') return (res) => { try { res({ data: [], error: null }); } catch (e) {} return chain(); };
      if (k === 'catch') return () => chain();
      return () => chain();
    },
    apply() { return chain(); },
  });
}

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({}),
      refreshSession: async () => ({ data: {}, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: {}, error: { message: 'stub' } }),
    },
    from: () => chain(),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() {},
    storage: { from: () => ({ upload: async () => ({ data: {}, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }), remove: async () => ({}) }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
  }),
};
window.Chart = class { constructor() {} destroy() {} update() {} static register() {} };
window.tailwind = {};

// import order mirrors src/main.js (without ./styles.css and without the boot block)
const order = [
  '../src/ui/helpers.js', '../src/supabase.js', '../src/state.js', '../src/perms.js',
  '../src/engine/notifications.js', '../src/engine/core.js', '../src/engine/answers.js',
  '../src/ui/nav.js', '../src/ui/charts.js',
  '../src/pages/login.js', '../src/pages/dashboard.js', '../src/pages/users.js',
  '../src/pages/departments.js',
  '../src/pages/locations.js', '../src/pages/documents.js', '../src/pages/checklists.js', '../src/pages/mychecklists.js',
  '../src/pages/teamview.js', '../src/pages/allchecklists.js', '../src/pages/approvals.js',
  '../src/pages/questions.js', '../src/pages/notifications.js', '../src/pages/hierarchy.js',
  '../src/pages/tickets.js', '../src/pages/analytics.js', '../src/pages/audit.js', '../src/pages/profile.js',
  '../src/pages/settings.js', '../src/pages/accesscontrol.js',
];
for (const m of order) await import(m);

/* shared seeding helper for tests */
window.__mkUser = (over = {}) => Object.assign({
  id: 'u' + Math.random().toString(36).slice(2, 8),
  firstName: 'T', lastName: 'U', email: 't@u.com', phone: '', position: 'Staff',
  department: 'Ops', status: 'Active', managerId: null,
  rules: { past: true, future: true, edit: true },
  approval: { past: false, future: false, edited: false },
  docAccess: { departments: {}, locations: {} }, questionsAccess: false,
  emailEnabled: false, cities: [], password: '***',
}, over);
