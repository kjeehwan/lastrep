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

const UID_PREFIX_LENGTH = 8;
let analyticsDiagnosticsPromise: Promise<void> | null = null;

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
    const { Platform } = require("react-native") as { Platform?: { OS?: string } };
    if (Platform?.OS !== "android") return;

    if (__DEV__) {
      void logAnalyticsRuntimeDiagnostics();
    }

    const analyticsModule = require("@react-native-firebase/analytics") as {
      default?: () => { logEvent: (eventName: string, eventParams?: Record<string, unknown>) => Promise<void> };
    };
    const analyticsFactory = analyticsModule.default;
    if (!analyticsFactory) return;

    const sanitizedParams = sanitizeAnalyticsParams(params);
    await analyticsFactory().logEvent(name, sanitizedParams);
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
      const { Platform } = require("react-native") as { Platform?: { OS?: string } };
      if (Platform?.OS !== "android") return;

      const constantsModule = require("expo-constants") as { default?: Record<string, unknown> };
      const firebaseAppModule = require("@react-native-firebase/app") as {
        getApp?: () => {
          name?: string;
          options?: {
            projectId?: string;
            appId?: string;
            measurementId?: string;
          };
          automaticDataCollectionEnabled?: boolean;
        };
        default?: {
          app?: () => {
            name?: string;
            options?: {
              projectId?: string;
              appId?: string;
              measurementId?: string;
            };
            automaticDataCollectionEnabled?: boolean;
          };
        };
        metaGetAll?: () => Promise<Record<string, boolean | string>>;
        jsonGetAll?: () => Promise<Record<string, boolean | string>>;
        preferencesGetAll?: () => Promise<Record<string, boolean | string>>;
      };
      const analyticsModule = require("@react-native-firebase/analytics") as {
        default?: () => {
          getAppInstanceId?: () => Promise<string | null>;
          setAnalyticsCollectionEnabled?: (enabled: boolean) => Promise<void>;
        };
      };

      const app = firebaseAppModule.getApp?.() ?? firebaseAppModule.default?.app?.();
      const analytics = analyticsModule.default?.();

      const [meta, json, preferences, appInstanceId] = await Promise.all([
        firebaseAppModule.metaGetAll?.().catch(() => undefined),
        firebaseAppModule.jsonGetAll?.().catch(() => undefined),
        firebaseAppModule.preferencesGetAll?.().catch(() => undefined),
        analytics?.getAppInstanceId?.().catch(() => null),
      ]);

      let analyticsCollectionEnabledForced = false;
      if (analytics?.setAnalyticsCollectionEnabled) {
        await analytics.setAnalyticsCollectionEnabled(true);
        analyticsCollectionEnabledForced = true;
      }

      const appInstanceIdAfterEnable = await analytics?.getAppInstanceId?.().catch(() => null);

      const expoConfig = (constantsModule.default?.expoConfig ?? {}) as {
        android?: { package?: string };
      };

      const diagnostics: FirebaseDiagnostics = {
        packageName: expoConfig.android?.package,
        firebaseProjectId: app?.options?.projectId,
        googleAppId: app?.options?.appId,
        measurementId: app?.options?.measurementId,
        automaticDataCollectionEnabled: app?.automaticDataCollectionEnabled,
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
