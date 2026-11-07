# Sharing preview and listing follow-up — November 7, 2026

Continues on `fix/todays-plan-sheet-height` with the uncommitted Today's Plan
presentation adjustment. Existing store-listing work is preserved separately.

## App behavior

Accepted Inbox entries now have an opening caret and no standalone Block sender
button. Received workout/program previews expose Sender options through a
44 dp three-dot target beside Close. Its Cancel action preserves the preview;
Block sender uses the existing authenticated delivery response. Success returns
to the list; failure keeps the preview and existing retry/error handling.
Request rows retain Accept / Decline / Block. Sent and token-link previews do
not gain recipient-only sender controls.

This is a local presentation/state transition change. The provider keys dialogs
by account and revision, and calls still send the expected account ID. Backend
authorization, block relationships, retention and imported copies are unchanged.
Existing privacy disclosures already describe blocking and Health Connect;
no new product data collection, permissions or provider transfers are introduced.

## Listing capture changes

- Refresh images 02, 04, 05 and 08 in all three device folders. Workout examples
  have completed sets and Last values from genuine synthetic comparable sessions.
- Today's Plan uses the approved content-fitting sheet and an unfinished sample
  plan, with guidance produced by the actual rules. Inbox examples contain a
  workout and a seven-day program from the same accepted synthetic sender.
- Health Sync uses real native Health Connect imports in the disposable Android
  emulator. A temporary local-only writer creates 29 synthetic records: seven
  each for sleep, weight, body fat and lean mass, plus one 6,342-step record.
  Permissions are granted through Health Connect's normal UI; Lastrep's normal
  connection and Sync now flow reports successful imports. The compatibility
  sleep summary is eight hours, not a duplicated manual/import total.
- The existing Body composition “Ready (partial)” label denotes the Health
  Connect path, which supplies weight, body fat and lean mass; Samsung's separate
  direct integration can additionally provide skeletal muscle. No screenshot
  status is painted over or presented as a real scale/watch connection.
- Only local demo Firebase accounts and emulator health data are used. The
  writer deletes its own exact client record IDs before uninstalling; restore
  Lastrep's five initially denied read permissions, original display/demo
  settings and branding. Remove the synthetic accounts and account caches.

## Checks

TypeScript, focused lint and 21 existing focused tests pass. Native checks pass
for Inbox opening, received-program menu cancellation, a simulated transient
workout-block failure preserving the preview, and successful retry returning to
the list. Both native read imports and the failure injection are isolated to
local demo accounts. The failure override is restored after the check.
All three browser galleries were inspected after re-rendering. The 24 upload
PNGs pass dimensions, opacity, size, font, aspect-ratio and headline-fit checks.
Cleanup is verified: Health Connect reads reported zero remaining records from
the sample writer for all five record types, the writer was uninstalled, all
five Lastrep read permissions returned to denied, and display size/density and
demo mode returned to their original values. Both local accounts and their
account-scoped caches were removed; the production-wordmark override was
restored exactly. The temporary 8083 Metro is stopped; normal 8082 is preserved.
No Git delivery, deployment, physical-phone review or AAB is included.

## Phone-review follow-up

Today's Plan disclosures now share normal-ink, 16 dp medium headings. Expanded
Review context is inset with a fine left rule, including the recovery ratings
and Edit recovery check-in action. Shared-program day numbers are consistently
semibold. Sender options now replaces the received preview within the existing
notebook modal shell, showing sender identity and one Block sender row. Close,
backdrop dismissal and Android Back return to the preview without clearing it.
A failed block stays in options for retry; success returns to Inbox using the
existing authenticated call. No backend/schema or privacy changes.

TypeScript, focused ESLint and the same 21 focused tests pass after this update.
Physical-phone visual/interaction review of these refinements is pending.

Further phone feedback: the empty daily-context summary beneath Edit recovery
check-in now explicitly says no pain/discomfort or additional activity reported;
recorded ratings remain visible separately. This copy is scoped to the review,
leaving other daily-context summaries unchanged. Sender identity uses compact
normal-ink text rather than the editorial title font. Its icon-and-label Block
sender action sits to the right, vertically centered, or below for narrow screens
and enlarged text. TypeScript and focused lint pass; user review is pending.

Context readability follow-up: one Edit recovery check-in row now precedes the
ratings and pain/activity summary. Recent performance uses one line per exercise;
training and diet phases use separate lines, with muted group labels and normal
ink values. Groups have 20 dp separation and 6 dp internal spacing. No chips or
new interactions were added. The visible sender action is now Block; its
accessible name still identifies the sender.

## Final acceptance and delivery

The user approved all three image groups and reviewed the native Today's Plan,
program day numbers and Sender options on the connected phone. Final accepted
context details use an explicit 12/18 dp muted style after notebookSheet, which
otherwise enlarges these differently named styles. All review chevrons are
18 dp, right when collapsed/navigating and down when expanded. Git delivery
with separate app and listing commits is authorized. No AAB, Firebase deployment
or Play Console upload is included in this delivery.
