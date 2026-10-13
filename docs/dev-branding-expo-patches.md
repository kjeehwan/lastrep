# Dev branding and Expo patch alignment

## Scope

- Dev PNG branding maps the production blue-purple gradient to orange-red.
  Dimensions, alpha, pixel positions, saturation and brightness are preserved;
  neutral backgrounds are unchanged. Production assets are not modified.
- The generator also updates tracked Android dev-flavor launcher and splash
  resources from their matching production resources. Source asset changes alone
  do not update this project's checked-in native resources.
- The shared in-app SVG logo uses orange-red for dev and retains the production
  blue-purple palette. Both variants keep the same text geometry.
- Expo, Auth Session, Dev Client, Router and Splash Screen are aligned to the
  SDK 57 patch versions reported by Expo Doctor on October 13, 2026.

Regenerate assets on Windows with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/generate-dev-brand-assets.ps1
```

The execution-policy override applies only to that process. The generator requires
System.Drawing and the Windows image codecs used by the production resources.
Do not run clean prebuild: Android native folders and flavor overrides are tracked.

## Device Review

A native rebuild is required for the new icon and splash resources. Connect and
unlock the Android phone before running:

```powershell
$env:APP_VARIANT = "dev"
npx expo run:android --variant devDebug --app-id com.kjeehwan.lastrep.dev
```

Check the launcher icon and a cold launch for the warm gradient, unchanged logo
shape and no clipping. Check navigation, workout inputs, health sync and the
profile photo. The production app/package is separate and must remain unchanged.

## Diagnostics

Verified on October 13, 2026: Expo Doctor 20/20, lint, TypeScript, 220 unit tests
(14 skipped), web export, native configuration verification and an arm64 dev-debug
APK build. Source PNG dimensions/alpha/neutral pixels and all 20 native resource
dimensions were checked; the source icon and native splash were visually inspected.
Phone appearance and interaction checks remain separate from these build checks.

The tracked-native/app-config synchronization check remains intentionally disabled
as before; no new Doctor checks or dependency warnings were suppressed. Run
`npx expo-doctor` to verify the current dependency alignment. Dependency security
follow-ups remain a separate backlog item.
