import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type MakePurchaseResult,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { REVENUECAT_API_KEY_ANDROID } from "../config/billingConfig";

type BillingOperation =
  | "configure"
  | "logIn"
  | "logInPostCheck"
  | "logOut"
  | "getOfferings"
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

let configured = false;
let configurePromise: Promise<void> | null = null;
let activeFirebaseUid: string | null = null;

function toUidPrefix(uid?: string | null): string | undefined {
  if (!uid) return undefined;
  return uid.slice(0, UID_PREFIX_LENGTH);
}

function logBillingEvent(event: BillingLogEvent) {
  console.log(`[billing] ${JSON.stringify(event)}`);
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

async function ensureInitialized() {
  ensureSupportedPlatform();
  if (!configured) {
    await initializeRevenueCat();
  }
}

export async function initializeRevenueCat(): Promise<void> {
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

export async function syncRevenueCatIdentity(firebaseUid: string | null): Promise<void> {
  if (!IS_ANDROID) return;
  await ensureInitialized();

  if (firebaseUid) {
    if (activeFirebaseUid === firebaseUid) return;
    await runBillingOperation("logIn", async () => {
      await Purchases.logIn(firebaseUid);
    }, firebaseUid);
    activeFirebaseUid = firebaseUid;

    // Verify SDK identity after login without logging full identifiers.
    const startedAt = Date.now();
    try {
      const [postLogInAppUserId, postLogInCustomerInfo] = await Promise.all([
        Purchases.getAppUserID(),
        Purchases.getCustomerInfo(),
      ]);
      console.log(
        `[billing] ${JSON.stringify({
          op: "logInPostCheck",
          ok: true,
          latencyMs: Date.now() - startedAt,
          uidPrefix: toUidPrefix(firebaseUid),
          postLogInAppUserIdPrefix: toUidPrefix(postLogInAppUserId),
          postLogInOriginalAppUserIdPrefix: toUidPrefix(postLogInCustomerInfo.originalAppUserId),
        })}`
      );
    } catch (error) {
      const normalized = toBillingError(error);
      console.log(
        `[billing] ${JSON.stringify({
          op: "logInPostCheck",
          ok: false,
          latencyMs: Date.now() - startedAt,
          uidPrefix: toUidPrefix(firebaseUid),
          code: normalized.code,
        })}`
      );
    }

    return;
  }

  // If we're already anonymous (never logged in), do nothing.
  if (activeFirebaseUid === null) {
    return;
  }

  const previousUid = activeFirebaseUid;
  await runBillingOperation("logOut", async () => {
    await Purchases.logOut();
  }, previousUid);
  activeFirebaseUid = null;
}

export async function getOfferings(): Promise<PurchasesOfferings> {
  await ensureInitialized();
  return runBillingOperation("getOfferings", () => Purchases.getOfferings(), activeFirebaseUid);
}

export async function purchasePackage(aPackage: PurchasesPackage): Promise<MakePurchaseResult> {
  await ensureInitialized();
  return runBillingOperation(
    "purchasePackage",
    () => Purchases.purchasePackage(aPackage),
    activeFirebaseUid
  );
}

export async function restorePurchases(): Promise<CustomerInfo> {
  await ensureInitialized();
  return runBillingOperation(
    "restorePurchases",
    () => Purchases.restorePurchases(),
    activeFirebaseUid
  );
}

// Debug-only helper for Phase 4B. Do not use as source-of-truth entitlement state.
export async function getCustomerInfo(): Promise<CustomerInfo> {
  await ensureInitialized();
  return runBillingOperation("getCustomerInfo", () => Purchases.getCustomerInfo(), activeFirebaseUid);
}

export async function getAppUserId(): Promise<string> {
  await ensureInitialized();
  return runBillingOperation("getAppUserId", () => Purchases.getAppUserID(), activeFirebaseUid);
}
