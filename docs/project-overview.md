# Lastrep Project Overview and Working Agreement

Last reviewed: October 19, 2026.

This is the entry point for a new development thread, not a replacement for the
code, design specification, or current task checkpoint. Status below is dated;
inspect Git and relevant implementation before treating it as current.

## Product Purpose

Lastrep is a fitness logging and planning app focused on serious strength
training, with nutrition, sleep, recovery and body-composition tracking alongside
the workout log. The primary audience includes intermediate and experienced
lifters, but the interface must remain understandable to newer and cardio users.

The product should help users record accurately and quickly, understand their
own history, and make realistic training decisions. Recommendations support
user judgment; they must not replace trustworthy records with generic advice.
Use the brand spelling Lastrep or lastrep, not LastRep.

## Feature Map

| Area | Existing capabilities and important constraints |
| --- | --- |
| Home | Calendar and day details, training/diet phases, readiness and recovery check-in, weekly trends, body-composition progress and entry, contextual shortcuts. Avoid crowding Home with every available insight. |
| Workout | Routines, repeat/recommended workouts, custom exercises, resistance sets and cardio, exercise history/progress/PRs, notes/tempo/rest, timers, draft persistence, completion and routine updates. RPE/RIR is one account preference, not one per exercise. |
| Today's Plan | Workout-specific guidance using relevant recovery/context/performance information, with reviewed adjustments and Apply/Undo. The reviewed flow belongs with the planned workout, rather than requiring repeated Home/Workout navigation. Preserve completed/warmup sets, mixed set prescriptions, bodyweight/cardio distinctions and available-weight constraints. |
| Nutrition | Search and nutrition preview, editable quantities, meals with date-specific names and optional defaults, logging times, reorder, favorites, saved meals, copy meal, barcode/manual lookup, daily targets and composition/history. Barcode database coverage is not universal. |
| Sleep | Manual and imported sessions, multiple sessions per day, overlap handling, target editing, history/chart. Missing data is not zero sleep. Superseded totals and intentional deletion exclusions are separate concerns. |
| Profile | Identity/photo, training/diet phases, global units and effort preference, distinct body metrics, TDEE, nutrition/sleep targets, optional health connection. Native notebook presentation is user-approved; feature branch awaits merge. |
| Settings / Billing | Account/settings, support/legal access, subscription management and restore. Premium access and an active store subscription are not equivalent. Settings browser design is approved; native migration remains pending. |

These are a navigation map, not a claim that every edge case is verified.

## Approved Design Direction

Read `docs/training-notebook-design.md` before designing or migrating a screen.
It defines tokens, typography, icon sizing, component roles, accessibility,
responsive behavior and approved screen layouts. Use its headings to read
relevant sections rather than loading every historical document.

- A training notebook / pen-and-pad reference: warm paper, ink, readable numbers,
  deliberate hierarchy and fine rules. Not fake handwriting, distressed paper,
  excessive dashboard cards or ornamental graphs.
- The user's entries are primary; coaching is a supporting annotation.
- Light and dark presentations are both required. Dev branding uses an
  orange/red gradient; production branding uses its established blue/purple
  gradient. Do not arbitrarily recolor established assets.
- Reuse `src/ui/notebook/` primitives and tokens, not a new visual system per
  screen. Consistent roles should have consistent controls and touch targets.
- Modal styling, text contrast, outside-tap dismissal, Android Back, keyboard
  clearance and bottom-tab clearance matter as much as the underlying page.
- Preserve scroll position when editing, expanding or closing. Reveal an active
  input only as much as needed. Verify rotation, landscape and enlarged text.
- Do not add an extra last-row divider beside a section divider.
- New feedback may be implemented before it is folded into the specification;
  check the active checkpoint for these pending rule updates.

Approved interactive studies are in `prototypes/training-notebook/`. Read its
README for server commands and state-review routes. Browser fixtures simulate
behavior and are never production account data. An approved browser design does
not prove native keyboard, gesture, permission or accessibility behavior.

## Native Migration Status

As of this overview:

- Workout: approved and merged, PR #34.
- Home: approved and merged, PR #35.
- Nutrition: approved and merged, PR #36.
- Sleep: approved and merged, PR #37.
- Profile: approved implementation and feedback fixes on
  `feature/profile-notebook-ui`, pending merge; remaining limits are in its migration notes.
- Settings: browser baseline approved; native migration not started in this batch.

See each `docs/*-notebook-migration.md` for actual scope and coverage. Some older
status paragraphs describe pre-merge states. Git plus the dated checkpoint
resolve current progress; do not rewrite history by assuming everything passed.

## Architecture and Source Map

- Expo / React Native / TypeScript; Expo Router routes in `app/`. Check
  `package.json` and the lockfile for actual versions (currently Expo SDK 57).
- Main pages live under `app/(tabs)/`. Shared notebook components are in
  `src/ui/notebook/`; modal/keyboard primitives are in `src/ui/`.
- Domain code is grouped under `src/workouts/`, `src/nutrition/`, `src/sleep/`,
  `src/health/`, `src/bodyComposition/`, `src/home/`, `src/profile/`, and
  `src/billing/`. Follow imports to find the actual controller/service boundaries.
- Firebase Authentication and Firestore provide account identity and saved data.
  Private cloud profile photos use Firebase Storage; do not reintroduce public
  object access or local-only photo persistence.
- Backend functions and decision logic live in `functions/`. AI-assisted guidance
  has disclosure/consent and guardrails; not every decision path necessarily
  calls OpenAI. Inspect a path before claiming its output source.
- Optional Android health integration imports available sleep/body data from
  connected providers. Current device connection status is separate from saved
  account history, which can come from another signed-in installation.
- RevenueCat/Google Play handle production billing. The separately packaged dev
  app deliberately does not validate production store billing.
- Native Android is tracked. Read `app.config.ts`, plugins, `eas.json` and native
  verification scripts together before changing flavors, manifests or builds.
- `.github/workflows/web-export-check.yml` defines existing CI checks. It is not
  proof of successful device or Play billing testing.

## Behavioral Invariants

- Preserve existing records, drafts, permissions, units and feature behavior
  through a visual migration. Do not quietly expand scope into schema changes.
- Never populate a new exercise with invented load history or reuse previous
  RPE as a new set's effort. Historical performance must constrain realistic
  weight/repetition recommendations, not justify impossible progression.
- Training/diet phases and sleep targets must stay consistent across screens.
- Lean body mass and skeletal muscle mass are different metrics. Do not relabel
  uncertain legacy muscle values as either without evidence.
- Disconnecting health sync stops future reads, not display of saved history.
  Retain intentional deletion markers where needed to prevent re-import.
- Missing or incomplete sleep stages must not be presented as precise verified
  time asleep; preserve sole historical totals where appropriate.
- Unit conversion must not create fake new measurements or lose deliberate
  precision. Respect user-entered heterogeneous sets.
- Timers use elapsed time/deadlines and catch up after backgrounding/locking;
  do not rely solely on foreground interval ticks.
- UI feedback must describe confirmed outcomes. Do not imply verification is
  running, a purchase restored, or a write succeeded without evidence.
- Changes to collected data, provider transfers or storage may require updating
  `doc/privacy.md`, the public Notion policy and Google Play Data safety.

## How We Work Together

1. Implement an agreed, focused batch on its own branch. Inspect the existing
   working tree first and preserve user changes. Stop and clarify unexpected
   changes; never reset or discard them to simplify the task.
2. Give concise updates: what is changing, what was found and what remains.
   Ask only for material missing decisions, access or approval. Explain exact
   commands, where to run them, and prerequisites such as a connected phone.
3. Run appropriate automated checks, then native checks for affected behavior.
   User visual review is separate from automated verification. LGTM applies to
   the reviewed scope, not every untested case.
4. State precisely what passed, failed, was skipped and remains untested. A
   source-code inspection, mockup, screenshot or web export is not a substitute
   for a native interaction, persistence test or real billing check.
5. Commit/push only when explicitly requested. Open/merge PRs and delete branches
   only when requested. Work normally goes through PRs into main; do not assume
   an old direct-to-main exception authorizes future direct pushes.
6. Production builds/releases are separate explicit steps. The user handles
   Play Console review/promotion and policy forms unless access and execution
   are explicitly delegated. Verify current remote EAS version codes; do not
   infer them from filenames or old conversation messages.
7. Use checkpoints at interruptions. Record completed versus unverified changes,
   branch, remaining work, commands and device caveats. Never claim a usage
   percentage reliably predicts how much work will fit.

The user values concrete, usable behavior and consistent design over generic
explanations. Avoid repeatedly sending them through expensive AAB cycles for
issues that could be checked locally first. Do not make unsupported promises
about performance improvements or completeness.

## Local Development and Verification

Workspace is normally `D:\lastrep`, PowerShell. Use `npm.cmd` / `npx.cmd` when
PowerShell script execution policies interfere.

```powershell
git status --short
git branch --show-current
git diff --stat
```

Inspect the relevant diff and untracked files before editing. Do not include
environment files, credentials, private account data, raw screenshots or build
artifacts in commits.

- Metro: `npm run start:dev-client`. Check port 8081 first. Identify an existing
  process before stopping it; do not kill unrelated Node processes.
- Fast mode: `npm run start:dev-client:fast`. Record which mode was actually used
  for performance comparisons; do not mix normal/fast results.
- JS-only changes generally do not require a native rebuild. New native modules,
  configuration or native code may. Use actual tracked flavor/build scripts;
  do not repeat `assembleDevDebug` blindly after a flavor-generation failure.
- Confirm ADB device identity, connected/unlocked state and the visible app.
  Reconnection may require restoring port reverse and reloading. Verify a
  visible changed element so a stale bundle is not mistaken for current code.
- Do not change real records, purchase, revoke permissions or disconnect health
  access for demonstrations without the necessary user approval. Restore any
  test device display/orientation settings afterwards.

Usual automated checks, selected according to scope:

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd test
npm.cmd run check:web-export
git diff --check
```

Read `package.json` for native verification and emulator test scripts. Ordinary
unit runs can skip emulator-dependent tests; report counts and reasons from the
actual run. A historical green run does not cover later changes. Backend changes
also need their own build/tests. Avoid unreviewed `npm audit fix --force`.

## Read Relevant References, Not Everything

| Topic | Reference |
| --- | --- |
| Design authority | `docs/training-notebook-design.md` |
| Prototype operation | `prototypes/training-notebook/README.md` |
| Current Profile review/handoff | `docs/profile-migration-handoff.md` and `docs/profile-notebook-migration.md` (temporary checkpoint retired October 19) |
| Profile scope | `docs/profile-notebook-migration.md` |
| Shared input behavior | `docs/keyboard-modal-guardrails.md` |
| Other screen boundaries | `docs/workout-notebook-migration.md`, `docs/home-notebook-migration.md`, `docs/nutrition-notebook-migration.md`, `docs/sleep-notebook-migration.md` |
| Billing | `docs/revenuecat-build-isolation.md`, `docs/restore-purchase-outcomes.md` |
| Profile photo storage | `docs/cloud-profile-photos.md` |
| Performance evidence | `docs/performance-batches.md`, `docs/targeted-profiling.md` |
| Android configuration | `docs/android-adaptive-layout.md`, `docs/android-edge-to-edge.md`, `docs/android-release-optimization.md` |
| Dependency exceptions | `docs/expo-doctor-exceptions.md`, `docs/dependency-security-audit.md` |
| Privacy source | `doc/privacy.md` |

The root README is the concise setup and documentation entry point.
`docs/index.md` currently contains older privacy text, not this project overview;
do not treat it as the current policy or follow starter reset instructions.

## Updating This Overview

Update durable product/workflow decisions here and detailed design decisions in
the specification. Keep transient logs, process IDs, screenshots and local helper
scripts out of this overview. A checkpoint may reference ignored `.dev-tools/`
artifacts, but a fresh checkout will not contain those artifacts. Inspect the
current state rather than assuming an old server, device or local file exists.
Review ignored material before copying it into tracked documentation: remove
credentials, personal/account values, device identifiers and unnecessary local
details. Being ignored is not proof that a file is secret or safe to publish.
Retire temporary checkpoints only after their durable information and outstanding
review items have been transferred to maintained documents; update references.
