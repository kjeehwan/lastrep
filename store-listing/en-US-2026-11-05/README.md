# Lastrep — English Google Play listing

Prepared November 5, 2026. Copy the text files into the corresponding fields on Default store listing. Upload the images from each device folder in numerical order.

| Field | File / folder | Specification |
| --- | --- | --- |
| Short description | `short-description.txt` | 65 characters, excluding final newline; limit 80 |
| Full description | `full-description.txt` | 2,431 characters, excluding final newline; limit 4,000 |
| Feature graphic | `feature-graphic.png` | 1024 × 500, opaque PNG |
| Phone screenshots | `phone/` | 8 PNGs, 1080 × 1920, 9:16 |
| 7-inch tablet screenshots | `tablet-7-inch/` | 8 PNGs, 1080 × 1920, 9:16 |
| 10-inch tablet screenshots | `tablet-10-inch/` | 8 PNGs, 1440 × 2560, 9:16 |

## Screenshot order

1. Body-composition trends and recovery readiness on Home.
2. Workout set logging, warm-ups and exercise targets.
3. A program with workout and rest days.
4. Daily calorie and macro tracking.
5. Food search and barcode entry point.
6. Sleep session tracking and target.
7. Received workouts and programs in Sharing.
8. Recovery check-in.

All screenshots show native Android app views with synthetic data in a disposable review account. No personal health records are included. Captures use the development client with the production wordmark colors temporarily applied; the branding source is restored after capture. Screenshots have no fabricated controls or added marketing overlays.

Tablet screenshots are separate emulator captures at 600 dp (7-inch group) and 800 dp (10-inch group) logical widths, rather than enlarged phone images. These represent tablet-width layouts, not physical tablet testing. The phone capture uses a 480 dp logical width. All images are portrait 9:16 as requested.

`asset-manifest.json` records dimensions, byte sizes and SHA-256 checksums. `feature-graphic.html` is the editable source and uses repository assets; upload only the rendered PNG for the feature graphic.

The user submitted these listing changes for Google Play review on November 6, 2026. Publication remains pending. The app icon and feature graphic were declared as created or edited using AI; the actual app screenshots were left unlabeled. Verify the live listing after publication.

The final feature graphic uses the existing gradient wordmark and the tagline "Build on your last rep." on the app's warm paper background. Individual files are versioned; duplicate ZIP bundles are not retained.

Screenshot filenames include their device group: `phone-01-home-progress.png`, `tablet-7-inch-01-home-progress.png`, and `tablet-10-inch-01-home-progress.png`.
