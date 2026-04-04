import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import {
  HEALTH_SLEEP_STALE_HOURS,
  getHealthConnectAvailability,
  getSleepProfile,
  openHealthConnectDataManagementScreen,
  requestHealthSleepPermission,
  syncSleepFromHealthConnect,
  hasHealthSleepPermission,
  type HealthConnectAvailability,
} from "@/src/sleep/sleep";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";

const formatTimestamp = (value: Date | null): string =>
  value ? value.toLocaleString() : "Not synced yet";
const permissionRequestTimeoutMs = 6000;

const healthConnectStoreUrl =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

const availabilityDisplay = (
  availability: HealthConnectAvailability,
  permissionState: "granted" | "denied" | "revoked" | "unavailable" | "unsupported" | "unknown"
) => {
  switch (availability) {
    case "available":
      if (permissionState === "granted") {
        return {
          title: "Health Connect available",
          detail: "You have granted Health Connect permission. You can sync sleep data now.",
        };
      }
      return {
        title: "Health Connect available",
        detail: "You can grant permission and sync sleep data.",
      };
    case "provider_update_required":
      return {
        title: "Health Connect required",
        detail: "Download or update Health Connect from the Play Store, then reopen LastRep.",
      };
    case "unavailable":
      return {
        title: "Health Connect unavailable",
        detail: "Health Connect is not available on this device.",
      };
    default:
      return {
        title: "Not supported",
        detail: "Health sync currently supports Android only.",
      };
  }
};

const permissionDisplay = (
  permissionState: "granted" | "denied" | "revoked" | "unavailable" | "unsupported" | "unknown"
) => {
  switch (permissionState) {
    case "granted":
      return "Granted";
    case "denied":
      return "Denied";
    case "revoked":
      return "Revoked";
    case "unavailable":
      return "Unavailable";
    case "unsupported":
      return "Unsupported";
    default:
      return "Unknown";
  }
};

export default function SleepIndex() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [sleepSource, setSleepSource] = useState<"manual" | "health">("manual");
  const [sampleRecordedAt, setSampleRecordedAt] = useState<Date | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [permissionState, setPermissionState] = useState<
    "granted" | "denied" | "revoked" | "unavailable" | "unsupported" | "unknown"
  >("unknown");
  const [availability, setAvailability] = useState<HealthConnectAvailability>("unsupported");

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const refreshSleep = useCallback(async (resetFeedback = true) => {
    if (!uid) return;
    setLoading(true);
    if (resetFeedback) {
      setFeedback(null);
    }
    try {
      const [profile, nextAvailability] = await Promise.all([
        getSleepProfile(uid),
        getHealthConnectAvailability(),
      ]);
      setSleepHours(profile.latestSleepHours);
      setSleepSource(profile.source);
      setSampleRecordedAt(profile.sampleRecordedAt?.toDate() ?? null);
      setLastSyncedAt(profile.lastSyncedAt?.toDate() ?? null);

      setAvailability(nextAvailability);
      if (nextAvailability === "unsupported") {
        setPermissionState("unsupported");
      } else if (nextAvailability !== "available") {
        setPermissionState("unavailable");
      } else {
        const granted = await hasHealthSleepPermission();
        if (granted) {
          setPermissionState("granted");
        } else if (profile.source === "health") {
          setPermissionState("revoked");
        } else {
          setPermissionState("denied");
        }
      }
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load sleep profile", error);
      }
      setFeedback(
        isExpectedOfflineError(error)
          ? "You're offline. Sleep data will refresh when you reconnect."
          : "Unable to load sleep data right now."
      );
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setRedirectTo("/auth/sign-in");
        setLoading(false);
        return;
      }
      setUid(user.uid);
      setRedirectTo(null);
    });
    return unsub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSleep();
      return undefined;
    }, [refreshSleep])
  );

  const sourceLabel = useMemo(
    () => (sleepSource === "health" ? "Health" : "Manual"),
    [sleepSource]
  );
  const sampleAgeHours = useMemo(() => {
    if (!sampleRecordedAt) return null;
    const diffMs = Date.now() - sampleRecordedAt.getTime();
    if (diffMs < 0) return 0;
    return Math.round((diffMs / (60 * 60 * 1000)) * 10) / 10;
  }, [sampleRecordedAt]);
  const isStale = useMemo(() => {
    if (sleepSource !== "health") return false;
    if (sampleAgeHours == null) return true;
    return sampleAgeHours > HEALTH_SLEEP_STALE_HOURS;
  }, [sleepSource, sampleAgeHours]);

  const handleGrantPermission = async () => {
    setFeedback("Requesting Health Connect permission...");
    let result: "granted" | "denied" | "timeout" = "denied";
    try {
      const permissionResult = await Promise.race<
        "granted" | "denied" | "timeout"
      >([
        requestHealthSleepPermission().then((granted) => (granted ? "granted" : "denied")),
        new Promise((resolve) =>
          setTimeout(() => resolve("timeout"), permissionRequestTimeoutMs)
        ) as Promise<"timeout">,
      ]);
      result = permissionResult;
    } catch {
      result = "denied";
    }

    if (result === "granted") {
      setFeedback("Health Connect permission granted.");
    } else if (result === "timeout") {
      setFeedback(
        "Permission dialog did not open. Tap 'Open Health Connect settings' and grant Sleep access manually."
      );
    } else {
      setFeedback("Health Connect permission denied.");
    }
    await refreshSleep(false);
  };

  const handleSync = async () => {
    if (!uid) return;
    if (availability === "provider_update_required") {
      setFeedback("Sync is unavailable until Health Connect is installed or updated.");
      return;
    }
    if (availability !== "available") {
      setFeedback("Health Connect is not available right now. If you're offline, reconnect and try again.");
      return;
    }
    if (permissionState !== "granted") {
      setFeedback("Sync is unavailable until Sleep permission is granted in Health Connect.");
      return;
    }

    const result = await syncSleepFromHealthConnect(uid);
    switch (result.status) {
      case "success":
        setFeedback(`Synced ${result.sleepHours.toFixed(1)} hours from Health Connect.`);
        break;
      case "permission_denied":
        setPermissionState(sleepSource === "health" ? "revoked" : "denied");
        setFeedback("Permission is required to sync sleep from Health Connect.");
        break;
      case "no_data":
        setFeedback("No sleep sessions found for the previous night window.");
        break;
      case "provider_update_required":
        setFeedback("Download or update Health Connect from the Play Store.");
        break;
      case "unavailable":
      case "unsupported":
        setFeedback("Health Connect is not available on this device.");
        break;
      default:
        setFeedback(result.message);
        break;
    }
    await refreshSleep(false);
  };

  const handleOpenHealthConnectStore = async () => {
    const supported = await Linking.canOpenURL(healthConnectStoreUrl);
    if (!supported) {
      setFeedback("Unable to open Play Store on this device.");
      return;
    }
    await Linking.openURL(healthConnectStoreUrl);
  };

  const handleOpenHealthConnectSettings = async () => {
    const opened = await openHealthConnectDataManagementScreen();
    if (!opened) {
      setFeedback("Unable to open Health Connect settings on this device.");
    }
  };

  const availabilityUi = availabilityDisplay(availability, permissionState);
  const canSyncSleep = permissionState === "granted" && availability === "available" && !loading;
  const syncUnavailableMessage =
    availability === "provider_update_required"
      ? "Sync is unavailable until Health Connect is installed or updated."
      : permissionState !== "granted"
        ? "Sync is unavailable until Sleep permission is granted in Health Connect."
        : loading
          ? "Checking sleep access..."
          : null;

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} style={styles.container} bounces>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Sleep</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Current sleep summary</Text>
          <Text style={styles.valueText}>
            {sleepHours == null ? "No sample yet" : `${sleepHours.toFixed(1)} hours`}
          </Text>
          <Text style={styles.subText}>
            Recorded at: {formatTimestamp(sampleRecordedAt)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sleep source</Text>
          <Text style={styles.valueText}>{sourceLabel}</Text>
          <Text style={styles.subText}>Last sync: {formatTimestamp(lastSyncedAt)}</Text>
          <Text style={styles.subText}>Permission: {permissionDisplay(permissionState)}</Text>
          {sampleAgeHours != null ? (
            <Text style={styles.subText}>Sample age: {sampleAgeHours.toFixed(1)}h</Text>
          ) : null}
          {sleepSource === "health" && isStale ? (
            <Text style={styles.warningText}>
              Health sleep sample is stale. Decision flow will fall back to manual sleep.
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Health sync</Text>
          <Text style={styles.valueTextSmall}>{availabilityUi.title}</Text>
          <Text style={styles.subText}>{availabilityUi.detail}</Text>
          {availability === "provider_update_required" ? (
            <TouchableOpacity
              style={[styles.secondaryButton, loading && styles.disabled]}
              disabled={loading}
              onPress={handleOpenHealthConnectStore}
            >
              <Text style={styles.secondaryButtonText}>Open Play Store</Text>
            </TouchableOpacity>
          ) : null}
          {availability === "available" ? (
            <TouchableOpacity
              style={[styles.secondaryButton, loading && styles.disabled]}
              disabled={loading}
              onPress={handleOpenHealthConnectSettings}
            >
              <Text style={styles.secondaryButtonText}>Open Health Connect settings</Text>
            </TouchableOpacity>
          ) : null}
          {(permissionState === "denied" || permissionState === "revoked") && (
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabled]}
              disabled={loading}
              onPress={handleGrantPermission}
            >
              <Text style={styles.primaryButtonText}>Grant Health Connect permission</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.primaryButton, (!canSyncSleep || loading) && styles.disabled]}
            disabled={loading}
            onPress={handleSync}
          >
            <Text style={styles.primaryButtonText}>Sync sleep</Text>
          </TouchableOpacity>
          {syncUnavailableMessage ? (
            <Text style={styles.subText}>{syncUnavailableMessage}</Text>
          ) : null}
        </View>

        {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d1a" },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerSpacer: { width: 22 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  valueText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  valueTextSmall: { color: "#fff", fontSize: 15, fontWeight: "700" },
  subText: { color: MUTED, fontSize: 12, lineHeight: 16 },
  warningText: { color: "#fbbf24", fontSize: 12, lineHeight: 16 },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.6 },
  feedbackText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
});
