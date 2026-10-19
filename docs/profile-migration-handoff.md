# New-Thread Prompt: Resume Profile Migration

Updated October 19, 2026. Paste the following message into a new thread attached
to the Lastrep workspace. Profile presentation, Save/reopen, photo persistence
and landscape keyboard behavior have user approval, as does the permission-navigation
fix. Photo timing/selective-write optimization is complete. The optional one-call
client/backend optimization is preserved in an ignored local patch and full source
backup, excluded from the migration source. It requires review before reintroduction
and an explicit deployment request.
Reduced-motion observations and remaining checks are in the migration notes. The
offline cold-start/reconnect check passed after fixing the server-readiness retry;
existing loaded drafts remain protected during connectivity changes. The
in-flight photo upload interruption/retry and subsequent reopen also passed
against the current two-call backend; the deferred one-call path is unverified.
The temporary sanitized checkpoint has been retired; do not recreate its old work.

---

Continue working on Lastrep in `D:\lastrep`. First establish context; do not ask
me to paste the old thread or assume its history is available.

1. Follow any applicable repository instructions. Read `README.md`, then
   `docs/project-overview.md` for product purpose, features, architecture and our
   collaboration/review/release workflow.
2. Read the authority/status introduction and shared rules in
   `docs/training-notebook-design.md`, then its Profile/Settings section and any
   modal, input, icon, accessibility or responsive rules relevant to this task.
   Read `docs/profile-notebook-migration.md` and
   `docs/keyboard-modal-guardrails.md`. Inspect the approved Profile browser study
   and shared primitives as needed; do not mistake fixtures for account data.
3. Use the October 19 verification and remaining-review sections in
   `docs/profile-notebook-migration.md`, then inspect live Git/device state.
   Earlier phone results are explicitly dated and do not verify later changes.
   The temporary checkpoint was retired after its durable content was transferred.
4. Inspect current branch, status, diff and untracked files. Expected branch is
   `feature/profile-notebook-ui`, containing the Profile migration plus related
   Home/shared-control/Workout popup consistency fixes. Preserve all changes.
   Read changed implementations and tests before modifying them. Do not switch
   branches, reset files, recreate the migration or rerun one-off edit scripts.
   If actual state contradicts the migration notes, investigate and explain before
   taking an action that could overwrite work.
5. Briefly summarize what is implemented, what remains unverified and the next
   concrete steps. Resume Profile review and any new feedback; do not start a new
   feature or migrate Settings. Do not repeat completed fixes from the old handoff.
6. Verify that the phone loads the current bundle before interpreting results.
   A previous USB disconnection left a stale bundle; the October 19 session did
   confirm the latest UI. Still check current ADB and Metro state,
   not historical process IDs. Ask me to connect/unlock the phone only if needed;
   continue useful documentation/code/test work while it is unavailable.
7. Follow the migration notes' remaining user-review checklist. October 19 checks
   cover sync feedback above tabs at 110%/200%, badge/phase/unit/info controls,
   minimal portrait body-field scrolling, rotation visibility and native plan
   component corners in a read-only preview. They are not visual approval,
   persisted-save or complete keyboard/accessibility coverage. Normal Workout
   Review generates/saves a plan; do not invoke it for a read-only corner check.
   Do not save fake measurements, modify a real workout or alter health access
   without approval. Distinguish native verification from my visual approval.
8. Add appropriate regression coverage; update design rules and migration notes
   with the latest agreed refinements and actual results. Run relevant automated
   checks and report failures/skips honestly. Earlier green results do not verify
   the latest changes. Keep temporary instrumentation and private artifacts out
   of source control.
9. The prior checkpoint retirement is complete. If new unfinished work needs a
   checkpoint, retain a sanitized snapshot through interruptions. Transfer durable
   decisions, actual results and remaining review items to maintained notes before
   retiring that snapshot and updating references. Never delete the ignored local
   original or other files as part of checkpoint retirement.

Do not commit, push, open/merge a PR, delete branches, build an AAB or deploy
anything until I explicitly request those actions. Give me a short, specific
review checklist when the remaining work is ready for my approval.

---

## Minimum Handoff Sources

The overview supplies durable project context, the specification supplies design
authority, the migration note supplies implementation boundaries, verification
and pending user review, and the live working tree supplies what actually exists.
None alone replaces the others. No account credentials are needed in the prompt.
