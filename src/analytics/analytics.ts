import type { MonetizationAnalyticsEvent } from "../contracts";
import Constants from "expo-constants";
import { getApp } from "@react-native-firebase/app";
import {
  getAnalytics,
  getAppInstanceId,
  logEvent as logFirebaseEvent,
  setAnalyticsCollectionEnabled,
} from "@react-native-firebase/analytics";
import { Platform } from "react-native";

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

function getPlatformOs(): string | undefined {
  return Platform.OS;
}

function getExpoPackageName(): string | undefined {
  const constantsModule = Constants as unknown as ExpoConstantsModule;
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

    const analytics = getAnalytics(getApp());
    const sanitizedParams = sanitizeAnalyticsParams(params);
    await logFirebaseEvent(analytics, name, sanitizedParams);
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

      const app = getApp();
      const analytics = getAnalytics(app);
      const appInstanceId = await getAppInstanceId(analytics).catch(() => null);

      let analyticsCollectionEnabledForced = false;
      await setAnalyticsCollectionEnabled(analytics, true);
      analyticsCollectionEnabledForced = true;

      const appInstanceIdAfterEnable = await getAppInstanceId(analytics).catch(() => null);

      const diagnostics: FirebaseDiagnostics = {
        packageName: getExpoPackageName(),
        firebaseProjectId: app.options?.projectId,
        googleAppId: app.options?.appId,
        measurementId: app.options?.measurementId,
        automaticDataCollectionEnabled: app.automaticDataCollectionEnabled,
        analyticsCollectionEnabledForced,
        analyticsAppInstanceIdPresent: Boolean(appInstanceId),
        analyticsAppInstanceIdPresentAfterEnable: Boolean(appInstanceIdAfterEnable),
      };

      console.log("[analytics] runtime_diagnostics", diagnostics);
    } catch (error) {
      console.log("[analytics] diagnostics_failed", error);
    }
  })();

  return analyticsDiagnosticsPromise;
}
