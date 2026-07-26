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
| **Inbox** | Alerts (`notifications`) · Approvals (`approvals`) |
| **People** | Directory + user creation (`users`) · Hierarchy (`hierarchy`) |
| **Administration** | Settings (`settings`) · Access Control (`accesscontrol`) · Departments · **Clients** (`locations` — table, filters, folders + documents) · Audit |

## How a checklist run works

**"Any one assignee can complete" decides the run model** (`isShared` in `src/ui/helpers.js`):

- **Toggle ON, or any One-time client case** → a SHARED run, described below.
- **Toggle OFF** → an INDIVIDUAL run: every assignee fills in and submits their **own copy** —
  plain inputs, one Submit button, a teammate's submission never closes yours. No per-question
  submit, no shared locks, no waiting-status chips (those are shared-run concepts). Escalations
  still fire from each person's own submission.

A shared run is **one thing per checklist per run**, not one per person.

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

## Cases (One-time checklists)

A business-setup engagement is a **case**, not a repeating run: it opens once, stays open across
days until every question is answered and it is submitted, then it closes. Pick frequency
**"One-time — a client case"** in the builder.

- All of a case's answers live on ONE run date (its start date), so progress **accumulates day
  after day** instead of resetting at midnight. Every page reads a case through that anchor, so
  My Checklists, All results, Team and the client file all show the same run whichever calendar
  day is selected.
- The **deadline is final**: one date (and optional time). An open case past it is overdue, and
  the creator plus every assignee's manager are told once a day. A case with no deadline is
  never late.
- Once answers exist, the start date is locked (moving it would orphan the recorded answers).
- **Templates**: "Save as template" in the editor keeps the question list; creating a new
  checklist then offers "Start from a template" — new client case in seconds. Templates live in
  the new `tm_templates` table.

Every question on an open run also carries a **working status** the team sets with one tap:
*In progress*, *Waiting on client*, *Waiting on authority* (tap again to clear; submitting the
answer is what makes it Done). Waiting badges show **days waiting** everywhere. After 3 days
waiting on a client, whoever created the checklist gets a daily alert (`waiting_client_stale`
in Settings, both channels). Statuses live in the new `tm_q_status` table.

## The client file

Open a client and it lands on **Progress** — the screen that answers the phone call:

- contact details, then every **open case**: progress bar, deadline (overdue in red), each step
  with ✓ + who + when, the **NEXT UP** marker, waiting badges with day counts;
- a **"Waiting on someone"** card sorted by days stuck, with a **Nudge** button that emails the
  client's contact about exactly that item (queued via `notif_outbox`, recorded in `tm_nudges`
  so "we chased on the 4th and the 7th" is on file);
- recurring work for that client and its today-status; completed cases with completion dates.

The Clients table carries a **Case progress** column (open cases · average % · blocked count).

## The client status link

The feature that kills the "any update?" call: **Create link** on the client's Progress tab makes
a page at `#status/<token>` the client can open any time — no login. It shows each
case's progress bar, target date, step list with done ticks and dates, and a highlighted
**"We're waiting on you for:"** box — since round 8 with **days-and-hours counts** ("waiting
2d 5h"). It never shows who on the team did what, and never per-step costs.
Revoke kills the link instantly. Server side it is one SECURITY DEFINER RPC
(`tm_client_status_v2`) callable by `anon`; the token — checked against the `tm_share_links`
table — is the whole key, and an invalid or revoked token gets a friendly dead-link page.
(The original `tm_client_status` RPC is still deployed untouched; only this app moved to v2.)

### The link is two-way now (round 8)

If a step is **Waiting on client** and the link's *Can respond & upload* switch is on (it is by
default), that step carries a **Respond** box right on the status page. The client can write a
reply, attach up to 6 documents (25 MB each), or press **"Just confirm"**. Server side it is one
SECURITY DEFINER RPC (`tm_client_respond`) plus one anon storage policy that only accepts
uploads under `client-uploads/<their-own-live-token>/…` in the private docs bucket. When they
respond:

- uploaded files are registered under the client's **Documents tab, in a "From client" folder**;
- the **waiting-on-client flag clears instantly**, timestamped — the run card and client file
  show a blue **CLIENT REPLIED <n>h ago** chip instead, and the client sees "SENT <date> ✓";
- the checklist's **creator and every assignee are notified** (`client_responded` — a real event
  in Settings with both channels; the RPC honours the switches server-side);
- a second respond on the same step is refused (`not_waiting`) until the team marks it waiting
  again — responses are one answer per ask, on file forever in `tm_client_replies` and on the
  client file's **"From the client"** card.

Two more per-link switches decide what else the client sees (both **off** by default):
**Open tickets** (titles and statuses only, never assignees) and **Billing summary**
(Total / Paid / Balance due only — never per-question costs).

## Billing & invoices (round 8)

Money on a client is three numbers, and they live in three new `tm_` tables:

- **Total** — the agreed engagement value + currency, set on the client form ("Full cost",
  visible to Billing holders only). `tm_billing`.
- **Paid** — one row per payment received (`tm_payments`). The client form takes an optional
  **initial payment** at creation; after that, **Record payment** on the client's Billing tab.
  Balance due = total − paid.
- **Utilized** — Σ of per-question costs (`tm_q_costs`). Every run card question of a
  client-attached checklist carries a small **"Cost used"** field: any assignee fills it in as
  part of doing the work (clearing it removes the record); it rolls up per case and per client.

Every payment can become an **invoice** (`tm_invoices`) — or generate one for any amount. The
number is allocated atomically by the `tm_next_invoice_no` RPC (INV-0001, INV-0002…, prefix
configurable); the amount takes a configurable tax line (label + rate, e.g. VAT 5%); and the
**one company template** — header, address, TRN, logo, footer, terms, currency, tax and
numbering defaults, all edited from the Billing tab's "Invoice template" — is **snapshotted
onto the invoice at issue time**, so editing the template later never rewrites a document that
was already sent. View / print opens a standalone print window (browser print → PDF). Voiding
keeps the invoice on file with a VOID watermark; numbers are never reused.

**Permission:** everything money sits behind a new granular action — **Clients → Billing &
invoices** (`locations.billing`). Role seeds are at v11: superadmin/admin re-seed WITH it, every
other role has it OFF until it is granted in Access Control. The RLS on every billing table
enforces the same rule server-side (`_can('locations','billing') OR _is_elevated()`), so the
gate is real even against the raw API. The one deliberate exception: the per-question **cost**
can also be written by that run's assignees (`tm_q_costs` RLS checks the checklist's assignee
list) — entering what a step cost is part of doing the step.

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
- The **client form** asks client questions: name, contact person, reference / licence number,
  contact email and phone, address, owning department, status and free-text notes. The contact
  details live in a new `tm_client_meta` table — the shared `locations` row keeps exactly the five
  columns it always had, so the full Evarca app sees no change.

## Escalations

An escalation rule on a question (set in the checklist builder's Add Questions step) fires **the
moment that answer is submitted** — not when the whole run closes. A case can stay open for weeks,
so waiting would have meant no ticket until far too late. Firing creates the ticket (deduped: an
open ticket for the same question+checklist is reused, whoever triggers or re-triggers it),
notifies the escalation target, and the answer turns **red** — on the run card, in All results'
live view, and on the client file. The client-facing status page never shows escalations.

Settings has two tabs — Notifications and Templates. The old Data tab (export / clear / reset
workspace) was removed: destructive buttons have no place in a client-facing build.

## Notifications

`NOTIF_EVENTS` in `src/engine/notifications.js` is the whole list, and it is the only list. Settings
renders its rows straight from it and every send site calls `notifyEvent(key, …)`. Add an event there
and it appears in Settings with working switches; there is no second list to keep in step, and
nothing can appear in Settings that doesn't actually fire.

**Every event has both channels** — an in-app row on the bell and an email — each with its own
switch. Email additionally needs the master *Email delivery* switch, which is off until an admin
turns it on. The announcement pair is the one exception to where a switch is stored: it lives on the
shared `hrm_notif_prefs` row the wider platform owns, marked `store:'hnp'`, and the readers hide that
difference from every caller.

The old "mute a whole feature" table is gone. Those master switches lived on the shared `hrm_config`
row, so the other Evarca app could silently mute a notification nobody in this build could see or
turn back on. Per-event switches are now the only authority here.

Instructional filler is gone too — "Runs every day. To run it on particular days only, choose Weekly
above" and its like. Daily simply means every day, and the editor no longer explains itself.

## Feedback

Yes, it works, and here is the whole path:

1. A manager opens **Team**, picks someone, and presses **Send feedback**.
2. They fill in a title, a comment, a type and a priority, and can attach it to a specific checklist.
3. It is written to the `feedback` table and the person is notified (`feedback_received`).
4. The employee sees it in **Inbox → Alerts → Feedback**, on their **Profile**, and inline on that
   day's checklist card if it was attached to one.
5. They **Acknowledge** it; the manager can reply, and replies thread on the same record.

Feedback is about a person, not a run, which is why it is not on the dashboard.

## Permissions

`PERM_AREAS` in `src/perms.js` keeps the full platform list — role bundles live in the shared
`workspace_settings` row, so an area this build doesn't ship still has to survive a save here. What
the Access Control editor **renders** is `_tmAreas()`, which returns filtered *copies*:

- `TM_AREAS` — the areas this build has pages for.
- `TM_HIDDEN_ACTIONS` — actions nothing here checks (`employees.manageAssets` / `assign` / `manage`,
  `checklists.assign`, `locations.manage`). A switch that changes nothing is worse than no switch. A
  test walks every action still on offer and fails if it has no `can(area, action)` call site.
- `TM_AREA_COPY` — this build's wording, so the editor stops describing HR features that aren't here.

Hidden actions and hidden areas are copied through untouched on save, including by **All off**, so
editing a role here never strips a permission the wider platform relies on. The "their office" scope
is not offered either (people are no longer assigned to one), but a bundle that already stores it
reads back unchanged.

## One filter bar

Checklists, All results, Team, Tickets, Clients, People, Questions and Audit all build their filter
row from the same primitives in `src/ui/helpers.js` — `filterBar()`, `filterSearch()`,
`filterSelect()`, `clientFilter()`, `filterClear()`, `filterCount()`. Same card, same padding, same
34px control height on every page. A test asserts each of those pages calls `filterBar()` and none of
them re-declares the row or the control size locally, so they can't drift apart again.

## What's not in it

**Announcements were removed in round 6** on request — the nav entry, the page, the notification
event, the templates and every guard that referenced them. (A stale `announcements.js` page module
was still sitting on disk un-imported and referencing a removed helper; round 8 deleted the file,
which is also what got the static-reference audit back to green.) The `announcements` table itself is
untouched (the full platform still owns it), and `#announcements` deep links land on the dashboard.


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
npm test          # route sweep + reference audit + behaviour tests (245 assertions)
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
| `tm_client_meta` | a client's contact person, email, phone, reference number and notes |
| `tm_q_status` | the working status of one question on one run (in progress / waiting on client / waiting on authority), who set it, when |
| `tm_templates` | reusable question lists ("Mainland LLC formation") for starting a case in seconds |
| `tm_share_links` | the client status link tokens, enabled/revoked |
| `tm_nudges` | the record of every reminder emailed to a client, and about what |
| `tm_folders` | folders under a location |
| `tm_documents` | files under a location, pointing at the storage bucket |
| `tm_billing` | one row per client — the engagement total and its currency |
| `tm_payments` | one row per payment received from a client |
| `tm_invoices` | issued invoices, each with the company template snapshotted on |
| `tm_invoice_settings` | the ONE company invoice template (header, footer, tax, numbering) |
| `tm_q_costs` | one row per (checklist, date, question) — the money utilized on that step |
| `tm_share_prefs` | per-client link switches: can respond, show tickets, show billing |
| `tm_client_replies` | what the client sent back through the status link (reply / confirm / documents) |

**New storage buckets:** `tm-location-docs` (private, 25 MB cap, served via 5-minute signed URLs)
and `tm-answer-photos` (public-read with unguessable paths, 10 MB cap, so answer thumbnails render
without a signed-URL round trip per image). Round 8 adds one anon INSERT policy on
`tm-location-docs`: uploads are accepted only under `client-uploads/<token>/…` where the token is
a live, respond-enabled share link — nothing else in the bucket is readable or writable by anon.

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
   the task-management areas and actions (`TM_AREAS` / `TM_HIDDEN_ACTIONS` in `src/perms.js`), but
   `PERM_AREAS` deliberately keeps the full platform list, and saving a role copies through every
   toggle the editor never showed — including **All off**. Edit a role here and its Payroll/Leave
   switches, and `employees.manageAssets`, survive untouched.

2. **`hrm_config`** — a shared config row. This build no longer keeps any notification switch here
   (they are per-event now, on the workspace notification settings), but when it does write it sends
   a targeted `update` of the `extras` column only, round-tripping the fields it doesn't own
   (branding, alert thresholds, flow and letter templates) verbatim. It also refuses to write at all
   until it has successfully read the row, so a failed load can never overwrite live config with
   defaults.

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
- `src/engine/notifications.js` — `NOTIF_EVENTS` (the single list), `notifyEvent()` and the two
  channel gates `evInApp()` / `evEmail()`. Everything that sends goes through here.
- `src/engine/core.js` — the helpers the removed HR modules used to own: the in-app notification
  helper, the notification-preference store, the local activity log, the approval inbox model and a
  few formatters.
- `src/engine/answers.js` — the shared run: submitting one answer, requesting and deciding an edit,
  the deadline helpers, and the loaders for the `tm_` tables.
- `src/pages/documents.js` — folders and files under a location, including the upload/download path
  through the private bucket.

### RLS worth knowing about

One hard-won rule: **decide with UPDATE, never upsert someone else's row.** Postgres runs the
INSERT policy against the proposed row of an `INSERT … ON CONFLICT` even when it resolves to an
update — so upserting an edit request whose `requested_by` is another person bounces with
"you may not have permission". Every decision path (approving/rejecting an edit, marking it Used)
is a targeted `.update()` for exactly this reason.


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

`npm test` runs 269 assertions in nine files:

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
- **`tests/round4.test.js`** — the client form and its new meta table (asserting the `locations` row
  gained no columns), removing a deadline date without touching the time, every event carrying both
  channels and honouring each switch independently, "Assigned to me" in All results, the permission
  editor hiding only actions with no gate while a role save keeps them, no approval toggle on a
  question but the column still round-tripping, and every list page rendering the one shared filter
  bar.
- **`tests/round5.test.js`** — the case model: open across days, one accumulating run, closing for
  everyone and disappearing from later days, the final deadline; question statuses set/clear/badge
  and the 3-day stale alert with its daily dedup; the client file's %, who-did-what, NEXT UP,
  blocked card and nudge log; share links created/revoked and the public page rendered from RPC
  data (including that no employee name ever appears); templates applied with dead questions
  dropped.
- **`tests/round8.test.js`** — money and the two-way link: total/paid/balance/utilized rollups,
  the client form's full-cost + initial-payment fields (and their absence without the Billing
  permission), per-question costs normalising onto the case date with assignee/billing gating,
  invoice numbering via the RPC, tax math, the frozen template snapshot and VOID, link switches
  defaulting to respond-on/tickets-off/billing-off, the status page rendering waiting durations
  in days+hours, the respond box (reply shape, confirm, empty-send refusal, cache-rendered open,
  dead-link page), the team-side CLIENT REPLIED chips, and the `client_responded` event honouring
  every switch.

Both matter more than usual here, because cross-file references resolve through `window` at call
time — `vite build` will happily build an app whose buttons throw when clicked.
