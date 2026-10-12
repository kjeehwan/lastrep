# RevenueCat build isolation

## Cause and code fix

The standalone dev release uses `com.kjeehwan.lastrep.dev`, but `__DEV__` is
false. Root bootstrap therefore initialized RevenueCat. The package detector
also incorrectly read `Constants.default.expoConfig` instead of
`Constants.expoConfig`, so the existing dev paywall guard did not recognize it.

The package detector now reads the exported Expo config. Root bootstrap and
identity sync skip dev packages, including standalone releases. Explicit billing
operations in dev packages fail before SDK configuration with
`dev_billing_unavailable`; the paywall retains its explanation to test billing
in the Play-installed app. Production SDK configuration is unchanged.

This isolates dev billing; it does not prove that production store products are
configured correctly. No RevenueCat or Google Play dashboard configuration was
changed or verified by this code fix.

## Production verification before tester release

- Confirm the RevenueCat Google Play app uses `com.kjeehwan.lastrep` and the
  production EAS Android API key belongs to that app.
- Confirm `lastrep_premium_monthly` and `lastrep_premium_annual` exist in Play,
  have active base plans and availability for the tester's country.
- Confirm the RevenueCat `default` offering includes the monthly/annual
  packages and the products grant the `premium` entitlement.
- Using a license tester and a Play-installed production build, check displayed
  prices, test purchase, entitlement activation and restore. Do not use the
  separately packaged dev app to verify production products.

Regression tests cover standalone dev detection, skipped initialization and
identity sync, blocked explicit dev configuration, and production SDK setup.

## Reference

- https://revenuecat.github.io/codelabs/troubleshooting/fetching-offerings/index.html
