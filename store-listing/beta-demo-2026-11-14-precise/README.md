# Lastrep beta demo - precise cues and historical RPE

November 14, 2026. 66 seconds, 1080 x 1920 portrait, H.264 at 30 fps. Music and silent versions have identical pictures. No narration. Open preview.html or lastrep-beta-demo.mp4. Superseded delivery exports and previews were removed after approval; reusable capture and rendering scripts remain locally under .dev-tools.

## Changes

- Disclosure taps now target the actual native caret glyph, located from a fresh accessibility snapshot before each tap. The cue uses those icon bounds with a 4-source-pixel margin. Set-completion cues use a small box centered on the visible checkbox. Other button cues are small and centered at the actual tap location instead of covering an entire text row or button.
- Cue timing was calibrated against visible changes in the recorded frames. Logged ADB timestamps differed from the first visible update by up to about a quarter second. The calibrated cues end before controls move or checkbox state changes. This prevents a highlight from remaining at the previous sheet position. Full-size cue frames were inspected, including the forward caret before expansion and empty checkbox before completion.
- Synthetic completed history now has RPE for all six exercises: Bench Press 8, other exercises 8.5. Last columns render those values through the ordinary app lookup. These are actual disposable history records, not text painted onto footage. Today's Plan still changes only Bench Press and leaves five exercises unchanged.
- Brief extra holds on the Cable Fly and Triceps Pushdown tables make the D markers and reduced loads easier to read. Set completion and exercise scrolling remain one take with a continuous timer.

The approved Home, Nutrition, Sleep and single-swipe program captures are retained. The existing save-to-confirmation editorial dissolve is retained. The Save cue was reduced to the centered tap position. No additional feature screens were added. Music, captions, light mode, framing, eased close-ups and intro/outro are retained.

## Verification

Both exports passed complete FFmpeg decoding. Representative full-resolution frames were checked for cue placement/timing and RPE display. Audio mean -25.9 dBFS, peak -13.2 dBFS. Complete 66-second Chrome playback passed with no media error at 1080 x 1920. Subjective pacing and musical fit remain for user review.

Capture used disposable accounts and synthetic records in the local demo-lastrep-sharing Firebase emulators only. Both accounts/documents were removed. The temporary production-wordmark source override was restored exactly, original dark system theme restored, temporary forwarding removed, and task-created servers/emulator stopped. No personal phone/account used. No health permissions were changed in this revision. No product feature source changes, Git delivery, build, deployment or public posting performed; existing beta-billing changes are preserved.

Music: Chill Wave by Kevin MacLeod, CC BY 4.0. Include MUSIC-CREDIT.txt in the public post/video description when publishing the version with music.

Ignored sources: .dev-tools/demos/lastrep-beta-precise-2026-11-14. Recorder: .dev-tools/record-precise-main.py. Cue calibration: .dev-tools/calibrate-precise-cues.py. Renderer: .dev-tools/render-precise-demo.py. Cue frame check: .dev-tools/check-precise-cues.py. Delivery contains no credentials.
