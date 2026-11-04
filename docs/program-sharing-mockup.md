# Program sharing — design review

November 3, 2026. Browser mockup only, awaiting user review. No native behavior,
Firebase schema, production service, privacy policy or AAB was changed.

Open the usual Training notebook page at
`http://127.0.0.1:4317/index.html#layout-minimal-program-share-send`.
The **Program sharing** group in **Review a state** includes send, receive,
new-user receive, requests, sent and external-link-preview examples.

## Proposed behavior

- My programs → program details uses the native-style icon action grid. Share
  opens Review program, showing the cycle, rest days and each assigned routine.
  Tap a day to inspect its prescriptions and targets; weights can be omitted.
- Send in Lastrep reuses the people-search presentation and supports multiple
  recipients. Requests from new senders and accepted deliveries share the
  existing Inbox / Requests / Sent structure. Type labels distinguish Program
  from Workout. The header is shortened to Sharing.
- Share a link demonstrates Messages, Email and Copy link. The synthetic browser
  preview is read-only, with Open in Lastrep and Get Lastrep on Google Play.
  No real link, clipboard value, external-app draft or message is created.
- Saving a received program creates independent routine IDs, remaps the cycle's
  day assignments and preserves rest days. Repeated assignments to the same
  source routine use one imported copy. Same-name routines stay separate by ID.
- The same received item offers View saved program after import. A separate
  delivery can be imported independently. Sender edits do not change a saved
  snapshot or the recipient's independent copies.
- Program saved offers Start program as a separate action. If another program
  is active, Switch programs explains that its history is retained. Starting
  begins Day 1; the unfinished workout is preserved and is not replaced.
- Only routine prescriptions and optional weights/targets are shared. Completed
  days, actual effort/completion, personal notes, historical sets, recovery and
  sender program start dates are excluded. The imported copy starts with no
  progress. Existing 30-day sharing retention remains the intended native rule;
  imported routines and programs would remain independent.

## Verification and boundaries

`node --test prototypes/training-notebook/program-sharing.verify.mjs prototypes/training-notebook/verify.mjs`
passes the local model/render checks. JavaScript syntax checks pass. Review states
render nonempty dialog markup.

Playwright-controlled Chrome was opened and checked on November 3. Screenshots
were inspected for review, receive, saved-program, recipient selection, routine,
compact dark requests and browser-preview dialogs. Interactive checks covered
multiple recipients, request acceptance, independent import, explicit program
switching, new-user start, resend and the synthetic email draft. Inbox, Requests
and Sent maintained identical popup bounds. All six review states passed 96
combinations of four viewports, light/dark themes and normal/enlarged text with
no horizontal body overflow, popup containment failures or JavaScript errors.
Local results: `.dev-tools/program-sharing-browser-results.json`.

The bundled browser host remained unavailable in VS Code. These checks used the
existing local Playwright installation with a separate Chrome test session;
no desktop-app connection or new MCP installation was needed. Human design
approval remains pending.

November 4 feedback refinements: rest days use numbers; day/exercise rows have
equal top and bottom padding; exercise targets sit under each exercise title.
Redundant routine, search and result help buttons were removed. People search
now follows the native two-character threshold, plain checkbox rows and selected
username chips. Delivery results use native-style status cards. Mixed sharing
entries share the same left edge and selected tabs retain readable contrast.
Sender identity sits immediately under the received program title. The external
browser example occupies a separate full-height browser presentation; its app
and install actions do not appear on the in-app received-program preview.
The existing workout fixture is visible through Resume workout; continuing an
imported program loads its sets and parks the earlier draft for Resume saved
workout. Playwright verified the import/continue/resume path and 96 layouts again.

Further review: rest-day numbers and labels use matching bold weight. Consecutive
identical prescriptions are summarized together, so Bench press retains its
separate warm-up and summarizes its three identical working sets. Program saved
groups the title and cycle summary, with consistent explanation spacing. A single
Resume workout entry opens a draft picker labelled by program/day or Separate
workout. Starting the received program parks the existing workout before changing
program context; resuming Back + Biceps therefore does not show the new program's
strip. Real clipboard copying and hosted browser previews remain native/hosting
implementation checks; Copy link in this mockup still creates no live link.

Native work remains separate: versioned program snapshots, callable/rules
authorization, limits, duplicate/retry handling, independent imports, public link
hosting, deep links, compatibility, expiry/cleanup and account deletion. These
are not implemented by this mockup. Do not infer native readiness from the local
synthetic delivery confirmations.
