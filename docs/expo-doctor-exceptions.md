# Expo Doctor exceptions

React Navigation install exclusions were removed on October 13, 2026. Dependency
validation now runs without those exclusions.

`appConfigFieldsNotSyncedCheck` remains intentionally disabled. Android is tracked
and manually maintained, including dev/prod flavors, native workout inputs, health
integration and release optimization. EAS does not synchronize app config into
these checked-in files. Do not delete Android or run clean prebuild to silence this
warning.

Run `npm run verify:android-native` after changing Expo or native configuration.
CI runs the same command. It checks custom native registrations and files, then
evaluates both app variants in isolated processes and checks package IDs, names,
deep-link placeholders, explicitly configured permissions, orientation/resizing,
UI style, release build properties and existence of branding sources/resources.

These are targeted source checks, not a complete replacement for Prebuild or a
Gradle build. Config plugin side effects, merged dependency manifests, Firebase
credentials, asset pixel equivalence, iOS configuration and device behavior are
not verified by this command. Firebase placeholder paths are used only while
evaluating configuration; no credentials or native files are modified. Review
plugin changes in native code and perform the relevant build/device checks.
