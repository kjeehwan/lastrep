const { withAndroidManifest } = require("@expo/config-plugins");

// Android 14+ discovers a Health Connect app's permission rationale via this
// protected alias. Keep older Android's rationale filter on MainActivity too.
module.exports = function withHealthPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const aliases = app["activity-alias"] ?? [];
    const name = "ViewHealthPermissionUsageActivity";
    app["activity-alias"] = [...aliases.filter((alias) => alias.$["android:name"] !== name), {
      $: { "android:name": name, "android:exported": "true", "android:targetActivity": ".MainActivity", "android:permission": "android.permission.START_VIEW_PERMISSION_USAGE" },
      "intent-filter": [{ action: [{ $: { "android:name": "android.intent.action.VIEW_PERMISSION_USAGE" } }], category: [{ $: { "android:name": "android.intent.category.HEALTH_PERMISSIONS" } }] }],
    }];
    return cfg;
  });
};
