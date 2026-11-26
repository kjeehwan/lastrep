# Lastrep production access application working draft

Updated November 26, 2026. This is a working draft for the Google Play production
access application, not a submitted application or a declaration that testing is
complete. Update the marked fields from the final testing results before use.

The sections follow [Google's production access guidance](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en),
checked November 26, 2026. Match the actual form wording and character limits
when the application becomes available. This document separates confirmed facts
from fields still awaiting evidence; it is not ready to paste into the form as-is.

## About the closed test

### Recruitment

We recruited Android testers through Reddit app-testing communities. Our joining
instructions ask them to join our Google Group, opt into the Google Play closed
test and install Lastrep.
We respond to recruitment comments, participate in reciprocal testing and contact
testers individually to request feedback. We provide feedback on their apps as
part of those exchanges.

**Finalize:** Select the recruitment-difficulty option that matches the experience.
Add the actual recruitment dates and communities used, if the form asks. Do not
list communities where we only considered posting.

### Tester engagement

We have received installation confirmations and are asking testers about their
experience. A current count of confirmed installations has not been compiled
here. We also review production Android analytics for first opens and app activity. These aggregate figures do not establish which features each tester
used or how long each tester remained opted in.

The developer uses Lastrep for actual workout logging. We do not yet have enough
external feedback to say that testers used every feature or followed the same
workout habits as the intended audience. Recruitment includes developers
exchanging tests; their use of Lastrep during actual training is not yet confirmed.

**Finalize:** Replace this interim account with the observed engagement over the
test period. Include confirmed examples of feature use and any differences from
expected real-world use. Keep developer use separate from external tester use.

| Figure | Value to confirm before applying |
| --- | --- |
| Closed-test version available to testers | v50: the developer confirmed promoting it to closed testing, installing the update through Play and reviewing it. Add the publication date and confirm the current release before applying. |
| Eligible continuous opt-in period | [Confirm through Play Console when the application becomes available.] |
| Currently opted-in testers | [Use the current Play Console figure if displayed; otherwise leave the number unspecified.] |
| Production Android first-open users | [Count, date range and `lastrep-android` stream filter.] |
| Production Android active users | [Count, date range, stream filter and daily or period metric.] |
| Confirmed external feature use | [Specific tester confirmations or feedback; not an inference from installation.] |

Google Group membership, Play opt-in and analytics users are different measures.
Do not describe group members as confirmed installs, or analytics users as an
exact count of eligible testers. First opens can include reinstalls or developer
installations; report them as analytics figures rather than unique testers.

### Feedback and collection methods

We collect observations through Reddit conversations and direct follow-up with
testers, and maintain a feedback log with the affected screen, severity and action
taken. We are still requesting substantive feedback. One tester supplied an
installation screenshot showing a grey strip behind the Lastrep wordmark on the
Sign up screen. We investigated the report, could not reproduce it in our checks
and asked for the device model and Android version. Those details had not been
received at the last recorded update; confirm the latest reply before applying.
The report remains unresolved, not fixed.

A concise Google Form was created under the developer account for collecting
feedback. The developer approved it and planned to share it with the Google Group
and individual testers. Confirm where it was actually shared and review any
responses before describing form results. Do not include respondent emails or
identifiable responses in this document.

The onboarding improvement was a developer observation, not an external tester
request. It led to the optional app guide delivered in v50. Adding accessible
Terms of Use was also a developer suggestion; completion is not established by
this review and should not be claimed.

**Finalize:** Summarize any further feedback received, recurring themes and how
we acted on them. If substantive feedback remains limited, describe that honestly.

## About the app

### Intended audience

Lastrep is for English-speaking people who log resistance training, particularly
intermediate and experienced lifters who use routines, training programs and
performance history. It also supports cardio recording and related nutrition,
sleep and recovery tracking.

### Value to users

Lastrep brings workout planning, set logging and training history into one
training notebook. Users can organize reusable routines into programs, compare
previous sets while logging, and review workout adjustments using relevant
performance and recovery information. They can also track nutrition, sleep and
body measurements, optionally connect supported health data, and share workouts
or programs. Users review changes before applying them. All current features
are free during beta; launch pricing is not finalized.

### First year install estimate

**To decide:** Select a realistic range from the actual application options.
No first-year install forecast has been agreed. Base the choice on the intended
audience and recruitment plan rather than the minimum closed-test requirement.

## About production readiness

### Changes made during testing

Alongside external recruitment, we reviewed core workflows using disposable
accounts and local Firebase services. The review found an offline banner that
intercepted bottom-tab taps, clipped sharing feedback and unclear onboarding
and sharing wording. We corrected these issues and verified the affected flows
on an emulator. The developer also confirmed offline navigation on a Galaxy A51.

These were findings from developer-led testing, not claims of external tester
feedback. The workflow fixes in
[PR 99](https://github.com/kjeehwan/lastrep/pull/99) are included in the later v50
release. The developer confirmed updating the Play-installed closed-test app to
v50 and accepted the app guide, Last copying, sharing and reopening checks.
Those confirmations cover the reviewed paths, not every earlier emulator check.

| Change | Verification | Delivery status as of this draft |
| --- | --- | --- |
| Offline banner clears the bottom tabs | Emulator and developer phone review; Workout opens on the first offline tap. | Included in v50; the specific offline check was not newly repeated on the Play-installed v50 release. |
| Sharing feedback remains reachable | Emulator checks at default and narrow widths, enlarged text, busy/error states and successful retry. | Included in v50; the complete layout/failure matrix was not repeated on that Play-installed release. |
| Optional app guide replaces the earlier onboarding flow | Guidance now uses real app screens and normal saves; developer accepted the guide on the Play-installed v50 app. | Delivered in v50. The older copy-only onboarding fix is superseded by this flow. |
| Sharing copy includes programs and correct singular counts | Code review and native program preview/save checks. | Included in v50; developer confirmed sharing works, without a new exhaustive count/copy audit on that release. |
| Top and Back-off targets and progression | Automated and native checks, followed by developer review; see the implementation notes. | Delivered in v50. Developer feedback prompted the separate follow-up below. |

### Follow-up after v50

[PR 102](https://github.com/kjeehwan/lastrep/pull/102) contains further developer-led
improvements: shared-workout set tables, guidance chips and totals, clearer target
labels, unit/effort header controls, cardio row numbers and Rest Off. These are
merged but have **not been delivered in a new Play build**. Native dev-app reviews
and automated checks do not establish closed-tester use of these changes.

The nickname word-prefix search fix from the same PR is already deployed to
Firebase. Seven existing opted-in directory entries were refreshed. A synthetic
QA search found Program QA Alex with "alex", and the developer independently
confirmed that search works in the app. This backend delivery does not require a
new AAB. Do not present either this developer confirmation or synthetic-account
checks as external tester feedback.

**Finalize:** Add the version and publication date of any update actually made
available to closed testers, and its relevant verification. Do not present a
merged fix as a released fix or claim testers verified it without confirmation.

### How readiness will be determined

The November 20 core workflow review exercised registration and the then-current
onboarding, routine creation,
resistance/cardio logging, draft recovery after reopening, finishing and history,
and sending, receiving and saving shared plans. Those exercised paths worked;
the layout and copy findings were addressed. The detailed scope and limits are
in [the workflow review](beta-workflow-review-2026-11-20.md). Later app-guide
verification is recorded separately in the supporting records below.

Before submitting, complete these remaining notes:

- Confirm Play Console makes the production-access application available.
- Update engagement and feedback with the actual results through submission day.
- Check the intended release's crash/ANR and pre-launch information where
  available. Record unavailable data as unavailable, not as zero incidents.
- Review unresolved reports, including the grey wordmark strip, and record the
  evidence and decision for each. Do not describe the strip as fixed.
- Confirm the tested release version, any later fixes delivered to testers and
  the checks performed on that Play-installed version.
- Confirm working reviewer access details in Play Console, plus current privacy,
  deletion, app-content and store-listing information. Keep credentials out of
  this document.

Then write the final readiness answer from those results. Automated checks,
developer use and external tester engagement each contribute different evidence;
none should be presented as a substitute for the others.

## Supporting records

- Developer-maintained feedback log: maintained separately by the user.
- [Core workflow review and follow-up verification](beta-workflow-review-2026-11-20.md).
- [Beta access preparation](beta-billing-preparation-checkpoint-2026-11-13.md):
  historical implementation evidence; subsequent release status comes from the
  user's Play Console confirmations.
- [v50 release notes](../store-listing/release-notes-v50-en-US.txt).
- [Native app guide and its revised real-use flow](onboarding-native-guided-practice.md).
- [Top/Back-off implementation and verification](top-backoff-native-implementation.md).
- [Sharing follow-up scope and verification](workout-sharing-contract.md).
- [Google application guidance](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
