import type { MonetizationAnalyticsEvent } from "../contracts";

type AnalyticsParamValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsParamValue>;
type FirebaseDiagnostics = {
  packageName?: string;
  firebaseProjectId?: string;
  googleAppId?: string;
  measurementId?: string;
  automaticDataCollectionEnabled?: boolean;
  analyticsCollectionEnabledForced?: boolean;
  analyticsAppInstanceIdPresent?: boolean;
  analyticsAppInstanceIdPresentAfterEnable?: boolean;
  metaAnalyticsCollectionEnabled?: boolean | string;
  metaAnalyticsCollectionDeactivated?: boolean | string;
  metaAutomaticScreenReportingEnabled?: boolean | string;
  jsonAnalyticsAutoCollectionEnabled?: boolean | string;
  jsonAnalyticsCollectionDeactivated?: boolean | string;
  preferenceKeys?: string[];
};

type FirebaseAppModule = {
  getApp: () => {
    options?: {
      projectId?: string;
      appId?: string;
      measurementId?: string;
    };
    automaticDataCollectionEnabled?: boolean;
  };
  metaGetAll: () => Promise<Record<string, boolean | string>>;
  jsonGetAll: () => Promise<Record<string, boolean | string>>;
  preferencesGetAll: () => Promise<Record<string, boolean | string>>;
};

type FirebaseAnalyticsModule = {
  getAnalytics: (app?: unknown) => unknown;
  getAppInstanceId: (analytics: unknown) => Promise<string | null>;
  logEvent: (
    analytics: unknown,
    name: string,
    params?: Record<string, string | number | boolean>
  ) => Promise<void>;
  setAnalyticsCollectionEnabled: (analytics: unknown, enabled: boolean) => Promise<void>;
};

type ExpoConstantsModule = {
  default?: {
    expoConfig?: {
      android?: {
        package?: string;
      };
    };
  };
};

const UID_PREFIX_LENGTH = 8;
let analyticsDiagnosticsPromise: Promise<void> | null = null;

function getFirebaseAppModule(): FirebaseAppModule {
  return require("@react-native-firebase/app") as FirebaseAppModule;
}

function getFirebaseAnalyticsModule(): FirebaseAnalyticsModule {
  return require("@react-native-firebase/analytics") as FirebaseAnalyticsModule;
}

function getPlatformOs(): string | undefined {
  const reactNative = require("react-native") as {
    Platform?: { OS?: string };
  };

  return reactNative.Platform?.OS;
}

function getExpoPackageName(): string | undefined {
  const constantsModule = require("expo-constants") as ExpoConstantsModule;
  return constantsModule.default?.expoConfig?.android?.package;
}

export function getUidPrefix(uid?: string | null): string | undefined {
  if (!uid) return undefined;
  return uid.slice(0, UID_PREFIX_LENGTH);
}

export function sanitizeAnalyticsParams(
  params?: AnalyticsParams
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;

  const sanitizedEntries = Object.entries(params).filter(([, value]) => {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return typeof value === "number" || typeof value === "boolean";
  });

  if (sanitizedEntries.length === 0) return undefined;

  return Object.fromEntries(sanitizedEntries) as Record<string, string | number | boolean>;
}

export async function logAnalyticsEvent(
  name: MonetizationAnalyticsEvent,
  params?: AnalyticsParams
): Promise<void> {
  try {
    if (getPlatformOs() !== "android") return;

    if (__DEV__) {
      void logAnalyticsRuntimeDiagnostics();
    }

    const firebaseApp = getFirebaseAppModule();
    const analyticsModule = getFirebaseAnalyticsModule();
    const app = firebaseApp.getApp();
    const analytics = analyticsModule.getAnalytics(app);
    const sanitizedParams = sanitizeAnalyticsParams(params);

    await analyticsModule.logEvent(analytics, name, sanitizedParams);
  } catch (error) {
    if (__DEV__) {
      console.log("[analytics] log_failed", { name, error });
    }
  }
}

export async function logAnalyticsRuntimeDiagnostics(): Promise<void> {
  if (!__DEV__) return;
  if (analyticsDiagnosticsPromise) return analyticsDiagnosticsPromise;

  analyticsDiagnosticsPromise = (async () => {
    try {
      if (getPlatformOs() !== "android") return;

      const firebaseApp = getFirebaseAppModule();
      const analyticsModule = getFirebaseAnalyticsModule();
      const app = firebaseApp.getApp();
      const analytics = analyticsModule.getAnalytics(app);

      const [meta, json, preferences, appInstanceId] = await Promise.all([
        firebaseApp.metaGetAll().catch(() => undefined),
        firebaseApp.jsonGetAll().catch(() => undefined),
        firebaseApp.preferencesGetAll().catch(() => undefined),
        analyticsModule.getAppInstanceId(analytics).catch(() => null),
      ]);

      let analyticsCollectionEnabledForced = false;
      await analyticsModule.setAnalyticsCollectionEnabled(analytics, true);
      analyticsCollectionEnabledForced = true;

      const appInstanceIdAfterEnable = await analyticsModule
        .getAppInstanceId(analytics)
        .catch(() => null);

      const diagnostics: FirebaseDiagnostics = {
        packageName: getExpoPackageName(),
        firebaseProjectId: app.options?.projectId,
        googleAppId: app.options?.appId,
        measurementId: app.options?.measurementId,
        automaticDataCollectionEnabled: app.automaticDataCollectionEnabled,
        analyticsCollectionEnabledForced,
        analyticsAppInstanceIdPresent: Boolean(appInstanceId),
        analyticsAppInstanceIdPresentAfterEnable: Boolean(appInstanceIdAfterEnable),
        metaAnalyticsCollectionEnabled: meta?.firebase_analytics_collection_enabled,
        metaAnalyticsCollectionDeactivated: meta?.firebase_analytics_collection_deactivated,
        metaAutomaticScreenReportingEnabled: meta?.google_analytics_automatic_screen_reporting_enabled,
        jsonAnalyticsAutoCollectionEnabled: json?.analytics_auto_collection_enabled,
        jsonAnalyticsCollectionDeactivated: json?.analytics_collection_deactivated,
        preferenceKeys: preferences ? Object.keys(preferences).sort() : undefined,
      };

      console.log("[analytics] runtime_diagnostics", diagnostics);
    } catch (error) {
      console.log("[analytics] diagnostics_failed", error);
    }
  })();

  return analyticsDiagnosticsPromise;
}
