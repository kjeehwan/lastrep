import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { PurchasesOfferings, PurchasesPackage } from "react-native-purchases";
import { getUidPrefix, logAnalyticsEvent } from "../src/analytics/analytics";
import {
  MANAGE_SUBSCRIPTION_URL,
  OFFERING_ID,
  PACKAGE_ID_ANNUAL,
  PACKAGE_ID_MONTHLY,
} from "../src/config/billingConfig";
import { auth } from "../src/config/firebaseConfig";
import type {
  PaywallAnalyticsContext,
  PurchaseResult,
  RestoreResult,
} from "../src/contracts";
import {
  normalizePaywallReasonCode,
  normalizePaywallSourceScreen,
} from "../src/contracts";
import { useEntitlement } from "../src/hooks/useEntitlement";
import {
  configureRevenueCat,
  ensureRevenueCatLoggedIn,
  getAppUserId,
  getOfferings,
  purchasePackage,
  restorePurchases,
  syncRevenueCatPurchases,
} from "../src/billing/revenuecat";

type ScreenState = "idle" | "loading" | "success" | "error";
type PendingEntitlementAction = "purchase" | "restore" | null;

type PurchaseAttempt = {
  packageParams: Record<string, string | number | boolean | undefined>;
  successAtMs?: number;
  waitingForActivation: boolean;
  terminalLogged: boolean;
};

type RestoreAttempt = {
  baseParams: Record<string, string | number | boolean | undefined>;
  startedAtMs: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
  waitingForActivation: boolean;
  terminalLogged: boolean;
};

function getFirstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getDefaultOffering(offerings: PurchasesOfferings | null) {
  if (!offerings) return null;
  return offerings.all?.[OFFERING_ID] ?? offerings.current ?? null;
}

function getSortedPackages(offerings: PurchasesOfferings | null): PurchasesPackage[] {
  const offering = getDefaultOffering(offerings);
  if (!offering) return [];

  const allPackages = offering.availablePackages ?? [];
  const annual = allPackages.find((item) => item.identifier === PACKAGE_ID_ANNUAL);
  const monthly = allPackages.find((item) => item.identifier === PACKAGE_ID_MONTHLY);
  const others = allPackages.filter(
    (item) => item.identifier !== PACKAGE_ID_ANNUAL && item.identifier !== PACKAGE_ID_MONTHLY
  );

  return [annual, monthly, ...others].filter((item): item is PurchasesPackage => Boolean(item));
}

function formatPrice(aPackage: PurchasesPackage): string {
  const product = aPackage.product as {
    priceString?: string;
    title?: string;
  };
  const price = product.priceString ?? "";
  const title = product.title ?? aPackage.identifier;
  return `${title} ${price}`.trim();
}

function getCommonAnalyticsParams(
  sourceScreen: string | undefined,
  reasonCode: string | undefined,
  entitlementState: string,
  uid: string | null
) {
  return {
    source_screen: sourceScreen,
    reason_code: reasonCode,
    entitlement_state: entitlementState,
    uid_prefix: getUidPrefix(uid),
  };
}

function getPackageAnalyticsParams(
  aPackage: PurchasesPackage,
  offeringId: string | undefined
) {
  const product = aPackage.product as {
    identifier?: string;
    price?: number;
    currencyCode?: string;
  };

  return {
    offering_id: offeringId,
    package_id: aPackage.identifier,
    product_id: product.identifier,
    price: typeof product.price === "number" ? product.price : undefined,
    currency: product.currencyCode,
  };
}

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<PaywallAnalyticsContext>();
  const sourceScreen = normalizePaywallSourceScreen(getFirstParam(params.sourceScreen));
  const reasonCode = normalizePaywallReasonCode(getFirstParam(params.reasonCode));

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manageFallbackText, setManageFallbackText] = useState<string | null>(null);
  const [activationStartedAt, setActivationStartedAt] = useState<number | null>(null);
  const [pendingEntitlementAction, setPendingEntitlementAction] = useState<PendingEntitlementAction>(null);

  const entitlement = useEntitlement(authReady, uid);
  const currentOffering = useMemo(() => getDefaultOffering(offerings), [offerings]);
  const packages = useMemo(() => getSortedPackages(offerings), [offerings]);
  const packagesAvailable = packages.length > 0;

  const paywallViewedLoggedRef = useRef(false);
  const paywallOpenedAtRef = useRef<number | null>(null);
  const purchaseAttemptRef = useRef<PurchaseAttempt | null>(null);
  const restoreAttemptRef = useRef<RestoreAttempt | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      setUid(user?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (paywallViewedLoggedRef.current) return;

    paywallViewedLoggedRef.current = true;
    paywallOpenedAtRef.current = Date.now();
    void logAnalyticsEvent("paywall_viewed", {
      source_screen: sourceScreen,
      reason_code: reasonCode,
      entitlement_state: entitlement.state,
      uid_prefix: getUidPrefix(uid),
    });
  }, [entitlement.state, reasonCode, sourceScreen, uid]);

  useEffect(() => {
    let canceled = false;

    const load = async () => {
      if (!authReady || !uid || entitlement.state === "loading") return;

      setOfferingsLoading(true);
      setIdentityReady(false);
      setFeedback(null);

      try {
        await configureRevenueCat();
        await ensureRevenueCatLoggedIn(uid);
        const appUserId = await getAppUserId();
        if (appUserId !== uid) {
          await ensureRevenueCatLoggedIn(uid);
        }
        if (!canceled) {
          setIdentityReady(true);
        }
        const nextOfferings = await getOfferings();
        if (canceled) return;
        setOfferings(nextOfferings);
      } catch (error) {
        if (canceled) return;
        console.log("Failed to load paywall", error);
        setOfferings(null);
        setScreenState("error");
        setFeedback("Unable to load plans right now.");
      } finally {
        if (!canceled) {
          setOfferingsLoading(false);
        }
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, [authReady, entitlement.state, uid]);

  useEffect(() => {
    if (entitlement.state !== "active") return;

    const now = Date.now();
    const purchaseAttempt = purchaseAttemptRef.current;
    if (purchaseAttempt?.waitingForActivation && !purchaseAttempt.terminalLogged) {
      purchaseAttempt.terminalLogged = true;
      purchaseAttemptRef.current = null;
      void logAnalyticsEvent("purchase_completed", {
        ...purchaseAttempt.packageParams,
        latency_ms:
          typeof purchaseAttempt.successAtMs === "number"
            ? now - purchaseAttempt.successAtMs
            : undefined,
      });
    }

    const restoreAttempt = restoreAttemptRef.current;
    if (restoreAttempt?.waitingForActivation && !restoreAttempt.terminalLogged) {
      restoreAttempt.terminalLogged = true;
      if (restoreAttempt.timeoutId) {
        clearTimeout(restoreAttempt.timeoutId);
      }
      restoreAttemptRef.current = null;
      void logAnalyticsEvent("restore_completed", {
        ...restoreAttempt.baseParams,
        latency_ms: now - restoreAttempt.startedAtMs,
      });
    }

    setScreenState("idle");
    setActivationStartedAt(null);
    setPendingEntitlementAction(null);
    setFeedback(null);
  }, [entitlement.state]);

  useEffect(() => {
    return () => {
      if (restoreAttemptRef.current?.timeoutId) {
        clearTimeout(restoreAttemptRef.current.timeoutId);
      }
    };
  }, []);

  const canInteract =
    authReady &&
    uid !== null &&
    entitlement.state !== "loading" &&
    identityReady &&
    !offeringsLoading &&
    screenState !== "loading" &&
    pendingEntitlementAction === null;

  const handlePurchase = async (selectedPackage: PurchasesPackage) => {
    if (!uid || !canInteract) return;

    setScreenState("loading");
    setFeedback(null);
    setPendingEntitlementAction(null);

    const purchaseStartedAt = Date.now();
    const packageParams = {
      ...getCommonAnalyticsParams(sourceScreen, reasonCode, entitlement.state, uid),
      ...getPackageAnalyticsParams(selectedPackage, currentOffering?.identifier ?? OFFERING_ID),
      latency_ms:
        typeof paywallOpenedAtRef.current === "number"
          ? purchaseStartedAt - paywallOpenedAtRef.current
          : undefined,
    };

    purchaseAttemptRef.current = {
      packageParams,
      waitingForActivation: false,
      terminalLogged: false,
    };

    void logAnalyticsEvent("purchase_started", packageParams);

    const result: PurchaseResult = await purchasePackage(selectedPackage);
    if (result.status === "CANCELLED") {
      void logAnalyticsEvent("purchase_cancelled", packageParams);
      purchaseAttemptRef.current = null;
      setScreenState("idle");
      return;
    }

    if (result.status === "ERROR") {
      void logAnalyticsEvent("purchase_failed", {
        ...packageParams,
        error_code: result.errorCode,
      });
      purchaseAttemptRef.current = null;
      setScreenState("error");
      setFeedback("Purchase failed. Please try again.");
      return;
    }

    purchaseAttemptRef.current = {
      packageParams,
      successAtMs: Date.now(),
      waitingForActivation: true,
      terminalLogged: false,
    };

    setScreenState("success");
    setPendingEntitlementAction("purchase");
    setActivationStartedAt(Date.now());
    setFeedback("Purchase successful. Activating subscription...");
    try {
      await syncRevenueCatPurchases();
    } catch (error) {
      console.log("Purchase sync failed", error);
    }
  };

  const handleRestore = async () => {
    if (!uid || !canInteract) return;
    if (entitlement.state === "active") {
      setScreenState("idle");
      setPendingEntitlementAction(null);
      setActivationStartedAt(null);
      setFeedback("You already have active premium.");
      return;
    }

    setScreenState("loading");
    setFeedback("Checking for previous purchases...");
    setPendingEntitlementAction(null);

    const restoreStartedAt = Date.now();
    const restoreParams = {
      ...getCommonAnalyticsParams(sourceScreen, reasonCode, entitlement.state, uid),
    };

    restoreAttemptRef.current = {
      baseParams: restoreParams,
      startedAtMs: restoreStartedAt,
      timeoutId: null,
      waitingForActivation: false,
      terminalLogged: false,
    };

    void logAnalyticsEvent("restore_started", restoreParams);

    const result: RestoreResult = await restorePurchases();
    if (result.status === "ERROR") {
      void logAnalyticsEvent("restore_failed", {
        ...restoreParams,
        error_code: result.errorCode,
      });
      restoreAttemptRef.current = null;
      setScreenState("error");
      setFeedback("Restore failed. Please try again.");
      return;
    }

    const timeoutId = setTimeout(() => {
      const currentAttempt = restoreAttemptRef.current;
      if (!currentAttempt || currentAttempt.terminalLogged || !currentAttempt.waitingForActivation) {
        return;
      }

      currentAttempt.terminalLogged = true;
      restoreAttemptRef.current = null;
      void logAnalyticsEvent("restore_failed", currentAttempt.baseParams);
      setPendingEntitlementAction(null);
      setActivationStartedAt(null);
      setScreenState("idle");
      setFeedback(
        "We couldn't confirm an active subscription yet. If you recently subscribed, wait a moment and reopen the app, or try Restore again."
      );
    }, 30000);

    restoreAttemptRef.current = {
      baseParams: restoreParams,
      startedAtMs: restoreStartedAt,
      timeoutId,
      waitingForActivation: true,
      terminalLogged: false,
    };

    setScreenState("success");
    setPendingEntitlementAction("restore");
    setActivationStartedAt(Date.now());
    setFeedback("Checking for previous purchases...");
    try {
      await syncRevenueCatPurchases();
    } catch (error) {
      console.log("Restore sync failed", error);
    }
  };

  const handleManageSubscription = async () => {
    void logAnalyticsEvent("manage_subscription_tapped", {
      ...getCommonAnalyticsParams(sourceScreen, reasonCode, entitlement.state, uid),
    });

    try {
      const canOpen = await Linking.canOpenURL(MANAGE_SUBSCRIPTION_URL);
      if (!canOpen) {
        throw new Error("cannot_open_url");
      }
      await Linking.openURL(MANAGE_SUBSCRIPTION_URL);
      setManageFallbackText(null);
    } catch {
      setManageFallbackText(
        "Open Google Play > Payments & subscriptions > Subscriptions to manage your plan."
      );
    }
  };

  if (!authReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  if (authReady && uid === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Auth required</Text>
        <Text style={styles.body}>Sign in to manage subscription and purchase premium.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/auth/sign-in" as Href)}>
          <Text style={styles.primaryButtonText}>Sign in to manage subscription</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <Text style={styles.title}>Upgrade to Premium</Text>
      <Text style={styles.body}>
        Purchase and restore are available below. Access is granted only after Firestore entitlement updates.
      </Text>

      {entitlement.state === "loading" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Checking subscription status...</Text>
        </View>
      ) : null}

      {entitlement.state === "active" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Premium active</Text>
        </View>
      ) : null}

      {feedback ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{feedback}</Text>
          {activationStartedAt &&
          pendingEntitlementAction === "purchase" &&
          entitlement.state !== "active" &&
          Date.now() - activationStartedAt >= 30000 ? (
            <Text style={styles.noticeSub}>
              If it doesn't activate within ~30 seconds, reopen the app or tap Restore.
            </Text>
          ) : null}
        </View>
      ) : null}

      {offeringsLoading ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Loading plans...</Text>
        </View>
      ) : null}

      {entitlement.state === "inactive" ? (
        <>
          {packagesAvailable ? (
            <View style={styles.card}>
              {packages.map((aPackage) => (
                <TouchableOpacity
                  key={aPackage.identifier}
                  style={[styles.packageButton, !canInteract && styles.disabled]}
                  disabled={!canInteract}
                  onPress={() => handlePurchase(aPackage)}
                >
                  <View style={styles.packageContent}>
                    <Text style={styles.packageText}>{formatPrice(aPackage)}</Text>
                    {aPackage.identifier === PACKAGE_ID_ANNUAL ? (
                      <Text style={styles.badge}>Best value</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>Plans unavailable right now.</Text>
              <Text style={styles.noticeSub}>Try again later or use restore if you already subscribed.</Text>
            </View>
          )}
        </>
      ) : null}

      <TouchableOpacity
        style={[styles.secondaryButton, !canInteract && styles.disabled]}
        onPress={handleRestore}
        disabled={!canInteract}
      >
        <Text style={styles.secondaryButtonText}>
          {screenState === "loading" ? "Working..." : "Restore purchases"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={handleManageSubscription}>
        <Text style={styles.secondaryButtonText}>Manage subscription</Text>
      </TouchableOpacity>
      <Text style={styles.noticeSub}>
        Opens Google Play. To cancel, tap Lastrep in the subscription list.
      </Text>

      {manageFallbackText ? <Text style={styles.noticeSub}>{manageFallbackText}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
    gap: 14,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0d0d1a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
  body: {
    color: "#cfcfe6",
    fontSize: 14,
    lineHeight: 20,
  },
  loadingText: {
    color: "#cfcfe6",
    fontSize: 14,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  packageButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  packageContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  packageText: {
    color: "#fff",
    fontWeight: "700",
    flex: 1,
  },
  badge: {
    color: "#0d0d1a",
    backgroundColor: "#a6e3a1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#7b61ff",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  notice: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  noticeText: {
    color: "#fff",
    fontWeight: "700",
  },
  noticeSub: {
    color: "#a5acc1",
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.55,
  },
});
