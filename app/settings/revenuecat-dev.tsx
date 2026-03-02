import { Redirect } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { CustomerInfo, PurchasesOfferings } from "react-native-purchases";
import {
  getAppUserId,
  getCustomerInfo,
  getOfferings,
  restorePurchases,
  type BillingError,
} from "../../src/billing/revenuecat";

function toErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    typeof (error as BillingError).code === "string" &&
    typeof (error as BillingError).message === "string"
  ) {
    const typedError = error as BillingError;
    return `${typedError.code}: ${typedError.message}`;
  }
  return "unknown_error: Unexpected RevenueCat error";
}

function buildPackageRows(offerings: PurchasesOfferings | null): string[] {
  if (!offerings) return [];

  const rows: string[] = [];
  const allOfferings = Object.values((offerings as { all?: Record<string, unknown> }).all ?? {});

  for (const offering of allOfferings) {
    const typedOffering = offering as {
      identifier?: string;
      availablePackages?: Array<{
        identifier?: string;
        product?: { identifier?: string };
      }>;
    };
    const offeringId = typedOffering.identifier ?? "unknown_offering";
    const availablePackages = typedOffering.availablePackages ?? [];

    for (const availablePackage of availablePackages) {
      const packageId = availablePackage.identifier ?? "unknown_package";
      const productId = availablePackage.product?.identifier ?? "unknown_product";
      rows.push(`${offeringId} / ${packageId} / ${productId}`);
    }
  }

  return rows;
}

function getCustomerInfoSummary(
  customerInfo: CustomerInfo | null,
  currentAppUserIdPrefix: string | null
): string[] {
  if (!customerInfo) return [];

  const originalAppUserIdPrefix = (customerInfo.originalAppUserId ?? "").slice(0, 8);
  const activeEntitlements = Object.keys(customerInfo.entitlements.active ?? {});

  return [
    `appUserIdPrefix: ${currentAppUserIdPrefix || "none"}`,
    `originalAppUserIdPrefix: ${originalAppUserIdPrefix || "none"}`,
    `activeEntitlements: ${activeEntitlements.length > 0 ? activeEntitlements.join(", ") : "none"}`,
  ];
}

export default function RevenueCatDevScreen() {
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentAppUserIdPrefix, setCurrentAppUserIdPrefix] = useState<string | null>(null);
  const [loadingOp, setLoadingOp] = useState<"offerings" | "customerInfo" | "restore" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const packageRows = useMemo(() => buildPackageRows(offerings), [offerings]);
  const customerInfoSummary = useMemo(
    () => getCustomerInfoSummary(customerInfo, currentAppUserIdPrefix),
    [customerInfo, currentAppUserIdPrefix]
  );

  const fetchOfferings = async () => {
    setLoadingOp("offerings");
    setErrorMessage(null);
    try {
      const nextOfferings = await getOfferings();
      setOfferings(nextOfferings);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoadingOp(null);
    }
  };

  const fetchCustomerInfo = async () => {
    setLoadingOp("customerInfo");
    setErrorMessage(null);
    try {
      const [nextCustomerInfo, appUserId] = await Promise.all([
        getCustomerInfo(),
        getAppUserId(),
      ]);
      setCustomerInfo(nextCustomerInfo);
      setCurrentAppUserIdPrefix(appUserId.slice(0, 8));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoadingOp(null);
    }
  };

  const handleRestorePurchases = async () => {
    setLoadingOp("restore");
    setErrorMessage(null);
    try {
      const restoredCustomerInfo = await restorePurchases();
      const appUserId = await getAppUserId();
      setCustomerInfo(restoredCustomerInfo);
      setCurrentAppUserIdPrefix(appUserId.slice(0, 8));
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoadingOp(null);
    }
  };

  if (!__DEV__) {
    return <Redirect href="/settings" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <Text style={styles.title}>RevenueCat Debug</Text>
      <Text style={styles.note}>
        Dev-only tooling for Phase 4B. CustomerInfo is read-only and not used for entitlement unlocks.
      </Text>

      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={fetchOfferings} disabled={loadingOp !== null}>
          <Text style={styles.buttonText}>
            {loadingOp === "offerings" ? "Loading..." : "Fetch offerings"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={fetchCustomerInfo} disabled={loadingOp !== null}>
          <Text style={styles.buttonText}>
            {loadingOp === "customerInfo" ? "Loading..." : "Get customer info"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleRestorePurchases}
        disabled={loadingOp !== null}
      >
        <Text style={styles.buttonText}>
          {loadingOp === "restore" ? "Restoring..." : "Restore purchases"}
        </Text>
      </TouchableOpacity>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Packages</Text>
        {packageRows.length === 0 ? (
          <Text style={styles.mutedText}>No package data loaded yet.</Text>
        ) : (
          packageRows.map((row) => (
            <Text key={row} style={styles.valueText}>
              {row}
            </Text>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CustomerInfo (debug)</Text>
        {customerInfoSummary.length === 0 ? (
          <Text style={styles.mutedText}>No CustomerInfo loaded yet.</Text>
        ) : (
          customerInfoSummary.map((row) => (
            <Text key={row} style={styles.valueText}>
              {row}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: { padding: 20, paddingTop: 56, paddingBottom: 32, gap: 12 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  note: { color: "#a5acc1", fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", gap: 10 },
  button: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  errorText: { color: "#ff8d8d", fontSize: 13, marginTop: 2 },
  section: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  mutedText: { color: "#a5acc1", fontSize: 13 },
  valueText: { color: "#fff", fontSize: 13, lineHeight: 18 },
});
