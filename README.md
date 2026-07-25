# Evarca — Task Management

The task-management slice of Evarca, extracted as a standalone deployable app for a client who
only needs this feature set. Same stack (Vite + vanilla JS), **same Supabase project and same
login accounts** as the full Evarca deployment.

## What's in it

| Area | Routes |
|---|---|
| **Dashboard** | My Day (`dashboard`) · Company (`analytics`) |
| **My Checklists** | `mychecklists` — day strip, per-question submit, per-answer edit requests |
| **Checklists** | Builder (`checklists`) · All results (`allcl`) · Team (`teamview`) |
| **Questions** | `questions` — the reusable question bank + escalation rules |
| **Tickets** | `tickets` — raised by people or auto-created from a failing answer |
| **Announcements** | `announcements` |
| **Inbox** | Alerts (`notifications`) · Approvals (`approvals`) |
| **People** | Directory + user creation (`users`) · Hierarchy (`hierarchy`) |
| **Administration** | Settings (`settings`) · Access Control (`accesscontrol`) · Departments · **Clients** (`locations` — table, filters, folders + documents) · Audit |

## How a checklist run works

This build treats a run as **one shared thing per checklist per day**, not one per person.

1. **Each question has its own Submit button.** Answer it, press Submit, and that answer is
   saved and locked with the name of whoever submitted it and the time they did.
2. **Different people can answer different questions in the same run.** The card header shows
   who has contributed so far and how many answers are in.
3. **The checklist can only be submitted once every question has a submitted answer.** Until
   then the button is disabled and says how many are left.
4. **Changing a submitted answer needs a manager.** "Request edit" on that answer goes to the
   Approvals inbox; approving unlocks *that one answer* for another go — the rest of the run is
   untouched. Someone holding Checklists → Approve can also unlock directly, no request needed.
5. **Submitting closes the run for everyone** assigned, and writes the normal `submissions` row,
   so approvals, analytics and CSV export keep working unchanged. Each response in that row also
   carries `answeredBy` / `answeredAt`.

Deadlines are **date and time, both optional**. A time alone is the daily cut-off; a date alone
pins it to that calendar day; both together give an exact moment; neither means it is never
marked late.

Frequency **Daily** means every day. It used to also offer "Selected weekdays", which was the
same thing as Weekly under a second name — that is gone, and picking particular days is what
Weekly is for. A checklist saved by an older build with a weekday list is still honoured until
it is re-saved, so nothing silently changes schedule.

## Clients

What used to be called Locations is now **Clients** throughout the UI. The `locations` table and
the `locations` permission key are unchanged, so nothing moved in the database — only the labels.

- A client is attached to a **checklist** (`locationIds`). Everything else — a submission, a
  ticket, an answer — reaches its client through the checklist it belongs to.
- Every list can be filtered by client: the checklist builder, All results, Team, Tickets and the
  Company dashboard.
- People are **no longer assigned to an office**. That field is gone from the user editor, and
  the "their office" permission scope is no longer offered (a bundle that already has it still
  reads back correctly rather than silently changing). One consequence worth knowing: the Users
  directory has no client filter, because a person is no longer linked to one — they are linked
  to the checklists they work on.
- Each client holds its own folders and documents under its Documents tab.

## What's not in it

Attendance, Leave, Payroll, Shifts, Overtime, Discipline, Lifecycle flows, Letters, Surveys,
Performance reviews, OKRs and HR Config. Their page modules and engines are not in `src/` at all —
this is a smaller app, not the full one with tabs hidden.

Employee-performance tables and charts are gone too, on purpose: the dashboard is about the state
of the **work** — which checklists are running, how far through they are, which are late. The
per-answer name and timestamp already record who did what without turning it into a scoreboard.

Old deep links still work: `#attendance`, `#payroll`, `#okr` and friends land on the dashboard
instead of a blank page (`_RETIRED_ROUTES` in `src/ui/nav.js`).

## Commands

```
npm install       # install dependencies
npm run dev       # local dev server
npm run build     # production build into dist/
npm test          # route sweep + reference audit + behaviour tests (168 assertions)
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

**New tables this build added** (all prefixed `tm_`, nothing existing was altered):

| Table | What it holds |
|---|---|
| `tm_answers` | one row per (checklist, date, question) — the answer, who submitted it, when, and whether it is locked |
| `tm_answer_edits` | a request to change one submitted answer, and its decision |
| `tm_checklist_meta` | the optional deadline **date** (the optional deadline time keeps living on `checklists.schedule_time`, which already means exactly that) |
| `tm_folders` | folders under a location |
| `tm_documents` | files under a location, pointing at the storage bucket |

**New storage buckets:** `tm-location-docs` (private, 25 MB cap, served via 5-minute signed URLs)
and `tm-answer-photos` (public-read with unguessable paths, 10 MB cap, so answer thumbnails render
without a signed-URL round trip per image).

**Existing tables it reads and writes:** `profiles`, `departments`, `locations`, `checklists`,
`submissions`, `approvals`, `questions`, `tickets`, `notifications`, `feedback`, `announcements`,
`drafts`, `audit_logs`, `notif_outbox`, `user_hrm`, `workspace_settings`.

**Never written:** `attendance`, `leave_requests`, `leave_balances`, `leave_types`, `holidays`,
`shifts`, `payroll_runs`, `payroll_items`, `okrs`, `okr_checkins`, `okr_logs`, `flows`, `letters`,
`discipline`, `overtime`, `surveys`, `survey_answers`, `review_cycles`, `review_answers`,
`documents`, `doc_folders`, `expenses`. A test asserts this (`tests/routes.test.js`), because the
database is shared and a stale whole-table upsert from this app could otherwise clobber HR data.
Note `documents` / `doc_folders` are the *old* document tables — this build's location documents
live in the new `tm_` tables instead and leave those alone.

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
- `src/engine/answers.js` — the shared run: submitting one answer, requesting and deciding an edit,
  the deadline helpers, and the loaders for the `tm_` tables.
- `src/pages/documents.js` — folders and files under a location, including the upload/download path
  through the private bucket.

### RLS worth knowing about

`tm_answers` is where the real enforcement lives, and it is not just client-side:

- **Insert** requires `submitted_by = auth.uid()` — you cannot file an answer under someone
  else's name, which is the whole point of stamping them.
- **Update** requires the row to be *unlocked*, or the caller to be a checklist approver, an
  admin, or the answerer's own manager. That is what stops one colleague quietly rewriting
  another's submitted answer even via the raw API.
- The `WITH CHECK` clause is stated separately from `USING`. Postgres reuses `USING` for the new
  row when `WITH CHECK` is omitted, which would have rejected the perfectly legitimate act of
  re-locking an answer after an approved edit.

Charts: Chart.js v4, bundled. **Never replace `Chart.defaults` nested objects** — mutate
property-by-property only; replacing them breaks v4's resolver descriptors and every chart blanks on
hover. Theme lives in `src/ui/charts.js`.

## Tests

`npm test` runs 168 assertions in four files:

- **`tests/routes.test.js`** — renders every route for Super Admin, Manager and Employee; checks the
  retired routes redirect; audits every inline `onclick` handler across every route and every
  admin-openable modal for references to functions this build removed; asserts `_sync` never targets
  an HR table and that the shared-config write is refused before a read.
- **`tests/static-refs.test.js`** — reads the source and resolves every `App.*` and module-level call
  site against the loaded app, which catches branches the route sweep never rendered.
- **`tests/answers.test.js`** — the behaviour of the new flows: two people answering different
  questions in one run, the submit gate refusing a half-finished run, a colleague being unable to
  decide someone's edit request while their manager can, an unlocked answer re-locking with the
  new value and the old one preserved on the request, all four deadline combinations, and the
  location folder tree.
- **`tests/round3.test.js`** — ticket-resolved notifications reaching the raiser from both the
  modal and the status dropdown, the Client rename and filters, the password eye, the Settings
  consolidation (including that a stale sub-tab link still lands somewhere real), and Daily
  meaning every day.

Both matter more than usual here, because cross-file references resolve through `window` at call
time — `vite build` will happily build an app whose buttons throw when clicked.
