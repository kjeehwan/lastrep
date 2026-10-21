# Profile photo save performance

October 20, 2026. Local source follow-up to Play internal build 35; not in that AAB.

## Fresh native measurements

### Subsequent user timing check — October 21, 2026

The user reported an initial dev save at approximately eight seconds without a
timer, followed by a timed 2.89-second save. After a controlled app force-stop
and reopen, the first save was timed at 1.90 seconds and the immediate repeat at
2.71 seconds. These measure the user's Save-to-end-of-Saving observation, not
instrumented stages. This pair does not support a consistently slower first save.
Production v36 was separately observed at approximately six seconds, without a
stage breakdown. Intermittent slow saves remain unexplained.

The user approved retaining the current client and deployed two-call backend.
No one-call deployment is planned for this batch. Further optimization needs new
evidence, rather than attributing the earlier slow observation to a cold start.

### Original instrumented comparison

The user reported roughly ten seconds in both production and the standalone dev
app. Temporary stage-only timing in a fresh standalone dev build measured the
following saves with the same user-selected photo:

| Stage | Original client | Prepared upload |
| --- | ---: | ---: |
| File reading / local preparation | 64 ms | 254 ms |
| Upload and server staging, including transport | 2,404 ms | 1,214 ms |
| Commit request | 765 ms | 587 ms |
| Save handler total | 3,234 ms | 2,058 ms |
| Subsequent authenticated image refresh | 553 ms | 764 ms |

The measured Save handler was approximately 36% shorter, and the user reported
two to three seconds with the prepared upload. This is one before/after pair,
not a controlled network or cold-start benchmark. The reported ten-second case
was not reproduced during this pair, and server warmth/network variation can
contribute to the difference. Do not promise production will eliminate all delays.

## Client optimization

Native saves use the SDK-compatible `expo-image-manipulator` to center-crop and
prepare a JPEG at at most 512 x 512 before uploading. Smaller images are not
enlarged. This matches the existing server output geometry and bounds the upload
payload. Dimensions above the existing 40-megapixel server limit are rejected
before manipulation. The original six-megabyte input limit remains.

The selected source stays available for retry; only the generated temporary file
is deleted. Native resources are released after encoding or failure. Account
identity is checked again after preparation and before sending. The web path
keeps its existing reader. Server validation, normalization, ownership, checksum
and commit protections are unchanged.

The deployed two-call stage/commit flow remains in use. No backend deployment,
storage-policy change or minimum-instance setting is part of this optimization.
The older deferred one-call patch remains separate. A new native build is needed
for the image preparation module; an OTA/Metro refresh alone cannot add it.

## Verification

- Preparation geometry, size limits, temporary-file cleanup, failure cleanup,
  identity changes, upload failure and retained-file retry have unit coverage.
- Fresh full suite: 649 passed, 22 emulator-dependent tests skipped. TypeScript,
  lint, Expo dependency alignment and web export passed. Fresh Expo Doctor passed
  20/20 with the existing documented native-config exception.
- Standalone Android dev build installed; the user completed an optimized save.
  Closing/reopening loaded Profile in clean Saved state with the photo displayed.
- Three native radio-toggle attempts completed their saves before the connection
  actually dropped. They produced no unhandled errors, and connectivity settings
  were restored, but they do not establish the interrupted-save failure path.
  Separately, a one-shot cancellation of the actual native HTTP request after
  dispatch showed Save failed, retained the draft with Save enabled, and succeeded
  on retry in the same process. Profile then showed Saved. This verifies canceled
  request recovery, not physical Wi-Fi loss.
- Temporary timing and transport hooks were removed from source before the final
  standalone dev build. Raw test artifacts remain in ignored local development
  storage; no account values or photo content belong in this document.
- Final clean-source verification: TypeScript, lint, 31 focused Profile tests and
  diff checks passed. The clean standalone Android dev APK built and installed;
  cold reopening displayed the retained photo and Saved state. Its runtime log
  contained no temporary markers or observed unhandled errors. The full suite,
  Expo Doctor and web-export results above preceded instrumentation retirement;
  the focused checks and native rebuild were repeated after retirement.
