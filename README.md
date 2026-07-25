# Evarca — Task Management

The task-management slice of Evarca, extracted as a standalone deployable app for a client who
only needs this feature set. Same stack (Vite + vanilla JS), **same Supabase project and same
login accounts** as the full Evarca deployment.

## What's in it

| Area | Routes |
|---|---|
| **Dashboard** | My Day (`dashboard`) · Company (`analytics`) |
| **My Checklists** | `mychecklists` — day strip, submit, edit requests |
| **Checklists** | Builder (`checklists`) · All results (`allcl`) · Team (`teamview`) |
| **Questions** | `questions` — the reusable question bank + escalation rules |
| **Tickets** | `tickets` — raised by people or auto-created from a failing answer |
| **Announcements** | `announcements` |
| **Inbox** | Alerts (`notifications`) · Approvals (`approvals`) |
| **People** | Directory + user creation (`users`) · Hierarchy (`hierarchy`) |
| **Administration** | Settings (`settings`) · Access Control (`accesscontrol`) · Departments · Locations · Audit |

## What's not in it

Attendance, Leave, Payroll, Shifts, Overtime, Discipline, Lifecycle flows, Letters, Surveys,
Performance reviews, OKRs, HR Config and the Documents module. Their page modules and engines are
not in `src/` at all — this is a smaller app, not the full one with tabs hidden.

Old deep links still work: `#attendance`, `#payroll`, `#okr` and friends land on the dashboard
instead of a blank page (`_RETIRED_ROUTES` in `src/ui/nav.js`).

## Commands

```
npm install       # install dependencies
npm run dev       # local dev server
npm run build     # production build into dist/
npm test          # the route sweep + reference audit (115 assertions)
```

## Deploying

Push this folder to a Git repo and point Vercel (or Netlify / any static host) at it — build
command `npm run build`, output directory `dist`. `vercel.json` carries the security headers and a
CSP whose `connect-src` already allows the Supabase project below.

Browser tabs that are already open keep running the OLD bundle until a full refresh — hard-refresh
(Cmd/Ctrl+Shift+R) after a deploy before judging anything.

## Database

Points at Supabase project `emzgwkvkgojcaqngkatw` — the same one the full Evarca app uses. No
migration is needed: this app reads and writes a subset of the existing tables. Both apps can run
side by side against it.

`VITE_SB_URL` / `VITE_SB_ANON` override the target at build time if you ever need a separate
project (see `.env.example`).

### Tables this app touches

**Reads and writes:** `profiles`, `departments`, `locations`, `checklists`, `submissions`,
`approvals`, `questions`, `tickets`, `notifications`, `feedback`, `announcements`, `drafts`,
`audit_logs`, `notif_outbox`, `user_hrm`, `workspace_settings`.

**Never written:** `attendance`, `leave_requests`, `leave_balances`, `leave_types`, `holidays`,
`shifts`, `payroll_runs`, `payroll_items`, `okrs`, `okr_checkins`, `okr_logs`, `flows`, `letters`,
`discipline`, `overtime`, `surveys`, `survey_answers`, `review_cycles`, `review_answers`,
`documents`, `doc_folders`, `expenses`. A test asserts this (`tests/routes.test.js`), because the
database is shared and a stale whole-table upsert from this app could otherwise clobber HR data.

The one exception is deleting a person: that cascade is deliberately complete, since the
`profiles` row is going away and half-deleted records would be worse than none.

### Three places the shared database needs care

These are the spots where this app touches state the wider platform also owns. Each is defended in
code, and each has a test.

1. **`workspace_settings.role_profiles`** — the permission bundles. Access Control here renders only
   the task-management areas (`TM_AREAS` in `src/perms.js`), but `PERM_AREAS` deliberately keeps the
   full platform list, and saving a role copies through every toggle the editor never showed. Edit a
   role here and its Payroll/Leave switches survive untouched.

2. **`hrm_config`** — the notification switches live on this shared row. This app sends a targeted
   `update` of the `extras` column only, round-tripping the fields it doesn't own (branding, alert
   thresholds, flow and letter templates) verbatim. It also refuses to write at all until it has
   successfully read the row, so a failed load can never overwrite live config with defaults.

3. **`user_hrm`** — the per-user blob. The user editor here shows three directory fields (date of
   birth, joining date, office location); saving spreads the stored blob and overwrites only those,
   so salary, schedule, probation and permission overrides are carried through as-is.

## How the code is organised

Classic-script style modules under `src/` (`engine/`, `pages/`, `ui/`). Every module
window-attaches its top-level functions at the end of the file (`window.foo=foo`); cross-file
references resolve via `window` at call time.

**Rule: any new top-level function a page needs must be added to that file's window-attach block.**

Key modules:

- `src/perms.js` — the permission resolver: `can(area,action)`, `scopeOf(area)`, `scopeFilter(area)`
  → none/self/team/department/location/everyone. Roles live in `DB.roleProfiles`; per-user overrides
  in `u.hrm.perms` beat roles; only the Super Admin is universal.
- `src/supabase.js` — boot loader `loadFromSB`, the debounced 1.5s `_sync()` batch, targeted
  `_pushRow`/`_delRow` writes, `_lazyLoad`/`_lazyCold` per-tab loaders, tombstone arrays
  (`*_deleted`) against resurrection, and the realtime channel.
- `src/engine/notifications.js` — `notify()`, the per-feature in-app/email gates (`_inappOn`) and
  the config seeds.
- `src/engine/core.js` — the helpers the removed HR modules used to own: the in-app notification
  helper, the notification-preference store, the local activity log, the approval inbox model and a
  few formatters.

Charts: Chart.js v4, bundled. **Never replace `Chart.defaults` nested objects** — mutate
property-by-property only; replacing them breaks v4's resolver descriptors and every chart blanks on
hover. Theme lives in `src/ui/charts.js`.

## Tests

`npm test` runs 115 assertions in two files:

- **`tests/routes.test.js`** — renders every route for Super Admin, Manager and Employee; checks the
  retired routes redirect; audits every inline `onclick` handler across every route and every
  admin-openable modal for references to functions this build removed; asserts `_sync` never targets
  an HR table and that the shared-config write is refused before a read.
- **`tests/static-refs.test.js`** — reads the source and resolves every `App.*` and module-level call
  site against the loaded app, which catches branches the route sweep never rendered.

Both matter more than usual here, because cross-file references resolve through `window` at call
time — `vite build` will happily build an app whose buttons throw when clicked.
