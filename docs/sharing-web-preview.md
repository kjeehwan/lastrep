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
