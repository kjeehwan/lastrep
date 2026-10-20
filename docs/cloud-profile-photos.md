# Cloud-backed profile photos

## Native upload preparation — October 20, 2026

The native client now center-crops and encodes a JPEG at at most 512 x 512 before
uploading, preserving the selected source for failed-save retries. The deployed
two-call flow and server validation remain unchanged; the deferred one-call
backend patch is not deployed. See [photo save performance](profile-photo-save-performance.md)
for fresh measurements, native cancellation/retry checks and their limitations.

## Design

- Photo selection remains a local preview until Save Changes (including Save in the leave prompt).
- The app sends at most 6 MB of image bytes to an authenticated callable, never a public upload URL.
- The backend validates image decoding, restricts pixel count, auto-orients, crops/resizes to at most 512 x 512, strips metadata, and encodes JPEG.
- Uploads are limited to 12 attempts per account per hour. Images are private, under `users/{uid}/profile-photos/{uuid}.jpg`.
- The production bucket enforces public access prevention and uniform bucket-level access. Photo access uses IAM rather than object ACLs; clients still use authenticated callables, not direct Storage access.
- The Storage write supplies the computed CRC32C in object metadata and enables CRC32C validation. Downloads also validate CRC32C.
- Profile saves stage the upload, save other profile fields, then commit the photo reference in a backend transaction. A failed staged save leaves the previous active photo intact. Other profile fields are not a cross-service atomic transaction and may already have saved if a later operation fails.
- Photo references are server-managed `profilePhotoPath` and `profilePhotoUpdatedAt`. Legacy `profilePhotoUri` is cleared when a cloud photo is committed or removed.
- Downloads authenticate against the current account and its active photo. No download token or signed public URL is stored in Firestore. Native clients cache privately scoped local files; sign-out and account deletion clear that account's cache.
- Replacement/removal deletes the previous image. Failed cleanup is marked for retry; abandoned uploads are cleaned after 24 hours by a daily scheduled function (normally within 24-48 hours, subject to failures).
- Account deletion blocks new photo operations, deletes the user's Storage prefix, then deletes Firestore and Authentication data. In-flight uploads check the deletion flag and remove themselves.

## Profile save optimization (October 19)

- Profile now skips unchanged general preferences, sleep target and nutrition
  target writes. Mixed edits retain their existing validation and stage/write/commit
  order; failed saves retain drafts. Photo removal still uses the existing commit.
- Photo-only replacements use the existing authenticated stage/commit calls,
  without unrelated preference writes. Failed commit attempts best-effort discard
  the staged upload; cleanup failure does not replace the original save error.
- Native interruption/retry passed against that backend: connection loss during
  an upload request reported failure without a commit; the retained draft saved
  on retry and its cloud photo loaded after restarting the app.
- An optional one-call upload/commit and normalized-image-cache optimization was
  prepared and tested locally, then separated into an ignored local patch before
  committing the Profile migration. It is not included in this branch's source
  or deployed. Reintroducing it requires code review, an explicitly authorized
  `stageProfilePhoto` deployment, and fresh native persistence/failure/timing checks.

## Deployment prerequisites

Read-only checks on October 12, 2026 confirmed that `lastrep-ebac5.firebasestorage.app` exists in `ASIA-NORTHEAST3`, billing is enabled, and bucket IAM has no `allUsers`/`allAuthenticatedUsers` bindings. At that time uniform bucket-level access was disabled, and uploads explicitly used a private object ACL. On October 13, 2026 the bucket was migrated to uniform access with public access prevention enforced, as recorded below.

1. Confirm Firebase Storage is initialized for `lastrep-ebac5` and billing is enabled. Verify the default bucket matches `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` (`lastrep-ebac5.firebasestorage.app` in this workspace). Do not create a public bucket or grant `allUsers`/`allAuthenticatedUsers` object access. The runtime service account needs access to this bucket.
   Keep public access prevention enforced and uniform access enabled. All deployed photo functions currently use `lastrep-ebac5@appspot.gserviceaccount.com`, which has bucket-scoped `roles/storage.objectUser` for object creation, reading, listing, and deletion. Its existing project Editor access provides bucket metadata access required by uploads; if that project role is reduced later, preserve `storage.buckets.get` separately. Do not assume object ownership or object ACLs provide runtime access.
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

## Checksum follow-up verification - October 13, 2026

- Read-only bucket listing succeeded. The existing photo object (13,173 bytes) has stored CRC32C metadata.
- Downloading that exact object generation through the Storage API returned HTTP 403 with the existing Firebase CLI identity. Independent comparison of the stored CRC32C with downloaded bytes remains blocked; metadata presence alone does not prove a match.
- Cloud Monitoring returned HTTP 404 (descriptor not found) for `storage.googleapis.com/api/object_checksummed_write_count`. This metric could not be used to verify checksum write counts in this project at the time of the check.
- No bucket permissions, objects, or app/account data were changed. Complete the independent comparison using an identity already authorized to read the object, or after an explicitly approved access change. Previous live application upload/download validation remains the available end-to-end evidence.
- Subsequently, the user granted the Firebase CLI account bucket-scoped Storage Object Viewer access. A read-only verification downloaded the existing JPEG into memory, pinned to its listed object generation. Its 13,173-byte size and independently calculated CRC32C both matched Storage metadata. No photo was written to disk, and no cloud objects or account data were modified. This completes the independent stored-object checksum comparison for that photo; it does not establish checksum coverage for all future writes. The temporary role can now be removed.
- After verification, removed the temporary unconditional bucket-level `roles/storage.objectViewer` grant for `user:kjeehwan@gmail.com` at the user's request. Read-back confirmed that the grant was absent and all other bucket IAM bindings were preserved.

## Bucket access hardening - October 13, 2026

- Verified the deployed service account for upload, commit, download, discard, scheduled cleanup, and account deletion before migration.
- Added bucket-scoped `roles/storage.objectUser` for that runtime account, preserving all existing bucket IAM bindings. No project-wide roles were added or removed.
- Enabled `iamConfiguration.uniformBucketLevelAccess.enabled` and set `iamConfiguration.publicAccessPrevention` to `enforced`, using a metageneration precondition. Read-back confirmed both settings and no public IAM principals. Uniform access becomes locked on January 11, 2027 after 90 consecutive days; reversing it before then is subject to Google's requirements.
- Live deployed-function checks passed using two disposable accounts and synthetic JPEGs: upload/commit/download with independently matching CRC32C, public and unauthenticated access rejection, cross-account rejection, discard preserving the active photo, replacement/removal deleting the previous live objects, and account deletion cleaning up remaining live objects. Both disposable accounts were deleted. Existing users and photos were not modified.
- Added a regression test asserting that uniform-access uploads omit `predefinedAcl` and retain CRC32C validation. All 13 backend photo tests and the backend TypeScript build passed.
- The existing deployed backend already supports uniform access; no function deployment or mobile/AAB rebuild was needed. Live API tests do not replace a device UI smoke test, but no mobile code changed in this migration.
