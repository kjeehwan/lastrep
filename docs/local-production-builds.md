# Local Android production builds

Local production builds use the tracked Android project and the laptop's Android
toolchain. They do not start an EAS cloud build. A readiness check does not compile
an AAB or establish that its final contents are correct.

## Existing upload credentials

Use `eas credentials -p android`, select **production**, then
**credentials.json > Download credentials from EAS to credentials.json**.
Download the existing upload key; do not generate or replace it for a local build.
The default download produces `credentials.json` and
`credentials/android/keystore.jks`. Both locations are Git-ignored. Passwords
remain in the private credentials file, never tracked Gradle properties, command
arguments, documentation or build logs. Do not attach that file to a PR.

Gradle reads the root `credentials.json` for local production. An optional
`LASTREP_LOCAL_CREDENTIALS_FILE` can select another file; use an absolute path.
Relative `keystorePath` values inside the JSON are resolved against the repository
root, matching EAS's credentials format.

## Verify without building

Obtain the upload certificate's SHA-256 fingerprint from a previously accepted
production AAB, for example with `keytool -printcert -jarfile <previous.aab>`.
This is the AAB upload certificate; the Play-distributed APK can use a different
Play App Signing certificate.

From PowerShell at the repository root, set these values for the current process:

```powershell
$env:APP_VARIANT = 'prod'
$env:NODE_ENV = 'production'
$env:LASTREP_ANDROID_VERSION_CODE = '<intended version code>'
$env:LASTREP_EXPECTED_UPLOAD_CERT_SHA256 = '<previous AAB certificate SHA-256>'
Push-Location android
try {
    .\gradlew.bat :app:verifyLocalProductionSetup :app:validateSigningProdRelease --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Local production verification failed' }
} finally {
    Pop-Location
}
```

The verification task opens the private key with its passwords, compares the
certificate, checks package identity/version and confirms release optimization.
It prints no passwords. Local production release signing depends on this check.
Missing credentials, an absent/invalid version code or a mismatched certificate
stop the release. Dev releases retain their existing debug signing.

An offline dry-run can additionally check the task graph without compiling:

```powershell
Push-Location android
try { .\gradlew.bat :app:bundleProdRelease --dry-run --offline --console=plain }
finally { Pop-Location }
```

## Production release procedure

An actual AAB build remains a separate user-authorized step.

1. Confirm intended source, appropriate checks and a fresh Expo Doctor result.
   For health-import changes, compare the dev app's value with the source on a
   real phone before building, checking the source record interval and query
   range as well as permissions/display. For daily steps, include a running
   whole-day record whose end is later than now, compare the full local-day
   aggregate, and cover local midnight/DST boundaries. A nonempty count or an
   emulator record ending at now does not establish provider-total correctness.
   Keep actual health records/values out of tracked verification notes.
2. Recheck the latest Play version and EAS remote counter before choosing a
   version code. Direct Gradle builds do not increment EAS's remote counter.
   Coordinate the counter after a local release so a later cloud build cannot
   reuse a version already uploaded to Play. A rejected cloud request can reserve
   a counter value without creating an AAB.
3. Load/verify the production environment, including Firebase, Google sign-in and
   RevenueCat. Local `.env.local` can override other dotenv files. Do not assume
   a dev environment is suitable for production.
4. Ensure the existing postinstall compatibility patches are applied. Do not run
   clean prebuild over this manually maintained native project.
5. Verify signing as above, then use `:app:bundleProdRelease` without `--dry-run`
   only when the build is authorized. Do not restrict architectures merely to
   speed up a production release.
6. Validate the resulting AAB's signature, package, version, non-debuggable
   manifest, SDKs, production configuration and required native patches. Archive
   the AAB with its R8 mapping, source/build details and checksums. Native runtime
   and billing acceptance still require the intended installation path.

EAS cloud builds retain Expo's credentials injection and remote version handling;
`EAS_BUILD=true` bypasses local-only configuration. Do not set that flag to bypass
checks during a real local release.

Reference: [Expo local production guide](https://docs.expo.dev/guides/local-app-production/).
