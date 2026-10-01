import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import type { PurchaseResult, RestoreResult } from "../contracts";
import { REVENUECAT_API_KEY_ANDROID } from "../config/billingConfig";
import { isExpectedOfflineMessage } from "../utils/networkErrors";

type BillingOperation =
  | "configure"
  | "logIn"
  | "logInPostCheck"
  | "logOut"
  | "getOfferings"
  | "syncPurchases"
  | "purchasePackage"
  | "restorePurchases"
  | "getCustomerInfo"
  | "getAppUserId";

type BillingLogEvent = {
  op: BillingOperation;
  ok: boolean;
  latencyMs: number;
  code?: string;
  uidPrefix?: string;
};

export type BillingError = {
  code: string;
  message: string;
};

const UID_PREFIX_LENGTH = 8;
const IS_ANDROID = Platform.OS === "android";
const DEV_ANDROID_PACKAGE_SUFFIX = ".dev";

type ExpoConstantsModule = {
  default?: {
    expoConfig?: {
      android?: {
        package?: string;
      };
    };
  };
};

let configured = false;
let configurePromise: Promise<void> | null = null;
let activeFirebaseUid: string | null = null;
let ensureLoginPromise: Promise<void> | null = null;
let ensureLoginUid: string | null = null;

function toUidPrefix(uid?: string | null): string | undefined {
  if (!uid) return undefined;
  return uid.slice(0, UID_PREFIX_LENGTH);
}

function logBillingEvent(event: BillingLogEvent) {
  console.log(`[billing] ${JSON.stringify(event)}`);
}

function getAndroidPackageName(): string | undefined {
  const constantsModule = Constants as unknown as ExpoConstantsModule;
  return constantsModule.default?.expoConfig?.android?.package;
}

function isDevAndroidPackage(): boolean {
  const packageName = getAndroidPackageName();
  return Boolean(packageName && packageName.endsWith(DEV_ANDROID_PACKAGE_SUFFIX));
}

export function isDevBillingBuild(): boolean {
  return IS_ANDROID && isDevAndroidPackage();
}

function toBillingError(error: unknown): BillingError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return error as BillingError;
  }

  const codeFromError =
    typeof (error as { code?: unknown } | undefined)?.code === "string"
      ? (error as { code: string }).code
      : typeof (error as { code?: unknown } | undefined)?.code === "number"
        ? String((error as { code: number }).code)
        : "unknown_error";

  const messageFromError =
    typeof (error as { message?: unknown } | undefined)?.message === "string"
      ? (error as { message: string }).message
      : "Unexpected RevenueCat error";

  return { code: codeFromError, message: messageFromError };
}

function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    (error as { userCancelled?: unknown }).userCancelled === true
  );
}

function isPurchaseCancelledError(error: unknown): boolean {
  if (isUserCancelled(error)) {
    return true;
  }

  const code =
    typeof (error as { code?: unknown } | undefined)?.code === "string"
      ? (error as { code: string }).code.toLowerCase()
      : "";
  const message =
    typeof (error as { message?: unknown } | undefined)?.message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";

  return (
    code.includes("purchasecancellederror") ||
    code.includes("user_canceled") ||
    message.includes("purchasecancellederror") ||
    message.includes("user_canceled") ||
    message.includes("user canceled") ||
    message.includes("user cancelled")
  );
}

function shouldSuppressRevenueCatLog(logLevel: LOG_LEVEL, message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  const isCancellationNoise =
    normalizedMessage.includes("purchasecancellederror") ||
    normalizedMessage.includes("user_canceled") ||
    normalizedMessage.includes("user canceled") ||
    normalizedMessage.includes("user cancelled");
  const isBillingDisconnectNoise =
    normalizedMessage.includes("billing service disconnected") ||
    normalizedMessage.includes("billing is disconnected and purchase methods won't work") ||
    normalizedMessage.includes("billing is disconnected and purchase methods won''t work");
  const isBillingUnavailableNoise =
    normalizedMessage.includes("billing_unavailable") ||
    normalizedMessage.includes("billing service unavailable on device") ||
    normalizedMessage.includes("device or user is not allowed to make the purchase") ||
    normalizedMessage.includes("purchasenotallowederror");
  const isDevOfferingsConfigNoise =
    isDevAndroidPackage() &&
    (normalizedMessage.includes("none of the products registered in the revenuecat dashboard") ||
      normalizedMessage.includes("could be fetched from the play store") ||
      normalizedMessage.includes("offerings-empty") ||
      normalizedMessage.includes("error fetching offerings") ||
      normalizedMessage.includes("could not find productdetails") ||
      normalizedMessage.includes("missing productdetails") ||
      normalizedMessage.includes("product_not_found") ||
      normalizedMessage.includes("configuring-products"));

  if (isDevOfferingsConfigNoise) {
    return true;
  }

  if (logLevel === LOG_LEVEL.ERROR) {
    return (
      isCancellationNoise ||
      isBillingDisconnectNoise ||
      isBillingUnavailableNoise
    );
  }

  if (logLevel === LOG_LEVEL.WARN) {
    return isBillingDisconnectNoise || isBillingUnavailableNoise;
  }

  return false;
}

export function isExpectedDevBillingConfigurationError(error: unknown): boolean {
  if (!isDevAndroidPackage()) {
    return false;
  }

  const code =
    typeof (error as { code?: unknown } | undefined)?.code === "string"
      ? (error as { code: string }).code
      : "";
  const message =
    typeof (error as { message?: unknown } | undefined)?.message === "string"
      ? (error as { message: string }).message
      : "";
  const debugMessage =
    typeof (error as { underlyingErrorMessage?: unknown } | undefined)?.underlyingErrorMessage ===
    "string"
      ? (error as { underlyingErrorMessage: string }).underlyingErrorMessage
      : "";
  const combined = `${code} ${message} ${debugMessage}`.toLowerCase();

  return (
    combined.includes("configurationerror") ||
    combined.includes("none of the products registered in the revenuecat dashboard") ||
    combined.includes("could be fetched from the play store") ||
    combined.includes("offerings-empty") ||
    combined.includes("billing_unavailable") ||
    combined.includes("purchasenotallowederror")
  );
}

function revenueCatLogHandler(logLevel: LOG_LEVEL, message: string) {
  if (shouldSuppressRevenueCatLog(logLevel, message)) {
    return;
  }

  const formattedMessage = `[revenuecat] ${message}`;
  if (logLevel === LOG_LEVEL.ERROR && isExpectedOfflineMessage(message)) {
    if (__DEV__) {
      console.log(formattedMessage);
    }
    return;
  }
  if (logLevel === LOG_LEVEL.ERROR) {
    console.error(formattedMessage);
    return;
  }
  if (logLevel === LOG_LEVEL.WARN) {
    console.warn(formattedMessage);
    return;
  }
  if (__DEV__) {
    console.log(formattedMessage);
  }
}

function ensureSupportedPlatform() {
  if (!IS_ANDROID) {
    throw {
      code: "platform_unsupported",
      message: "RevenueCat is only configured for Android in this phase.",
    } as BillingError;
  }
}

async function runBillingOperation<T>(
  op: BillingOperation,
  task: () => Promise<T>,
  uid?: string | null
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await task();
    logBillingEvent({
      op,
      ok: true,
      latencyMs: Date.now() - startedAt,
      uidPrefix: toUidPrefix(uid),
    });
    return result;
  } catch (error) {
    const normalized = toBillingError(error);
    logBillingEvent({
      op,
      ok: false,
      latencyMs: Date.now() - startedAt,
      code: normalized.code,
      uidPrefix: toUidPrefix(uid),
    });
    throw normalized;
  }
}

export async function configureRevenueCat(): Promise<void> {
  if (!IS_ANDROID) return;
  if (configured) return;
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    const startedAt = Date.now();
    try {
      const apiKey = REVENUECAT_API_KEY_ANDROID?.trim();
      if (!apiKey) {
        throw {
          code: "missing_api_key",
          message: "EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID is not set.",
        } as BillingError;
      }

      await Purchases.setLogLevel(LOG_LEVEL.INFO);
      Purchases.setLogHandler(revenueCatLogHandler);
      Purchases.configure({ apiKey });
      configured = true;

      logBillingEvent({
        op: "configure",
        ok: true,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      const normalized = toBillingError(error);
      logBillingEvent({
        op: "configure",
        ok: false,
        latencyMs: Date.now() - startedAt,
        code: normalized.code,
      });
      throw normalized;
    } finally {
      configurePromise = null;
    }
  })();

  return configurePromise;
}

async function verifyAppUserId(firebaseUid: string): Promise<void> {
  let appUserId = await runBillingOperation("getAppUserId", () => Purchases.getAppUserID(), firebaseUid);
  if (appUserId === firebaseUid) {
    logBillingEvent({
      op: "logInPostCheck",
      ok: true,
      latencyMs: 0,
      uidPrefix: toUidPrefix(firebaseUid),
    });
    return;
  }

  await runBillingOperation("logIn", () => Purchases.logIn(firebaseUid), firebaseUid);
  activeFirebaseUid = firebaseUid;
  appUserId = await runBillingOperation("getAppUserId", () => Purchases.getAppUserID(), firebaseUid);

  if (appUserId !== firebaseUid) {
    logBillingEvent({
      op: "logInPostCheck",
      ok: false,
      latencyMs: 0,
      uidPrefix: toUidPrefix(firebaseUid),
      code: "identity_mismatch",
    });
    throw {
      code: "identity_mismatch",
      message: "RevenueCat identity mismatch after login.",
    } as BillingError;
  }

  logBillingEvent({
    op: "logInPostCheck",
    ok: true,
    latencyMs: 0,
    uidPrefix: toUidPrefix(firebaseUid),
  });
}

async function startEnsureRevenueCatLoggedIn(firebaseUid: string): Promise<void> {
  ensureLoginUid = firebaseUid;
  ensureLoginPromise = (async () => {
    await runBillingOperation("logIn", () => Purchases.logIn(firebaseUid), firebaseUid);
    activeFirebaseUid = firebaseUid;
    await verifyAppUserId(firebaseUid);
  })();

  try {
    await ensureLoginPromise;
  } finally {
    if (ensureLoginUid === firebaseUid) {
      ensureLoginUid = null;
      ensureLoginPromise = null;
    }
  }
}

export async function ensureRevenueCatLoggedIn(firebaseUid: string): Promise<void> {
  ensureSupportedPlatform();
  if (!firebaseUid) {
    throw {
      code: "missing_uid",
      message: "A Firebase UID is required for RevenueCat login.",
    } as BillingError;
  }

  await configureRevenueCat();

  if (activeFirebaseUid === firebaseUid) return;

  if (ensureLoginPromise) {
    if (ensureLoginUid === firebaseUid) {
      await ensureLoginPromise;
      return;
    }
    await ensureLoginPromise;
    if (activeFirebaseUid === firebaseUid) return;
  }

  await startEnsureRevenueCatLoggedIn(firebaseUid);
}

// Backward-compatible alias used by existing app bootstrap.
export async function initializeRevenueCat(): Promise<void> {
  await configureRevenueCat();
}

// Backward-compatible auth sync used by app bootstrap.
export async function syncRevenueCatIdentity(firebaseUid: string | null): Promise<void> {
  if (!IS_ANDROID) return;
  await configureRevenueCat();

  if (firebaseUid) {
    await ensureRevenueCatLoggedIn(firebaseUid);
    return;
  }

  if (activeFirebaseUid === null) return;
  const previousUid = activeFirebaseUid;
  await runBillingOperation("logOut", () => Purchases.logOut(), previousUid);
  activeFirebaseUid = null;
}

export async function getOfferings(): Promise<PurchasesOfferings> {
  await configureRevenueCat();
  return runBillingOperation("getOfferings", () => Purchases.getOfferings(), activeFirebaseUid);
}

export async function purchasePackage(aPackage: PurchasesPackage): Promise<PurchaseResult> {
  await configureRevenueCat();
  const startedAt = Date.now();
  try {
    await Purchases.purchasePackage(aPackage);
    logBillingEvent({
      op: "purchasePackage",
      ok: true,
      latencyMs: Date.now() - startedAt,
      uidPrefix: toUidPrefix(activeFirebaseUid),
    });
    return { status: "PURCHASED" };
  } catch (error) {
    if (isPurchaseCancelledError(error)) {
      logBillingEvent({
        op: "purchasePackage",
        ok: true,
        latencyMs: Date.now() - startedAt,
        code: "cancelled",
        uidPrefix: toUidPrefix(activeFirebaseUid),
      });
      return { status: "CANCELLED" };
    }

    const normalized = toBillingError(error);
    logBillingEvent({
      op: "purchasePackage",
      ok: false,
      latencyMs: Date.now() - startedAt,
      code: normalized.code,
      uidPrefix: toUidPrefix(activeFirebaseUid),
    });
    return { status: "ERROR", errorCode: normalized.code };
  }
}

export async function restorePurchases(): Promise<RestoreResult> {
  await configureRevenueCat();
  const startedAt = Date.now();
  try {
    await Purchases.restorePurchases();
    logBillingEvent({
      op: "restorePurchases",
      ok: true,
      latencyMs: Date.now() - startedAt,
      uidPrefix: toUidPrefix(activeFirebaseUid),
    });
    return { status: "RESTORED" };
  } catch (error) {
    const normalized = toBillingError(error);
    logBillingEvent({
      op: "restorePurchases",
      ok: false,
      latencyMs: Date.now() - startedAt,
      code: normalized.code,
      uidPrefix: toUidPrefix(activeFirebaseUid),
    });
    return { status: "ERROR", errorCode: normalized.code };
  }
}

export async function syncRevenueCatPurchases(): Promise<void> {
  await configureRevenueCat();
  await runBillingOperation(
    "syncPurchases",
    async () => {
      await Purchases.syncPurchasesForResult();
    },
    activeFirebaseUid
  );
}

// Debug-only helper. Do not use as source-of-truth entitlement state.
export async function getCustomerInfo(): Promise<CustomerInfo> {
  await configureRevenueCat();
  return runBillingOperation("getCustomerInfo", () => Purchases.getCustomerInfo(), activeFirebaseUid);
}

export async function getAppUserId(): Promise<string> {
  await configureRevenueCat();
  return runBillingOperation("getAppUserId", () => Purchases.getAppUserID(), activeFirebaseUid);
}
