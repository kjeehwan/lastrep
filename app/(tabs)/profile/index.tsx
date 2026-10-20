import { NotebookProvider, useNotebook } from "../../../src/ui/notebook/Notebook";
import { NotebookHeader } from "../../../src/ui/notebook/NotebookHeader";
import { useNotebookStatusBar } from "../../../src/ui/notebook/useNotebookStatusBar";
import { notebookFonts, type NotebookColors } from "../../../src/ui/notebook/tokens";
import { cancelProfileSection, profileMeasurementChanged, validateProfileEditor, type ProfileEditor } from "../../../src/profile/profileNotebookDraft";
import { ProfileText, ProfileAction, ProfileSection, ProfileRow, ProfileField, ProfileChoices, ProfileSheet } from "../../../src/profile/ProfileNotebookControls";
import { useEntitlement } from "../../../src/hooks/useEntitlement";

import { normalizeMealLabels, reconcileMealLabelDraft, type MealLabels } from "../../../src/nutrition/mealOrganization";
import { resolveEffortScale, type EffortScale } from "../../../src/workouts/effortScale";
import Slider from "@react-native-community/slider";
import { ProfilePhoto } from "../../../src/profile/ProfilePhoto";
import { cloudPhotoPath, profilePhotoReference, snapshotWithPhoto } from "../../../src/profile/profilePhotoReference";
import { stageProfilePhoto, saveProfilePhotoOnly, commitProfilePhoto, discardProfilePhotoUpload } from "../../../src/profile/profilePhotos";
import { profileSaveSections } from "../../../src/profile/profileSaveSections";
import * as ImagePicker from "expo-image-picker";
import { Href, Redirect, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../src/config/firebaseConfig";
import { phaseWeek, saveUserPhases } from "../../../src/profile/phaseState";
import { useNow } from "../../../src/hooks/useNow";
import { useOfflineStatus } from "../../../src/hooks/useOfflineStatus";
import {
  acceptHealthSyncConsent,
  clearHealthSyncConsent,
  hasHealthSyncConsent,
} from "../../../src/health/healthSyncConsent";
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
import { getUserData } from "../../../src/userData";
import { scheduleAfterInteractions } from "../../../src/utils/scheduleAfterInteractions";
import { reconcileSleepTargetDraft } from "../../../src/sleep/sleepTargetDraft";
import { isExpectedOfflineError } from "../../../src/utils/networkErrors";
import { runProfileRefresh, shouldRetryProfileLoad } from "../../../src/profile/profileRefresh";

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


type WeightUnit = "kg" | "lbs";
type HeightUnit = "cm" | "ft/in";
type EnergyUnit = "kcal" | "kJ";
type TdeeSex = "female" | "male";
type TdeeActivity = "sedentary" | "light" | "moderate" | "very-active";
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
  effortScale: EffortScale;
  mealLabels: MealLabels;
  bodyWeight: string;
  bodyFatPercent: string;
  muscleMass: string;
  leanMass: string;
  tdeeAge: string;
  tdeeHeightCm: string;
  tdeeSex: TdeeSex;
  tdeeActivity: TdeeActivity;
};
const KCAL_TO_KJ = 4.184;
const LBS_TO_KG = 0.453592;
const TDEE_ACTIVITY_MULTIPLIERS: Record<TdeeActivity, { label: string; multiplier: number }> = {
  sedentary: { label: "Sedentary", multiplier: 1.2 },
  light: { label: "Light", multiplier: 1.375 },
  moderate: { label: "Moderate", multiplier: 1.55 },
  "very-active": { label: "Very active", multiplier: 1.725 },
};
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
    ? `${Math.round(convertKgToWeightUnit(valueKg, unit) * 100) / 100}`
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
export default function ProfileIndex() { return <NotebookProvider><ProfileContent /></NotebookProvider>; }
function ProfileContent() {
  useNotebookStatusBar();
  const { colors } = useNotebook();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [editor, setEditor] = useState<{ section: ProfileEditor; before: string; focus?: string } | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();

  const { fontScale } = useWindowDimensions();
  const params = useLocalSearchParams<{ from?: string; openHealth?: string }>();
  const returnTo = typeof params.from === "string" && params.from.startsWith("/") ? params.from : null;
  const { isOffline, ready: networkReady } = useOfflineStatus();
  const loadedProfileUidRef = useRef<string | null>(null);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("");
  const [nickname, setNickname] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profilePhotoUri, setProfilePhotoUri] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const savingProfileRef = useRef(false);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [dietPhase, setDietPhase] = useState<DietPhase>("Maintain");
  const [initialTrainingPhase, setInitialTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [initialDietPhase, setInitialDietPhase] = useState<DietPhase>("Maintain");
  const [currentTrainingPhaseStartedAt, setCurrentTrainingPhaseStartedAt] = useState<Timestamp | null>(
    null
  );
  const [currentDietPhaseStartedAt, setCurrentDietPhaseStartedAt] = useState<Timestamp | null>(null);
  const phaseNowMs = useNow();
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
  const [healthConsentLoaded, setHealthConsentLoaded] = useState(false);
  const [healthConsentVisible, setHealthConsentVisible] = useState(false);
  const openedHealthFromRouteRef = useRef<string | null>(null);
  const profileScrollRef = useRef<ScrollView>(null);
  const pendingHealthFeedbackRef = useRef(false);
  const feedbackFrameRef = useRef<number | null>(null);
  const revealHealthFeedback = useCallback(() => {
    if (!pendingHealthFeedbackRef.current) return;
    if (feedbackFrameRef.current !== null) cancelAnimationFrame(feedbackFrameRef.current);
    // Let both the feedback view and the ScrollView's native content size settle.
    feedbackFrameRef.current = requestAnimationFrame(() => {
      feedbackFrameRef.current = requestAnimationFrame(() => {
        feedbackFrameRef.current = null;
        if (!pendingHealthFeedbackRef.current) return;
        pendingHealthFeedbackRef.current = false;
        profileScrollRef.current?.scrollToEnd({ animated: true });
      });
    });
  }, []);
  useEffect(() => {
    pendingHealthFeedbackRef.current = !!healthFeedback;
    revealHealthFeedback();
    return () => {
      if (feedbackFrameRef.current !== null) cancelAnimationFrame(feedbackFrameRef.current);
    };
  }, [healthFeedback, revealHealthFeedback]);
  const healthSyncYRef = useRef(0);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [lastSleepSyncLabel, setLastSleepSyncLabel] = useState<string>("Not synced yet");
  const [savedSleepDataLabel, setSavedSleepDataLabel] = useState<string>("No saved data");
  const [photoActionMenuVisible, setPhotoActionMenuVisible] = useState(false);
  const [bodyHistoryExpanded, setBodyHistoryExpanded] = useState(false);

  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  const [effortScale, setEffortScale] = useState<EffortScale>("rpe");
  const [mealLabels, setMealLabels] = useState<MealLabels>(() => normalizeMealLabels(null));
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [leanMass, setLeanMass] = useState("");
  const [tdeeAge, setTdeeAge] = useState("");
  const [tdeeHeightCm, setTdeeHeightCm] = useState("");
  const [tdeeSex, setTdeeSex] = useState<TdeeSex>("male");
  const [tdeeActivity, setTdeeActivity] = useState<TdeeActivity>("moderate");
  const [appliedTdeeEstimate, setAppliedTdeeEstimate] = useState<number | null>(null);
  const [bodyCompositionProfile, setBodyCompositionProfile] = useState<BodyCompositionProfile | null>(null);
  const [bodyCompositionEffective, setBodyCompositionEffective] = useState<BodyCompositionMetricSnapshot>(
    getEffectiveBodyCompositionSnapshot({
      schemaVersion: 2,
      manual: {
        weightKg: null,
        bodyFatPercent: null,
        leanBodyMassKg: null,
        skeletalMuscleMassKg: null,
        legacyMuscleMassKg: null,
        recordedAt: null,
        source: null,
        originLabel: null,
      },
      synced: {
        weightKg: null,
        bodyFatPercent: null,
        leanBodyMassKg: null,
        skeletalMuscleMassKg: null,
        legacyMuscleMassKg: null,
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
  const initialSnapshotRef = useRef<string | null>(null);
  const latestSnapshotRef = useRef("");
  const skipNextBlurPromptRef = useRef(false);
  const blurPromptOpenRef = useRef(false);
  const profileFocusTaskRef = useRef<{ cancel: () => void } | null>(null);
  const lastProfileHealthRefreshAtRef = useRef(0);
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
        effortScale,
        mealLabels: normalizeMealLabels(mealLabels),
        bodyWeight: bodyWeight.trim(),
        bodyFatPercent: bodyFatPercent.trim(),
        muscleMass: muscleMass.trim(),
        leanMass: leanMass.trim(),
        tdeeAge: tdeeAge.trim(),
        tdeeHeightCm: tdeeHeightCm.trim(),
        tdeeSex,
        tdeeActivity,
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
      effortScale,
      mealLabels,
      bodyWeight,
      bodyFatPercent,
      muscleMass,
      leanMass,
      tdeeAge,
      tdeeHeightCm,
      tdeeSex,
      tdeeActivity,
    ]
  );

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, (snap) => {
      const data = snap.data();
      if (!data) return;
      if (shouldRetryProfileLoad(loadedProfileUidRef.current, uid, initialSnapshotRef.current != null, snap.metadata.fromCache)) {
        setProfileLoadAttempt((attempt) => attempt + 1);
      }
      if (!initialSnapshotRef.current || !latestSnapshotRef.current) return;
      const baseline = JSON.parse(initialSnapshotRef.current) as ProfileSnapshot;
      const local = JSON.parse(latestSnapshotRef.current) as ProfileSnapshot;
      let changed = false;
      const sleepTarget = reconcileSleepTargetDraft(baseline.sleepTargetHours, local.sleepTargetHours, data.sleepSettings?.targetHours);
      if (sleepTarget.baseline !== baseline.sleepTargetHours) {
        setSleepTargetHours(sleepTarget.draft);
        baseline.sleepTargetHours = sleepTarget.baseline;
        changed = true;
      }
      const remoteLabels = normalizeMealLabels(data.mealLabels);
      const reconciled = reconcileMealLabelDraft(baseline.mealLabels, local.mealLabels, remoteLabels);
      if (JSON.stringify(reconciled.baseline) !== JSON.stringify(baseline.mealLabels)) {
        setMealLabels(reconciled.draft);
        baseline.mealLabels = reconciled.baseline;
        changed = true;
      }
      if (isTrainingPhase(data.trainingPhase) && local.trainingPhase === baseline.trainingPhase && data.trainingPhase !== baseline.trainingPhase) {
        setTrainingPhase(data.trainingPhase);
        setInitialTrainingPhase(data.trainingPhase);
        baseline.trainingPhase = data.trainingPhase;
        changed = true;
      }
      if (isDietPhase(data.dietPhase) && local.dietPhase === baseline.dietPhase && data.dietPhase !== baseline.dietPhase) {
        setDietPhase(data.dietPhase);
        setInitialDietPhase(data.dietPhase);
        baseline.dietPhase = data.dietPhase;
        changed = true;
      }
      setCurrentTrainingPhaseStartedAt(data.trainingPhaseStartedAt instanceof Timestamp ? data.trainingPhaseStartedAt : null);
      setCurrentDietPhaseStartedAt(data.dietPhaseStartedAt instanceof Timestamp ? data.dietPhaseStartedAt : null);
      if (changed) {
        const next = JSON.stringify(baseline);
        initialSnapshotRef.current = next;
        setInitialSnapshot(next);
      }
    }, (error) => console.log('Could not refresh phases', error));
  }, [uid]);

  const currentSnapshot = useMemo(() => buildSnapshot(), [buildSnapshot]);
  const hasUnsavedChanges = initialSnapshot != null && currentSnapshot !== initialSnapshot;

  useEffect(() => {
    latestSnapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);

  useEffect(() => {
    initialSnapshotRef.current = initialSnapshot;
  }, [initialSnapshot]);

  const tdeeEstimateKcal = useMemo(() => {
    const displayedWeight = Number(bodyWeight.trim());
    const weightKg = Number.isFinite(displayedWeight) && displayedWeight > 0
      ? convertWeightUnitToKg(displayedWeight, weightUnit)
      : bodyCompositionEffective.weightKg;
    const age = Number(tdeeAge.trim());
    const heightCm = Number(tdeeHeightCm.trim());
    if (
      typeof weightKg !== "number" ||
      !Number.isFinite(weightKg) ||
      !Number.isFinite(age) ||
      !Number.isFinite(heightCm) ||
      age < 13 || age > 100 || heightCm < 100 || heightCm > 250
    ) {
      return null;
    }
    const sexOffset = tdeeSex === "male" ? 5 : -161;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
    return Math.round(bmr * TDEE_ACTIVITY_MULTIPLIERS[tdeeActivity].multiplier);
  }, [bodyCompositionEffective.weightKg, bodyWeight, tdeeActivity, tdeeAge, tdeeHeightCm, tdeeSex, weightUnit]);

  const applyTdeeEstimate = () => {
    if (tdeeEstimateKcal == null) return;
    const display = (value: number) => String(Math.round(convertEnergyValue(value, "kcal", energyUnit)));
    setMaintainCalories(display(tdeeEstimateKcal));
    setCutCalories(display(Math.max(0, tdeeEstimateKcal - 400)));
    setBulkCalories(display(tdeeEstimateKcal + 300));
    setAppliedTdeeEstimate(tdeeEstimateKcal);
    setSaveFeedback("TDEE estimate applied. Review the targets, then save changes.");
  };

  const applyBodyCompositionState = useCallback(
    (profile: BodyCompositionProfile, unit: WeightUnit) => {
      const effective = getEffectiveBodyCompositionSnapshot(profile);
      setBodyCompositionProfile(profile);
      setBodyCompositionEffective(effective);
      setBodyWeight(formatWeightForUnit(effective.weightKg, unit));
      setBodyFatPercent(formatPercent(effective.bodyFatPercent));
      setMuscleMass(formatWeightForUnit(effective.skeletalMuscleMassKg, unit));
      setLeanMass(formatWeightForUnit(effective.leanBodyMassKg, unit));
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
      setEffortScale(resolveEffortScale(parsed.effortScale));
      setMealLabels(normalizeMealLabels(parsed.mealLabels));
      if (typeof parsed.bodyWeight === "string") setBodyWeight(parsed.bodyWeight);
      if (typeof parsed.bodyFatPercent === "string") setBodyFatPercent(parsed.bodyFatPercent);
      if (typeof parsed.muscleMass === "string") setMuscleMass(parsed.muscleMass);
      if (typeof parsed.leanMass === "string") setLeanMass(parsed.leanMass);
      if (typeof parsed.tdeeAge === "string") setTdeeAge(parsed.tdeeAge);
      if (typeof parsed.tdeeHeightCm === "string") setTdeeHeightCm(parsed.tdeeHeightCm);
      if (parsed.tdeeSex === "female" || parsed.tdeeSex === "male") setTdeeSex(parsed.tdeeSex);
      if (parsed.tdeeActivity && parsed.tdeeActivity in TDEE_ACTIVITY_MULTIPLIERS) {
        setTdeeActivity(parsed.tdeeActivity);
      }
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
    async (userId: string, unit: WeightUnit, rebaseIfClean = false) => {
      const shouldRebase =
        rebaseIfClean && initialSnapshotRef.current === latestSnapshotRef.current;
      const profile = await getBodyCompositionProfile(userId);
      if (rebaseIfClean && !shouldRebase) {
        setBodyCompositionProfile(profile);
        setBodyCompositionEffective(getEffectiveBodyCompositionSnapshot(profile));
      } else applyBodyCompositionState(profile, unit);
      if (shouldRebase) {
        scheduleAfterInteractions(() => setInitialSnapshot(latestSnapshotRef.current));
      }
    },
    [applyBodyCompositionState]
  );

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        loadedProfileUidRef.current = null;
        setRedirectTo("/auth/sign-in");
        return;
      }
      // Connectivity retries only an unfinished initial load, never an existing draft.
      if (loadedProfileUidRef.current === user.uid) return;
      initialSnapshotRef.current = null;
      setInitialSnapshot(null);
      setHealthConsentLoaded(false);
      setUid(user.uid);
      if (!networkReady || isOffline) {
        setProfileLoadFailed(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setProfileLoadFailed(false);
      try {
        const [data, sleepProfile, compositionProfile] = await Promise.all([
          getUserData(user.uid),
          getSleepProfile(user.uid),
          getBodyCompositionProfile(user.uid),
        ]);
        if (cancelled || auth.currentUser?.uid !== user.uid) return;
        if (!data) throw new Error("Profile data could not be loaded.");
        setLastSleepSyncLabel(
          sleepProfile.lastSyncedAt
            ? sleepProfile.lastSyncedAt.toDate().toLocaleString()
            : "Not synced yet"
        );
        setSavedSleepDataLabel(
          sleepProfile.sampleRecordedAt
            ? sleepProfile.sampleRecordedAt.toDate().toLocaleString()
            : "No saved data"
        );
        if (data?.goal) setGoal(data.goal);
        if (data?.nickname) setNickname(data.nickname);
        if (typeof data?.description === "string") setProfileDescription(data.description);
        setProfilePhotoUri(profilePhotoReference(data));
        setMealLabels(normalizeMealLabels(data?.mealLabels));
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
        setEffortScale(resolveEffortScale(data?.effortScale));
        if (isHeightUnit(data?.heightUnit)) setHeightUnit(data.heightUnit);
        if (isEnergyUnit(data?.energyUnit)) setEnergyUnit(data.energyUnit);
        if (typeof data?.tdeeProfile?.age === "number" && Number.isFinite(data.tdeeProfile.age)) {
          setTdeeAge(String(Math.round(data.tdeeProfile.age)));
        }
        if (typeof data?.tdeeProfile?.heightCm === "number" && Number.isFinite(data.tdeeProfile.heightCm)) {
          setTdeeHeightCm(String(Math.round(data.tdeeProfile.heightCm * 10) / 10));
        }
        if (data?.tdeeProfile?.sex === "female" || data?.tdeeProfile?.sex === "male") {
          setTdeeSex(data.tdeeProfile.sex);
        }
        const savedTdeeProfile = data?.tdeeProfile;
        if (savedTdeeProfile?.activity in TDEE_ACTIVITY_MULTIPLIERS) {
          setTdeeActivity(savedTdeeProfile.activity as TdeeActivity);
        }
        applyBodyCompositionState(compositionProfile, resolvedWeightUnit);
        loadedProfileUidRef.current = user.uid;
      } catch (e) {
        if (cancelled) return;
        setProfileLoadFailed(true);
        if (!isExpectedOfflineError(e)) console.log("Could not load Profile", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [applyBodyCompositionState, refreshHealthConnectStatus, isOffline, networkReady, profileLoadAttempt]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const accepted = await hasHealthSyncConsent(uid);
        if (!cancelled) {
          setHealthConsentAccepted(accepted);
        }
      } catch (error) {
        console.log("Failed to load health sync consent state", error);
      } finally {
        if (!cancelled) {
          setHealthConsentLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      if (!uid || !networkReady || isOffline) return;
      if (Date.now() - lastProfileHealthRefreshAtRef.current >= 60_000) {
        profileFocusTaskRef.current?.cancel();
        profileFocusTaskRef.current = scheduleAfterInteractions(() => runProfileRefresh(async () => {
          await refreshHealthConnectStatus();
          if (!uid) return;
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
            await refreshBodyComposition(uid, weightUnit, true);
          }
          const sleepProfile = await getSleepProfile(uid);
          setLastSleepSyncLabel(
            sleepProfile.lastSyncedAt
              ? sleepProfile.lastSyncedAt.toDate().toLocaleString()
              : "Not synced yet"
          );
          setSavedSleepDataLabel(
            sleepProfile.sampleRecordedAt
              ? sleepProfile.sampleRecordedAt.toDate().toLocaleString()
              : "No saved data"
          );
          lastProfileHealthRefreshAtRef.current = Date.now();
        }, (error) => console.log("Could not refresh Profile health data", error)));
      }
      return () => profileFocusTaskRef.current?.cancel();
    }, [refreshBodyComposition, refreshHealthConnectStatus, uid, weightUnit, isOffline, networkReady])
  );

  useEffect(() => {
    if (!loading && !profileLoadFailed && initialSnapshot == null) {
      // Wait until all initial profile and auto-sync state updates settle before enabling the leave guard.
      const task = scheduleAfterInteractions(() => setInitialSnapshot(latestSnapshotRef.current));
      return task.cancel;
    }
  }, [loading, profileLoadFailed, initialSnapshot, currentSnapshot]);

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
    if (Platform.OS === "android" && Number(Platform.Version) >= 34) {
      try { await Linking.sendIntent("android.health.connect.action.HEALTH_HOME_SETTINGS"); return; }
      catch { /* Fall back to provider installation/update guidance. */ }
    }
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
        await acceptHealthSyncConsent(uid);
        setHealthConsentAccepted(true);
      } catch (error) {
        console.log("Failed to persist health sync consent", error);
      } finally {
        setHealthConsentVisible(false);
        void handleConnectHealthPermission();
      }
    })();
  };

  useEffect(() => {
    if (
      loading ||
      !healthConsentLoaded ||
      typeof params.openHealth !== "string" ||
      openedHealthFromRouteRef.current === params.openHealth
    ) {
      return;
    }

    openedHealthFromRouteRef.current = params.openHealth;
    const task = scheduleAfterInteractions(() => {
      profileScrollRef.current?.scrollTo({
        y: Math.max(0, healthSyncYRef.current - 12),
        animated: true,
      });
      if (!healthConsentAccepted) {
        setHealthConsentVisible(true);
      }
    });
    return task.cancel;
  }, [healthConsentAccepted, healthConsentLoaded, loading, params.openHealth]);

  const clearHealthConsentAccepted = useCallback(async () => {
    if (!uid) return;
    try {
      await clearHealthSyncConsent(uid);
      setHealthConsentAccepted(false);
      setHealthFeedback("Disconnected on this device. Previously saved records are kept.");
    } catch (error) {
      console.log("Failed to clear health sync consent", error);
      setHealthFeedback("Could not disconnect. Try again; the connection state is unchanged.");
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
        "Stop future health-data reads on this device. Previously saved account records will remain. To revoke device permissions too, use Health Connect permissions separately.",
      buttonLayout: "vertical",
      buttons: [
        {
          text: "Disconnect in Lastrep",
          role: "destructive",
          onPress: () => {
            void clearHealthConsentAccepted();
          },
        },
        { text: "Cancel", role: "cancel" },
      ],
    });
  }, [clearHealthConsentAccepted]);

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
      return `${Math.round(convertKgToWeightUnit(kgValue, nextUnit) * 100) / 100}`;
    };
    setBodyWeight((previous) => convertText(previous));
    setMuscleMass((previous) => convertText(previous));
    setLeanMass((previous) => convertText(previous));
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
    if ((result.assets[0].fileSize ?? 0) > 6 * 1024 * 1024) {
      showAppAlert("Photo too large", "Choose a photo smaller than 6 MB.");
      return;
    }
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
        setHealthFeedback(
          "Permissions are required before syncing sleep or body composition. Use Health Connect permissions to review access, then try again."
        );
        await refreshHealthConnectStatus();
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
        setSavedSleepDataLabel(
          sleepProfile.sampleRecordedAt
            ? sleepProfile.sampleRecordedAt.toDate().toLocaleString()
            : "No saved data"
        );
      }
      if (bodyResult.status === "success") {
        await refreshBodyComposition(uid, weightUnit, true);
      }

      const messages: string[] = [];
      if (sleepResult.status === "success") {
        messages.push("Sleep synced.");
      } else if (sleepResult.status === "no_data") {
        messages.push("No new sleep data found.");
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
    if (!uid || savingProfileRef.current) return false;
    // The connectivity-driven notice owns offline feedback; do not persist it as a save result.
    if (isOffline) return false;
    const validationError = (["body", "nutrition", "sleep", "tdee"] as const).map((section) => validateProfileEditor(section, buildSnapshot(), initialSnapshot ?? undefined)).find(Boolean);
    if (validationError) { showAppAlert("Check your entries", validationError); return false; }
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
      return label === "Body weight" ? parsed : Math.round(parsed * 10) / 10;
    };
    const parsedWeight = parseOptionalBodyMetric(bodyWeight, "Body weight");
    if (Number.isNaN(parsedWeight)) return false;
    const parsedBodyFat = parseOptionalBodyMetric(bodyFatPercent, "Body fat %");
    if (Number.isNaN(parsedBodyFat)) return false;
    const parsedMuscleMass = parseOptionalBodyMetric(muscleMass, "Muscle mass");
    const parsedLeanMass = parseOptionalBodyMetric(leanMass, "Lean body mass");
    if (Number.isNaN(parsedLeanMass)) return false;
    const nextLeanMassKg = parsedLeanMass == null ? null : convertWeightUnitToKg(parsedLeanMass, weightUnit);
    if (Number.isNaN(parsedMuscleMass)) return false;
    const nextWeightKg =
      typeof parsedWeight === "number" ? convertWeightUnitToKg(parsedWeight, weightUnit) : null;
    const nextMuscleMassKg =
      typeof parsedMuscleMass === "number"
        ? convertWeightUnitToKg(parsedMuscleMass, weightUnit)
        : null;
    const parsedTdeeAge = Number(tdeeAge.trim());
    const parsedTdeeHeightCm = Number(tdeeHeightCm.trim());
    if (
      (tdeeAge.trim() || tdeeHeightCm.trim()) &&
      (!Number.isFinite(parsedTdeeAge) || parsedTdeeAge < 13 || parsedTdeeAge > 100 || !Number.isFinite(parsedTdeeHeightCm) || parsedTdeeHeightCm < 100 || parsedTdeeHeightCm > 250)
    ) {
      showAppAlert("Invalid TDEE inputs", "Enter an age between 13 and 100 and a height between 100 and 250 cm.");
      return false;
    }

    let stagedPhotoPath: string | null = null;
    let photoCommitted = false;
    const previousPhoto = initialSnapshot ? (JSON.parse(initialSnapshot) as ProfileSnapshot).profilePhotoUri : "";
    const needsPhotoCommit = !cloudPhotoPath(profilePhotoUri) && (!!profilePhotoUri || previousPhoto !== profilePhotoUri);
    let savedPhotoReference = profilePhotoUri;
    const sectionsToSave = profileSaveSections(buildSnapshot(), initialSnapshot);
    savingProfileRef.current = true;
    setSavingProfile(true);
    try {
      if (needsPhotoCommit && profilePhotoUri) {
        setSaveFeedback("Uploading photo...");
        if (sectionsToSave.photoOnly) {
          savedPhotoReference = await saveProfilePhotoOnly(uid, profilePhotoUri);
          photoCommitted = true;
        } else {
          stagedPhotoPath = await stageProfilePhoto(uid, profilePhotoUri);
        }
      }
      setSaveFeedback("Saving profile...");
      const profilePayload: Record<string, unknown> = {
        goal,
        nickname: nickname.trim(),
        description: profileDescription.trim(),
        weightUnit,
        heightUnit,
        energyUnit,
        effortScale,
        availabilityDays,
        availability: `${availabilityDays}`,
        tdeeProfile:
          tdeeAge.trim() && tdeeHeightCm.trim()
            ? { age: Math.round(parsedTdeeAge), heightCm: Math.round(parsedTdeeHeightCm * 10) / 10, sex: tdeeSex, activity: tdeeActivity }
            : null,
      };
      const phaseChanges = {
        ...(trainingPhase !== initialTrainingPhase ? { trainingPhase } : {}),
        ...(dietPhase !== initialDietPhase ? { dietPhase } : {}),
      };
      const savedPhases = sectionsToSave.profile
        ? await saveUserPhases(uid, phaseChanges, profilePayload)
        : null;
      if (initialSnapshot && JSON.stringify(normalizeMealLabels((JSON.parse(initialSnapshot) as ProfileSnapshot).mealLabels)) !== JSON.stringify(normalizeMealLabels(mealLabels))) {
        // Replace the map, rather than deep-merge names that a reset removed.
        await updateDoc(doc(db, "users", uid), { mealLabels: normalizeMealLabels(mealLabels) });
      }
      if (sectionsToSave.sleep) await setDoc(
        doc(db, "users", uid),
        { sleepSettings: { targetHours: Math.round(parsedSleepTarget * 10) / 10 } },
        { merge: true }
      );
      if (sectionsToSave.nutrition) await saveNutritionProfile(
        uid,
        parsedTargets,
        parsedProteinTarget == null ? null : Math.round(parsedProteinTarget)
      );
      const bodyCompositionUpdates: {
        weightKg?: number | null;
        bodyFatPercent?: number | null;
        skeletalMuscleMassKg?: number | null;
        leanBodyMassKg?: number | null;
      } = {};
      const savedDraft = initialSnapshot ? JSON.parse(initialSnapshot) as ProfileSnapshot : null;
      const hasMetricChanged = (field: "bodyWeight" | "bodyFatPercent" | "muscleMass" | "leanMass", raw: string) =>
        profileMeasurementChanged(raw, savedDraft?.[field], savedDraft?.weightUnit ?? weightUnit, weightUnit, field !== "bodyFatPercent");
      if (
        hasMetricChanged("bodyWeight", bodyWeight)
      ) {
        bodyCompositionUpdates.weightKg = nextWeightKg;
      }
      if (hasMetricChanged("bodyFatPercent", bodyFatPercent)) {
        bodyCompositionUpdates.bodyFatPercent = parsedBodyFat;
      }
      if (hasMetricChanged("muscleMass", muscleMass)) {
        bodyCompositionUpdates.skeletalMuscleMassKg = nextMuscleMassKg;
      }
      if (hasMetricChanged("leanMass", leanMass)) bodyCompositionUpdates.leanBodyMassKg = nextLeanMassKg;
      if (Object.keys(bodyCompositionUpdates).length > 0) {
        await saveManualBodyCompositionEntry(uid, bodyCompositionUpdates);
        await refreshBodyComposition(uid, weightUnit);
      }
      if (needsPhotoCommit && !photoCommitted) {
        setSaveFeedback("Finalizing photo...");
        savedPhotoReference = await commitProfilePhoto(uid, stagedPhotoPath);
        photoCommitted = true;
      }
      if (needsPhotoCommit) setProfilePhotoUri(savedPhotoReference);
      setInitialTrainingPhase(trainingPhase);
      setInitialDietPhase(dietPhase);
      if (savedPhases) {
        setCurrentTrainingPhaseStartedAt(
          savedPhases.trainingPhaseStartedAt instanceof Timestamp ? savedPhases.trainingPhaseStartedAt : null
        );
        setCurrentDietPhaseStartedAt(
          savedPhases.dietPhaseStartedAt instanceof Timestamp ? savedPhases.dietPhaseStartedAt : null
        );
      }
      setSaveFeedback("Changes saved.");
      setInitialSnapshot(snapshotWithPhoto(buildSnapshot(), savedPhotoReference));
      return true;
    } catch (error) {
      if (stagedPhotoPath && !photoCommitted) {
        await discardProfilePhotoUpload(uid, stagedPhotoPath).catch(() => undefined);
      }
      console.log("Failed to save profile", error);
      setSaveFeedback(null);
      showAppAlert("Save failed", "Couldn't finish saving your changes. Your previous photo is kept if the new photo wasn't saved. Check your connection and try again.");
      return false;
    } finally {
      savingProfileRef.current = false;
      setSavingProfile(false);
    }
  }, [
    uid,
    isOffline,
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
    initialSnapshot,
    trainingPhase,
    dietPhase,
    weightUnit,
    effortScale,
    mealLabels,
    heightUnit,
    availabilityDays,
    initialTrainingPhase,
    initialDietPhase,
    bodyWeight,
    bodyFatPercent,
    muscleMass,
    leanMass,
    tdeeAge,
    tdeeHeightCm,
    tdeeSex,
    tdeeActivity,
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
    if (savingProfileRef.current) return;
    if (!hasUnsavedChanges) {
      navigateBack(destination);
      return;
    }
    showAppDialog({
      title: "Unsaved changes",
      message: "You have unsaved changes. Save before leaving?",
      buttonLayout: "vertical",
      buttons: [
        {
          text: "Save and leave",
          role: "default",
          onPress: () => {
            void (async () => {
              const ok = await save();
              if (ok) navigateBack(destination);
            })();
          },
        },
        {
          text: "Discard and leave",
          role: "destructive",
          onPress: () => {
            if (initialSnapshot) {
              restoreFromSnapshot(initialSnapshot);
            }
            navigateBack(destination);
          },
        },
        { text: "Keep editing", role: "cancel" },
      ],
    });
  }, [hasUnsavedChanges, initialSnapshot, navigateBack, restoreFromSnapshot, save]);

  const handleGoBack = () => {
    attemptLeave();
  };

  useEffect(() => {
    setProfileLeaveGuard({
      hasUnsavedChanges,
      isSaving: () => savingProfileRef.current,
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
        if (savingProfileRef.current) {
          event.preventDefault();
          return;
        }
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
      buttonLayout: "vertical",
          buttons: [
            {
              text: "Save and leave",
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
              text: "Discard and leave",
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
              text: "Keep editing",
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
  const latestBodyCompositionLabel = formatBodyCompositionTimestamp(
    bodyCompositionEffective.recordedAt
  );
  const lastBodySyncLabel = bodyCompositionProfile?.lastSyncedAt
    ? bodyCompositionProfile.lastSyncedAt.toDate().toLocaleString()
    : "Not synced yet";
  const showsCurrentSyncDetails = healthConsentAccepted && hasAnyHealthPermission;
  const savedBodyDataLabel =
    latestBodyCompositionLabel === "Not recorded" ? "No saved data" : latestBodyCompositionLabel;
  const sleepSyncRowLabel = showsCurrentSyncDetails ? "Last sleep sync" : "Saved sleep data";
  const bodySyncRowLabel = showsCurrentSyncDetails ? "Last body sync" : "Saved body data";
  const displayedLastSleepSyncLabel = showsCurrentSyncDetails
    ? lastSleepSyncLabel
    : savedSleepDataLabel;
  const displayedLastBodySyncLabel = showsCurrentSyncDetails
    ? lastBodySyncLabel
    : savedBodyDataLabel;
  const healthPrimaryButtonLabel = healthLoading
    ? "Working..."
    : !healthConsentAccepted
      ? "Connect"
      : hasAnyHealthPermission
        ? "Sync now"
        : "Reconnect";
  const latestBodyCompositionSource = formatBodyCompositionSource(
    bodyCompositionEffective.source,
    bodyCompositionEffective.originLabel
  );
  const bodyCompositionHistory = bodyCompositionProfile?.history ?? [];
  const visibleBodyCompositionHistory = bodyHistoryExpanded
    ? bodyCompositionHistory.slice(0, 8)
    : bodyCompositionHistory.slice(0, 3);
  const entitlement = useEntitlement(!!uid, uid);
  const openEditor = (section: ProfileEditor, focus?: string) => {
    setEditorError(null);
    setAppliedTdeeEstimate(null);
    setEditor({ section, focus, before: buildSnapshot() });
  };
  const cancelEditor = () => {
    if (!editor) return;
    restoreFromSnapshot(cancelProfileSection(buildSnapshot(), editor.before, editor.section));
    if (editor.section === "tdee") setSaveFeedback(null);
    setEditor(null); setEditorError(null); setPhotoActionMenuVisible(false);
  };
  const acceptEditor = () => {
    if (!editor) return;
    const error = validateProfileEditor(editor.section, buildSnapshot(), editor.before);
    if (error) { setEditorError(error); return; }
    setEditor(null); setEditorError(null);
  };
  const phaseLabel = (kind: "training" | "diet") => {
    const changed = kind === "training" ? trainingPhase !== initialTrainingPhase : dietPhase !== initialDietPhase;
    const start = kind === "training" ? currentTrainingPhaseStartedAt : currentDietPhaseStartedAt;
    return changed ? "Week 1 on save" : start ? `Week ${phaseWeek(start.toMillis(), phaseNowMs)}` : "Start date not recorded";
  };
  const displayValue = (raw: string, unit: string) => raw.trim() ? `${raw} ${unit}` : "Not recorded";
  const titles: Record<ProfileEditor, string> = { identity: "Profile identity", training: "Training phase", diet: "Diet phase", availability: "Days available", units: "Units and effort", body: "Body composition", tdee: "TDEE calculator", nutrition: "Nutrition targets", sleep: "Sleep target" };
  const metricField = (label: string, value: string, onChangeText: (text: string) => void, unit: string, placeholder: string) => <ProfileField key={label} inline label={label} value={value} onChangeText={onChangeText} unit={unit} placeholder={placeholder} keyboardType="decimal-pad" autoFocus={editor?.focus === label} />;
  const healthRows = [
    ["Status", healthConnectionStatus], ["Supported data", "Sleep, Body composition"],
    ["Sleep", displayedSleepStatus], ["Body composition", displayedBodyStatus],
    [sleepSyncRowLabel, displayedLastSleepSyncLabel], [bodySyncRowLabel, displayedLastBodySyncLabel],
  ];
  if (redirectTo) return <Redirect href={redirectTo} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "left", "right"]}>
    <NotebookHeader title="Profile" onBack={() => { if (!savingProfile) handleGoBack(); }} action={savingProfile ? "Saving..." : "Save"} onAction={() => void save()} disabled={loading || savingProfile || !hasUnsavedChanges || initialSnapshot == null} />
    {loading ? <ProfileText>Loading profile...</ProfileText> : profileLoadFailed ? <View style={{ padding: 20, gap: 12 }}><ProfileText muted>Your saved profile has not loaded. Reconnect to load it; no changes have been saved.</ProfileText><ProfileAction label="Retry" disabled={isOffline || !networkReady} onPress={() => setProfileLoadAttempt((attempt) => attempt + 1)} /></View> : <ScrollView ref={profileScrollRef} onContentSizeChange={revealHealthFeedback} pointerEvents={savingProfile ? "none" : "auto"} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 56, gap: 28, width: "100%", maxWidth: 800, alignSelf: "center" }}>
      {isOffline ? <Text accessibilityLiveRegion="polite" style={styles.helperText}>Offline. Your edits stay here; reconnect before saving.</Text> : saveFeedback ? <Text accessibilityLiveRegion="polite" style={styles.helperText}>{saveFeedback}</Text> : null}
      <ProfileSection first title="Identity" action={<ProfileAction label="Edit" onPress={() => openEditor("identity")} />}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
          <ProfilePhoto fallbackBackgroundColor={colors.subtle} fallbackTextColor={colors.ink} fallbackFontFamily={notebookFonts.semibold} uid={uid} reference={profilePhotoUri} initial={nickname.trim().charAt(0).toUpperCase() || "L"} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.subtle }} contentFit="cover" />
          <View style={{ flex: 1, gap: 8 }}><Text style={{ fontFamily: notebookFonts.editorial, fontSize: 28, color: colors.ink }}>{nickname.trim() || "Your profile"}</Text><Text style={{ fontFamily: notebookFonts.semibold, fontSize: 13, color: colors.ink, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>{entitlement.state === "loading" ? "Checking access" : entitlement.isSubscribed ? "Premium" : "Free"}</Text>{profileDescription ? <ProfileText muted>{profileDescription}</ProfileText> : null}</View>
        </View>
      </ProfileSection>
      <ProfileSection title="Training">
        <ProfileRow wideValue label="Training phase" value={`${trainingPhase} / ${phaseLabel("training")}`} onPress={() => openEditor("training")} />
        <ProfileRow wideValue label="Diet phase" value={`${dietPhase} / ${phaseLabel("diet")}`} onPress={() => openEditor("diet")} />
        <ProfileRow label="Availability" value={`${availabilityDays} days / week`} onPress={() => openEditor("availability")} />
      </ProfileSection>
      <ProfileSection title="Units">
        <ProfileRow label="Exercise effort" value={effortScale.toUpperCase()} onPress={() => openEditor("units")} />
        <ProfileRow label="Weight" value={weightUnit} onPress={() => openEditor("units")} />
        <ProfileRow label="Height" value={heightUnit} onPress={() => openEditor("units")} />
        <ProfileRow label="Food energy" value={energyUnit} onPress={() => openEditor("units")} />
      </ProfileSection>
      <ProfileSection title="Body composition">
        <ProfileRow label="Weight" value={displayValue(bodyWeight, weightUnit)} onPress={() => openEditor("body", "Weight")} />
        <ProfileRow label="Body fat" value={displayValue(bodyFatPercent, "%")} onPress={() => openEditor("body", "Body fat")} />
        <ProfileRow label="Lean body mass" value={displayValue(leanMass, weightUnit)} onPress={() => openEditor("body", "Lean body mass")} help={() => setHelp("Lean body mass is your body weight excluding fat. It includes muscle, organs, bones and water; it is not skeletal muscle mass.")} />
        <ProfileRow label="Skeletal muscle" value={displayValue(muscleMass, weightUnit)} onPress={() => openEditor("body", "Skeletal muscle")} help={() => setHelp("Skeletal muscle mass is the mass of muscles that move your skeleton. It is only part of lean body mass and must not be inferred from a lean-mass reading.")} />
        <ProfileText muted>{latestBodyCompositionSource} / {latestBodyCompositionLabel}</ProfileText>
        {typeof bodyCompositionEffective.legacyMuscleMassKg === "number" ? <ProfileText muted>Older muscle value: {formatWeightForUnit(bodyCompositionEffective.legacyMuscleMassKg, weightUnit)} {weightUnit}. Type unverified; not used as lean or skeletal muscle.</ProfileText> : null}
        <ProfileAction label="View body history" onPress={() => setHistoryVisible(true)} />
      </ProfileSection>
      <ProfileSection title="TDEE calculator">
        <ProfileText muted>{tdeeEstimateKcal == null ? "Estimate maintenance calories using your weight, height, age and activity." : `Estimated maintenance / ${Math.round(convertEnergyValue(tdeeEstimateKcal, "kcal", energyUnit))} ${energyUnit} per day`}</ProfileText>
        <ProfileAction label="Calculate" onPress={() => openEditor("tdee")} />
      </ProfileSection>
      <ProfileSection title="Nutrition targets">
        <ProfileRow label="Cut" value={displayValue(cutCalories, energyUnit)} onPress={() => openEditor("nutrition")} />
        <ProfileRow label="Maintain" value={displayValue(maintainCalories, energyUnit)} onPress={() => openEditor("nutrition")} />
        <ProfileRow label="Bulk" value={displayValue(bulkCalories, energyUnit)} onPress={() => openEditor("nutrition")} />
        <ProfileRow label="Protein" value={displayValue(proteinTargetGrams, "g / day")} onPress={() => openEditor("nutrition")} />
      </ProfileSection>
      <ProfileSection title="Sleep target"><ProfileRow label="Daily target" value={`${sleepTargetHours} hours`} onPress={() => openEditor("sleep")} /></ProfileSection>
      <View onLayout={(event) => { healthSyncYRef.current = event.nativeEvent.layout.y; }}>
        <ProfileSection title="Health sync">
          {healthRows.map(([label, value]) => <View key={label} style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", gap: 8, paddingVertical: 6 }}><View style={{ flex: 1 }}><ProfileText>{label}</ProfileText></View><View style={{ flex: 1.4 }}><ProfileText muted>{value}</ProfileText></View></View>)}
          <ProfileText muted>{healthConnectMessage()}</ProfileText>
          <ProfileAction label={healthPrimaryButtonLabel} primary disabled={healthLoading} onPress={shouldShowConnectAction ? handleOpenHealthConsent : handleSyncHealthConnectData} />
          {healthConsentAccepted ? <><ProfileAction label="Health Connect permissions" disabled={healthLoading} onPress={handleManageHealthPermissions} /><ProfileAction label="Disconnect" disabled={healthLoading} onPress={handleDisconnectHealth} /></> : null}
          {healthAvailability === "provider_update_required" || healthAvailability === "unavailable" ? <ProfileAction label="Set up Health Connect" disabled={healthLoading} onPress={handleOpenPlayStore} /> : null}
          {healthFeedback ? <View accessibilityLiveRegion="polite" onLayout={revealHealthFeedback}><ProfileText muted>{healthFeedback}</ProfileText></View> : null}
        </ProfileSection>
      </View>
    </ScrollView>}
    {editor ? <ProfileSheet title={titles[editor.section]} onClose={cancelEditor} footer={<><ProfileAction label="Done" primary onPress={acceptEditor} /><ProfileAction label="Cancel" onPress={cancelEditor} /></>}>
      <ProfileText muted>Changes are staged until you tap Save on Profile.</ProfileText>
      {editor.section === "identity" ? <>
        <View style={{ alignItems: "center", gap: 8 }}><ProfilePhoto fallbackBackgroundColor={colors.subtle} fallbackTextColor={colors.ink} fallbackFontFamily={notebookFonts.semibold} uid={uid} reference={profilePhotoUri} initial={nickname.trim().charAt(0).toUpperCase() || "L"} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.subtle }} contentFit="cover" /><ProfileAction label={profilePhotoUri ? "Change photo" : "Add photo"} onPress={() => setPhotoActionMenuVisible(true)} /></View>
        <ProfileField label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Your nickname" />
        <ProfileField label="Description" value={profileDescription} onChangeText={setProfileDescription} placeholder="A few words about you" multiline maxLength={160} />
      </> : null}
      {editor.section === "training" ? <><ProfileChoices label="Training phase" values={TRAINING_PHASES} selected={trainingPhase} onChange={setTrainingPhase} /><ProfileText muted>{phaseLabel("training")}</ProfileText><ProfileText muted>A different phase starts when you save Profile.</ProfileText></> : null}
      {editor.section === "diet" ? <><ProfileChoices label="Diet phase" values={DIET_PHASES} selected={dietPhase} onChange={setDietPhase} /><ProfileText muted>{phaseLabel("diet")}</ProfileText><ProfileText muted>A different phase starts when you save Profile.</ProfileText></> : null}
      {editor.section === "availability" ? <><ProfileText>{availabilityDays} days / week</ProfileText><Slider accessibilityLabel="Days available per week" accessibilityValue={{ min: 1, max: 7, now: availabilityDays }} value={availabilityDays} minimumValue={1} maximumValue={7} step={1} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.rule} thumbTintColor={colors.ink} onValueChange={(value: number) => setAvailabilityDays(Math.round(value))} /></> : null}
      {editor.section === "units" ? <>
        <ProfileChoices equalCells label="Exercise effort" values={["RPE", "RIR"]} selected={effortScale.toUpperCase()} onChange={(value) => setEffortScale(value.toLowerCase() as EffortScale)} />
        <ProfileText muted>Applies to all resistance exercises. RPE 8 is approximately 2 RIR. Your recorded history is unchanged.</ProfileText>
        <ProfileChoices equalCells label="Weight" values={["kg", "lbs"] as WeightUnit[]} selected={weightUnit} onChange={applyWeightUnit} />
        <ProfileChoices equalCells label="Height" values={["cm", "ft/in"] as HeightUnit[]} selected={heightUnit} onChange={setHeightUnit} />
        <ProfileChoices equalCells label="Food energy" values={["kcal", "kJ"] as EnergyUnit[]} selected={energyUnit} onChange={applyEnergyUnit} />
      </> : null}
      {editor.section === "body" ? <>
        {metricField("Weight", bodyWeight, setBodyWeight, weightUnit, weightUnit === "kg" ? "e.g. 80.15" : "e.g. 176.7")}
        {metricField("Body fat", bodyFatPercent, setBodyFatPercent, "%", "e.g. 15.0")}
        {metricField("Lean body mass", leanMass, setLeanMass, weightUnit, weightUnit === "kg" ? "e.g. 65.0" : "e.g. 143.3")}
        {metricField("Skeletal muscle", muscleMass, setMuscleMass, weightUnit, weightUnit === "kg" ? "e.g. 35.0" : "e.g. 77.2")}
      </> : null}
      {editor.section === "tdee" ? <>
        <ProfileField label="Age" value={tdeeAge} onChangeText={setTdeeAge} placeholder="e.g. 30" keyboardType="number-pad" />
        <ProfileField label="Height" value={tdeeHeightCm} onChangeText={setTdeeHeightCm} placeholder="e.g. 175" unit="cm" keyboardType="decimal-pad" />
        <ProfileText muted>Uses your latest weight from Body composition. Height here is entered in cm.</ProfileText>
        <ProfileChoices label="Sex used for calculation" values={["female", "male"] as TdeeSex[]} selected={tdeeSex} onChange={setTdeeSex} />
        <View style={{ gap: 8 }}><ProfileText>Activity</ProfileText>{(Object.keys(TDEE_ACTIVITY_MULTIPLIERS) as TdeeActivity[]).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === tdeeActivity }} onPress={() => setTdeeActivity(value)} style={{ padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 6, borderColor: value === tdeeActivity ? colors.primary : colors.border, backgroundColor: value === tdeeActivity ? colors.primary : colors.surface }}><Text style={{ color: value === tdeeActivity ? colors.onPrimary : colors.ink, fontFamily: notebookFonts.body, fontSize: 16 }}>{TDEE_ACTIVITY_MULTIPLIERS[value].label}</Text></Pressable>)}</View>
        <ProfileText>{tdeeEstimateKcal == null ? "Enter valid age, height and weight to calculate." : `Estimated maintenance: ${Math.round(convertEnergyValue(tdeeEstimateKcal, "kcal", energyUnit))} ${energyUnit} / day`}</ProfileText>
        <ProfileAction label={appliedTdeeEstimate != null && appliedTdeeEstimate === tdeeEstimateKcal ? "Targets applied to draft" : "Use for nutrition targets"} primary disabled={tdeeEstimateKcal == null} onPress={() => { applyTdeeEstimate(); }} />
        {appliedTdeeEstimate != null ? <Text accessibilityLiveRegion="polite" style={styles.helperText}>{appliedTdeeEstimate === tdeeEstimateKcal
          ? `Draft nutrition targets updated: Cut ${cutCalories}, Maintain ${maintainCalories}, Bulk ${bulkCalories} ${energyUnit} / day. Tap Done, then Save on Profile to keep these changes.`
          : "Estimate changed. Tap Use for nutrition targets again to update your draft targets."}</Text> : null}
      </> : null}
      {editor.section === "nutrition" ? <>
        {metricField("Cut", cutCalories, setCutCalories, energyUnit, "e.g. 2200")}
        {metricField("Maintain", maintainCalories, setMaintainCalories, energyUnit, "e.g. 2600")}
        {metricField("Bulk", bulkCalories, setBulkCalories, energyUnit, "e.g. 2900")}
        {metricField("Protein", proteinTargetGrams, setProteinTargetGrams, "g / day", "e.g. 160")}
      </> : null}
      {editor.section === "sleep" ? <ProfileField label="Daily sleep target" unit="hours" value={sleepTargetHours} onChangeText={setSleepTargetHours} keyboardType="decimal-pad" placeholder="e.g. 7.5" /> : null}
      {editorError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 16, fontFamily: notebookFonts.body }}>{editorError}</Text> : null}
    </ProfileSheet> : null}
    {photoActionMenuVisible ? <ProfileSheet title="Profile photo" onClose={() => setPhotoActionMenuVisible(false)} footer={<ProfileAction label="Cancel" onPress={() => setPhotoActionMenuVisible(false)} />}><ProfileAction label={profilePhotoUri ? "Choose another photo" : "Choose photo"} onPress={handlePickProfilePhoto} />{profilePhotoUri ? <ProfileAction label="Remove photo" onPress={handleRemoveProfilePhoto} /> : null}</ProfileSheet> : null}
    {help ? <ProfileSheet title="Body composition" onClose={() => setHelp(null)} footer={<ProfileAction label="Close" onPress={() => setHelp(null)} />}><ProfileText>{help}</ProfileText></ProfileSheet> : null}
    {historyVisible ? <ProfileSheet title="Body composition history" onClose={() => setHistoryVisible(false)} footer={<ProfileAction label="Close" onPress={() => setHistoryVisible(false)} />}>
      {visibleBodyCompositionHistory.length ? visibleBodyCompositionHistory.map((entry, index) => <View key={`${entry.source}-${entry.recordedAt?.toMillis() ?? index}-${index}`} style={{ gap: 8, paddingVertical: 12, borderBottomWidth: index < visibleBodyCompositionHistory.length - 1 ? 1 : 0, borderBottomColor: colors.rule }}><ProfileText>{formatBodyCompositionTimestamp(entry.recordedAt)}</ProfileText><ProfileText muted>{formatBodyCompositionSource(entry.source, entry.originLabel)}</ProfileText><ProfileText>{`Weight ${formatWeightForUnit(entry.weightKg, weightUnit) || "-"} ${weightUnit} / Body fat ${formatPercent(entry.bodyFatPercent) || "-"}%`}</ProfileText><ProfileText>{`Lean mass ${formatWeightForUnit(entry.leanBodyMassKg, weightUnit) || "-"} ${weightUnit} / Skeletal muscle ${formatWeightForUnit(entry.skeletalMuscleMassKg, weightUnit) || "-"} ${weightUnit}`}</ProfileText></View>) : <ProfileText muted>No body composition records yet.</ProfileText>}
      {bodyCompositionHistory.length > 3 ? <ProfileAction label={bodyHistoryExpanded ? "Show less" : "Show more"} onPress={() => setBodyHistoryExpanded((value) => !value)} /> : null}
    </ProfileSheet> : null}
    {healthConsentVisible ? <ProfileSheet title="Connect health data" onClose={() => setHealthConsentVisible(false)} footer={<><ProfileAction label="Continue" primary onPress={handleAcceptHealthConsent} /><ProfileAction label="Not now" onPress={() => setHealthConsentVisible(false)} /></>}>
      <ProfileText>On supported Android devices, Lastrep can read sleep, weight, body-fat and lean-body-mass records that you permit.</ProfileText>
      <ProfileText>We use them for recovery, sleep and body-composition trends. Relevant summaries may also support AI-assisted training recommendations.</ProfileText>
      <ProfileText>Imported summaries are stored in your Lastrep account. Before the first AI-assisted plan, Lastrep separately explains what is sent to OpenAI and asks you to continue.</ProfileText>
      <ProfileText>This is optional. You can disconnect in Profile or revoke access in your connected health service at any time.</ProfileText>
    </ProfileSheet> : null}
  </SafeAreaView>;
}
const makeStyles = (colors: NotebookColors) => StyleSheet.create({ helperText: { color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16 } });
