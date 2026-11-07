# Google Play icon — opaque white variant

Prepared November 7, 2026 for the user's requested store-rendering check.

Upload `lastrep-play-icon-opaque-white.png` to Lastrep's **Default store listing →
App icon**. It is a 512 × 512, 32-bit PNG with every pixel fully opaque.

The source is the existing `assets/images/logo-splash-512.png`, which the user
identified in Play Console's asset picker. Its wordmark size, position and colors
are preserved; transparency is composited over white. No shadow, rounded corners
or other artwork is added. Existing source and launcher assets are unchanged.

```powershell
node store-listing/app-icon-2026-11-07/render-icon.cjs
```

After uploading, save and submit/publish the listing change through Publishing
overview as required. Compare the published icon after the change takes effect.
This tests whether transparency contributes to the glow beneath the wordmark;
its removal is not guaranteed. Google Play may retain its outer icon shadow.
No AAB update is required for this listing-asset change.

Prepared locally only; not uploaded to Play Console.
