import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Href, Redirect, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../../src/config/firebaseConfig";
import { useOfflineStatus } from "../../../src/hooks/useOfflineStatus";
import { showAppAlert, showAppDialog } from "../../../src/ui/appDialog";
import {
  autoSyncBodyCompositionFromHealthConnectIfEligible,
  autoSyncBodyCompositionFromSamsungHealthIfEligible,
  getSamsungHealthAccessIssueMessage,
  getBodyCompositionProfile,
  getEffectiveBodyCompositionSnapshot,
  hasHealthBodyCompositionPermission,
  hasSamsungHealthBodyCompositionPermission,
  requestSamsungHealthBodyCompositionPermission,
  saveManualBodyCompositionEntry,
  syncBodyCompositionFromHealthConnect,
  syncBodyCompositionFromSamsungHealth,
} from "../../../src/bodyComposition/bodyComposition";
import type {
  BodyCompositionHistoryEntry,
  BodyCompositionMetricSnapshot,
  BodyCompositionProfile,
} from "../../../src/contracts";
import {
  DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE,
  normalizeCalorieTargets,
  saveNutritionProfile,
} from "../../../src/nutrition/meals";
import { clearProfileLeaveGuard, setProfileLeaveGuard } from "../../../src/profile/leaveGuard";
import type { DietPhase, TrainingPhase } from "../../../src/types/decision";
import {
  getHealthConnectAvailability,
  getSleepProfile,
  hasHealthSleepPermission,
  openHealthConnectAppPermissionsScreen,
  openHealthConnectDataManagementScreen,
  syncSleepFromHealthConnect,
  type HealthConnectAvailability,
} from "../../../src/sleep/sleep";
import { getUserData, saveUserData } from "../../../src/userData";

const goals = [
  { key: "buildMuscle", label: "Build Muscle" },
  { key: "loseFat", label: "Lose Fat" },
  { key: "getStronger", label: "Get Stronger" },
  { key: "improveFitness", label: "Improve Fitness" },
];
const TRAINING_PHASES: TrainingPhase[] = ["Hypertrophy", "Strength", "Power"];
const DIET_PHASES: DietPhase[] = ["Cut", "Maintain", "Bulk"];
const isTrainingPhase = (value: unknown): value is TrainingPhase =>
  typeof value === "string" && TRAINING_PHASES.includes(value as TrainingPhase);
const isDietPhase = (value: unknown): value is DietPhase =>
  typeof value === "string" && DIET_PHASES.includes(value as DietPhase);
const isAvailabilityDays = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 7;
const mapLegacyAvailabilityToDays = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return isAvailabilityDays(parsed) ? parsed : null;
  }
  if (normalized === "2-3") return 3;
  if (normalized === "4-5") return 5;
  if (normalized === "6+") return 6;
  return null;
};

type TrainingPhaseHistoryEntry = {
  phase: TrainingPhase;
  startedAt: Timestamp;
};

type DietPhaseHistoryEntry = {
  phase: DietPhase;
  startedAt: Timestamp;
};
type WeightUnit = "kg" | "lbs";
type HeightUnit = "cm" | "ft/in";
type EnergyUnit = "kcal" | "kJ";
type ProfileSnapshot = {
  goal: string;
  nickname: string;
  description: string;
  profilePhotoUri: string;
  trainingPhase: TrainingPhase;
  dietPhase: DietPhase;
  cutCalories: string;
  maintainCalories: string;
  bulkCalories: string;
  proteinTargetGrams: string;
  availabilityDays: number;
  sleepTargetHours: string;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  energyUnit: EnergyUnit;
  bodyWeight: string;
  bodyFatPercent: string;
  muscleMass: string;
};
const KCAL_TO_KJ = 4.184;
const LBS_TO_KG = 0.453592;
const HEALTH_SYNC_CONSENT_KEY_PREFIX = "healthSyncConsentAccepted";
const isWeightUnit = (value: unknown): value is WeightUnit => value === "kg" || value === "lbs";
const isHeightUnit = (value: unknown): value is HeightUnit => value === "cm" || value === "ft/in";
const isEnergyUnit = (value: unknown): value is EnergyUnit => value === "kcal" || value === "kJ";
const convertEnergyValue = (value: number, from: EnergyUnit, to: EnergyUnit): number => {
  if (from === to) return value;
  return from === "kcal" ? value * KCAL_TO_KJ : value / KCAL_TO_KJ;
};
const convertKgToWeightUnit = (valueKg: number, unit: WeightUnit): number =>
  unit === "lbs" ? valueKg * 2.20462 : valueKg;
const convertWeightUnitToKg = (value: number, unit: WeightUnit): number =>
  unit === "lbs" ? value * LBS_TO_KG : value;
const formatWeightForUnit = (valueKg: number | null, unit: WeightUnit): string =>
  typeof valueKg === "number" && Number.isFinite(valueKg)
    ? `${Math.round(convertKgToWeightUnit(valueKg, unit) * 10) / 10}`
    : "";
const formatPercent = (value: number | null): string =>
  typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 10) / 10}` : "";
const formatBodyCompositionTimestamp = (value: Timestamp | null): string =>
  value ? value.toDate().toLocaleString() : "Not recorded";
const formatBodyCompositionSource = (
  source: BodyCompositionHistoryEntry["source"] | null,
  originLabel: string | null
): string => {
  if (source === "manual") return "Manual";
  if (originLabel) return originLabel;
  if (source === "health") return "Health Connect";
  return "Unknown";
};

// Phase 2A: keep only nickname + goal for prompts; remove body metrics
export default function ProfileIndex() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string }>();
  const returnTo = typeof params.from === "string" && params.from.startsWith("/") ? params.from : null;
  const { isOffline } = useOfflineStatus();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("");
  const [nickname, setNickname] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profilePhotoUri, setProfilePhotoUri] = useState("");
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [dietPhase, setDietPhase] = useState<DietPhase>("Maintain");
  const [initialTrainingPhase, setInitialTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [initialDietPhase, setInitialDietPhase] = useState<DietPhase>("Maintain");
  const [trainingPhaseHistory, setTrainingPhaseHistory] = useState<TrainingPhaseHistoryEntry[]>([]);
  const [dietPhaseHistory, setDietPhaseHistory] = useState<DietPhaseHistoryEntry[]>([]);
  const [currentTrainingPhaseStartedAt, setCurrentTrainingPhaseStartedAt] = useState<Timestamp | null>(
    null
  );
  const [currentDietPhaseStartedAt, setCurrentDietPhaseStartedAt] = useState<Timestamp | null>(null);
  const [cutCalories, setCutCalories] = useState("");
  const [maintainCalories, setMaintainCalories] = useState("");
  const [bulkCalories, setBulkCalories] = useState("");
  const [proteinTargetGrams, setProteinTargetGrams] = useState("");
  const [availabilityDays, setAvailabilityDays] = useState(4);
  const [sleepTargetHours, setSleepTargetHours] = useState("7");
  const [healthFeedback, setHealthFeedback] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthAvailability, setHealthAvailability] = useState<HealthConnectAvailability>("unsupported");
  const [healthPermissionState, setHealthPermissionState] = useState<
    "granted" | "denied" | "revoked" | "unavailable" | "unsupported" | "unknown"
  >("unknown");
  const [bodyHealthPermissionGranted, setBodyHealthPermissionGranted] = useState(false);
  const [healthConnectBodyPermissionGranted, setHealthConnectBodyPermissionGranted] = useState(false);
  const [samsungHealthIssue, setSamsungHealthIssue] = useState<string | null>(null);
  const [healthConsentAccepted, setHealthConsentAccepted] = useState(false);
  const [healthConsentVisible, setHealthConsentVisible] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [lastSleepSyncLabel, setLastSleepSyncLabel] = useState<string>("Not synced yet");
  const [photoActionMenuVisible, setPhotoActionMenuVisible] = useState(false);
  const [bodyHistoryExpanded, setBodyHistoryExpanded] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [bodyCompositionProfile, setBodyCompositionProfile] = useState<BodyCompositionProfile | null>(null);
  const [bodyCompositionEffective, setBodyCompositionEffective] = useState<BodyCompositionMetricSnapshot>(
    getEffectiveBodyCompositionSnapshot({
      manual: {
        weightKg: null,
        bodyFatPercent: null,
        muscleMassKg: null,
        recordedAt: null,
        source: null,
        originLabel: null,
      },
      synced: {
        weightKg: null,
        bodyFatPercent: null,
        muscleMassKg: null,
        recordedAt: null,
        source: null,
        originLabel: null,
      },
      history: [],
      lastSyncedAt: null,
      originAppPackage: null,
      originLabel: null,
    })
  );
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const skipNextBlurPromptRef = useRef(false);
  const blurPromptOpenRef = useRef(false);
  const buildSnapshot = useCallback(
    () =>
      JSON.stringify({
        goal,
        nickname: nickname.trim(),
        description: profileDescription.trim(),
        profilePhotoUri: profilePhotoUri.trim(),
        trainingPhase,
        dietPhase,
        cutCalories: cutCalories.trim(),
        maintainCalories: maintainCalories.trim(),
        bulkCalories: bulkCalories.trim(),
        proteinTargetGrams: proteinTargetGrams.trim(),
        availabilityDays,
        sleepTargetHours: sleepTargetHours.trim(),
        weightUnit,
        heightUnit,
        energyUnit,
        bodyWeight: bodyWeight.trim(),
        bodyFatPercent: bodyFatPercent.trim(),
        muscleMass: muscleMass.trim(),
      } satisfies ProfileSnapshot),
    [
      goal,
      nickname,
      profileDescription,
      profilePhotoUri,
      trainingPhase,
      dietPhase,
      cutCalories,
      maintainCalories,
      bulkCalories,
      proteinTargetGrams,
      availabilityDays,
      sleepTargetHours,
      weightUnit,
      heightUnit,
      energyUnit,
      bodyWeight,
      bodyFatPercent,
      muscleMass,
    ]
  );

  const hasUnsavedChanges = initialSnapshot != null && buildSnapshot() !== initialSnapshot;

  const applyBodyCompositionState = useCallback(
    (profile: BodyCompositionProfile, unit: WeightUnit) => {
      const effective = getEffectiveBodyCompositionSnapshot(profile);
      setBodyCompositionProfile(profile);
      setBodyCompositionEffective(effective);
      setBodyWeight(formatWeightForUnit(effective.weightKg, unit));
      setBodyFatPercent(formatPercent(effective.bodyFatPercent));
      setMuscleMass(formatWeightForUnit(effective.muscleMassKg, unit));
    },
    []
  );

  const restoreFromSnapshot = useCallback((snapshotText: string) => {
    try {
      const parsed = JSON.parse(snapshotText) as Partial<ProfileSnapshot>;
      if (typeof parsed.goal === "string") setGoal(parsed.goal);
      if (typeof parsed.nickname === "string") setNickname(parsed.nickname);
      if (typeof parsed.description === "string") setProfileDescription(parsed.description);
      if (typeof parsed.profilePhotoUri === "string") setProfilePhotoUri(parsed.profilePhotoUri);
      if (isTrainingPhase(parsed.trainingPhase)) setTrainingPhase(parsed.trainingPhase);
      if (isDietPhase(parsed.dietPhase)) setDietPhase(parsed.dietPhase);
      if (typeof parsed.cutCalories === "string") setCutCalories(parsed.cutCalories);
      if (typeof parsed.maintainCalories === "string") setMaintainCalories(parsed.maintainCalories);
      if (typeof parsed.bulkCalories === "string") setBulkCalories(parsed.bulkCalories);
      if (typeof parsed.proteinTargetGrams === "string") setProteinTargetGrams(parsed.proteinTargetGrams);
      if (isAvailabilityDays(parsed.availabilityDays)) setAvailabilityDays(parsed.availabilityDays);
      if (typeof parsed.sleepTargetHours === "string") setSleepTargetHours(parsed.sleepTargetHours);
      if (isWeightUnit(parsed.weightUnit)) setWeightUnit(parsed.weightUnit);
      if (isHeightUnit(parsed.heightUnit)) setHeightUnit(parsed.heightUnit);
      if (isEnergyUnit(parsed.energyUnit)) setEnergyUnit(parsed.energyUnit);
      if (typeof parsed.bodyWeight === "string") setBodyWeight(parsed.bodyWeight);
      if (typeof parsed.bodyFatPercent === "string") setBodyFatPercent(parsed.bodyFatPercent);
      if (typeof parsed.muscleMass === "string") setMuscleMass(parsed.muscleMass);
      setSaveFeedback(null);
    } catch (error) {
      console.log("Failed to restore profile snapshot", error);
    }
  }, []);

  const refreshHealthConnectStatus = useCallback(async () => {
    setHealthLoading(true);
    try {
      const availability = await getHealthConnectAvailability();
      let samsungBodyGranted = false;
      let samsungIssue: string | null = null;
      try {
        samsungBodyGranted = await hasSamsungHealthBodyCompositionPermission();
      } catch (error) {
        samsungIssue = getSamsungHealthAccessIssueMessage(error);
      }
      setHealthAvailability(availability);
      setBodyHealthPermissionGranted(samsungBodyGranted);
      setSamsungHealthIssue(samsungIssue);
      if (availability === "unsupported") {
        setHealthPermissionState("unsupported");
        setHealthConnectBodyPermissionGranted(false);
      } else if (availability !== "available") {
        setHealthPermissionState("unavailable");
        setHealthConnectBodyPermissionGranted(false);
      } else {
        const [sleepGranted, bodyGranted] = await Promise.all([
          hasHealthSleepPermission(),
          hasHealthBodyCompositionPermission(),
        ]);
        setHealthPermissionState(sleepGranted ? "granted" : "denied");
        setHealthConnectBodyPermissionGranted(bodyGranted);
      }
    } catch {
      setHealthPermissionState("unknown");
      setBodyHealthPermissionGranted(false);
      setHealthConnectBodyPermissionGranted(false);
      setSamsungHealthIssue(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const refreshBodyComposition = useCallback(
    async (userId: string, unit: WeightUnit) => {
      const profile = await getBodyCompositionProfile(userId);
      applyBodyCompositionState(profile, unit);
    },
    [applyBodyCompositionState]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRedirectTo("/auth/sign-in");
        return;
      }
      setUid(user.uid);
      try {
        const [data, sleepProfile, compositionProfile] = await Promise.all([
          getUserData(user.uid),
          getSleepProfile(user.uid),
          getBodyCompositionProfile(user.uid),
        ]);
        setLastSleepSyncLabel(
          sleepProfile.lastSyncedAt
            ? sleepProfile.lastSyncedAt.toDate().toLocaleString()
            : "Not synced yet"
        );
        if (data?.goal) setGoal(data.goal);
        if (data?.nickname) setNickname(data.nickname);
        if (typeof data?.description === "string") setProfileDescription(data.description);
        if (typeof data?.profilePhotoUri === "string") setProfilePhotoUri(data.profilePhotoUri);
        if (isTrainingPhase(data?.trainingPhase)) {
          setTrainingPhase(data.trainingPhase);
          setInitialTrainingPhase(data.trainingPhase);
        }
        if (isDietPhase(data?.dietPhase)) {
          setDietPhase(data.dietPhase);
          setInitialDietPhase(data.dietPhase);
        }
        setCurrentTrainingPhaseStartedAt(
          data?.trainingPhaseStartedAt instanceof Timestamp ? data.trainingPhaseStartedAt : null
        );
        setCurrentDietPhaseStartedAt(
          data?.dietPhaseStartedAt instanceof Timestamp ? data.dietPhaseStartedAt : null
        );
        const rawTrainingHistory = Array.isArray(data?.trainingPhaseHistory)
          ? data.trainingPhaseHistory
          : [];
        const rawDietHistory = Array.isArray(data?.dietPhaseHistory) ? data.dietPhaseHistory : [];
        const parsedTrainingHistory = rawTrainingHistory
          .map((entry: any) => ({
            phase: isTrainingPhase(entry?.phase) ? entry.phase : null,
            startedAt: entry?.startedAt instanceof Timestamp ? entry.startedAt : null,
          }))
          .filter(
            (
              entry: {
                phase: TrainingPhase | null;
                startedAt: Timestamp | null;
              }
            ): entry is TrainingPhaseHistoryEntry =>
              entry.phase != null && entry.startedAt != null
          )
          .sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
        const parsedDietHistory = rawDietHistory
          .map((entry: any) => ({
            phase: isDietPhase(entry?.phase) ? entry.phase : null,
            startedAt: entry?.startedAt instanceof Timestamp ? entry.startedAt : null,
          }))
          .filter(
            (
              entry: {
                phase: DietPhase | null;
                startedAt: Timestamp | null;
              }
            ): entry is DietPhaseHistoryEntry =>
              entry.phase != null && entry.startedAt != null
          )
          .sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
        setTrainingPhaseHistory(parsedTrainingHistory);
        setDietPhaseHistory(parsedDietHistory);
        const calorieTargets = normalizeCalorieTargets(
          data?.nutritionProfile?.calorieTargetsByDietPhase
        );
        if (
          typeof data?.nutritionProfile?.proteinTargetGrams === "number" &&
          Number.isFinite(data.nutritionProfile.proteinTargetGrams) &&
          data.nutritionProfile.proteinTargetGrams > 0
        ) {
          setProteinTargetGrams(String(Math.round(data.nutritionProfile.proteinTargetGrams)));
        }
        setCutCalories(
          calorieTargets.Cut == null ? "" : String(calorieTargets.Cut)
        );
        setMaintainCalories(
          calorieTargets.Maintain == null ? "" : String(calorieTargets.Maintain)
        );
        setBulkCalories(
          calorieTargets.Bulk == null ? "" : String(calorieTargets.Bulk)
        );
        const sleepTarget = data?.sleepSettings?.targetHours;
        if (typeof sleepTarget === "number" && sleepTarget > 0) {
          setSleepTargetHours(String(Math.round(sleepTarget * 10) / 10));
        }
        if (isAvailabilityDays(data?.availabilityDays)) {
          setAvailabilityDays(Math.round(data.availabilityDays));
        } else {
          const mappedDays = mapLegacyAvailabilityToDays(data?.availability);
          if (mappedDays != null) {
            setAvailabilityDays(mappedDays);
          }
        }
        const resolvedWeightUnit = isWeightUnit(data?.weightUnit) ? data.weightUnit : "kg";
        if (isWeightUnit(data?.weightUnit)) setWeightUnit(data.weightUnit);
        if (isHeightUnit(data?.heightUnit)) setHeightUnit(data.heightUnit);
        if (isEnergyUnit(data?.energyUnit)) setEnergyUnit(data.energyUnit);
        applyBodyCompositionState(compositionProfile, resolvedWeightUnit);
      } catch (e) {
        console.log("Error fetching user data", e);
      } finally {
        await refreshHealthConnectStatus();
        setLoading(false);
      }
    });
    return unsub;
  }, [applyBodyCompositionState, refreshHealthConnectStatus]);

  useEffect(() => {
    if (!uid) {
      setHealthConsentAccepted(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const accepted = await AsyncStorage.getItem(`${HEALTH_SYNC_CONSENT_KEY_PREFIX}:${uid}`);
        if (!cancelled) {
          setHealthConsentAccepted(accepted === "true");
        }
      } catch (error) {
        console.log("Failed to load health sync consent state", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void refreshHealthConnectStatus();
      if (uid) {
        void (async () => {
          const samsungAutoSyncResult = await autoSyncBodyCompositionFromSamsungHealthIfEligible(uid, {
            minIntervalMinutes: 60,
          });
          const bodyAutoSyncResult =
            samsungAutoSyncResult === "synced"
              ? "synced"
              : await autoSyncBodyCompositionFromHealthConnectIfEligible(uid, {
                  minIntervalMinutes: 60,
                });
          if (bodyAutoSyncResult === "synced") {
            await refreshBodyComposition(uid, weightUnit);
          }
          const sleepProfile = await getSleepProfile(uid);
          setLastSleepSyncLabel(
            sleepProfile.lastSyncedAt
              ? sleepProfile.lastSyncedAt.toDate().toLocaleString()
              : "Not synced yet"
          );
        })();
      }
      return undefined;
    }, [refreshBodyComposition, refreshHealthConnectStatus, uid, weightUnit])
  );

  useEffect(() => {
    if (!loading && initialSnapshot == null) {
      setInitialSnapshot(buildSnapshot());
    }
  }, [loading, initialSnapshot, buildSnapshot]);

  const healthConnectMessage = () => {
    if (!healthConsentAccepted) {
      return "Connect to allow supported sleep and body composition sync.";
    }
    const hasAnyBodyCompositionAccess =
      bodyHealthPermissionGranted || healthConnectBodyPermissionGranted;
    if (isOffline) {
      return "You're offline. Reconnect before checking permissions or syncing.";
    }
    if (healthAvailability === "provider_update_required") {
      return "Update Health Connect to enable sleep sync.";
    }
    if (healthAvailability === "unavailable") {
      return "Health Connect is unavailable on this device, so sleep sync is unavailable.";
    }
    if (healthAvailability === "unsupported") {
      return "Health sync is only supported on Android.";
    }
    if (healthPermissionState === "granted" && hasAnyBodyCompositionAccess) {
      return bodyHealthPermissionGranted
        ? "Ready. Sleep and body composition can sync now."
        : "Ready. Sleep can sync now, and supported body composition data is available through Health Connect.";
    }
    if (samsungHealthIssue && hasAnyBodyCompositionAccess) {
      return "Supported sleep and body composition data can sync now.";
    }
    if (healthPermissionState === "granted") {
      return "Sleep is ready. Body composition permission is still needed.";
    }
    if (hasAnyBodyCompositionAccess) {
      return "Body composition is ready. Health Connect sleep permission is still needed.";
    }
    if (healthPermissionState === "denied" || healthPermissionState === "revoked") {
      return "Connect to allow supported sleep and body composition sync.";
    }
    return "Connect to set permissions, then use Sync now to import your latest records.";
  };

  const handleOpenPlayStore = async () => {
    const url = "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      setHealthFeedback("Unable to open Play Store on this device.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleConnectHealthPermission = async () => {
    if (isOffline) {
      setHealthFeedback("You're offline. Reconnect to continue.");
      return;
    }
    setHealthLoading(true);
    setHealthFeedback(null);
    try {
      let sleepGranted = false;
      let samsungBodyGranted = false;
      let healthConnectBodyGranted = false;
      let samsungIssue: string | null = null;

      if (healthAvailability === "provider_update_required") {
        const opened = await openHealthConnectDataManagementScreen();
        if (!opened) {
          setHealthFeedback("Unable to open Health Connect settings on this device.");
        }
        return;
      } else if (healthAvailability !== "available") {
        setHealthFeedback("Health Connect is unavailable on this device.");
        return;
      } else {
        const healthConnect = await import("react-native-health-connect");
        await healthConnect.initialize();
        await healthConnect.requestPermission([
          { accessType: "read", recordType: "SleepSession" },
          { accessType: "read", recordType: "Weight" },
          { accessType: "read", recordType: "BodyFat" },
          { accessType: "read", recordType: "LeanBodyMass" },
        ]);
        sleepGranted = await hasHealthSleepPermission();
        healthConnectBodyGranted = await hasHealthBodyCompositionPermission();
      }

      try {
        samsungBodyGranted = await requestSamsungHealthBodyCompositionPermission();
      } catch (error) {
        console.log("Failed to request Samsung Health body composition permissions", error);
        samsungIssue = getSamsungHealthAccessIssueMessage(error);
      }

      await refreshHealthConnectStatus();

      if (sleepGranted && (samsungBodyGranted || healthConnectBodyGranted)) {
        setHealthFeedback(
          samsungBodyGranted
            ? "Health Connect sleep permission and Samsung Health body composition permission granted."
            : "Health Connect sleep and fallback body composition permissions granted."
        );
        return;
      }

      if (samsungIssue && !healthConnectBodyGranted) {
        setHealthFeedback(
          "Sleep permission can still be managed through Health Connect. Review body composition access in your connected health services."
        );
        return;
      }

      const opened =
        (await openHealthConnectAppPermissionsScreen()) ||
        (await openHealthConnectDataManagementScreen());
      setHealthFeedback(
        opened
          ? "Some permissions are still missing. Review sleep and body composition access in your connected health services."
          : "Unable to open Health Connect settings on this device."
      );
    } catch (error) {
      console.log("Failed to request Health Connect permissions", error);
      const opened =
        (await openHealthConnectAppPermissionsScreen()) ||
        (await openHealthConnectDataManagementScreen());
      setHealthFeedback(
        opened
          ? "Couldn't request permissions in-app. Review sleep and body composition access in your connected health services."
          : "Unable to open Health Connect settings on this device."
      );
    } finally {
      setHealthLoading(false);
    }
  };

  const handleOpenHealthConsent = () => {
    if (healthConsentAccepted) {
      void handleConnectHealthPermission();
      return;
    }
    setHealthConsentVisible(true);
  };

  const handleAcceptHealthConsent = () => {
    if (!uid) return;
    void (async () => {
      try {
        await AsyncStorage.setItem(`${HEALTH_SYNC_CONSENT_KEY_PREFIX}:${uid}`, "true");
        setHealthConsentAccepted(true);
      } catch (error) {
        console.log("Failed to persist health sync consent", error);
      } finally {
        setHealthConsentVisible(false);
        void handleConnectHealthPermission();
      }
    })();
  };

  const clearHealthConsentAccepted = useCallback(async () => {
    if (!uid) return;
    try {
      await AsyncStorage.removeItem(`${HEALTH_SYNC_CONSENT_KEY_PREFIX}:${uid}`);
    } catch (error) {
      console.log("Failed to clear health sync consent", error);
    } finally {
      setHealthConsentAccepted(false);
      setHealthFeedback(null);
    }
  }, [uid]);

  const handleManageHealthPermissions = useCallback(async () => {
    const opened =
      (await openHealthConnectAppPermissionsScreen()) ||
      (await openHealthConnectDataManagementScreen());
    setHealthFeedback(opened ? null : "Unable to open Health Connect permissions on this device.");
  }, []);

  const handleDisconnectHealth = useCallback(() => {
    showAppDialog({
      title: "Disconnect health sync",
      message:
        "Lastrep can stop using connected health data now. If you also want to remove access at the source, open Health Connect permissions.",
      buttonLayout: "vertical",
      buttons: [
        {
          text: "Disconnect in Lastrep",
          role: "destructive",
          onPress: () => {
            void clearHealthConsentAccepted();
          },
        },
        {
          text: "Open Health Connect",
          onPress: () => {
            void handleManageHealthPermissions();
          },
        },
        { text: "Cancel", role: "cancel" },
      ],
    });
  }, [clearHealthConsentAccepted, handleManageHealthPermissions]);

  const applyEnergyUnit = (nextUnit: EnergyUnit) => {
    if (nextUnit === energyUnit) return;
    const convertText = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return raw;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return raw;
      return String(Math.round(convertEnergyValue(parsed, energyUnit, nextUnit)));
    };
    setCutCalories((previous) => convertText(previous));
    setMaintainCalories((previous) => convertText(previous));
    setBulkCalories((previous) => convertText(previous));
    setEnergyUnit(nextUnit);
  };

  const applyWeightUnit = (nextUnit: WeightUnit) => {
    if (nextUnit === weightUnit) return;
    const convertText = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return raw;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return raw;
      const kgValue = convertWeightUnitToKg(parsed, weightUnit);
      return `${Math.round(convertKgToWeightUnit(kgValue, nextUnit) * 10) / 10}`;
    };
    setBodyWeight((previous) => convertText(previous));
    setMuscleMass((previous) => convertText(previous));
    setWeightUnit(nextUnit);
  };

  const handlePickProfilePhoto = useCallback(async () => {
    setPhotoActionMenuVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAppAlert("Permission required", "Allow photo library access to choose a profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setProfilePhotoUri(result.assets[0].uri);
  }, []);

  const handleRemoveProfilePhoto = useCallback(() => {
    setPhotoActionMenuVisible(false);
    setProfilePhotoUri("");
  }, []);

  const handleSyncHealthConnectData = useCallback(async () => {
    if (!uid) return;
    if (isOffline) {
      setHealthFeedback("You're offline. Reconnect to sync health data.");
      return;
    }
    setHealthLoading(true);
    setHealthFeedback(null);
    try {
      const [sleepGranted, healthConnectBodyGrantedNext] = await Promise.all([
        hasHealthSleepPermission(),
        hasHealthBodyCompositionPermission(),
      ]);
      let samsungBodyGranted = false;
      let samsungIssue: string | null = null;
      try {
        samsungBodyGranted = await hasSamsungHealthBodyCompositionPermission();
      } catch (error) {
        samsungIssue = getSamsungHealthAccessIssueMessage(error);
        setSamsungHealthIssue(samsungIssue);
      }

      if (!sleepGranted && !samsungBodyGranted && !healthConnectBodyGrantedNext) {
        const opened =
          (await openHealthConnectAppPermissionsScreen()) ||
          (await openHealthConnectDataManagementScreen());
        setHealthFeedback(
          opened
            ? "Permissions are required before syncing sleep or body composition."
            : "Unable to open Health Connect settings on this device."
        );
        return;
      }

      const [sleepResult, bodyResult] = await Promise.all([
        sleepGranted ? syncSleepFromHealthConnect(uid) : Promise.resolve({ status: "permission_denied" as const }),
        samsungBodyGranted
          ? syncBodyCompositionFromSamsungHealth(uid)
          : healthConnectBodyGrantedNext
            ? syncBodyCompositionFromHealthConnect(uid)
            : Promise.resolve({ status: "permission_denied" as const }),
      ]);

      if (sleepResult.status === "success") {
        const sleepProfile = await getSleepProfile(uid);
        setLastSleepSyncLabel(
          sleepProfile.lastSyncedAt
            ? sleepProfile.lastSyncedAt.toDate().toLocaleString()
            : "Not synced yet"
        );
      }
      if (bodyResult.status === "success") {
        await refreshBodyComposition(uid, weightUnit);
      }

      const messages: string[] = [];
      if (sleepResult.status === "success") {
        messages.push("Sleep synced.");
      } else if (sleepResult.status === "no_data") {
        messages.push("No sleep data found.");
      } else if (sleepResult.status === "permission_denied") {
        messages.push("Sleep permission missing.");
      } else if (sleepResult.status === "error") {
        messages.push(`Sleep sync failed: ${sleepResult.message}`);
      }

      if (bodyResult.status === "success") {
        messages.push(
          samsungBodyGranted
            ? "Body composition synced from Samsung Health."
            : "Body composition synced from Health Connect."
        );
      } else if (bodyResult.status === "no_data") {
        messages.push("No body composition data found.");
      } else if (bodyResult.status === "permission_denied") {
        messages.push("Body composition permission missing.");
      } else if (bodyResult.status === "error") {
        messages.push(`Body composition sync failed: ${bodyResult.message}`);
      }
      if (messages.length === 0) {
        messages.push("Nothing was synced.");
      }
      setHealthFeedback(messages.join(" "));
      await refreshHealthConnectStatus();
    } finally {
      setHealthLoading(false);
    }
  }, [isOffline, refreshBodyComposition, refreshHealthConnectStatus, uid, weightUnit]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!uid) return false;
    setSaveFeedback(null);
    const fields = [
      { label: "Cut", value: cutCalories },
      { label: "Maintain", value: maintainCalories },
      { label: "Bulk", value: bulkCalories },
    ] as const;

    const parsedTargets = { ...DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE };
    for (const field of fields) {
      const trimmed = field.value.trim();
      if (!trimmed) continue;

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        showAppAlert(
          "Invalid calorie target",
          `${field.label} calories must be a positive number or left blank.`
        );
        return false;
      }

      const kcalValue = energyUnit === "kJ" ? parsed / KCAL_TO_KJ : parsed;
      parsedTargets[field.label] = Math.round(kcalValue);
    }

    const parsedSleepTarget = Number(sleepTargetHours.trim());
    if (!Number.isFinite(parsedSleepTarget) || parsedSleepTarget <= 0 || parsedSleepTarget > 24) {
      showAppAlert("Invalid sleep target", "Sleep target must be a number between 0 and 24.");
      return false;
    }
    const parsedProteinTarget = proteinTargetGrams.trim()
      ? Number(proteinTargetGrams.trim())
      : null;
    if (
      parsedProteinTarget != null &&
      (!Number.isFinite(parsedProteinTarget) || parsedProteinTarget <= 0)
    ) {
      showAppAlert("Invalid protein target", "Protein target must be a positive number or blank.");
      return false;
    }
    const parseOptionalBodyMetric = (raw: string, label: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        showAppAlert("Invalid body composition", `${label} must be a positive number or blank.`);
        return Number.NaN;
      }
      return Math.round(parsed * 10) / 10;
    };
    const parsedWeight = parseOptionalBodyMetric(bodyWeight, "Body weight");
    if (Number.isNaN(parsedWeight)) return false;
    const parsedBodyFat = parseOptionalBodyMetric(bodyFatPercent, "Body fat %");
    if (Number.isNaN(parsedBodyFat)) return false;
    const parsedMuscleMass = parseOptionalBodyMetric(muscleMass, "Muscle mass");
    if (Number.isNaN(parsedMuscleMass)) return false;
    const nextWeightKg =
      typeof parsedWeight === "number" ? convertWeightUnitToKg(parsedWeight, weightUnit) : null;
    const nextMuscleMassKg =
      typeof parsedMuscleMass === "number"
        ? convertWeightUnitToKg(parsedMuscleMass, weightUnit)
        : null;

    try {
      const profilePayload: Record<string, unknown> = {
        goal,
        nickname: nickname.trim(),
        description: profileDescription.trim(),
        profilePhotoUri: profilePhotoUri.trim(),
        trainingPhase,
        dietPhase,
        weightUnit,
        heightUnit,
        energyUnit,
        availabilityDays,
        availability: `${availabilityDays}`,
      };
      let nextTrainingHistory = trainingPhaseHistory;
      let nextDietHistory = dietPhaseHistory;
      if (trainingPhase !== initialTrainingPhase) {
        const now = Timestamp.now();
        profilePayload.trainingPhaseStartedAt = now;
        if (trainingPhaseHistory.length === 0) {
          const baselineStartedAt =
            currentTrainingPhaseStartedAt ?? Timestamp.fromMillis(Math.max(0, now.toMillis() - 1));
          nextTrainingHistory = [
            { phase: initialTrainingPhase, startedAt: baselineStartedAt },
            { phase: trainingPhase, startedAt: now },
          ];
        } else {
          nextTrainingHistory = [...trainingPhaseHistory, { phase: trainingPhase, startedAt: now }];
        }
        profilePayload.trainingPhaseHistory = nextTrainingHistory;
      }
      if (dietPhase !== initialDietPhase) {
        const now = Timestamp.now();
        profilePayload.dietPhaseStartedAt = now;
        if (dietPhaseHistory.length === 0) {
          const baselineStartedAt =
            currentDietPhaseStartedAt ?? Timestamp.fromMillis(Math.max(0, now.toMillis() - 1));
          nextDietHistory = [
            { phase: initialDietPhase, startedAt: baselineStartedAt },
            { phase: dietPhase, startedAt: now },
          ];
        } else {
          nextDietHistory = [...dietPhaseHistory, { phase: dietPhase, startedAt: now }];
        }
        profilePayload.dietPhaseHistory = nextDietHistory;
      }
      await saveUserData(uid, profilePayload, true);
      await saveUserData(
        uid,
        { sleepSettings: { targetHours: Math.round(parsedSleepTarget * 10) / 10 } },
        true
      );
      await saveNutritionProfile(
        uid,
        parsedTargets,
        parsedProteinTarget == null ? null : Math.round(parsedProteinTarget)
      );
      const bodyCompositionUpdates: {
        weightKg?: number | null;
        bodyFatPercent?: number | null;
        muscleMassKg?: number | null;
      } = {};
      const hasMetricChanged = (nextValue: number | null, currentValue: number | null) =>
        typeof nextValue === "number" &&
        (typeof currentValue !== "number" || Math.abs(nextValue - currentValue) > 0.05);
      if (
        hasMetricChanged(nextWeightKg, bodyCompositionEffective.weightKg)
      ) {
        bodyCompositionUpdates.weightKg = nextWeightKg;
      }
      if (hasMetricChanged(parsedBodyFat, bodyCompositionEffective.bodyFatPercent)) {
        bodyCompositionUpdates.bodyFatPercent = parsedBodyFat;
      }
      if (hasMetricChanged(nextMuscleMassKg, bodyCompositionEffective.muscleMassKg)) {
        bodyCompositionUpdates.muscleMassKg = nextMuscleMassKg;
      }
      if (Object.keys(bodyCompositionUpdates).length > 0) {
        await saveManualBodyCompositionEntry(uid, bodyCompositionUpdates);
        await refreshBodyComposition(uid, weightUnit);
      }
      setInitialTrainingPhase(trainingPhase);
      setInitialDietPhase(dietPhase);
      setTrainingPhaseHistory(nextTrainingHistory);
      setDietPhaseHistory(nextDietHistory);
      setCurrentTrainingPhaseStartedAt(
        trainingPhase !== initialTrainingPhase ? (profilePayload.trainingPhaseStartedAt as Timestamp) : currentTrainingPhaseStartedAt
      );
      setCurrentDietPhaseStartedAt(
        dietPhase !== initialDietPhase ? (profilePayload.dietPhaseStartedAt as Timestamp) : currentDietPhaseStartedAt
      );
      setSaveFeedback("Changes saved.");
      setInitialSnapshot(buildSnapshot());
      return true;
    } catch (error) {
      console.log("Failed to save profile", error);
      showAppAlert("Save failed", "Couldn't save your changes. Please try again.");
      return false;
    }
  }, [
    uid,
    cutCalories,
    maintainCalories,
    bulkCalories,
    energyUnit,
    sleepTargetHours,
    proteinTargetGrams,
    goal,
    nickname,
    profileDescription,
    profilePhotoUri,
    trainingPhase,
    dietPhase,
    weightUnit,
    heightUnit,
    availabilityDays,
    trainingPhaseHistory,
    dietPhaseHistory,
    initialTrainingPhase,
    initialDietPhase,
    currentTrainingPhaseStartedAt,
    currentDietPhaseStartedAt,
    bodyWeight,
    bodyFatPercent,
    muscleMass,
    bodyCompositionEffective.weightKg,
    bodyCompositionEffective.bodyFatPercent,
    bodyCompositionEffective.muscleMassKg,
    buildSnapshot,
    refreshBodyComposition,
  ]);

  const navigateBack = useCallback((destination?: Href | null) => {
    skipNextBlurPromptRef.current = true;
    if (destination) {
      router.replace(destination);
      return;
    }
    if (returnTo) {
      router.replace(returnTo as Href);
      return;
    }
    router.replace("/home");
  }, [router, returnTo]);

  const attemptLeave = useCallback((destination?: Href | null) => {
    if (!hasUnsavedChanges) {
      navigateBack(destination);
      return;
    }
    showAppDialog({
      title: "Unsaved changes",
      message: "You have unsaved changes. Save before leaving?",
      buttons: [
        {
          text: "Save",
          role: "default",
          onPress: () => {
            void (async () => {
              const ok = await save();
              if (ok) navigateBack(destination);
            })();
          },
        },
        {
          text: "Discard",
          role: "destructive",
          onPress: () => {
            if (initialSnapshot) {
              restoreFromSnapshot(initialSnapshot);
            }
            navigateBack(destination);
          },
        },
        { text: "Cancel", role: "cancel" },
      ],
    });
  }, [hasUnsavedChanges, initialSnapshot, navigateBack, restoreFromSnapshot, save]);

  const handleGoBack = () => {
    attemptLeave();
  };

  useEffect(() => {
    setProfileLeaveGuard({
      hasUnsavedChanges,
      save,
      discard: () => {
        if (initialSnapshot) {
          restoreFromSnapshot(initialSnapshot);
        }
      },
    });
    return () => {
      clearProfileLeaveGuard();
    };
  }, [hasUnsavedChanges, initialSnapshot, restoreFromSnapshot, save]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (healthConsentVisible) {
          setHealthConsentVisible(false);
          return true;
        }
        if (photoActionMenuVisible) {
          setPhotoActionMenuVisible(false);
          return true;
        }
        attemptLeave();
        return true;
      });
      return () => sub.remove();
    }, [attemptLeave, healthConsentVisible, photoActionMenuVisible])
  );

  useFocusEffect(
    useCallback(() => {
      const unsubBeforeRemove = navigation.addListener("beforeRemove", (event) => {
        if (!hasUnsavedChanges) return;
        if (skipNextBlurPromptRef.current) {
          skipNextBlurPromptRef.current = false;
          return;
        }
        if (blurPromptOpenRef.current) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        blurPromptOpenRef.current = true;
        const continueAction = event.data.action;
        showAppDialog({
          title: "Unsaved changes",
          message: "You have unsaved changes. Save before leaving?",
          buttons: [
            {
              text: "Save",
              role: "default",
              onPress: () => {
                blurPromptOpenRef.current = false;
                void (async () => {
                  const ok = await save();
                  if (!ok) return;
                  skipNextBlurPromptRef.current = true;
                  navigation.dispatch(continueAction);
                })();
              },
            },
            {
              text: "Discard",
              role: "destructive",
              onPress: () => {
                blurPromptOpenRef.current = false;
                if (initialSnapshot) {
                  restoreFromSnapshot(initialSnapshot);
                }
                skipNextBlurPromptRef.current = true;
                navigation.dispatch(continueAction);
              },
            },
            {
              text: "Cancel",
              role: "cancel",
              onPress: () => {
                blurPromptOpenRef.current = false;
              },
            },
          ],
        });
      });
      return () => {
        unsubBeforeRemove();
      };
    }, [navigation, hasUnsavedChanges, save, initialSnapshot, restoreFromSnapshot])
  );

  const isHealthConnected =
    healthConsentAccepted &&
    healthPermissionState === "granted" &&
    (bodyHealthPermissionGranted || healthConnectBodyPermissionGranted);
  const hasAnyHealthPermission =
    healthPermissionState === "granted" ||
    bodyHealthPermissionGranted ||
    healthConnectBodyPermissionGranted;
  const shouldShowConnectAction = !healthConsentAccepted || !hasAnyHealthPermission;
  const healthConnectionStatus = isHealthConnected
    ? "Connected"
    : healthConsentAccepted && hasAnyHealthPermission
      ? "Partially connected"
      : "Not connected";
  const displayedSleepStatus = healthConsentAccepted
    ? healthPermissionState === "granted"
      ? "Ready"
      : "Needs permission"
    : "Not connected";
  const displayedBodyStatus = healthConsentAccepted
    ? bodyHealthPermissionGranted
      ? "Ready"
      : healthConnectBodyPermissionGranted
        ? "Ready (partial)"
        : "Needs permission"
    : "Not connected";
  const displayedLastSleepSyncLabel =
    healthConsentAccepted && hasAnyHealthPermission ? lastSleepSyncLabel : "Not connected";
  const displayedLastBodySyncLabel =
    healthConsentAccepted && hasAnyHealthPermission ? lastBodySyncLabel : "Not connected";
  const healthPrimaryButtonLabel = healthLoading
    ? "Working..."
    : !healthConsentAccepted
      ? "Connect"
      : hasAnyHealthPermission
        ? "Sync now"
        : "Reconnect";
  const latestBodyCompositionLabel = formatBodyCompositionTimestamp(
    bodyCompositionEffective.recordedAt
  );
  const latestBodyCompositionSource = formatBodyCompositionSource(
    bodyCompositionEffective.source,
    bodyCompositionEffective.originLabel
  );
  const bodyCompositionHistory = bodyCompositionProfile?.history ?? [];
  const visibleBodyCompositionHistory = bodyHistoryExpanded
    ? bodyCompositionHistory.slice(0, 8)
    : bodyCompositionHistory.slice(0, 3);
  const lastBodySyncLabel = bodyCompositionProfile?.lastSyncedAt
    ? bodyCompositionProfile.lastSyncedAt.toDate().toLocaleString()
    : "Not synced yet";

  if (redirectTo) return <Redirect href={redirectTo} />;
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile identity</Text>
          <View style={styles.identityRow}>
            <View style={styles.profilePhotoWrap}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profilePhoto} contentFit="cover" />
              ) : (
                <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
                  <Ionicons name="person" size={28} color="#d8daec" />
                </View>
              )}
              <TouchableOpacity
                style={styles.profilePhotoAction}
                onPress={() => setPhotoActionMenuVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={15} color="#eef1ff" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.targetLabel}>Nickname</Text>
          <TextInput
            placeholder="Your nickname"
            placeholderTextColor="#7a7a8c"
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
          />
          <Text style={styles.targetLabel}>Description</Text>
          <TextInput
            placeholder="Short description"
            placeholderTextColor="#7a7a8c"
            style={[styles.input, styles.multilineInput]}
            value={profileDescription}
            onChangeText={setProfileDescription}
            multiline
            textAlignVertical="top"
            maxLength={160}
          />
        </View>

        <Modal
          visible={photoActionMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoActionMenuVisible(false)}
        >
          <Pressable style={styles.photoActionOverlay} onPress={() => setPhotoActionMenuVisible(false)}>
            <Pressable style={styles.photoActionSheet} onPress={(event) => event.stopPropagation()}>
              <TouchableOpacity style={styles.photoActionItem} onPress={handlePickProfilePhoto}>
                <Ionicons name={profilePhotoUri ? "image-outline" : "camera-outline"} size={18} color="#f4f7ff" />
                <Text style={styles.photoActionItemText}>
                  {profilePhotoUri ? "Change photo" : "Add photo"}
                </Text>
              </TouchableOpacity>
              {profilePhotoUri ? (
                <TouchableOpacity style={styles.photoActionItem} onPress={handleRemoveProfilePhoto}>
                  <Ionicons name="trash-outline" size={18} color="#ffb4b4" />
                  <Text style={[styles.photoActionItemText, styles.photoActionDeleteText]}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Goal</Text>
          <View style={styles.row}>
            {goals.map((g) => (
              <TouchableOpacity
                key={g.key}
                onPress={() => setGoal(g.key)}
                style={[styles.chip, goal === g.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, goal === g.key && styles.chipTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Training phase</Text>
          <View style={styles.row}>
            {TRAINING_PHASES.map((phase) => (
              <TouchableOpacity
                key={phase}
                onPress={() => setTrainingPhase(phase)}
                style={[styles.chip, trainingPhase === phase && styles.chipActive]}
              >
                <Text style={[styles.chipText, trainingPhase === phase && styles.chipTextActive]}>
                  {phase}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diet phase</Text>
          <View style={styles.row}>
            {DIET_PHASES.map((phase) => (
              <TouchableOpacity
                key={phase}
                onPress={() => setDietPhase(phase)}
                style={[styles.chip, dietPhase === phase && styles.chipActive]}
              >
                <Text style={[styles.chipText, dietPhase === phase && styles.chipTextActive]}>
                  {phase}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Availability</Text>
          <Text style={styles.availabilityValue}>{availabilityDays} days / week</Text>
          <Slider
            value={availabilityDays}
            minimumValue={1}
            maximumValue={7}
            step={1}
            minimumTrackTintColor="#7b61ff"
            maximumTrackTintColor="rgba(255,255,255,0.35)"
            thumbTintColor="#fff"
            onValueChange={(value: number) => setAvailabilityDays(Math.round(value))}
          />
          <View style={styles.availabilityTicksRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <View key={`availability-${day}`} style={styles.availabilityTickCol}>
                <View
                  style={[
                    styles.availabilityTick,
                    day === availabilityDays && styles.availabilityTickActive,
                  ]}
                />
                <Text
                  style={[
                    styles.availabilityTickLabel,
                    day === availabilityDays && styles.availabilityTickLabelActive,
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Units</Text>
          <Text style={styles.targetLabel}>Weight</Text>
          <View style={styles.row}>
            {(["kg", "lbs"] as WeightUnit[]).map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => applyWeightUnit(unit)}
                style={[styles.chip, weightUnit === unit && styles.chipActive]}
              >
                <Text style={[styles.chipText, weightUnit === unit && styles.chipTextActive]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.targetLabel}>Height</Text>
          <View style={styles.row}>
            {(["cm", "ft/in"] as HeightUnit[]).map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => setHeightUnit(unit)}
                style={[styles.chip, heightUnit === unit && styles.chipActive]}
              >
                <Text style={[styles.chipText, heightUnit === unit && styles.chipTextActive]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.targetLabel}>Food energy</Text>
          <View style={styles.row}>
            {(["kcal", "kJ"] as EnergyUnit[]).map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => applyEnergyUnit(unit)}
                style={[styles.chip, energyUnit === unit && styles.chipActive]}
              >
                <Text style={[styles.chipText, energyUnit === unit && styles.chipTextActive]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardTitleNoMargin}>Body composition</Text>
          </View>
          <Text style={styles.helperText}>Latest source: {latestBodyCompositionSource}</Text>
          <Text style={styles.helperText}>Last updated: {latestBodyCompositionLabel}</Text>
          <View style={styles.targetRow}>
            <View style={styles.targetColumn}>
              <Text style={styles.targetLabel}>Weight ({weightUnit})</Text>
              <TextInput
                placeholder={weightUnit === "lbs" ? "176.4" : "80.0"}
                placeholderTextColor="#7a7a8c"
                style={styles.input}
                value={bodyWeight}
                onChangeText={setBodyWeight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.targetColumn}>
              <Text style={styles.targetLabel}>Body fat (%)</Text>
              <TextInput
                placeholder="15.0"
                placeholderTextColor="#7a7a8c"
                style={styles.input}
                value={bodyFatPercent}
                onChangeText={setBodyFatPercent}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.targetColumn}>
              <Text style={styles.targetLabel}>Skeletal muscle ({weightUnit})</Text>
              <TextInput
                placeholder={weightUnit === "lbs" ? "88.2" : "40.0"}
                placeholderTextColor="#7a7a8c"
                style={styles.input}
                value={muscleMass}
                onChangeText={setMuscleMass}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={styles.historySection}>
            <Text style={styles.targetLabel}>Recent history</Text>
            {bodyCompositionHistory.length === 0 ? (
              <Text style={styles.helperText}>No body composition records yet.</Text>
            ) : (
              <>
                {visibleBodyCompositionHistory.map((entry, index) => (
                  <View
                    key={`${entry.source}-${entry.recordedAt?.toMillis() ?? index}-${index}`}
                    style={styles.historyRow}
                  >
                    <View style={styles.historyRowHeader}>
                      <Text style={styles.historyRowTitle}>
                        {formatBodyCompositionSource(entry.source, entry.originLabel)}
                      </Text>
                      <Text style={styles.historyRowMeta}>
                        {formatBodyCompositionTimestamp(entry.recordedAt)}
                      </Text>
                    </View>
                    <Text style={styles.historyRowValues}>
                      {`W ${formatWeightForUnit(entry.weightKg, weightUnit) || "-"} ${weightUnit} | BF ${
                        formatPercent(entry.bodyFatPercent) || "-"
                      }% | MM ${formatWeightForUnit(entry.muscleMassKg, weightUnit) || "-"} ${weightUnit}`}
                    </Text>
                  </View>
                ))}
                {bodyCompositionHistory.length > 3 ? (
                  <TouchableOpacity
                    style={styles.historyToggle}
                    onPress={() => setBodyHistoryExpanded((previous) => !previous)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.historyToggleText}>
                      {bodyHistoryExpanded ? "Show less" : "Show more"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.nutritionTargetsHeaderRow}>
            <Text style={styles.cardTitleNoMargin}>Nutrition targets</Text>
            <TouchableOpacity
              style={styles.energyUnitToggle}
              onPress={() => applyEnergyUnit(energyUnit === "kcal" ? "kJ" : "kcal")}
            >
              <Text style={styles.energyUnitToggleText}>{energyUnit}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            Set daily targets by diet phase. Nutrition decisions will use completed days, not partial
            same-day intake.
          </Text>
          <View style={styles.targetRow}>
            <View style={styles.targetColumn}>
              <Text style={styles.targetLabel}>Cut</Text>
              <TextInput
                placeholder="2200"
                placeholderTextColor="#7a7a8c"
                style={styles.input}
                value={cutCalories}
                onChangeText={setCutCalories}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.targetColumn}>
              <Text style={styles.targetLabel}>Maintain</Text>
              <TextInput
                placeholder="2600"
                placeholderTextColor="#7a7a8c"
                style={styles.input}
                value={maintainCalories}
                onChangeText={setMaintainCalories}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.targetColumn}>
              <Text style={styles.targetLabel}>Bulk</Text>
              <TextInput
                placeholder="2900"
                placeholderTextColor="#7a7a8c"
                style={styles.input}
                value={bulkCalories}
                onChangeText={setBulkCalories}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text style={styles.targetLabel}>Protein target (g/day)</Text>
          <TextInput
            placeholder="160"
            placeholderTextColor="#7a7a8c"
            style={styles.input}
            value={proteinTargetGrams}
            onChangeText={setProteinTargetGrams}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sleep target</Text>
          <TextInput
            placeholder="7.0"
            placeholderTextColor="#7a7a8c"
            style={styles.input}
            value={sleepTargetHours}
            onChangeText={setSleepTargetHours}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health sync</Text>
          <Text style={styles.healthSummaryText}>Sync supported sleep and body composition data.</Text>
          <View style={styles.healthStatusBlock}>
            <View style={styles.healthStatusRow}>
              <Text style={styles.healthStatusLabel}>Status</Text>
              <Text style={styles.healthStatusValue}>{healthConnectionStatus}</Text>
            </View>
            <View style={styles.healthStatusRow}>
              <Text style={styles.healthStatusLabel}>Data</Text>
              <Text style={styles.healthStatusValue}>Sleep, Body composition</Text>
            </View>
              <View style={styles.healthStatusRow}>
                <Text style={styles.healthStatusLabel}>Sleep</Text>
                <Text style={styles.healthStatusValue}>{displayedSleepStatus}</Text>
              </View>
              <View style={styles.healthStatusRow}>
                <Text style={styles.healthStatusLabel}>Body comp</Text>
                <Text style={styles.healthStatusValue}>{displayedBodyStatus}</Text>
              </View>
              <View style={styles.healthStatusRow}>
                <Text style={styles.healthStatusLabel}>Last sleep sync</Text>
                <Text style={styles.healthStatusValue}>{displayedLastSleepSyncLabel}</Text>
              </View>
              <View style={styles.healthStatusRow}>
                <Text style={styles.healthStatusLabel}>Last body sync</Text>
                <Text style={styles.healthStatusValue}>{displayedLastBodySyncLabel}</Text>
              </View>
          </View>
          <Text style={styles.healthCaptionText}>{healthConnectMessage()}</Text>
          <TouchableOpacity
            style={[
              styles.healthPrimaryButton,
              !shouldShowConnectAction && isHealthConnected && styles.connectedButton,
              healthLoading && styles.buttonDisabled,
            ]}
            disabled={healthLoading}
            onPress={shouldShowConnectAction ? handleOpenHealthConsent : handleSyncHealthConnectData}
          >
            <Text
              style={[
                styles.healthPrimaryButtonText,
                !shouldShowConnectAction && isHealthConnected && styles.connectedButtonText,
              ]}
            >
              {healthPrimaryButtonLabel}
            </Text>
          </TouchableOpacity>
          {healthConsentAccepted ? (
            <View style={styles.healthLinkRow}>
              <TouchableOpacity disabled={healthLoading} onPress={handleManageHealthPermissions}>
                <Text style={[styles.healthLinkText, healthLoading && styles.buttonDisabled]}>
                  Health Connect permissions
                </Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={healthLoading} onPress={handleDisconnectHealth}>
                <Text style={[styles.healthLinkText, healthLoading && styles.buttonDisabled]}>
                  Disconnect
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {healthAvailability === "provider_update_required" ? (
            <TouchableOpacity
              style={[styles.secondaryButton, healthLoading && styles.buttonDisabled]}
              disabled={healthLoading}
              onPress={handleOpenPlayStore}
            >
              <Text style={styles.secondaryButtonText}>Open Play Store</Text>
            </TouchableOpacity>
          ) : null}
          {healthFeedback ? <Text style={styles.healthFeedback}>{healthFeedback}</Text> : null}
        </View>

        <Modal
          visible={healthConsentVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setHealthConsentVisible(false)}
        >
          <View style={styles.sheetOverlay}>
            <TouchableWithoutFeedback onPress={() => setHealthConsentVisible(false)}>
              <View style={styles.sheetDismissArea} />
            </TouchableWithoutFeedback>
            <View style={[styles.sheetCard, { paddingBottom: 28 + Math.max(insets.bottom, 8) }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Connect health data</Text>
                <Text style={styles.sheetText}>
                  Lastrep can read supported sleep and body composition data.
                </Text>
                <Text style={styles.sheetText}>
                  This helps show recovery and progress trends.
                </Text>
                <Text style={styles.sheetText}>
                  This is optional, and you can manage or disconnect it later in Profile.
                </Text>
              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.sheetSecondaryButton} onPress={() => setHealthConsentVisible(false)}>
                  <Text style={styles.sheetSecondaryButtonText}>Not now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetPrimaryButton} onPress={handleAcceptHealthConsent}>
                  <Text style={styles.sheetPrimaryButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TouchableOpacity style={styles.save} onPress={save}>
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
        {saveFeedback ? <Text style={styles.saveFeedback}>{saveFeedback}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d1a" },
  loadingText: { color: "#fff", padding: 20 },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  scrollContent: { padding: 20, paddingTop: 20, paddingBottom: 100, gap: 10 },
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
  headerSpacer: {
    width: 22,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  cardTitleNoMargin: { color: "#fff", fontSize: 15, fontWeight: "700" },
  helperText: { color: "#a5acc1", fontSize: 13, lineHeight: 18 },
  nutritionTargetsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  energyUnitToggle: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  energyUnitToggleText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  availabilityValue: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 2 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profilePhotoWrap: {
    position: "relative",
  },
  profilePhoto: {
    width: 104,
    height: 104,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  profilePhotoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  profilePhotoAction: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(22, 22, 37, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  photoActionOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 18, 0.56)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  photoActionSheet: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 22,
    paddingVertical: 10,
    backgroundColor: "#171a2a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  photoActionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  photoActionItemText: {
    color: "#f4f7ff",
    fontSize: 15,
    fontWeight: "700",
  },
  photoActionDeleteText: {
    color: "#ffb4b4",
  },
  multilineInput: {
    minHeight: 88,
  },
  availabilityTicksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  availabilityTickCol: {
    width: 18,
    alignItems: "center",
    gap: 4,
  },
  availabilityTick: {
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: "rgba(216,218,236,0.55)",
  },
  availabilityTickActive: {
    height: 10,
    backgroundColor: "#fff",
  },
  availabilityTickLabel: {
    color: "#d8daec",
    fontSize: 11,
    fontWeight: "700",
  },
  availabilityTickLabelActive: {
    color: "#fff",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetRow: { gap: 10 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  targetColumn: { gap: 8 },
  targetLabel: { color: "#cfcfe6", fontSize: 14, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  chipActive: { backgroundColor: "#fff", borderColor: "#7b61ff" },
  chipText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },
  chipTextActive: { color: "#4a90e2", fontWeight: "700", fontSize: 13.5 },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  healthActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  healthSummaryText: { color: "#d7dcef", fontSize: 13, lineHeight: 18 },
  healthStatusBlock: { gap: 8 },
  healthStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  healthStatusLabel: { color: "#8f96ae", fontSize: 12, fontWeight: "700" },
  healthStatusValue: { color: "#eef1ff", fontSize: 12, lineHeight: 16, flex: 1, textAlign: "right" },
  healthCaptionText: { color: "#a5acc1", fontSize: 12, lineHeight: 16 },
  healthPrimaryButton: {
    borderRadius: 12,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7b61ff",
    paddingHorizontal: 12,
  },
  healthPrimaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  healthLinkRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 18,
  },
  healthLinkText: { color: "#cfd3f8", fontSize: 12, fontWeight: "700" },
  healthActionButton: {
    flex: 1,
  },
  buttonDisabled: { opacity: 0.6 },
  healthFeedback: { color: "#a5acc1", fontSize: 12, lineHeight: 16 },
  healthHint: { color: "#a5acc1", fontSize: 12, lineHeight: 16 },
  connectedButton: {
    borderColor: "#37c26b",
    backgroundColor: "rgba(55,194,107,0.16)",
  },
  connectedButtonText: {
    color: "#c6f5d8",
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 10, 20, 0.62)",
    justifyContent: "flex-end",
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#171a2a",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
    marginBottom: 6,
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  sheetText: {
    color: "#c7cde0",
    fontSize: 14,
    lineHeight: 20,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sheetSecondaryButtonText: {
    color: "#eef1ff",
    fontSize: 14,
    fontWeight: "700",
  },
  sheetPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7b61ff",
  },
  sheetPrimaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  historySection: {
    gap: 10,
    paddingTop: 4,
  },
  historyRow: {
    gap: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  historyRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyRowTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  historyRowMeta: {
    color: "#8f96ae",
    fontSize: 11,
  },
  historyRowValues: {
    color: "#cfcfe6",
    fontSize: 12,
    lineHeight: 18,
  },
  historyToggle: {
    alignSelf: "flex-start",
    paddingTop: 4,
    paddingBottom: 2,
  },
  historyToggleText: {
    color: "#dbe3ff",
    fontSize: 12,
    fontWeight: "700",
  },
  save: { backgroundColor: "#7b61ff", borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 22 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  saveFeedback: { color: "#a6e3a1", textAlign: "center", fontSize: 13, marginTop: 8 },
});

