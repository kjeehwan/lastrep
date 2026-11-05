# Lastrep homepage

Created November 5, 2026 for the existing Firebase Hosting site at
https://lastrep.web.app/.

The root page introduces the Android app, with an explicitly illustrative workout
log, current feature descriptions, Google Play, support and legal links. It uses
the existing bundled fonts, wordmark and paper/ink colors. `home.css` is scoped to
the homepage so sharing previews and legal pages retain their approved styling.
The operator is shown as the user-confirmed registered name, 라스트렙(Lastrep).
No registration number, personal phone number or home address is added.

The shared-plan HTML template is now `hosting/workout-sharing/shared-plan.html`.
The functions build generates `sharingPageTemplate.ts` from that file instead of
the root homepage. Its HTML content is unchanged; only the generated source-file
comment changes. A Hosting-only release is sufficient for this change; existing
sharing functions do not need redeployment. Existing sharing/API rewrites,
Android association, legal pages and security headers are unchanged.

This is a static page without analytics, account entry or new backend services.
The Google Play URL is the existing package listing; it does not override Play's
testing, regional or release availability. Search Console ownership verification
and Google Play organization approval are separate tasks. The user has confirmed
HTML-tag ownership verification; retain the tag. Public information pages now
allow indexing as described below, while shared-plan pages remain excluded.

Validation: functions build; 17 focused hosting/legal/server-rendering tests;
Playwright checks at 320, 412 and 1280px in light/dark modes; screenshot review
of desktop light and narrow-phone dark; images/fonts, keyboard skip link, support
anchor, legal routes and association JSON. No app rebuild is needed.

Published to Firebase Hosting version `2bfc2d91e383001f` on November 5, 2026.
The six viewport/theme checks and legal/association checks also passed against
the deployed HTTPS site.

## App gallery follow-up

Added Inside Lastrep with selectable Workout, Home and Nutrition screenshots,
one visible view at a time. Native horizontal touch scrolling, anchor-link fallback,
keyboard arrows/Home/End and reduced-motion support keep the gallery usable
without automatic rotation. Short captions describe each screen. How it works
adds a three-step introduction; Health Connect and support share the section
heading scale and symmetric padding. Pricing, testimonials and FAQ are deferred.

Screens in `hosting/workout-sharing/screens/` are unaltered Android emulator
captures from the task-created Sharing Review account, taken November 5, 2026.
The fixture contains only synthetic nutrition targets/meals, seven manual body
measurements and a Chest + Triceps routine. No personal account or phone data was
used. These are development-app captures; see the production-branding follow-up
below for the updated wordmark rendering.
Credentials and the profile backup remain in ignored `.dev-tools` files.

Published gallery follow-up as Hosting version `afdf801d7d24fdbc`. Focused tests
remain 17/17; browser checks cover three widths in both themes, selected-view
tracking after horizontal scrolling, link and keyboard navigation, screenshot
loads and the no-JavaScript anchor fallback. Review images are kept ignored.

## Five-view gallery and copy refinement

The user-selected headline is now “Build on your last rep.” Combined Built around
your training and How it works into a single three-step overview. Gallery order:
Home, Workout, Nutrition, Sleep, Sharing. Mobile labels use the smaller type size
and spacing so five choices fit while retaining their touch height.

Home now contains a complete synthetic recovery check-in and seven manual sleep
sessions (81% readiness in the captured example). The Workout image shows its
warm-up and all three working sets checked Done. Sleep shows a synthetic saved
session, and Sharing shows one sample workout and program delivered between the
two task-created review accounts. No real users were messaged.

For the Home and Sharing captures only, the existing LastrepLogo production
gradient was rendered through a temporary source override, then restored exactly.
The PNGs were captured directly, without retouching. No app code or production
binary changes are part of this homepage revision. Screenshot fixtures and
temporary branding backups are ignored; only the approved public images ship.

Published the five-view update as Firebase Hosting version `8ba4855b0fe6358d`.
All five views passed image-load, selection, horizontal scrolling and keyboard
checks across 320/412/1280px in both themes; the no-JavaScript fallback and
legal/Android-association routes passed as well. Focused regression tests remain
17/17. LastrepLogo.tsx has no remaining diff after the capture override.

## Homepage appearance selector

Header navigation now reads How it works / Support / Appearance. The last control
opens a native details disclosure containing labeled Light, Dark and System radio
choices. System is the default and reacts to OS/browser changes. Explicit choices
override the homepage palette and are saved in browser-local storage under
`lastrep-site-appearance`; no account data is written. A small same-origin head
script applies a saved explicit choice before styles paint. Storage failures fall
back to system on load and still permit a temporary choice for the current page.

Outside click and Escape close the disclosure; Escape returns focus to its
summary. Keyboard radio navigation stays native. Without JavaScript the control
is hidden and automatic system appearance remains available. Header navigation
wraps below the wordmark on phones so all three controls retain readable labels.
Existing sharing and legal pages retain their system appearance behavior.

Checked theme overrides against the opposite system setting, System responding
to live OS changes, persistence after reload, Escape/focus, outside dismissal,
blocked local storage, menu bounds and page overflow at 320/412/1280px. Light
phone and dark desktop screenshots were inspected. Web JavaScript lint passed.
Published as Firebase Hosting version `e2624d3d04c7ab2a`.

## Search Console ownership tag

Added the user's supplied google-site-verification meta tag to the root HTML
head and published Hosting version `15fad357ec31eb92`. Keep the tag in future
homepage revisions. The user subsequently confirmed Search Console displayed
Ownership verified, using the HTML tag method.

## Search discovery

Published Hosting version `82c43094611d604d`: an exact-path regex after the
default noindex header sets `X-Robots-Tag: index, follow` only for the homepage,
privacy policy and account/data deletion page (including their static aliases).
All other paths retain the default noindex policy. Shared-plan Cloud Function
responses also retain their own noindex header and HTML meta tag. Do not remove
these protections globally or use robots.txt Disallow for shared plans: crawlers
must be able to read noindex directives.

The sitemap lists only the three canonical public information URLs. robots.txt
points to the sitemap and allows crawlers to read page-specific directives.
Live checks confirmed HTTP 200 and index/follow for all three public pages;
noindex for a valid synthetic shared program, missing-token shared page, static
shared template, 404 template and unknown path; sitemap contents, robots.txt and
the retained ownership tag. Focused regression tests: 18/18.

Search Console sitemap submission and the homepage Request indexing action still
need to be performed in the user's signed-in Console. Eligibility does not
guarantee indexing or ranking.
