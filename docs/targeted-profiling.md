# Navigation profiling findings (archived)

Temporary profiling hooks, runtime globals, capture scripts and npm commands were
removed after verification. The descriptions below refer to the historical
harness and local captures, not instrumentation retained in the app.

## Interpretation

- `tab_press` starts when the JS tab handler receives the press. It excludes any
  earlier Android input-dispatch delay.
- `next_frame_proxy` marks two animation frames after focus, not physical pixels
  becoming visible. It is a scheduling proxy, not an end-to-end display measurement.
- `ready_frame_proxy` uses each page's loading indicator. It does not mean every
  backend request has settled or that cached content is fresh. Workout currently
  has no overall content-loading indicator, so its ready marker equals its frame
  proxy.
- Commit counts include focused/unfocused top-level screen commits. React render
  durations cover the subtree, but are only available in the development React
  bundle. Fast mode reports those durations as unavailable, not zero.
- Async read durations include network wait and scheduling; they are not CPU
  time. Correlate with the local Hermes profile (microsecond timestamps) and trace
  events (`performance.now()` millisecond timestamps) to investigate overlap.
- CPU profiling and development instrumentation add overhead. Use repeated runs
  and confirm the eventual fix with tracing off before making acceptance claims.

The timing buffer is bounded to 1,500 events. Labels are developer-defined
screen/operation names; no UID, account fields, food queries, health values,
Firestore payloads or error messages are recorded. Controls are exposed only
for development JS or the `.dev` package, never the production Android app.

## Initial Valid Fast-Mode Capture

Two visits per tab on SM_A516N; too few samples for population latency claims:

- Workout first-entry frame proxy: 1,211.7 ms; repeat entry: 246.5 ms.
- Home frame proxy: 134.6 ms (one timed return; first press reselected Home).
- Nutrition maximum frame proxy: 255.4 ms.
- Sleep maximum frame proxy: 91.2 ms.
- Profile maximum frame proxy: 140.0 ms.
- Workout: four decision reads for two visits, 15 screen commits (three
  unfocused). History and routines reads overlapped and took about 979/994 ms
  elapsed, including waits. Those reads finished after the first frame proxy,
  so the measurement does not prove the requests caused the initial delay.
- CPU samples in the first Workout interval included React hook rendering,
  native tree commit/node creation and synchronous UI work (`runOnUISync`).
  The repeated-entry interval was shorter and included property/context updates.

Next investigation should isolate first-entry Workout setup/rendering and
redundant focus-effect reads. Do not infer that all perceived app lag is fixed,
or attribute network elapsed time directly to CPU blocking.

## Normal-Mode Investigation and Targeted Fix

Same phone and two-round navigation sequence, development React bundle:

| Measurement | Before targeted fix | After targeted fix |
| --- | ---: | ---: |
| Workout render time, total | 4,309 ms | 2,668 ms |
| Workout tab frame proxy, median | 1,306 ms | 963 ms |
| Nutrition tab frame proxy, median | 1,294 ms | 973 ms |
| Workout decision reads | 3 | 2 |

The baseline included approximately 250 ms Workout renders while Nutrition
was opening. This established cross-screen render interference. The fixes cache
unchanged exercise-card JSX using stable, latest-committed event callbacks;
prevent pending-add callback changes from restarting the focus read effect;
skip replacement suggestions when replacement is closed; and reuse a locale
collator for catalog sorting. Visual state remains in the card cache dependencies.

Local captures: `navigation-1791960739349` (baseline),
`navigation-1791961143434` (card/focus fix), and
`navigation-1791962045795` (including catalog fix). The intermediate Nutrition
median was 808 ms, so the samples also demonstrate run-to-run variability.
The baseline CPU trace included catalog comparison costs; development-only
React task creation is also substantial in normal mode. Neither cost should be
equated with release-mode latency without measuring that mode.

These results show partial improvement, not resolution of overall app lag.
Typecheck, lint and 265 active tests pass (14 skipped). Acceptance still needs
fast-mode comparison and unprofiled device checks; do not commit/push this batch
as a resolved performance issue yet. Captures remain local and git-ignored.

## Fast-Mode Follow-Up

Capture `navigation-1791962270109` confirmed `dev=false&minify=true` in the
Hermes script URLs. Expo's developer overlay was dismissed before recording.

- Workout first entry: 1,298 ms (baseline 1,212 ms); repeat entry: 204 ms
  (baseline 247 ms). First-entry delay has not improved.
- Nutrition median: 220 ms (baseline 235 ms); Profile median: 136 ms
  (baseline 136 ms). These differences do not establish overall lag resolution.
- Workout decision reads: two for two visits, versus four before the fix.
- Remaining first-entry CPU samples include module evaluation, React rendering,
  native tree commits, synchronous UI work, and Firestore query processing.
  History/routines finish after the first frame marker; their elapsed request
  durations alone do not explain the initial transition.

Normal-mode gains must not be presented as equivalent fast/release-mode gains.
Keep this batch uncommitted pending performance acceptance.

An additional warmed run used the same two-round navigation/scroll sequence
with both timing recording and CPU sampling off: 999 frames, 30 deadline misses
(3.00%), p95 20 ms, p99 61 ms. Earlier warmed baseline was 3.66%, p95 20 ms,
p99 73 ms. This is a small single-run improvement, not evidence that global lag
or first-entry delay is resolved. The phone was returned to Home; user's Metro
was left running. No workout or account data was edited.

## First-Entry Read Scheduling

The first-entry CPU trace mapped saved-plan validation and Firestore processing
to work occurring before the first frame marker. The retained change restores
the local draft first, then schedules history/routines and focus guidance reads
after two animation frames and an idle opportunity. It does not skip validation,
discard saved sets, change prescriptions, or delay local draft restoration.
Scheduled work is cancelled on relevant cleanup; four tests cover frame order
and cancellation before either frame or the idle callback.

- Before scheduling change: first Workout entry 1,298 ms.
- Scheduling-only capture `navigation-1791962819632`: first 1,009 ms,
  repeat 176 ms. Reads started at approximately 1,448 ms, after the frame marker
  at 1,009 ms, rather than competing with initial rendering.
- Repeat capture `navigation-1791963417218`: first 1,084 ms, repeat 225 ms.
- An experimental bounded FlatList captured 1,071 ms and did not improve on
  scheduling alone. It was removed; Workout retains its existing ScrollView.
- Typecheck, lint and web export pass. 269 active tests pass, 14 are skipped.
- A non-editing native tap check kept Reps focused rather than Weight.

The before/after scheduling samples show a modest first-entry improvement,
not elimination of the delay or a verified fix for app-wide perceived lag.
Initial module evaluation, rendering, gesture setup and native view creation
remain visible in CPU samples. Keep changes uncommitted until acceptance.

Conditional loading of the Reanimated swipe module was also tested
(`navigation-1791963781681`, first entry 1,255 ms) and removed because it did not
demonstrate a benefit. This capture included ongoing Home reads that were absent
in some shorter captures: background startup activity is a confounder, so the
1,009/1,084 ms samples are not a controlled proof of a lasting latency reduction.
The stronger verified result is that Workout's noncritical reads/validation no
longer compete with its first frame. Overall lag is still not verified resolved.

## Resumed Verification With Startup Settling

The capture tool now accepts `--settle-ms 5000` and records the runtime mode.
All comparisons below used fast mode, the same phone/draft, a fresh JS reload,
the same settling interval, and the same two-round navigation sequence.
These remain JS-handler-to-frame proxies, not physical input-to-display timing.

| Implementation | First Workout entry | Repeat entry | Capture |
| --- | ---: | ---: | --- |
| Before read scheduling, other earlier fixes retained | 1,270 ms | 161 ms | `1791973071092` |
| Read scheduling only | 1,149 ms | 219 ms | `1791972999374` |
| Scheduling + preference snapshot deduplication | 998 ms | 156 ms | `1791973294939` |
| Repeat of final implementation | 1,003 ms | 178 ms | `1791973447334` |

The available-weight listener previously replaced its state for every user
document update, including unrelated changes. It now retains equal normalized
settings, scoped to the same UID; its unloaded empty map is also stable.
Real setting additions, removals, mode/unit/load changes and account changes
still update state. Ten tests verify these comparisons and loaded references.

The final samples show approximately 21% lower first-entry latency versus the
matched baseline, but first entry still takes about one second. They do not
establish that app-wide perceived lag is eliminated. Normal-mode React overhead
and physical tap-dispatch latency are not covered by this fast-mode result.
Typecheck, lint, web export and 279 active tests pass; 14 tests are skipped.
No speculative list or conditional-swipe-loading experiment is retained.
Changes remain uncommitted pending acceptance.

Final unprofiled warm sequence: 974 frames, 29 deadline misses (2.98%),
p95 21 ms, p99 61 ms. This is a small improvement relative to the earlier
3.66% single-run baseline, not proof of uniformly smooth interactions.

Normal-mode final capture `navigation-1791973694886` confirmed development React
with the same 5,000 ms settling interval: first Workout entry 1,589 ms, repeat
589 ms, Nutrition median 891 ms. Workout React rendering totaled 3,165 ms.
The earlier normal-mode captures used different settling conditions, so these
numbers should not be presented as a matched normal-mode improvement. Normal
development navigation still has noticeable delay; overall lag is not resolved.
The agent-owned temporary Metro sessions were stopped after verification.

## Final Disposition

The user accepted retaining the verified improvements and moving on with the
remaining delay documented, rather than claiming overall lag is solved.
Temporary profiling instrumentation and commands were removed. The subsequent
profiling-free normal-mode phone smoke test is recorded in
`docs/performance-batches.md`. Final checks passed with 275 active tests and
14 skipped; five profiling-infrastructure tests were intentionally removed.
Original local drafts were restored after test edits. No completed workout or
meal was saved, and no health permissions were changed during the smoke test.
