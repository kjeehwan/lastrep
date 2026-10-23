import { NotebookTextInput } from "../../../src/ui/notebook/NotebookTextInput";
import { NotebookHeader } from "@/src/ui/notebook/NotebookHeader";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react-native";
import { IntakeBar, MacroComposition, DiaryCalendar } from "@/src/nutrition/components/NotebookNutrition";
import { adjacentDiaryDate, foodNamesBySection } from "@/src/nutrition/notebookPresentation";
import { notebookSheet, useNotebookStyles } from "@/src/ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "@/src/ui/notebook/tokens";
import { NotebookModal as Modal } from "@/src/ui/notebook/NotebookModal";
import { nutritionPalette, useNutritionColors } from "@/src/nutrition/notebookPalette";
import { AdaptiveModalCard } from "../../../src/ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../../src/ui/KeyboardAwareModalFrame";
import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "@/src/config/firebaseConfig";
import type { NutritionMeal } from "@/src/contracts";
import {
  computeNutritionTotals,
  DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE,
  formatDateKey,
  getCalorieTargetForDietPhase,
  getNutritionTrendReport,
  getRecentMeals,
  groupMealsByLocalDay,
  parseDateKey,
  saveNutritionProfile,
  subscribeToMealsForDate,
} from "@/src/nutrition/meals";
import type { NutritionTrendReport } from "@/src/nutrition/mealHelpers";
import {
  ChartEmptyState,
  type ChartPoint,
} from "@/src/components/charts/TrendCharts";
import type { DietPhase } from "@/src/types/decision";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";
import { nutritionProfileContext } from "@/src/nutrition/profileContext";
import { scheduleAfterInteractions } from "@/src/utils/scheduleAfterInteractions";
import { useMealLabels } from "@/src/nutrition/useMealLabels";
import { DEFAULT_MEAL_IDS, formatMealTime, mealLabel, mealSectionId, sectionMealTime } from "@/src/nutrition/mealOrganization";
import { MealOrganizationEditor } from "@/src/nutrition/components/MealOrganizationControls";
import { showAppDialog } from "@/src/ui/appDialog";

const DEFAULT_SECTIONS = DEFAULT_MEAL_IDS;
const RECOMMENDED_MACRO_RATIO = { protein: 0.3, carbs: 0.45, fats: 0.25 };
type EnergyUnit = "kcal" | "kJ";
const KCAL_TO_KJ = 4.184;
const toEnergyUnit = (valueKcal: number, unit: EnergyUnit): number =>
  unit === "kJ" ? valueKcal * KCAL_TO_KJ : valueKcal;

type TimelineBarItemProps = {
  point: ChartPoint;
  selected: boolean;
  timelineBarCellWidth: number;
  timelinePlotHeight: number;
  timelineScaleMax: number;
  onPressDate: (dateKey: string) => void;
};

const TimelineBarItem = React.memo(function TimelineBarItem({
  point,
  selected,
  timelineBarCellWidth,
  timelinePlotHeight,
  timelineScaleMax,
  onPressDate,
}: TimelineBarItemProps) {
  const colors = useNutritionColors();
  const styles = useNotebookStyles(createStyles);

  const height = Math.max(
    8,
    Math.min(timelinePlotHeight, (point.value / timelineScaleMax) * timelinePlotHeight)
  );

  return (
    <TouchableOpacity
      style={[styles.timelineBarCell, { width: timelineBarCellWidth }]}
      onPress={() => onPressDate(point.key)}
    >
      <View
        style={[
          styles.timelineBar,
          {
            height,
            width: Math.max(20, Math.min(28, timelineBarCellWidth - 12)),
            backgroundColor: selected ? colors.accent : colors.accentSoft,
          },
        ]}
      />
      <Text style={[styles.timelineLabel, selected && styles.timelineLabelSelected]}>{point.label}</Text>
    </TouchableOpacity>
  );
});

export default function NutritionIndex() {
  const colors = useNutritionColors();
  const styles = useNotebookStyles(createStyles);

  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;
  const params = useLocalSearchParams<{ date?: string; focusMeals?: string }>();
  const [uid, setUid] = useState<string | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [mealEditor, setMealEditor] = useState<{ section: string; mode: "menu" | "time" } | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [meals, setMeals] = useState<NutritionMeal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [expandedMeals, setExpandedMeals] = useState<{ scope: string; sections: string[] }>({ scope: "", sections: [] });

  const [currentDietPhase, setCurrentDietPhase] = useState<DietPhase>("Maintain");
  const [calorieTargets, setCalorieTargets] = useState(DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE);
  const [proteinTargetGrams, setProteinTargetGrams] = useState<number | null>(null);
  const [mealSectionsOrder, setMealSectionsOrder] = useState<string[]>(DEFAULT_SECTIONS);
  const [addMealVisible, setAddMealVisible] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [trendReport, setTrendReport] = useState<NutritionTrendReport | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const mealSnapshots = React.useRef(new Map<string, string>());
  const [historyRevision, setHistoryRevision] = useState(0);
  const [timelinePoints, setTimelinePoints] = useState<ChartPoint[]>([]);
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  const timelineScrollRef = React.useRef<FlatList<ChartPoint> | null>(null);
  const pageScrollRef = React.useRef<ScrollView | null>(null);
  const logMealsYRef = React.useRef(0);
  const handledMealFocusRef = React.useRef<string | null>(null);
  const [timelineShouldSnapToLatest, setTimelineShouldSnapToLatest] = useState(true);
  const [timelineWindowStart, setTimelineWindowStart] = useState(0);
  const [timelineViewportWidthMeasured, setTimelineViewportWidthMeasured] = useState<number>(0);
  const [dateSelection, setDateSelection] = useState<{ source: string | undefined; date: string } | null>(null);
  const selectedDateKey = useMemo(() => {
    if (dateSelection && dateSelection.source === params.date) return dateSelection.date;
    const fromParams = typeof params.date === "string" ? params.date : "";
    return parseDateKey(fromParams) ? fromParams : formatDateKey(new Date());
  }, [params.date, dateSelection]);
  const { labels } = useMealLabels(uid, selectedDateKey);

  useEffect(() => {
    if (
      typeof params.focusMeals !== "string" ||
      handledMealFocusRef.current === params.focusMeals
    ) {
      return;
    }
    handledMealFocusRef.current = params.focusMeals;
    const task = scheduleAfterInteractions(() => {
      pageScrollRef.current?.scrollTo({
        y: Math.max(0, logMealsYRef.current - 8),
        animated: true,
      });
    });
    return task.cancel;
  }, [params.focusMeals]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setRedirectTo("/auth/sign-in");
        setMeals([]);
        setLoadingMeals(false);
        return;
      }
      setUid(user.uid);
      setRedirectTo(null);
    });
    return unsubscribe;
  }, []);

  const calorieTarget = useMemo(
    () => getCalorieTargetForDietPhase(calorieTargets, currentDietPhase),
    [calorieTargets, currentDietPhase]
  );

  const fetchHistoryData = useCallback(async () => {
    if (!uid) return;
    setLoadingTrends(true);
    try {
      const report = await getNutritionTrendReport(uid, calorieTarget);
      setTrendReport(report);
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load trends", error);
      }
    } finally {
      setLoadingTrends(false);
    }
  }, [uid, calorieTarget]);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const loadingTimer = setTimeout(() => {
      if (active) {
        setLoadingMeals(true);
      }
    }, 0);
    const targetDate = parseDateKey(selectedDateKey) ?? new Date();
    const unsubscribe = subscribeToMealsForDate(
      uid,
      targetDate,
      (nextMeals) => {
        setMeals(nextMeals);
        setLoadingMeals(false);
        const key = uid + ":" + selectedDateKey;
        const signature = JSON.stringify(nextMeals);
        const previous = mealSnapshots.current.get(key);
        mealSnapshots.current.set(key, signature);
        if (previous !== undefined && previous !== signature) {
          void fetchHistoryData();
          setHistoryRevision((revision) => revision + 1);
        }
      },
      (error) => {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to load meals", error);
        }
        setLoadingMeals(false);
      }
    );
    return () => {
      active = false;
      clearTimeout(loadingTimer);
      unsubscribe();
    };
  }, [uid, selectedDateKey, fetchHistoryData]);

  useEffect(() => { const task = scheduleAfterInteractions(() => { void fetchHistoryData(); }); return task.cancel; }, [fetchHistoryData]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const recentMeals = await getRecentMeals(uid, 60);
        if (cancelled) return;
        const grouped = groupMealsByLocalDay(recentMeals);
        const byDate = new Map(grouped.map((entry) => [entry.dateKey, entry]));
        const points: ChartPoint[] = [];
        for (let offset = 59; offset >= 0; offset -= 1) {
          const d = new Date();
          d.setDate(d.getDate() - offset);
          const key = formatDateKey(d);
          const calories = byDate.get(key)?.calories ?? 0;
          points.push({
            key,
            label: key.slice(5).replace("-", "/"),
            value: Math.round(toEnergyUnit(calories, energyUnit)),
          });
        }
        setTimelinePoints(points);
      } catch (error) {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to load timeline", error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, energyUnit, historyRevision]);

  useFocusEffect(useCallback(() => {
    setTimelineShouldSnapToLatest(true);
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/home");
      return true;
    });
    return () => subscription.remove();
  }, [router]));

  useEffect(() => {
    if (!uid) return;
    let previousSignature: string | null = null;
    return onSnapshot(doc(db, "users", uid), (snapshot) => {
      const context = nutritionProfileContext(snapshot.data());
      const signature = JSON.stringify(context);
      if (signature === previousSignature) return;
      previousSignature = signature;
      setCalorieTargets(context.calorieTargets);
      setProteinTargetGrams(context.proteinTargetGrams);
      setMealSectionsOrder(context.mealSections?.length ? context.mealSections : DEFAULT_SECTIONS);
      setCurrentDietPhase(context.dietPhase);
      setEnergyUnit(context.energyUnit);
    }, (error) => {
      if (!isExpectedOfflineError(error)) console.log("Failed to load nutrition profile context", error);
    });
  }, [uid]);

  const totals = useMemo(() => computeNutritionTotals(meals), [meals]);
  const mealFoodNames = useMemo(() => foodNamesBySection(meals), [meals]);
  const sections = useMemo(() => {
    const fromMeals = new Set<string>();
    for (const meal of meals) {
      const section = meal.mealSection?.trim();
      if (!section) continue;
      fromMeals.add(section);
    }
    const ordered = [...mealSectionsOrder];
    for (const s of fromMeals) {
      if (!ordered.includes(s)) ordered.push(s);
    }
    return ordered;
  }, [meals, mealSectionsOrder]);

  const sectionStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        count: number;
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
        carbsKnownCount: number;
        fatsKnownCount: number;
      }
    >();
    for (const section of sections) {
      stats.set(section, {
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        carbsKnownCount: 0,
        fatsKnownCount: 0,
      });
    }
    for (const meal of meals) {
      const key = meal.mealSection?.trim() || DEFAULT_SECTIONS[0];
      if (!stats.has(key)) {
        stats.set(key, {
          count: 0,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          carbsKnownCount: 0,
          fatsKnownCount: 0,
        });
      }
      const row = stats.get(key)!;
      row.count += 1;
      row.calories += meal.calories;
      row.protein += meal.proteinGrams ?? 0;
      if (meal.carbGrams != null) {
        row.carbs += meal.carbGrams;
        row.carbsKnownCount += 1;
      }
      if (meal.fatGrams != null) {
        row.fats += meal.fatGrams;
        row.fatsKnownCount += 1;
      }
    }
    return stats;
  }, [meals, sections]);

  const persistMealSections = useCallback(
    async (nextSections: string[]) => {
      if (!uid) return;
      try {
        await saveNutritionProfile(uid, calorieTargets, proteinTargetGrams, nextSections);
        setMealSectionsOrder(nextSections);
      } catch (error) {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to save meal sections", error);
        }
        showAppDialog({ title: "Could not save meal sections", message: "Please try again." });
      }
    },
    [uid, calorieTargets, proteinTargetGrams]
  );

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    void persistMealSections(next);
  };

  const handleAddMealSection = () => {
    const name = newMealName.trim();
    if (!name || name.length > 24) return;
    if (sections.includes(name) || sections.some((id) => mealLabel(id, labels).toLowerCase() === name.toLowerCase())) {
      showAppDialog({ title: "Meal already exists", message: "Choose a different meal name." });
      return;
    }
    const next = [...sections, name];
    setAddMealVisible(false);
    setNewMealName("");
    void persistMealSections(next);
  };

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const getAdherenceColor = (status: string | null, dateKey?: string) => {
    if (dateKey === todayKey && status === "below_target") return colors.accent;
    switch (status) {
      case "on_target":
        return colors.success;
      case "below_target":
        return colors.warning;
      case "above_target":
        return colors.danger;
      default:
        return colors.muted;
    }
  };

  const getAdherenceLabel = (status: string | null, dateKey?: string) => {
    if (dateKey === todayKey && status === "below_target") return "Tracking...";
    switch (status) {
      case "on_target":
        return "On target";
      case "below_target":
        return "Below target";
      case "above_target":
        return "Above target";
      default:
        return "Not enough data";
    }
  };

  const handleOpenSection = (section: string) => {
    router.push({ pathname: "/nutrition/meal/[section]", params: { section, date: selectedDateKey } });
  };

  const handleGoBack = () => {
    router.replace("/home");
  };

  const calorieConsumed = totals.calories;
  const calorieTargetRaw = calorieTarget ?? 0;
  const calorieTargetSafe = Math.round(toEnergyUnit(calorieTargetRaw, energyUnit));
  const proteinConsumed = totals.proteinGrams;

  const recommendedProteinKcal = calorieTargetRaw > 0
    ? Math.min(
        calorieTargetRaw,
        proteinTargetGrams != null && proteinTargetGrams > 0
          ? proteinTargetGrams * 4
          : calorieTargetRaw * RECOMMENDED_MACRO_RATIO.protein
      )
    : 0;
  const remainingRecommendedMacroKcal = Math.max(0, calorieTargetRaw - recommendedProteinKcal);
  const carbFatRatioTotal = RECOMMENDED_MACRO_RATIO.carbs + RECOMMENDED_MACRO_RATIO.fats;
  const recommendedMacroKcal = calorieTargetRaw > 0
    ? {
        protein: recommendedProteinKcal,
        carbs: remainingRecommendedMacroKcal * (RECOMMENDED_MACRO_RATIO.carbs / carbFatRatioTotal),
        fats: remainingRecommendedMacroKcal * (RECOMMENDED_MACRO_RATIO.fats / carbFatRatioTotal),
      }
    : { protein: 0, carbs: 0, fats: 0 };
  const recommendedMacroGrams = calorieTargetRaw > 0
    ? {
        protein: Math.round(recommendedMacroKcal.protein / 4),
        carbs: Math.round(recommendedMacroKcal.carbs / 4),
        fats: Math.round(recommendedMacroKcal.fats / 9),
      }
    : null;
  const selectedDateLabel = selectedDateKey === formatDateKey(new Date()) ? "Today" : selectedDateKey;

  const timelineMax = useMemo(() => Math.max(1, ...timelinePoints.map((item) => item.value, 0)), [timelinePoints]);
  const timelineVisibleBars = 7;
  const timelineMeasuredWidth = timelineViewportWidthMeasured > 0 ? timelineViewportWidthMeasured : 308;
  const timelineBarCellWidth = Math.max(1, Math.floor(timelineMeasuredWidth / timelineVisibleBars));
  const timelineViewportWidth = timelineBarCellWidth * timelineVisibleBars;
  const timelineMaxWindowStart = Math.max(0, timelinePoints.length - timelineVisibleBars);
  const timelineScaleMax = Math.max(1, timelineMax, calorieTargetSafe || 0);
  const timelinePlotHeight = 120;
  const timelineLabelSpace = 18;
  const timelineTargetLaneWidth = Math.max(56, String(calorieTargetSafe).length * 10 * fontScale + 12);
  const targetLineBottom =
    timelineLabelSpace +
    Math.max(0, Math.min(timelinePlotHeight, (calorieTargetSafe / timelineScaleMax) * timelinePlotHeight));
  const targetLabelHalfHeight = 10 * fontScale;
  const targetLabelVisualAlignOffset = 1;

  useEffect(() => {
    if (!timelineShouldSnapToLatest || timelinePoints.length === 0) return;
    const timer = setTimeout(() => {
      const nextStart = timelineMaxWindowStart;
      timelineScrollRef.current?.scrollToOffset({
        offset: nextStart * timelineBarCellWidth,
        animated: false,
      });
      setTimelineWindowStart(nextStart);
      setTimelineShouldSnapToLatest(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [timelineShouldSnapToLatest, timelinePoints.length, timelineMaxWindowStart, timelineBarCellWidth]);

  const effectiveTimelineWindowStart = Math.min(timelineWindowStart, timelineMaxWindowStart);

  const timelineFocusedPoints = useMemo(
    () =>
      timelinePoints.slice(
        effectiveTimelineWindowStart,
        effectiveTimelineWindowStart + timelineVisibleBars
      ),
    [timelinePoints, effectiveTimelineWindowStart]
  );
  const timelineSnapOffsets = useMemo(
    () => Array.from({ length: timelineMaxWindowStart + 1 }, (_, index) => index * timelineBarCellWidth),
    [timelineMaxWindowStart, timelineBarCellWidth]
  );
  const sevenDayAverage = useMemo(() => {
    if (timelineFocusedPoints.length === 0) return null;
    const sum = timelineFocusedPoints.reduce((acc, point) => acc + point.value, 0);
    return Math.round(sum / timelineFocusedPoints.length);
  }, [timelineFocusedPoints]);
  const selectedTimelinePoint = useMemo(() => {
    if (!timelinePoints.length) return null;
    return (
      timelinePoints.find((point) => point.key === selectedDateKey) ??
      timelinePoints[timelinePoints.length - 1] ??
      null
    );
  }, [timelinePoints, selectedDateKey]);
  const selectedCaloriesDisplay = useMemo(() => {
    if (selectedTimelinePoint) return Math.round(selectedTimelinePoint.value);
    return Math.round(toEnergyUnit(calorieConsumed, energyUnit));
  }, [selectedTimelinePoint, calorieConsumed, energyUnit]);
  const selectedCaloriesDeltaText = useMemo(() => {
    if (!selectedTimelinePoint || calorieTargetSafe <= 0) return "-";
    const diff = Math.round(selectedTimelinePoint.value - calorieTargetSafe);
    if (diff === 0) return "On target";
    const prefix = diff > 0 ? "+" : "";
    return `${prefix}${diff} ${energyUnit} vs target`;
  }, [selectedTimelinePoint, calorieTargetSafe, energyUnit]);

  const snapTimelineToNearestWindow = useCallback(
    (offsetX: number) => {
      const nearestStart = Math.max(
        0,
        Math.min(timelineMaxWindowStart, Math.round(offsetX / timelineBarCellWidth))
      );
      setTimelineWindowStart(nearestStart);
    },
    [timelineMaxWindowStart, timelineBarCellWidth]
  );

  const handleTimelineViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - timelineViewportWidthMeasured) > 0.5) {
      setTimelineViewportWidthMeasured(width);
    }
  }, [timelineViewportWidthMeasured]);

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

  const handlePressTimelineDate = useCallback((dateKey: string) => {
    setDateSelection({ source: params.date, date: dateKey });
  }, [params.date]);

  const renderTimelineItem = useCallback(
    ({ item: point }: { item: ChartPoint }) => (
      <TimelineBarItem
        point={point}
        selected={point.key === selectedDateKey}
        timelineBarCellWidth={timelineBarCellWidth}
        timelinePlotHeight={timelinePlotHeight}
        timelineScaleMax={timelineScaleMax}
        onPressDate={handlePressTimelineDate}
      />
    ),
    [
      selectedDateKey,
      timelineBarCellWidth,
      timelinePlotHeight,
      timelineScaleMax,
      handlePressTimelineDate,
    ]
  );

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <NotebookHeader title="Nutrition" onBack={handleGoBack} />
      <ScrollView ref={pageScrollRef} contentContainerStyle={styles.content} style={styles.container}>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity accessibilityLabel="Previous diary day" style={styles.backButton} onPress={() => handlePressTimelineDate(adjacentDiaryDate(selectedDateKey, -1))}><ChevronLeft size={20} color={colors.ink} /></TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Choose diary date" style={{ flex: 1, minHeight: 48, justifyContent: "center" }} onPress={() => setCalendarVisible(true)}><Text style={[styles.sectionTitle, { textAlign: "center" }]}>{selectedDateLabel}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Next diary day" style={styles.backButton} onPress={() => handlePressTimelineDate(adjacentDiaryDate(selectedDateKey, 1))}><ChevronRight size={20} color={colors.ink} /></TouchableOpacity>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily intake</Text>
          <IntakeBar title="Calories" consumed={toEnergyUnit(calorieConsumed, energyUnit)} target={calorieTarget == null ? null : calorieTargetSafe} unit={energyUnit} />
          <IntakeBar title="Protein" consumed={proteinConsumed} target={proteinTargetGrams} unit="g" protein />
          <Text style={styles.totalLabel}>Macro composition</Text>
          <MacroComposition title="Consumed" grams={[totals.proteinGrams, totals.carbGrams, totals.fatGrams]} />
          <MacroComposition title="Recommended" grams={[recommendedMacroGrams?.protein ?? 0, recommendedMacroGrams?.carbs ?? 0, recommendedMacroGrams?.fats ?? 0]} />
        </View>

        <View
          style={styles.card}
          onLayout={(event) => {
            logMealsYRef.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Log meals</Text>
            <TouchableOpacity style={[styles.addMealBtn, { borderRadius: 4, minHeight: 44 }]} onPress={() => setAddMealVisible(true)}>
              <Ionicons name="add" size={14} color={colors.ink} />
              <Text style={styles.addMealBtnText}>Add meal</Text>
            </TouchableOpacity>
          </View>
          {loadingMeals ? <Text style={styles.subText}>Loading meals...</Text> : null}
          <View>
          {sections.map((section, sectionIndex) => {
            const stats = sectionStats.get(section) ?? {
              count: 0,
              calories: 0,
              protein: 0,
              carbs: 0,
              fats: 0,
              carbsKnownCount: 0,
              fatsKnownCount: 0,
            };
            const expansionScope = `${uid}:${selectedDateKey}`;
            const expanded = expandedMeals.scope === expansionScope && expandedMeals.sections.includes(section);
            return (
              <View key={section} style={[styles.sectionRow, sectionIndex === sections.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <TouchableOpacity disabled={!stats.count} accessibilityLabel={`Edit ${mealLabel(section, labels)} time`} style={[styles.mealTime, largeText && { width: 88, alignItems: "center" }]}
                  onPress={() => setMealEditor({ section, mode: "time" })}>
                  <Text style={styles.subText}>{stats.count ? formatMealTime(sectionMealTime(meals.filter((meal) => mealSectionId(meal) === section))) : "-"}</Text>
                </TouchableOpacity>
                <View style={styles.mealContent}>
                  <TouchableOpacity onPress={() => handleOpenSection(section)} style={[styles.mealHeading, largeText && { flexWrap: "wrap" }]}>
                    <Text style={[styles.sectionRowTitle, { flexShrink: 1 }]}>{mealLabel(section, labels)}</Text>
                    {stats.count > 0 ? <Text style={styles.sectionRowMacro}>{Math.round(toEnergyUnit(stats.calories, energyUnit))} {energyUnit}</Text> : null}
                  </TouchableOpacity>
                  {!stats.count ? <TouchableOpacity onPress={() => handleOpenSection(section)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={styles.subText}>Add food</Text></TouchableOpacity> : null}
                {stats.count > 0 ? <>
                  <View style={[styles.mealSummary, largeText && { flexWrap: "wrap" }]}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${expanded ? "Hide" : "Show"} foods in ${mealLabel(section, labels)}`}
                      accessibilityState={{ expanded }}
                      style={styles.mealExpand}
                      onPress={() => setExpandedMeals((current) => {
                        const sections = current.scope === expansionScope ? current.sections : [];
                        return { scope: expansionScope, sections: sections.includes(section) ? sections.filter((id) => id !== section) : [...sections, section] };
                      })}
                    >
                      <Text style={styles.subText}>{stats.count} {stats.count === 1 ? "item" : "items"}</Text>
                      {expanded ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
                    </TouchableOpacity>
                  <Text style={[styles.subText, { textAlign: "right", flexShrink: 1 }]}>
                    P {Math.round(stats.protein)}g / C{" "}
                    {stats.carbsKnownCount > 0 ? `${Math.round(stats.carbs)}g` : "0g"} / F{" "}
                    {stats.fatsKnownCount > 0 ? `${Math.round(stats.fats)}g` : "0g"}
                  </Text>
                  </View>
                  {expanded ? <View style={styles.mealFoods}>
                    {(mealFoodNames.get(section) ?? []).map((name, index) => <View key={index} style={styles.mealFood}><Text style={styles.subText}>{"\u2022"}</Text><Text style={[styles.subText, { flex: 1 }]}>{name}</Text></View>)}
                  </View> : null}
                </> : null}
                </View>
                <View style={{ flexDirection: "column" }}>
                  <TouchableOpacity accessibilityLabel={`Move ${mealLabel(section, labels)} up`} disabled={sectionIndex === 0} onPress={() => moveSection(sectionIndex, -1)} style={[styles.mealMenu, { opacity: sectionIndex === 0 ? 0.25 : 1 }]}><ChevronUp size={20} color={colors.ink} /></TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={`Move ${mealLabel(section, labels)} down`} disabled={sectionIndex === sections.length - 1} onPress={() => moveSection(sectionIndex, 1)} style={[styles.mealMenu, { opacity: sectionIndex === sections.length - 1 ? 0.25 : 1 }]}><ChevronDown size={20} color={colors.ink} /></TouchableOpacity>
                </View>
                </View>
              </View>
            );
          })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Calorie history</Text>
          </View>
          <Text style={styles.totalValue}>
            {`${selectedCaloriesDisplay} ${energyUnit}`}
          </Text>
          <Text style={styles.subText}>
            {selectedCaloriesDeltaText}
          </Text>
          <Text style={styles.subText}>
            7-day avg: {sevenDayAverage == null ? "-" : `${sevenDayAverage} ${energyUnit}`}
          </Text>
          {timelinePoints.length ? (
            <>
              <View style={styles.timelineStage}>
                {calorieTargetSafe > 0 ? (
                  <View
                    style={[
                      styles.timelineTargetLine,
                      {
                        bottom: targetLineBottom,
                        right: timelineTargetLaneWidth,
                      },
                    ]}
                  />
                ) : null}
                <View
                  style={[styles.timelineBarsPane, { width: timelineViewportWidth }]}
                  onLayout={handleTimelineViewportLayout}
                >
                  <FlatList
                    ref={timelineScrollRef}
                    horizontal
                    data={timelinePoints}
                    keyExtractor={(item) => item.key}
                    renderItem={renderTimelineItem}
                    extraData={selectedDateKey}
                    getItemLayout={(_, index) => ({
                      length: timelineBarCellWidth,
                      offset: timelineBarCellWidth * index,
                      index,
                    })}
                    automaticallyAdjustContentInsets={false}
                    contentInsetAdjustmentBehavior="never"
                    automaticallyAdjustsScrollIndicatorInsets={false}
                    bounces={false}
                    overScrollMode="never"
                    decelerationRate="fast"
                    snapToOffsets={timelineSnapOffsets}
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
                  {calorieTargetSafe > 0 ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.timelineTargetStickyWrap,
                          {
                          bottom: targetLineBottom - targetLabelHalfHeight + targetLabelVisualAlignOffset,
                          height: 20 * fontScale,
                          },
                        ]}
                      >
                      <Text style={styles.timelineTargetText}>{calorieTargetSafe}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </>
          ) : (
            <ChartEmptyState loading={loadingTrends} text="No timeline data yet." />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>History</Text>
          {trendReport?.dailyHistory.length === 0 ? <Text style={styles.subText}>No history yet.</Text> : null}
          {trendReport?.dailyHistory.map((day) => (
            <View key={day.dateKey} style={styles.historyRow}>
              <View style={styles.historyDateCol}>
                <Text style={styles.historyDate}>{day.dateKey.split("-").slice(1).join("/")}</Text>
                <View style={[styles.adherenceDot, { backgroundColor: getAdherenceColor(day.adherence, day.dateKey) }]} />
              </View>
              <View style={styles.historyStatsCol}>
                <Text style={styles.historyValue}>{Math.round(toEnergyUnit(day.calories, energyUnit))} {energyUnit}</Text>
                <Text style={styles.subText}>{getAdherenceLabel(day.adherence, day.dateKey)}</Text>
              </View>
              <View style={styles.historyProteinCol}>
                <Text style={styles.historyValue}>{day.proteinGrams}g</Text>
                <Text style={styles.subText}>Protein</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal visible={addMealVisible} transparent animationType="fade" onRequestClose={() => setAddMealVisible(false)}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop} onDismiss={() => setAddMealVisible(false)}>
          <AdaptiveModalCard contentSized style={styles.modalCard} contentContainerStyle={{ gap: 16 }}>
            <Text style={styles.modalTitle}>Add meal section</Text>
            <NotebookTextInput disableFullscreenUI
              value={newMealName}
              maxLength={24}
              onChangeText={setNewMealName}
              placeholder="e.g. Pre-workout"
              placeholderTextColor={colors.muted}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAddMealVisible(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAddMealSection}>
                <Text style={styles.primaryBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>
      {calendarVisible ? <DiaryCalendar selected={selectedDateKey} onSelect={handlePressTimelineDate} onClose={() => setCalendarVisible(false)} /> : null}
      {mealEditor ? <MealOrganizationEditor key={`${selectedDateKey}:${mealEditor.section}:${mealEditor.mode}`} uid={uid} section={mealEditor.section} sections={sections}
        meals={meals.filter((meal) => mealSectionId(meal) === mealEditor.section)} dateKey={selectedDateKey} initialMode={mealEditor.mode} onClose={() => setMealEditor(null)} /> : null}
    </SafeAreaView>
  );
}

const createStyles = (baseColors: NotebookColors) => {
  const colors = nutritionPalette(baseColors);
  return notebookSheet({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 20 },
  backButton: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "transparent", borderRadius: 0, borderWidth: 0, borderTopWidth: 1, borderTopColor: colors.rule, paddingHorizontal: 0, paddingVertical: 20, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  sectionHeaderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" },
  addMealBtn: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  addMealBtnText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  timelineStage: { position: "relative", flexDirection: "row", alignItems: "stretch", minHeight: 168 },
  timelineBarsPane: { flex: 1, overflow: "hidden" },
  timelineTargetPane: { position: "relative", alignSelf: "stretch" },
  timelineScrollViewport: { marginRight: 0 },
  timelineScrollOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 4 },
  timelineScrollContent: { paddingVertical: 4 },
  timelineBarCell: { width: 44, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  timelineBar: { width: 28, borderRadius: 8, minHeight: 8 },
  timelineLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  timelineLabelSelected: { color: colors.ink },
  timelineTargetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderTopColor: colors.accent,
    borderStyle: "dashed",
    zIndex: 2,
  },
  timelineTargetStickyWrap: {
    position: "absolute",
    right: 0,
    minHeight: 20,
    justifyContent: "center",
    zIndex: 3,
  },
  timelineTargetText: {
    color: colors.accent,
    fontSize: 10,
    lineHeight: 10,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "right",
  },
  totalLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  totalValue: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  subText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  sectionRow: { paddingVertical: 12, borderRadius: 0, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: "transparent" },
  mealContent: { flex: 1, minWidth: 0, gap: 4 },
  mealSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 8 },
  mealExpand: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  mealHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", columnGap: 8, rowGap: 4 },
  mealFoods: { gap: 4, paddingTop: 4 },
  mealFood: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  mealTime: { width: 52, minHeight: 44, justifyContent: "center" },
  mealMenu: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  sectionRowTitle: { color: colors.ink, fontSize: 18, fontWeight: "600" },
  sectionRowMacro: { color: colors.ink, fontSize: 16 },
  historyRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.subtle, gap: 12,
  },
  historyDateCol: { width: 50, alignItems: "center", gap: 6 },
  historyDate: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  adherenceDot: { width: 8, height: 8, borderRadius: 4 },
  historyStatsCol: { flex: 1, gap: 2 },
  historyProteinCol: { width: 60, alignItems: "flex-end", gap: 2 },
  historyValue: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.overlay },
  modalCard: { width: "100%", maxWidth: 560, padding: 20, gap: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8 },
  modalTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22, marginBottom: 8 },
  modalInput: {
    backgroundColor: colors.subtle,
    borderColor: colors.rule,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-end", marginTop: 12 },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, minHeight: 48, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: colors.ink, fontSize: 16 },
  primaryBtn: { backgroundColor: colors.primary, minHeight: 48, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" }
  });
};
