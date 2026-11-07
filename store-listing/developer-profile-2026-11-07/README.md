# Lastrep Google Play developer profile

Prepared November 7, 2026. The developer profile is separate from the app's
Default store listing; the existing feature graphic is unchanged.

- Upload `header-image.png`: 4096 × 2304, opaque 24-bit RGB PNG, under 1 MB.
- Copy `promotional-text.txt` into Promotional text (limit 140 characters).
- Set the website to https://lastrep.web.app if it is not already present.

The header adapts the approved feature graphic: the same production gradient
wordmark, warm paper background and “Build on your last rep.” tagline. Content
is centered with generous outer margins for cropping. Review Play Console's
preview at phone and desktop widths before saving; display crops can vary.

The wordmark uses the existing repository outline, rather than upscaling the
1024 × 500 feature graphic. `header-image.svg` is the editable source;
`render-header.cjs` regenerates it and a PNG using the existing serif font.
The renderer converts Resvg's output to opaque 24-bit RGB using the installed
PNG tooling and checks the upload size and text length:

```powershell
node store-listing/developer-profile-2026-11-07/render-header.cjs
```

Dimensions and the 140-character promotional-text limit:
https://support.google.com/googleplay/android-developer/answer/9873827?hl=en

Prepared locally for review; not uploaded or saved in Play Console.
