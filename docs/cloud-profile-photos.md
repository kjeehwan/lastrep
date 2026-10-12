# Cloud-backed profile photos

## Design

- Photo selection remains a local preview until Save Changes (including Save in the leave prompt).
- The app sends at most 6 MB of image bytes to an authenticated callable, never a public upload URL.
- The backend validates image decoding, restricts pixel count, auto-orients, crops/resizes to at most 512 x 512, strips metadata, and encodes JPEG.
- Uploads are limited to 12 attempts per account per hour. Images are private, under `users/{uid}/profile-photos/{uuid}.jpg`.
- The Storage write supplies the computed CRC32C in object metadata and enables CRC32C validation. Downloads also validate CRC32C.
- Profile saves stage the upload, save other profile fields, then commit the photo reference in a backend transaction. A failed staged save leaves the previous active photo intact. Other profile fields are not a cross-service atomic transaction and may already have saved if a later operation fails.
- Photo references are server-managed `profilePhotoPath` and `profilePhotoUpdatedAt`. Legacy `profilePhotoUri` is cleared when a cloud photo is committed or removed.
- Downloads authenticate against the current account and its active photo. No download token or signed public URL is stored in Firestore. Native clients cache privately scoped local files; sign-out and account deletion clear that account's cache.
- Replacement/removal deletes the previous image. Failed cleanup is marked for retry; abandoned uploads are cleaned after 24 hours by a daily scheduled function (normally within 24-48 hours, subject to failures).
- Account deletion blocks new photo operations, deletes the user's Storage prefix, then deletes Firestore and Authentication data. In-flight uploads check the deletion flag and remove themselves.

## Deployment prerequisites

Read-only checks on October 12, 2026 confirmed that `lastrep-ebac5.firebasestorage.app` exists in `ASIA-NORTHEAST3`, billing is enabled, and bucket IAM has no `allUsers`/`allAuthenticatedUsers` bindings. Uniform bucket-level access is disabled; the upload function explicitly uses a private object ACL in this mode. No production configuration was changed by these checks.

1. Confirm Firebase Storage is initialized for `lastrep-ebac5` and billing is enabled. Verify the default bucket matches `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` (`lastrep-ebac5.firebasestorage.app` in this workspace). Do not create a public bucket or grant `allUsers`/`allAuthenticatedUsers` object access. The runtime service account needs access to this bucket.
2. Review existing Storage rules and Firestore indexes in the console before deployment. The checked-in Storage rules deny all client access because every photo operation goes through the backend. Do not overwrite unrelated production Storage rules or delete unrelated indexes without reviewing them.
3. Deploy the new rules/index and only the affected functions:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage,functions:stageProfilePhoto,functions:commitProfilePhoto,functions:getProfilePhoto,functions:discardProfilePhotoUpload,functions:cleanupAbandonedProfilePhotos,functions:deleteMyAccount
```

The scheduled function requires Cloud Scheduler/Pub/Sub setup, which the Firebase CLI may prompt to enable. Wait for the collection-group index to finish building before relying on cleanup.

No mobile dependency was added. Restart Metro/reload the existing dev client after backend deployment; a native rebuild is not required solely for this feature.

## Google Cloud checksum advisory

The backend explicitly depends on `@google-cloud/storage` 8.2.0 or later, above Google's recommended minimum 7.19.0. Tests assert that upload metadata contains the CRC32C calculated from the final JPEG and that validation is enabled. This is not proof of a live verified upload: after deployment, perform upload/download validation against the real bucket and compare its stored CRC32C with the bytes. When available, review `storage.googleapis.com/api/object_checksummed_write_count` in Cloud Monitoring.

## Validation

```powershell
npm test
npm run lint
npx tsc --noEmit
npm --prefix functions run build
firebase emulators:exec --project demo-lastrep-photos --only firestore,storage "npx vitest run src/firestore.rules.test.ts src/storage.rules.test.ts"
```

Device checks after deployment:

- Choose photo, Discard: old photo remains on Home and Profile.
- Choose photo, Save: compressed photo appears on Home and in its profile popup.
- Restart, then reinstall the dev app and sign in: the saved photo returns. Reinstall only the dev app; leave production installed.
- Sign in on a second installation/account: correct account's photo only.
- Replace/remove and save; verify old Storage object disappears.
- Simulate offline/failed save; previous active photo remains and save reports failure.
- Delete a test account; verify its photo objects, upload records, user document, and Authentication account are deleted.
- Existing local photo migrates on next Save if its local file is still available. Lost files cannot be recovered.

Before distributing this version, publish the updated privacy policy and declare Photos in Google Play Data safety (collected, not ephemeral, optional; app functionality/account management). Recheck sharing against your provider settings. The policy change in this branch is not automatically published to Notion or Play Console.

## Deployment verification - October 12, 2026

- Deployed the five photo functions, updated `deleteMyAccount`, Firestore/Storage rules, and cleanup index to `lastrep-ebac5`.
- The collection-group index is READY. The daily cleanup job is ENABLED in Cloud Scheduler's `us-central1` location; the function runs in `asia-northeast3`. Scheduler was enabled during deployment. Scheduled execution has not yet been observed.
- Backend build and 24 targeted photo tests passed before deployment.
- Live tests used disposable accounts and synthetic images, then deleted all test accounts. Verified authenticated stage/commit/download, 512 x 512 JPEG conversion, metadata stripping, fresh sign-in retrieval, unauthenticated/public/cross-account rejection, client reference-change rejection, discard, replacement/removal, and account deletion (Firestore profile and Auth account).
- Live uploads/downloads succeeded through code that enables CRC32C validation. Independent comparison of stored CRC32C and direct confirmation of physical object deletion were blocked because the CLI account lacks `storage.objects.get`. No IAM permissions were changed to bypass this restriction.
- The connected Android dev app opened and Home/Profile rendered without observed runtime errors. No personal photo was selected or saved, no account was switched on the phone, and no app was reinstalled. Device Save/Discard, cache/offline behavior, and reinstall restoration remain to be checked.
- Subsequent device checks passed: Discard restored the initials placeholder, Save displayed the photo on Home and Profile, and the photo persisted after restarting. Lastrep Dev was then uninstalled/reinstalled and its local data cleared; the user confirmed the saved photo returned after signing in again. Production's version and installation timestamp were unchanged. Device offline/failed-save behavior has not been checked.
- The user published the updated Notion privacy policy and submitted the Photos Data safety disclosure for Google Play review. Review approval is not yet confirmed.
