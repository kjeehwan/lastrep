import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, Redirect, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import type { SleepNightlySummary } from "@/src/contracts";
import { useOfflineStatus } from "@/src/hooks/useOfflineStatus";
import { useNow } from "@/src/hooks/useNow";
import { getSleepRecoveryHint, classifySleepVsTarget } from "@/src/sleep/sleepInsights";
import {
  autoSyncSleepFromHealthConnectIfEligible,
  HEALTH_SLEEP_STALE_HOURS,
  getHealthConnectAvailability,
  getSleepProfile,
  saveManualSleepForDateKey,
  syncSleepFromHealthConnect,
  hasHealthSleepPermission,
  type HealthConnectAvailability,
} from "@/src/sleep/sleep";
import { showAppDialog } from "@/src/ui/appDialog";
import { getUserData } from "@/src/userData";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";
import { scheduleAfterInteractions } from "@/src/utils/scheduleAfterInteractions";
import { ChartEmptyState, type ChartPoint } from "@/src/components/charts/TrendCharts";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";
const SLEEP_SYNC_CONFIRM_KEY_PREFIX = "sleep-sync-confirmed-v1";
export default function SleepIndex() {
  const router = useRouter();
  const { isOffline } = useOfflineStatus();
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sleepSource, setSleepSource] = useState<"manual" | "health">("manual");
  const [sampleRecordedAt, setSampleRecordedAt] = useState<Date | null>(null);
  const [recentNightlyHours, setRecentNightlyHours] = useState<SleepNightlySummary[]>([]);
  const [sleepTargetHours, setSleepTargetHours] = useState<number>(7);
  const [manualOverrideHours, setManualOverrideHours] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "granted" | "denied" | "revoked" | "unavailable" | "unsupported" | "unknown"
  >("unknown");
  const [availability, setAvailability] = useState<HealthConnectAvailability>("unsupported");
  const timelineScrollRef = React.useRef<FlatList<ChartPoint> | null>(null);
  const refreshSleepTaskRef = React.useRef<{ cancel: () => void } | null>(null);
  const lastSleepRefreshAtRef = React.useRef(0);
  const [timelineWindowStart, setTimelineWindowStart] = useState(0);
  const [timelineShouldSnapToLatest, setTimelineShouldSnapToLatest] = useState(true);
  const [timelineViewportWidthMeasured, setTimelineViewportWidthMeasured] = useState(0);
  const [selectedSleepDateKey, setSelectedSleepDateKey] = useState<string | null>(null);
  const nowMs = useNow(60_000, sleepSource === "health" && sampleRecordedAt != null);

  const applyProfile = useCallback((profile: Awaited<ReturnType<typeof getSleepProfile>>) => {
    setSleepSource(profile.source);
    setSampleRecordedAt(profile.sampleRecordedAt?.toDate() ?? null);
    setRecentNightlyHours(profile.recentNightlyHours);
  }, []);

  const handleGoBack = () => {
    router.replace("/home");
  };

  const refreshSleep = useCallback(async (options?: { resetFeedback?: boolean; autoSync?: boolean }) => {
    const resetFeedback = options?.resetFeedback ?? true;
    const autoSync = options?.autoSync ?? false;
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
      applyProfile(profile);

      setAvailability(nextAvailability);
      if (nextAvailability === "unsupported") {
        setPermissionState("unsupported");
      } else if (nextAvailability !== "available") {
        setPermissionState("unavailable");
      } else {
        const granted = await hasHealthSleepPermission();
        if (granted) {
          setPermissionState("granted");
          if (autoSync) {
            const autoSyncResult = await autoSyncSleepFromHealthConnectIfEligible(uid, {
              minIntervalMinutes: 30,
            });
            if (autoSyncResult === "synced") {
              const refreshedProfile = await getSleepProfile(uid);
              applyProfile(refreshedProfile);
            }
          }
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
      setFeedback(isExpectedOfflineError(error) ? null : "Unable to load sleep data right now.");
    } finally {
      setLoading(false);
    }
  }, [uid, applyProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setAccountLabel(null);
        setRedirectTo("/auth/sign-in");
        setLoading(false);
        return;
      }
      setUid(user.uid);
      setAccountLabel(user.email?.trim() || user.uid);
      setRedirectTo(null);
      void getUserData(user.uid).then((data) => {
        const target = data?.sleepSettings?.targetHours;
        if (typeof target === "number" && target > 0) {
          setSleepTargetHours(Math.round(target * 10) / 10);
        }
      });
    });
    return unsub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastSleepRefreshAtRef.current >= 30_000) {
        refreshSleepTaskRef.current?.cancel();
        refreshSleepTaskRef.current = scheduleAfterInteractions(async () => {
          lastSleepRefreshAtRef.current = Date.now();
          await refreshSleep({ autoSync: true });
        });
      }
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        router.replace("/home");
        return true;
      });
      return () => {
        refreshSleepTaskRef.current?.cancel();
        subscription.remove();
      };
    }, [refreshSleep, router])
  );

  const fallbackLastNightDateKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, []);
  const lastNightSummary = useMemo(
    // "Last night" means the most recent completed sleep episode.
    () => recentNightlyHours[0] ?? null,
    [recentNightlyHours]
  );
  const sleepChartPoints = useMemo<ChartPoint[]>(
    () =>
      [...recentNightlyHours]
        .reverse()
        .map((item) => ({ key: item.dateKey, label: item.dateKey.slice(5).replace("-", "/"), value: item.sleepHours })),
    [recentNightlyHours]
  );
  const timelineVisiblePoints = 7;
  const timelineMeasuredWidth = timelineViewportWidthMeasured > 0 ? timelineViewportWidthMeasured : 308;
  const timelinePointCellWidth = Math.max(1, Math.floor(timelineMeasuredWidth / timelineVisiblePoints));
  const timelineViewportWidth = timelinePointCellWidth * timelineVisiblePoints;
  const timelineMaxWindowStart = Math.max(0, sleepChartPoints.length - timelineVisiblePoints);
  const timelinePlotHeight = 120;
  const timelinePlotTopInset = 4;
  const timelineDatesRowHeight = 24;
  const timelineTargetLaneWidth = 34;
  const effectiveTimelineWindowStart = Math.min(timelineWindowStart, timelineMaxWindowStart);
  const focusedSleepPoints = useMemo(
    () =>
      sleepChartPoints.slice(
        effectiveTimelineWindowStart,
        effectiveTimelineWindowStart + timelineVisiblePoints
      ),
    [sleepChartPoints, effectiveTimelineWindowStart]
  );
  const trendAverage = useMemo(() => {
    if (!focusedSleepPoints.length) return null;
    const total = focusedSleepPoints.reduce((sum, item) => sum + item.value, 0);
    return Math.round((total / focusedSleepPoints.length) * 10) / 10;
  }, [focusedSleepPoints]);
  const trendConsistencyPct = useMemo(() => {
    if (!focusedSleepPoints.length) return null;
    const onTargetDays = focusedSleepPoints.filter((item) => item.value >= sleepTargetHours).length;
    return Math.round((onTargetDays / focusedSleepPoints.length) * 100);
  }, [focusedSleepPoints, sleepTargetHours]);
  const timelineScaleMax = useMemo(() => {
    const maxPoint = sleepChartPoints.reduce((max, point) => Math.max(max, point.value), 0);
    return Math.max(1, maxPoint, sleepTargetHours);
  }, [sleepChartPoints, sleepTargetHours]);
  const targetLineTop =
    timelinePlotTopInset +
    Math.max(0, Math.min(timelinePlotHeight, timelinePlotHeight - (sleepTargetHours / timelineScaleMax) * timelinePlotHeight));
  const targetLabelHalfHeight = 5;
  const selectedSleepPoint = useMemo(() => {
    if (!sleepChartPoints.length) return null;
    if (!selectedSleepDateKey) return sleepChartPoints[sleepChartPoints.length - 1] ?? null;
    return sleepChartPoints.find((point) => point.key === selectedSleepDateKey) ?? sleepChartPoints[sleepChartPoints.length - 1] ?? null;
  }, [sleepChartPoints, selectedSleepDateKey]);
  const sampleAgeHours = useMemo(() => {
    if (!sampleRecordedAt) return null;
    const diffMs = nowMs - sampleRecordedAt.getTime();
    if (diffMs < 0) return 0;
    return Math.round((diffMs / (60 * 60 * 1000)) * 10) / 10;
  }, [nowMs, sampleRecordedAt]);
  const isStale = useMemo(() => {
    if (sleepSource !== "health") return false;
    if (sampleAgeHours == null) return true;
    return sampleAgeHours > HEALTH_SLEEP_STALE_HOURS;
  }, [sleepSource, sampleAgeHours]);
  const lastNightStatus = useMemo(
    () => classifySleepVsTarget(lastNightSummary?.sleepHours ?? null, sleepTargetHours),
    [lastNightSummary, sleepTargetHours]
  );
  const recoveryHint = useMemo(
    () => getSleepRecoveryHint(lastNightStatus, trendConsistencyPct),
    [lastNightStatus, trendConsistencyPct]
  );

  useEffect(() => {
    if (!timelineShouldSnapToLatest || sleepChartPoints.length === 0) return;
    const timer = setTimeout(() => {
      const nextStart = timelineMaxWindowStart;
      timelineScrollRef.current?.scrollToOffset({
        offset: nextStart * timelinePointCellWidth,
        animated: false,
      });
      setTimelineWindowStart(nextStart);
      setTimelineShouldSnapToLatest(false);
      const latest = sleepChartPoints[sleepChartPoints.length - 1];
      setSelectedSleepDateKey(latest?.key ?? null);
    }, 0);
    return () => clearTimeout(timer);
  }, [timelineShouldSnapToLatest, sleepChartPoints, timelineMaxWindowStart, timelinePointCellWidth]);

  const snapTimelineToNearestWindow = useCallback(
    (offsetX: number) => {
      const nearestStart = Math.max(0, Math.min(timelineMaxWindowStart, Math.round(offsetX / timelinePointCellWidth)));
      setTimelineWindowStart(nearestStart);
    },
    [timelineMaxWindowStart, timelinePointCellWidth]
  );

  const handleTimelineViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width > 0 && Math.abs(width - timelineViewportWidthMeasured) > 0.5) {
        setTimelineViewportWidthMeasured(width);
      }
    },
    [timelineViewportWidthMeasured]
  );

  const handleTimelineMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      snapTimelineToNearestWindow(event.nativeEvent.contentOffset.x);
    },
    [snapTimelineToNearestWindow]
  );

  const handleTimelineDragEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (event.nativeEvent.velocity?.x) return;
      snapTimelineToNearestWindow(event.nativeEvent.contentOffset.x);
    },
    [snapTimelineToNearestWindow]
  );

  const selectedSleepHoursText = useMemo(() => {
    if (!selectedSleepPoint) return "-";
    const totalMinutes = Math.round(selectedSleepPoint.value * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.max(0, totalMinutes % 60);
    return `${hours}h ${minutes}m`;
  }, [selectedSleepPoint]);
  const selectedSleepDeltaText = useMemo(() => {
    if (!selectedSleepPoint) return "-";
    const diff = Math.round((selectedSleepPoint.value - sleepTargetHours) * 10) / 10;
    if (diff === 0) return "On target";
    const prefix = diff > 0 ? "+" : "";
    return `${prefix}${diff.toFixed(1)}h vs target`;
  }, [selectedSleepPoint, sleepTargetHours]);

  const performSync = async (activeUid: string) => {
    const result = await syncSleepFromHealthConnect(activeUid);
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
    await refreshSleep({ resetFeedback: false });
  };

  const handleSync = async () => {
    if (!uid) return;
    if (isOffline) {
      setFeedback("You're offline. Reconnect to sync sleep from Health Connect.");
      return;
    }
    if (loading) {
      setFeedback("Still checking sleep access. Try again in a moment.");
      return;
    }
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

    const confirmationKey = `${SLEEP_SYNC_CONFIRM_KEY_PREFIX}:${uid}`;
    const confirmationValue = await AsyncStorage.getItem(confirmationKey);
    if (confirmationValue !== "true") {
      showAppDialog({
        title: "Confirm account for sleep sync",
        message: `Import this device's Health Connect sleep data into ${accountLabel ?? "the current account"}?`,
        buttons: [
          { text: "Cancel", role: "cancel" },
          {
            text: "Import",
            role: "default",
            onPress: () => {
              void (async () => {
                await AsyncStorage.setItem(confirmationKey, "true");
                await performSync(uid);
              })();
            },
          },
        ],
      });
      return;
    }
    await performSync(uid);
  };

  const handleManualOverride = async () => {
    if (!uid || savingOverride) return;
    const parsed = Number(manualOverrideHours.trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) {
      setFeedback("Enter a valid sleep value between 0 and 24 hours.");
      return;
    }
    const overrideDateKey = lastNightSummary?.dateKey ?? fallbackLastNightDateKey;
    setSavingOverride(true);
    try {
      await saveManualSleepForDateKey(uid, parsed, overrideDateKey);
      setFeedback(`Saved manual sleep override for ${overrideDateKey}.`);
      setManualOverrideHours("");
      await refreshSleep({ resetFeedback: false });
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to save manual override", error);
      }
      setFeedback("Unable to save manual sleep override right now.");
    } finally {
      setSavingOverride(false);
    }
  };

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
          <Text style={styles.sectionTitle}>Sleep trends</Text>
          <Text style={styles.valueText}>{selectedSleepHoursText}</Text>
          <Text style={styles.subText}>
            {selectedSleepDeltaText}
          </Text>
          <Text style={styles.subText}>
            7-day avg: {trendAverage == null ? "-" : `${trendAverage.toFixed(1)}h`}
          </Text>
          {sleepChartPoints.length ? (
            <View style={styles.timelineStage}>
              <View
                style={[
                  styles.timelineTargetLine,
                  {
                    top: targetLineTop,
                    right: timelineTargetLaneWidth,
                  },
                ]}
              />
              <View
                style={[styles.timelinePointsPane, { width: timelineViewportWidth }]}
                onLayout={handleTimelineViewportLayout}
              >
                <FlatList
                  ref={timelineScrollRef}
                  horizontal
                  data={sleepChartPoints}
                  keyExtractor={(item) => item.key}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setSelectedSleepDateKey(item.key)}
                      style={[
                        styles.timelinePointCell,
                        {
                          width: timelinePointCellWidth,
                          height: timelinePlotTopInset + timelinePlotHeight + timelineDatesRowHeight,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.sleepBar,
                          {
                            height: Math.max(
                              8,
                              Math.min(timelinePlotHeight, (item.value / timelineScaleMax) * timelinePlotHeight)
                            ),
                            backgroundColor: item.key === selectedSleepPoint?.key ? "#60a5fa" : "rgba(123,97,255,0.45)",
                            width: Math.max(20, Math.min(28, timelinePointCellWidth - 12)),
                          },
                        ]}
                      />
                      <Text style={[styles.timelinePointLabel, item.key === selectedSleepPoint?.key && styles.timelinePointLabelSelected]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                  getItemLayout={(_, index) => ({
                    length: timelinePointCellWidth,
                    offset: timelinePointCellWidth * index,
                    index,
                  })}
                  automaticallyAdjustContentInsets={false}
                  contentInsetAdjustmentBehavior="never"
                  automaticallyAdjustsScrollIndicatorInsets={false}
                  bounces={false}
                  overScrollMode="never"
                  decelerationRate="fast"
                  snapToInterval={timelinePointCellWidth}
                  snapToAlignment="start"
                  disableIntervalMomentum
                  onMomentumScrollEnd={handleTimelineMomentumEnd}
                  onScrollEndDrag={handleTimelineDragEnd}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.timelineScrollContent}
                  style={[styles.timelineScrollViewport, styles.timelineScrollOverlay]}
                />
              </View>
              <View style={[styles.timelineTargetPane, { width: timelineTargetLaneWidth }]}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.timelineTargetStickyWrap,
                    { top: targetLineTop - targetLabelHalfHeight },
                  ]}
                >
                  <Text style={styles.timelineTargetText}>{sleepTargetHours.toFixed(1)}h</Text>
                </View>
              </View>
            </View>
          ) : (
            <ChartEmptyState text="No recent sleep records yet." />
          )}
          <Text style={styles.subText}>{recoveryHint}</Text>
          {sleepSource === "health" && isStale ? (
            <Text style={styles.warningText}>
              Health sleep sample is stale. Decision flow will fall back to manual sleep.
            </Text>
          ) : null}
          <View style={styles.overrideRow}>
            <TextInput
              placeholder="Manually record last night hours (e.g. 7.5)"
              placeholderTextColor="#7a7a8c"
              style={styles.overrideInput}
              keyboardType="decimal-pad"
              value={manualOverrideHours}
              onChangeText={setManualOverrideHours}
            />
            <TouchableOpacity
              style={[styles.overrideButton, savingOverride && styles.disabled]}
              disabled={savingOverride}
              onPress={handleManualOverride}
            >
              <Text style={styles.overrideButtonText}>{savingOverride ? "Saving..." : "Save manual entry"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick sync</Text>
          <Pressable
            style={[styles.primaryButton, (!canSyncSleep || loading) && styles.disabled]}
            disabled={false}
            hitSlop={8}
            onPress={handleSync}
          >
            <Text style={styles.primaryButtonText}>Sync sleep</Text>
          </Pressable>
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
    gap: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
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
  timelineStage: { position: "relative", flexDirection: "row", alignItems: "stretch", minHeight: 168 },
  timelinePointsPane: { flex: 1, overflow: "hidden" },
  timelineTargetPane: { position: "relative", alignSelf: "stretch" },
  timelineScrollViewport: { marginRight: 0 },
  timelineScrollOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 4 },
  timelineScrollContent: { paddingVertical: 2 },
  timelinePointCell: { justifyContent: "flex-end", alignItems: "center", height: 24 },
  sleepBar: { borderRadius: 8, minHeight: 8, marginBottom: 4 },
  timelinePointLabel: { color: MUTED, fontSize: 10, fontWeight: "600" },
  timelinePointLabelSelected: { color: "#fff", fontWeight: "700" },
  timelineTargetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderTopColor: "#8ea2ff",
    borderStyle: "dashed",
    zIndex: 2,
  },
  timelineTargetStickyWrap: {
    position: "absolute",
    right: 0,
    height: 10,
    justifyContent: "center",
    zIndex: 5,
  },
  timelineTargetText: {
    color: "#8ea2ff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 10,
    textAlign: "right",
  },
  overrideRow: { marginTop: 8, gap: 8 },
  overrideInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  overrideButton: {
    backgroundColor: "rgba(123,97,255,0.25)",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  overrideButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  feedbackText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
});
