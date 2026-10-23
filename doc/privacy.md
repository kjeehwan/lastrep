# Lastrep Privacy Policy

**Effective Date:** October 23, 2026

Lastrep ("we", "our", or "us") operates the Lastrep mobile application.

## 1. Information We Collect

When you use Lastrep, we may collect and store:

- Account information, including your email address, through Firebase Authentication.
- Profile information you choose to provide, such as a nickname, description, and profile photo. When you save a profile photo in a version supporting cloud photos, Lastrep uploads a resized image to private Firebase Cloud Storage and stores its reference with your account so it can appear across your signed-in devices.
- Fitness data you enter in Lastrep, including workouts, exercise history, nutrition entries, goals, body-composition entries, and recovery check-ins.
- Optional daily context you choose to provide, such as pain or discomfort, the affected body area, severity, movement triggers, additional physical activity, and free-text notes.
- Workout-planning and performance information, such as a selected routine, recent sets, repetitions, weight, volume, and perceived exertion.
- Optional health data you choose to connect on Android: daily step counts, sleep sessions and duration, weight, body-fat percentage, and lean body mass when those records are available from your connected health service.
- Purchase history and subscription information through RevenueCat and Google Play, such as purchased products and subscription status.
- App usage and interaction information through Firebase Analytics, such as sessions, screen views, and subscription-related button actions and events.
- Device and app identifiers, such as app-instance identifiers and, where available and enabled, Android advertising identifiers collected by Firebase Analytics.
- Approximate location inferred by Firebase Analytics from masked IP addresses. Lastrep does not request GPS location permission for this analytics use.
- Basic device and diagnostic information needed to operate, secure, and troubleshoot the app, such as request timing, errors, and limited health-sync metadata.
- Product barcodes you scan or enter for nutrition lookups through Open Food Facts.

Health data can be sensitive. Lastrep does not read optional health data until you choose to connect health sync and grant the required permissions.

## 2. How We Use Information

We use this information to:

- Provide authentication and secure access to your account.
- Display your optional profile photo on your Profile, Home, and related profile views, and restore cloud-backed photos across your signed-in installations.
- Save and display your workout, nutrition, body-composition, sleep, and recovery history.
- Display optional daily step counts in Home Daily movement, with their date and last-read time.
- Generate in-app training and recovery insights, including Today's Plan, from relevant information in your account.
- Adapt recommendations using factors such as your planned workout, recent performance, recovery check-in, nutrition summary, connected health summaries, and optional daily context.
- Manage subscriptions and provide support.
- Understand app usage and subscription flows through analytics and improve the user experience.
- Look up nutrition information for products using their barcodes.
- Improve app reliability, diagnose errors, and protect the service.

We do not sell health data or use it for advertising or advertising-based profiling.

## 3. Optional Health Sync

On supported Android devices, Lastrep may request permission to read supported data through Health Connect and, where available, other connected health services such as Samsung Health. The exact data available depends on your device, permissions, and connected apps.

When you connect health sync, Lastrep uses imported sleep and body-measurement records to show sleep, recovery, and body-composition trends. Relevant sleep and body-composition summaries may also support training and recovery recommendations, including Today's Plan.

Steps require separate consent in Lastrep and read permission in Health Connect. While you use the app, Lastrep reads today's aggregated step count for your local calendar day and displays it in Home Daily movement. It does not track steps using phone sensors or request background health access. Steps are display-only: they are not used to estimate calories, adjust nutrition targets or generate AI recommendations.

Imported summaries, including a dated steps snapshot and its last-read time, are saved locally and with your Lastrep account so they can appear across your signed-in sessions. Previously saved values can remain visible while offline or disconnected, with their original date and status.

Health sync is optional. You can:

- Decline the connection request.
- Disconnect health sync in Lastrep to stop future reads.
- Revoke Lastrep's health permissions in Health Connect or the relevant connected health service.
- Delete your Lastrep account and associated app data from Settings.

Disconnecting health sync does not automatically delete records that were previously imported into your Lastrep account. Use account deletion if you want to remove your account and associated app data.

## 4. AI-Generated Recommendations

Lastrep uses the OpenAI API to help generate certain training and recovery decisions and explanations. When you request an AI-generated recommendation, Lastrep may send only the information relevant to that request, such as:

- Sleep and recovery summaries.
- Soreness, fatigue, and motivation ratings.
- Nutrition summaries and targets.
- Training and diet phases.
- Planned workouts and recent workout-performance summaries.
- Pain, discomfort, additional activity, or daily notes that you choose to provide.

Lastrep does not intentionally include your email address, nickname, profile photo, or Firebase user identifier in the prompt sent to OpenAI. The information is sent to produce the recommendation you requested and is not used by Lastrep for advertising.

Lastrep requests that OpenAI not store generated responses as application state. OpenAI may still temporarily retain API inputs and outputs in abuse-monitoring logs under its applicable API data controls. OpenAI states that API data is not used to train or improve its models unless the API customer explicitly opts in.

AI-generated recommendations may be inaccurate and are intended for general fitness guidance, not medical diagnosis or treatment. Do not rely on Lastrep for emergency or medical decisions.

## 5. Service Providers and Data Sharing

Lastrep uses the following service providers to operate the app:

- Firebase and Google Cloud for authentication, app data and profile-photo storage, backend services, diagnostics, and Firebase Analytics.
- OpenAI for generating certain training and recovery recommendations and explanations.
- RevenueCat for subscription management.
- Google Play for billing and app distribution.
- Open Food Facts for product barcode lookups. The barcode is sent to its service, which also receives standard network information such as your IP address. Lastrep does not intentionally include your account details, health records, or camera images in these lookup requests.
- Health Connect and connected health services only when you choose to grant Lastrep access.

We disclose information to these providers only as needed to provide, secure, and support Lastrep. We do not sell personal or health data. Their handling of information is governed by their applicable terms and privacy policies.

## 6. Your Choices and Controls

- Adding a profile photo is optional. In versions supporting cloud photos, choosing a photo creates a local preview; the photo is uploaded when you save your profile changes. Discarding unsaved changes keeps your previously saved photo, or the initials placeholder if no photo was saved. To remove a saved photo, choose Remove photo and save the change.
- Providing pain, discomfort, additional-activity details, and daily notes is optional.
- You can use Lastrep without connecting Health Connect or another health service.
- You can disconnect health sync to stop future reads and revoke permissions through your connected health service.
- You can edit or delete supported records through the relevant Lastrep feature where that control is available.
- You can request deletion of selected Lastrep data without deleting your account by emailing lastrep.dev@gmail.com with the subject "Data Deletion Request". Include your account email and the record types or date range you want deleted. We may need to verify your identity before processing the request; do not send your password.
- You can delete your Lastrep account from Settings. Account deletion removes your authentication account and associated Lastrep data stored under that account.

## 7. Data Retention

Lastrep retains account and app data while your account is active and as needed to provide the service. Date-scoped context may be retained with your account so that recommendations and history remain understandable. We remove associated Lastrep account data when you complete account deletion, subject to limited retention where required for security, fraud prevention, legal compliance, or operational backup processes.

Disconnecting a health service stops future access by Lastrep but does not automatically delete information already imported and stored in your Lastrep account.

Requests to delete selected records are processed as soon as reasonably possible after verification, subject to the limited retention described above. Deleting imported data in Lastrep does not delete the original records in your connected health service. If sync remains enabled, those records may be imported again. Deleting your Lastrep account does not automatically cancel a Google Play subscription; manage or cancel it through Google Play.

Information sent to service providers may be retained according to their applicable terms and data-retention controls. OpenAI's default API abuse-monitoring logs may retain API inputs and outputs for up to 30 days unless a different retention control applies or longer retention is legally required.

## 8. Camera and Photos

The app may request photo-library or camera access when you choose to add a profile photo, and camera access when you choose to scan a food barcode. Barcode recognition takes place on your device; the decoded barcode, not the camera image, is sent for the product lookup. You can enter a barcode manually without granting camera permission.

In versions supporting cloud photos, Lastrep sends the selected image to its Firebase/Google Cloud backend when you save your profile changes. The backend resizes the image and removes unnecessary image metadata before saving the processed photo in private cloud storage linked to your account. Profile photos are not sent to OpenAI for recommendations.

Access to a cloud-backed photo requires authentication to the owning account; photos are not published as public profile images. Saved photos can be restored after reinstalling Lastrep or signing in on another supported installation. Lastrep may cache photos locally for faster display and clears its account-specific photo cache when you sign out or delete your account. Uninstalling the app does not delete a cloud-backed photo from your account.

Saving a replacement or removal deletes the previous photo from active cloud storage. Account deletion also includes cloud-backed profile photos. Temporary uploads that are not committed to your profile are cleaned up automatically. Limited backup or recovery copies may remain temporarily under the retention described in Section 7 and the storage provider's applicable policies. Removing a photo from Lastrep does not delete the original image from your device's photo library.

Older app versions may store profile photos only locally; those images may be lost if you uninstall the app or clear its local data before saving them with a cloud-photo-capable version. Lastrep does not use camera or photo permissions for background recording or surveillance.

## 9. Data Security

We use Firebase and Google Cloud infrastructure and take reasonable measures designed to protect the information stored in Lastrep. Data transmitted between the app, our backend, and service providers is sent using encrypted network connections such as HTTPS. No method of electronic storage or transmission is completely secure.

## 10. Children's Privacy

Lastrep is not directed to children under 13.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Updates will be reflected with a new effective date.

## 12. Contact

For privacy questions or requests, contact:

lastrep.dev@gmail.com
