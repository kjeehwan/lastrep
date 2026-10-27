# Workout sharing study

Status (2026-10-27): browser design approved; native sharing, backend and 30-day
retention implemented locally on `feature/workout-sharing-study`. Prepared for split commits and PR review. No deployment or AAB has been made for this feature. Fixtures are
synthetic; real account data and health permissions were not used for sharing tests.

See [Sharing contract and deployment checks](workout-sharing-contract.md) for the
payload, limits, retention, link setup and remaining release gates. Resume details
are in the ignored `.dev-tools/workout-sharing-native-checkpoint.md`.

## Native implementation

Home and Workout expose Inbox / Requests / Sent through their header inbox icon.
Tap an Inbox or Sent entry to preview its workout; there is no separate Open
workout button. Pending requests still require Accept before preview.
Settings and Profile share one username editor. Discovery and incoming sharing are
off by default. First-time senders require acceptance. Sends create immutable plan
snapshots and separate recipient deliveries, with persistent retry-safe request IDs.
Decline, block, opt-out, account guards, routine imports and account deletion are
handled by the backend. Routine imports are idempotent for the same snapshot.

The isolated sharing editor reuses actual Workout cards, menus, warm-up sheet,
inline Replace, styles and Android set rows. It does not mount the active workout's
controller or persistence. Plan mode omits Last and Done. Deliberate target effort
is separate from recorded effort; personal notes and logged RPE are not copied.
Workout Finish is below the exercise area; Share and Discard share a setup row.
The native sharing dialogs use a consistent gap below their titles. The sender
selects recipients and sends from the same popup; the separate review screen was
removed. The inline Replace list has an accessible X control. New external links
use a shorter `/w/<token>` address with the same preview-only access model.
The plan editor now gives exercise cards side margins, spaces Demo / Rest / Tempo
evenly, and aligns Replace's Close control with its heading. Add exercise includes
Workout-style search, clear, group filters, catalog metadata and a custom entry.
Rest uses the same interval choices as Workout, without a live countdown in this
plan copy; Tempo uses Workout's four sliders. The result popup uses recipient
status cards and distinguishes sent, requested and already-pending outcomes.
After phone review, preview panels omit the decorative top rule, the editor
uses a borderless workout-title field with a nearby pencil action, and exercise panels align with the action
buttons' outer edges while keeping inner padding. Nested controls have explicit
group spacing and inline Replace uses an X. Inbox / Requests / Sent share a
stable popup viewport, with per-tab results retained while live data refreshes.
The title has no separate visible label, and the plan's note field has no
Instructions heading. Sent and other read-only exercise panels have the same
inner side padding as the editor. The tabbed sharing sheet uses a compact
viewport to reduce unused space while keeping its dimensions stable.
The pencil focuses and selects an existing title; tapping the title text places
the cursor for a local edit. Request entries place labeled Accept / Decline /
Block icons horizontally at the right, vertically centered against the entry; the action group moves
below the entry at larger text or narrow widths.

Requests, Inbox and Sent expire after 30 days. Every new delivery has its own
window; repeating a plan is allowed and does not restore an old expired delivery.
Imported workouts and routines remain independent. The expiry worker updates
counters transactionally; counter-free records use TTL. Links are revocable and
expire after 30 days, with explicit refresh starting a new window.

Firebase Hosting's small companion page and production Android HTTPS association
are prepared. The public certificate was verified against the Play-installed APK.
The dev package does not claim production links. Hosting is not deployed; native
external links remain custom-scheme links until the HTTPS base is enabled after
deployment. Installed-app, signed-out continuation, explicit import and unavailable
link paths exist; final verified-domain behavior requires deployment and an updated
production app. Some messaging apps do not recognize the development custom
scheme; the direct Android handler works, but message-app tapping is not a
reliable way to open a dev link. No message or email is sent automatically.

Local native coverage includes live requests, accept/read counters, separate
multiple-recipient delivery, duplicate-tap protection, Sent editing cancellation,
active-workout isolation, link import, repeat import, units/rest persistence,
large text, keyboard visibility, dark mode and outside dismissal. Fresh automated
results and remaining release gates are recorded in the contract. User phone
acceptance was received October 27; local checks do not establish production behavior.

The following sections describe the approved browser behavior and retain their
mockup-only qualifications.


Open `http://127.0.0.1:4317/index.html#share-send` and use the Workout study's
review selector for Receive a workout, Receive the same workout again, Workout
already open and Shared link unavailable.

The sender reviews exercises, set prescriptions and rest intervals. Include
weights can be turned off. Personal notes, effort ratings and completion marks
are excluded. Send in Lastrep is the primary action; external link sharing is
secondary. External links are viewable by anyone who holds them. The Android
share sheet is simulated and never sends a message.

## Optional sharing identity and inbox

Settings has one Sharing within Lastrep on/off switch, off by default. Choose
a unique @username using the separate Username row before enabling. If none is
saved, tapping the switch leaves it off and shows an inline instruction; it does
not open a username dialog. Normal app use and external links do not require a
username. Nickname is a separate, nonunique display name. Profile Identity and
Settings expose the same optional username editor directly, with no intermediate
information popup or duplicate Sharing preferences entry. Save username saves
only the username and closes the editor; it does not enable sharing. Cancel keeps
the previous username. The new-user example is blank. Existing-user handles are
synthetic fixtures, not generated or verified unique. Discovery uses nickname or @username and shows
only sharing-enabled fixture people, with handles to distinguish duplicate names.
Email addresses are not exposed in discovery.

The row label is Username without an optional suffix. The prerequisite hint is
shown only after trying to enable sharing without a username, below the Username
row. The Shared with you button has been removed from Settings; the Home and
Workout header icons are the inbox entry points. Only choosing Use for a new
workout or Save to My routines navigates to Workout. The use destination
resolves an existing workout explicitly; saving a routine preserves its sets.
The cross-page handoff uses synthetic sessionStorage only, not real app records.

The send flow previews the chosen recipient. Accepted senders go to Shared with
you; first-time senders go to Requests. Recipients accept, decline or block a
request before opening the attached workout. Receiving never starts a workout.
Home and Workout use the same outlined inbox icon with a new-item/request count.
Home places it between Calendar and Settings; Workout places it at header right.
Both open the same inbox above their current page. Settings is limited to sharing
enablement and username editing. Use or Save to My routines navigates to Workout
only after choosing it.
The header badge totals unread workouts and pending requests. Inbox and Requests
tabs show their respective counts only above zero; never display `(0)`.
The popup is titled Workout sharing and has Inbox, Requests and Sent tabs.
Sent lists the workout, recipients and sent time for in-app sends. Send again
restores the original plan snapshot and selected recipients in the send popup; it never
sends immediately or changes the active workout. Each simulated send adds a new
entry at the top. Sent history does not contribute to the header unread badge.
External composer drafts are excluded because Lastrep cannot establish whether
the user actually sent them. This browser history is synthetic and page-local.
Tapping a Sent entry opens a read-only Sent workout preview of its saved snapshot:
exercises, sets, reps, shared weights and rest intervals, recipients and sent time.
Later edits to the source workout do not alter that snapshot. Excluded weights
stay hidden. Send again is at the bottom of this preview, with Back to Sent.
Edit workout appears above Send again and is also the editor title. It opens a
separate plan editor using Workout's exercise cards, Rest/Tempo controls,
instructions field and set table. Retain weight/reps, target RPE/RIR, set-number
options (Normal/Warm-up/Failure/Drop, duplicate/delete), add/duplicate last set,
and exercise replace/reorder/remove. Warm-ups use W and working sets number
independently. Weight units convert entered values. Add exercise uses the synthetic
search catalog. Cardio uses time/distance; bodyweight uses reps and target effort.
Last, completion checkboxes, the active timer/date, recommendations and Finish
are excluded from this editor. Instructions are deliberately authored recipient
instructions; personal exercise notes and recorded RPE are never prefilled or
included in the outgoing snapshot. Target effort is a separate canonical target
value, displayed as RPE or RIR. Preview and Sent preserve target effort, set types,
tempo and instructions. Omitted weights are removed from outgoing snapshots.
The copy has its own name and Include weights choice. Editing does not reference
the active workout, timer, completed sets or rest deadline. Review workout previews
the copy before sending; sending records a new Sent snapshot. Cancel,
outside dismissal and Escape discard only the copy and return to the original
Sent preview. Dismissing a nested picker returns to editing without discarding it.
Workout Finish is after the last exercise; there is no header Finish button.
The routine-builder header Save remains separate.

The browser's obsolete Session options button was removed. The action section
below Today's Plan matches the current native source: My routines / Create
routine, Repeat past workout / Recommend workout, and Discard workout. The new
Share workout action lives in that section. No device was connected through ADB
for this layout comparison; native source inspection is not a fresh phone test.
The inbox demonstrates two deliveries of the same plan to the same recipient.

People search sorts by display name, then @username for identical names. Select
one or multiple recipients; selected handles stay visible across searches and can
be removed before sending. Send workout is on the same popup. The result lists per-recipient
outcomes. This is a separate delivery per person, not a group conversation;
recipients should not see the sender's other selected recipients. Server-side
authorization, limits and partial failures are implemented locally; live service
behavior remains unverified until deployment.

External sharing shows representative Messages, Email and Copy link icons with
labels underneath. The real Android chooser must reflect installed/available apps.
Share workout and Discard workout share one action row, with the same vertical
divider and alignment as the routine/recommendation rows.

Turning sharing off stops discovery and new incoming shares; imported workouts
and previously received items remain available. The username is retained for
reuse but hidden from discovery. These are proposed behaviors, not server-backed
controls. The mock registry has reserved names to demonstrate username validation;
it cannot establish real uniqueness or access control.

Review Settings `settings.html#sharing-off`, Profile
`profile.html#sharing-profile` and Workout `index.html#social-inbox`,
`#social-requests` and `#social-search`. Changes to the synthetic sharing preference
are shared across these pages in the same browser tab's sessionStorage. Explicit
enabled review states seed a local example without enabling a real account.
Use `settings.html#sharing` to inspect the current tab's saved preference without
seeding an off/on fixture. Settings links from Workout open this actual Settings
page rather than another settings popup. Settings/Profile Reset clears the stored sharing preference. Deliveries, requests,
blocking and imports otherwise stay in page memory and reset with the example.

The recipient explicitly chooses Use for a new workout or Save to My routines.
Opening a link alone changes nothing. A saved routine does not block another
session at any time, including for the same recipient. A new session starts with unchecked sets and empty effort;
it is a draft, not a completed historical workout. An open workout requires an
explicit keep, append or replace decision. The same popup explains that replacing
discards unsaved sets; Replace applies immediately without a second confirmation.
Repeated clicks cannot append twice after the confirmation closes. The browser
study keeps changes in memory only; changing examples or reloading resets them.

Native/backend implementation needs a separate approved contract for immutable
share revisions, idempotent requests, reuse of links, intentional repeat sessions,
server-enforced creation/import limits, revocation, retention/cleanup and access
controls. No numerical abuse limits or storage policy is approved by this mockup.
The implementation also needs a private username registry, discovery permissions,
sender acceptance/blocking, delivery authorization and inbox pagination. Update
the privacy disclosures before implementing public discovery or real delivery.
Weekly/monthly programs and recipient edits/updates are outside this first study.

Browser verification: 96 layout combinations across the sharing, search, inbox,
requests, Settings and Profile states, light/dark, phone/compact/landscape and
compact 200% text. Checked repeat sharing/use, routine saving, keep/append/replace,
username validation, cross-page optional enablement, duplicate display-name
disambiguation, accepted delivery versus requests, accept/decline/block and
external sharing while disabled. No browser errors, external requests or detected
modal overflow. Sender, repeat recipient, people search, requests and sharing
settings were visually inspected. Existing account, Workout and warm-up model
checks passed (43 tests including Home). The final Home/Workout headers and inbox
interactions passed 16 additional light/dark, compact, landscape and enlarged-text
checks, with header order, touch targets, containment and bottom Finish verified.
Both header views were visually inspected. This is not native Android share-sheet, backend identity,
real delivery, persistence or abuse-control verification.

Latest refinements: 40 additional layout checks for multiple selection, recipient
review, sent outcomes, external icons and the paired workout action row passed.
Verified alphabetical order, selection across queries, deselection, retained
selection on editing, mixed Inbox/Requests delivery previews and clearing selection
after sending. Rechecked the 56 sharing/account layouts, 16 header/inbox checks
and zero-count behavior. Search, icon choices and the paired action row were
visually inspected. No real messages were sent.

Sent follow-up: 24 three-tab layout combinations passed, including compact,
landscape, enlarged text and light/dark. Verified seeded and new sent entries,
multiple recipients, Send again review, unchanged header unread count and the
Home popup remaining on Home. Rechecked the 16 header checks, count clearing and
40 multi-recipient/external-icon/action-row layouts. Sent was visually inspected.

Sent preview follow-up: 16 light/dark, compact, landscape and enlarged-text cases
passed with and without shared weights. A newly sent snapshot retained its
original prescription after the source weight was edited and the share draft
recreated. Preview had no input fields; Send again opened recipient review and
left the active workout unchanged. Home opened the same preview without leaving
Home. Rechecked the 40 multi-recipient layouts and visually inspected the preview.

Edit-copy follow-up: 16 editor/review layout combinations passed. Browser checks
covered weight/reps/rest/title editing, set addition/duplication/deletion,
exercise addition/replacement/reordering/removal, new Sent version creation,
original snapshot preservation, active workout field/completion preservation,
Cancel/Escape and the Home-hosted editor. Separate state checks confirmed the
running timer start, elapsed offset, rest deadline and active plan were unchanged
after copy editing, sending and cancellation; invalid reps were rejected and
excluded source weights were cleared when making a copy. Rechecked the read-only
preview and multi-recipient layouts. Editor was visually inspected. No native
workout, real account or phone data was edited.

Workout-style editor refinement: 16 rich editor/preview layout checks and 32
Rest/Tempo/Units/Set options dialog layouts passed. Verified RPE/RIR conversion,
blank absent targets, warm-up numbering, kg/lbs conversion, tempo/instructions,
cardio/bodyweight fields, sent snapshot round-trip and invalid target rejection.
Privacy/state checks confirmed that personal notes, recorded RPE, completion and
history are excluded; deliberate targets/instructions/types are retained, and
active workout/timer/rest state remains untouched. Rechecked isolated editing,
read-only Sent preview and multi-recipient flows. The editor was visually reviewed.

### Shared Workout component refactor

The separate sharing-card markup was retired. `workout-exercise-ui.mjs` now
renders exercise cards for both the Workout study and Edit workout, using a plan
mode to omit Last/completion and bind inputs to isolated target prescriptions.
Both hosts share the exercise menu and inline replacement picker, aligned to
the current native source: units and Available weights in the three-dot menu,
Reorder Up/Down, Replace, favorites and Delete. Replace expands under the title
with search, group filters, scrollable results and a set-reset confirmation.
These catalog options are synthetic; they do not verify native replacement ranking.

`workout-warmup-ui.mjs`, the existing warm-up model and `warmup-gestures.mjs`
are shared by both hosts. Add warm-up is left-aligned above the set table;
swipe/keyboard deletion and insertion use the same implementation. The copy
remembers warm-up choices only in its own draft, preserving active preferences.
Add set and Duplicate last set reuse the same horizontal action row at normal
text size; enlarged text can reflow as on Workout. Ordinal/title DOM and typography
are shared rather than separately styled.

Verification: 24 shared editor/menu/inline-picker layout cases passed. Compared
the actual computed ordinal/title fonts and relative positions, and menu item
text, against the Workout study: exact matches. Tested both warm-up hosts,
keyboard deletion, actual pointer swipe deletion, insertion/numbering and
inline replacement confirmation. The refactor retained rich-plan editing,
read-only snapshots, multi-recipient sharing and header behavior. All 43 browser
model checks passed, and active workout/timer/rest/privacy state checks passed.
New sheets start at their top; returning to the editor restores its scroll.
Editor, menu and inline picker were visually inspected. This is browser component
reuse; a future native implementation must reuse the real Workout components,
not translate another independent editor. No native app code or account changed.
