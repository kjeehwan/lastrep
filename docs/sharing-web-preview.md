# Sharing web preview follow-up

The public page uses the app's bundled Notebook fonts, uniform day/rest rows,
right-hand carets, consistent dividers and icon/text app and store actions.
Light/dark mobile browser checks verified equal row typography, loaded icons,
working expansion and no horizontal overflow.

Messaging previews read server HTML. The new sharingPage HTTP function reuses the
existing bearer snapshot authorization, expiry/revocation and read quota, and
returns fixed type-only title/OG/Twitter metadata before JavaScript runs. It does
not embed sender identity, exercise prescriptions or a bearer token in metadata.
Unavailable and transient links retain their corresponding error status.
Firebase Hosting must deploy this function before switching /w/** and the legacy
/shared-workout route to it. Existing Android routes and tokens remain unchanged.

The public policy lives at /privacy, generated from doc/privacy.md by
scripts/prepare-sharing-hosting.js. The same step copies the app icon and font
files with their license notices. Hosting predeploy regenerates these artifacts.
The app's privacy URL points there for the next binary; update the Play Console
policy URL after the page is published. Existing Notion content can remain while
older app versions continue linking to it.

Focused checks: functions build, 15 metadata/hosting/privacy tests, TypeScript and
focused ESLint passed. Browser automation checked both themes, day-row typography,
icon loading, program targets/grouped sets, and all twelve generated policy
sections. Tests cover ambiguous tokens, unavailable/expired previews, transient
errors, raw HTML escaping and exact policy regeneration.

## November 4 review follow-up

Rest, tempo and exercise context appear immediately below targets and before set
prescriptions. The app action uses the readable Lastrep wordmark with an Open app
label and chevron; the store action uses Google's official English Play badge
from https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png.

The exact reported URL returned Shared program in its initial title and OG
metadata under normal and Kakao-style request headers. A fresh path was confirmed
by the user to show Shared program on the phone. Existing Kakao cards can retain
cached metadata; desktop preview-card creation was inconsistent and is not claimed
as controlled by Lastrep. Kakao documents OG cache reset at
https://developers.kakao.com/docs/ko/message-template/faq.

No separate local deletion-policy Markdown was found. The supplied public Notion
page was read and migrated to doc/account-and-data-deletion.md, preserving its
October 9 effective date and policy wording. /data-deletion is generated from
that source. It includes two distinct mailto request actions, with the existing
Account Deletion Request and Data Deletion Request subjects; neither action
deletes records or sends email automatically. The same page covers both Play
Console account-deletion and selected-data-deletion URL fields.

Sixteen focused tests, functions build and focused lint passed. Browser review
confirmed context ordering, readable branding and badge loading in both themes,
six policy sections and both mailto subjects. No personal records were altered.

## Paired actions and email-handler follow-up

Rest and tempo share one middle-dot row. The two equal-size action cards occupy
one row at widths down to 320 px, with OPEN ON above the Lastrep wordmark and
GET LASTREP ON above the Google Play name. The launch arrow is removed. The
custom wording is HTML; the downloaded official badge image is not altered.
The generic word plan remains appropriate in shared explanatory copy; explicit
Shared workout / Shared program titles identify the scope of the received item.

Deletion buttons remain mailto links. Phone Gmail/Outlook can handle them; PC
browser selection alone does not necessarily provide a configured email composer.
See Microsoft's URI handler documentation:
https://learn.microsoft.com/en-us/windows/apps/develop/launch-default-app.
The page explains this dependency and includes an expandable Email draft didn't
open? section. Copy details writes only the fixed support address, the correct
request subject and placeholders/instructions. Denied/unavailable clipboard
access shows selectable text instead. It never opens a composer or sends mail.

Nineteen focused tests, backend build and focused lint passed. Browser checks
verified light/dark paired controls, the single context row, equal card geometry,
no narrow-screen overflow, actual clipboard text/subjects and visible feedback,
and the selectable fallback after an injected clipboard denial.
