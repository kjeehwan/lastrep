# Dependency security review

Reviewed October 12, 2026, after the Expo SDK 57 patch batch.

## Results

| Dependency tree | Before | After |
| --- | --- | --- |
| App | 61: 3 critical, 37 high, 20 moderate, 1 low | 35: 26 high, 9 moderate |
| Firebase Functions | 0 | 0 (unchanged) |

Counts include vulnerable parent packages inherited from transitive dependencies;
35 warnings do not represent 35 independent defects. No critical advisories remain
in this audit snapshot. This does not prove that the application is vulnerability-free.

## Changes

- Updated compatible JavaScript dependency releases, including Babel, protobufjs,
  shell-quote, websocket-driver, XML/YAML parsers, glob matchers, CSS tooling and Vitest.
- Raised the Vitest manifest minimum to 4.1.11.
- Scoped overrides keep gRPC on a patched 1.x release and legacy brace-expansion
  on a patched 1.x release. Firebase's older gRPC minor constraint otherwise prevents
  the security update. Verify Firestore integration when changing this override.
- Added lockfile regression tests for the three previously critical package roots,
  gRPC and Vitest. These are not a substitute for running npm audit.
- Replaced the vulnerable URI decoder with upstream 0.5.0 through a two-line
  local CommonJS adapter. The root dependency alias pins the actual fixed package;
  the npm override makes query-string, navigation and Expo Router use the adapter.
  No decoder algorithm was copied or modified. Tests cover actual Expo Router
  parsing, Unicode, OAuth-style parameters and long malformed input with a timeout.
  See `vendor/decode-uri-component-compat/README.md` for removal conditions.
- Kept Expo, React Native, RevenueCat, Health Connect and other direct native SDK
  versions unchanged from the tested patch batch. No backend deployment is required.
- Did not run npm audit fix --force: its suggestions include incompatible framework
  replacements and downgrades.

## Remaining Advisory Roots

| Package | Exposure and next action |
| --- | --- |
| braces | Nested glob pattern denial of service in build/lint/Metro tooling. No patched release listed. Keep tool configuration trusted and monitor an upstream fix. |
| node-forge | RSA verification advisory in Expo certificate tooling. No patched release listed. No direct application import or Expo code-signing configuration found in the repository. This does not exclude use by Expo tooling. Monitor upstream. |
| image-size | Malformed image parser denial of service in Metro asset processing. Metro expects the callable 1.x API; fixed 2.x changes that API. Keep repository assets trusted; upgrade when Metro integrates the fixed API, rather than forcing an incompatible override. |
| uuid | Buffer bounds advisory in v3/v5/v6. The inspected xcode consumer calls v4() without a supplied buffer; the reported vulnerable operation was not found there. Keep the legacy tooling dependency until a compatible upstream update rather than overriding every uuid major. |

Advisory references:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm (braces)
- https://github.com/advisories/GHSA-86w9-cpqp-85rv (node-forge)
- https://github.com/advisories/GHSA-vcc3-ghjq-m6fr (URI decoding)
- https://github.com/advisories/GHSA-w5hq-g745-h8pq (uuid)

## Rechecking

Validation for this batch: 161 tests passed, 14 emulator-only tests skipped;
lint, app TypeScript, Functions build, native configuration verification, Expo
dependency check, Expo doctor (20/20 with the existing native-config sync check
disabled), web export, Android export (Hermes bytecode) and git whitespace checks
passed. A clean `npm ci` also
confirmed that the adapter resolves without relying on a previous installation.
Direct native SDK versions were compared against the patch commit and are
unchanged. No Android rebuild was needed for this security batch. User-confirmed
device smoke tests passed for navigation and workout input.

Run `npm audit` in the project root and `npm --prefix functions audit` separately.
Audit exits nonzero while the above advisories remain. Do not suppress them or
interpret a successful lint/test/export as proof that these advisories are fixed.
After dependency changes, run tests, lint, TypeScript, Expo doctor, web export and
native configuration verification; use a device smoke test for runtime changes.
