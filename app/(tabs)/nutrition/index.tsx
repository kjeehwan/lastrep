import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, LayoutChangeEvent, Modal, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "@/src/config/firebaseConfig";
import type { NutritionMeal } from "@/src/contracts";
import {
  computeNutritionTotals,
  DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE,
  formatDateKey,
  getCalorieTargetForDietPhase,
  getNutritionProfile,
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
import { getUserData } from "@/src/userData";

const DIET_PHASES: DietPhase[] = ["Cut", "Maintain", "Bulk"];
const DEFAULT_SECTIONS = ["Breakfast", "Snack 1", "Lunch", "Snack 2", "Dinner", "Snack 3"];
const RECOMMENDED_MACRO_RATIO = { protein: 0.3, carbs: 0.45, fats: 0.25 };
const MUTED = "#a5acc1";
const SUCCESS = "#4ade80";
const WARNING = "#fbbf24";
const DANGER = "#f87171";
type EnergyUnit = "kcal" | "kJ";
const KCAL_TO_KJ = 4.184;
const isEnergyUnit = (value: unknown): value is EnergyUnit => value === "kcal" || value === "kJ";
const toEnergyUnit = (valueKcal: number, unit: EnergyUnit): number =>
  unit === "kJ" ? valueKcal * KCAL_TO_KJ : valueKcal;

function isDietPhase(value: string): value is DietPhase {
  return DIET_PHASES.includes(value as DietPhase);
}

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
            backgroundColor: selected ? "#60a5fa" : "rgba(123,97,255,0.45)",
          },
        ]}
      />
      <Text style={[styles.timelineLabel, selected && styles.timelineLabelSelected]}>{point.label}</Text>
    </TouchableOpacity>
  );
});

export default function NutritionIndex() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const [uid, setUid] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [meals, setMeals] = useState<NutritionMeal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [currentDietPhase, setCurrentDietPhase] = useState<DietPhase>("Maintain");
  const [calorieTargets, setCalorieTargets] = useState(DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE);
  const [proteinTargetGrams, setProteinTargetGrams] = useState<number | null>(null);
  const [mealSectionsOrder, setMealSectionsOrder] = useState<string[]>(DEFAULT_SECTIONS);
  const [addMealVisible, setAddMealVisible] = useState(false);
  const [newMealName, setNewMealName] = useState("");
  const [trendReport, setTrendReport] = useState<NutritionTrendReport | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const fromParams = typeof params.date === "string" ? params.date : "";
    return parseDateKey(fromParams) ? fromParams : formatDateKey(new Date());
  });
  const [timelinePoints, setTimelinePoints] = useState<ChartPoint[]>([]);
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  const timelineScrollRef = React.useRef<FlatList<ChartPoint> | null>(null);
  const [timelineShouldSnapToLatest, setTimelineShouldSnapToLatest] = useState(true);
  const [timelineWindowStart, setTimelineWindowStart] = useState(0);
  const [timelineViewportWidthMeasured, setTimelineViewportWidthMeasured] = useState<number>(0);

  useEffect(() => {
    const fromParams = typeof params.date === "string" ? params.date : "";
    if (!parseDateKey(fromParams)) return;
    setSelectedDateKey(fromParams);
  }, [params.date]);

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

  useEffect(() => {
    let cancelled = false;
    const warm = async () => {
      try {
        const foodDb = await import("@/src/nutrition/foodDb");
        await foodDb.prewarmFoodSearch();
      } catch (error) {
        if (!cancelled) {
          console.log("Nutrition search prewarm failed", error);
        }
      }
    };
    void warm();
    return () => {
      cancelled = true;
    };
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
    if (!uid) {
      setMeals([]);
      setLoadingMeals(false);
      return;
    }
    setLoadingMeals(true);
    const targetDate = parseDateKey(selectedDateKey) ?? new Date();
    const unsubscribe = subscribeToMealsForDate(
      uid,
      targetDate,
      (nextMeals) => {
        setMeals(nextMeals);
        setLoadingMeals(false);
        void fetchHistoryData();
      },
      (error) => {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to load meals", error);
        }
        setLoadingMeals(false);
      }
    );
    return unsubscribe;
  }, [uid, selectedDateKey, fetchHistoryData]);

  const fetchTimelineData = useCallback(async () => {
    if (!uid) return;
    try {
      const recentMeals = await getRecentMeals(uid, 60);
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
  }, [uid, energyUnit]);

  useEffect(() => {
    void fetchTimelineData();
  }, [fetchTimelineData, meals]);

  const refreshProfileContext = useCallback(async () => {
    if (!uid) return;
    try {
      const [profile, userData] = await Promise.all([getNutritionProfile(uid), getUserData(uid)]);
      setCalorieTargets(profile.calorieTargetsByDietPhase);
      setProteinTargetGrams(profile.proteinTargetGrams ?? null);
      if (profile.mealSections?.length) setMealSectionsOrder(profile.mealSections);
      const nextDietPhase = userData?.dietPhase;
      const nextEnergyUnit = userData?.energyUnit;
      setEnergyUnit(isEnergyUnit(nextEnergyUnit) ? nextEnergyUnit : "kcal");
      setCurrentDietPhase(
        typeof nextDietPhase === "string" && isDietPhase(nextDietPhase) ? nextDietPhase : "Maintain"
      );
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load profile context", error);
      }
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      setTimelineShouldSnapToLatest(true);
      if (!uid) return undefined;
      void refreshProfileContext();
      return undefined;
    }, [uid, refreshProfileContext])
  );

  useEffect(() => {
    if (!uid) return undefined;
    const unsub = onSnapshot(doc(db, "users", uid), () => {
      void refreshProfileContext();
    });
    return unsub;
  }, [uid, refreshProfileContext]);

  const totals = useMemo(() => computeNutritionTotals(meals), [meals]);
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
      setMealSectionsOrder(nextSections);
      try {
        await saveNutritionProfile(uid, calorieTargets, proteinTargetGrams, nextSections);
      } catch (error) {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to save meal sections", error);
        }
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
    if (!name) return;
    if (sections.includes(name)) {
      setAddMealVisible(false);
      setNewMealName("");
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
    if (dateKey === todayKey && status === "below_target") return "#60a5fa";
    switch (status) {
      case "on_target":
        return SUCCESS;
      case "below_target":
        return WARNING;
      case "above_target":
        return DANGER;
      default:
        return MUTED;
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
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const calorieConsumed = totals.calories;
  const calorieTargetRaw = calorieTarget ?? 0;
  const calorieTargetSafe = Math.round(toEnergyUnit(calorieTargetRaw, energyUnit));
  const calorieConsumedRatio = calorieTargetRaw > 0 ? Math.min(1, calorieConsumed / calorieTargetRaw) : 0;
  const calorieRemaining = calorieTargetRaw > 0 ? Math.max(0, calorieTargetRaw - calorieConsumed) : 0;
  const proteinConsumed = totals.proteinGrams;
  const proteinRatio =
    proteinTargetGrams && proteinTargetGrams > 0 ? Math.min(1, proteinConsumed / proteinTargetGrams) : 0;

  const consumedMacroKcal = {
    protein: totals.proteinGrams * 4,
    carbs: totals.carbGrams * 4,
    fats: totals.fatGrams * 9,
  };
  const consumedMacroTotal = consumedMacroKcal.protein + consumedMacroKcal.carbs + consumedMacroKcal.fats;
  const consumedMacroRatio = {
    protein: consumedMacroTotal > 0 ? consumedMacroKcal.protein / consumedMacroTotal : 0,
    carbs: consumedMacroTotal > 0 ? consumedMacroKcal.carbs / consumedMacroTotal : 0,
    fats: consumedMacroTotal > 0 ? consumedMacroKcal.fats / consumedMacroTotal : 0,
  };
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
  const timelineTargetLaneWidth = 34;
  const targetLineBottom =
    timelineLabelSpace +
    Math.max(0, Math.min(timelinePlotHeight, (calorieTargetSafe / timelineScaleMax) * timelinePlotHeight));
  const targetLabelHalfHeight = 5;
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

  useEffect(() => {
    setTimelineWindowStart((previous) => Math.min(previous, timelineMaxWindowStart));
  }, [timelineMaxWindowStart]);

  const timelineFocusedPoints = useMemo(
    () => timelinePoints.slice(timelineWindowStart, timelineWindowStart + timelineVisibleBars),
    [timelinePoints, timelineWindowStart]
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
    setSelectedDateKey(dateKey);
  }, []);

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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Nutrition</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Daily calories</Text>
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
          <Text style={styles.sectionTitle}>Daily intake</Text>
          <Text style={styles.subText}>{selectedDateLabel}</Text>
          <View style={styles.metricBlock}>
            <View style={styles.metricHeaderRow}>
              <Text style={[styles.totalLabel, styles.totalLabelNoUpper]}>Calories</Text>
              <Text style={styles.subText}>
                {Math.round(toEnergyUnit(calorieConsumed, energyUnit))} consumed / {calorieTarget == null ? "Set target" : `${Math.round(toEnergyUnit(calorieTarget, energyUnit))} target`} /{" "}
                {calorieTarget == null ? "-" : `${Math.round(toEnergyUnit(calorieRemaining, energyUnit))} remaining`}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${calorieConsumedRatio * 100}%` }]} />
            </View>
          </View>
          <View style={styles.metricBlock}>
            <View style={styles.metricHeaderRow}>
              <Text style={[styles.totalLabel, styles.totalLabelNoUpper]}>Protein</Text>
              <Text style={styles.subText}>
                {proteinTargetGrams != null ? `${proteinConsumed}g / ${proteinTargetGrams}g` : `${proteinConsumed}g`}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFillProtein, { width: `${proteinRatio * 100}%` }]} />
            </View>
          </View>
          <View style={styles.metricBlock}>
            <Text style={[styles.totalLabel, styles.totalLabelNoUpper]}>Composition (consumed vs recommended)</Text>
            <View style={styles.compositionRow}>
              <Text style={styles.subText}>Protein</Text>
              <Text style={styles.subText}>
                {Math.round(consumedMacroRatio.protein * 100)}% / {Math.round(RECOMMENDED_MACRO_RATIO.protein * 100)}%
              </Text>
            </View>
            <View style={styles.compositionRow}>
              <Text style={styles.subText}>Carb</Text>
              <Text style={styles.subText}>
                {Math.round(consumedMacroRatio.carbs * 100)}% / {Math.round(RECOMMENDED_MACRO_RATIO.carbs * 100)}%
              </Text>
            </View>
            <View style={styles.compositionRow}>
              <Text style={styles.subText}>Fat</Text>
              <Text style={styles.subText}>
                {Math.round(consumedMacroRatio.fats * 100)}% / {Math.round(RECOMMENDED_MACRO_RATIO.fats * 100)}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Log meals</Text>
            <TouchableOpacity style={styles.addMealBtn} onPress={() => setAddMealVisible(true)}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.addMealBtnText}>Add meal</Text>
            </TouchableOpacity>
          </View>
          {loadingMeals ? <Text style={styles.subText}>Loading meals...</Text> : null}
          {sections.map((section, index) => {
            const stats = sectionStats.get(section) ?? {
              count: 0,
              calories: 0,
              protein: 0,
              carbs: 0,
              fats: 0,
              carbsKnownCount: 0,
              fatsKnownCount: 0,
            };
            return (
              <TouchableOpacity key={section} style={styles.sectionRow} onPress={() => handleOpenSection(section)}>
                <View style={styles.sectionRowLeft}>
                  <Text style={styles.sectionRowTitle}>{section}</Text>
                  <Text style={styles.subText}>{stats.count} entries</Text>
                </View>
                <View style={styles.sectionRowRight}>
                  <Text style={styles.sectionRowMacro}>{Math.round(toEnergyUnit(stats.calories, energyUnit))} {energyUnit}</Text>
                  <Text style={styles.subText}>
                    P {Math.round(stats.protein)}g / C{" "}
                    {stats.carbsKnownCount > 0 ? `${Math.round(stats.carbs)}g` : "0g"} / F{" "}
                    {stats.fatsKnownCount > 0 ? `${Math.round(stats.fats)}g` : "0g"}
                  </Text>
                </View>
                <View style={styles.reorderCol}>
                  <TouchableOpacity style={styles.reorderBtn} onPress={() => moveSection(index, -1)}>
                    <Ionicons name="chevron-up" size={14} color="#cfd3f8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reorderBtn} onPress={() => moveSection(index, 1)}>
                    <Ionicons name="chevron-down" size={14} color="#cfd3f8" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add meal section</Text>
            <TextInput
              value={newMealName}
              onChangeText={setNewMealName}
              placeholder="e.g. Pre-workout"
              placeholderTextColor="#7a7a8c"
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d1a" },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: { padding: 16, paddingTop: 12, paddingBottom: 140, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backButton: {
    width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerSpacer: { width: 22 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)", gap: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addMealBtn: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  addMealBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  todayResetBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  todayResetBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  metricBlock: { gap: 6 },
  metricHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#7b61ff" },
  progressFillProtein: { height: "100%", backgroundColor: "#4ade80" },
  timelineStage: { position: "relative", flexDirection: "row", alignItems: "stretch", minHeight: 168 },
  timelineBarsPane: { flex: 1, overflow: "hidden" },
  timelineTargetPane: { position: "relative", alignSelf: "stretch" },
  timelineScrollViewport: { marginRight: 0 },
  timelineScrollOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 4 },
  timelineScrollContent: { paddingVertical: 4 },
  timelineChartWrap: { position: "relative", minHeight: 160, justifyContent: "flex-end" },
  timelineChartRow: { flexDirection: "row", alignItems: "flex-end", minHeight: 160 },
  timelineBarCell: { width: 44, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  timelineBar: { width: 28, borderRadius: 8, minHeight: 8 },
  timelineLabel: { color: MUTED, fontSize: 10, fontWeight: "600" },
  timelineLabelSelected: { color: "#fff" },
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
    zIndex: 3,
  },
  timelineTargetText: {
    color: "#8ea2ff",
    fontSize: 10,
    lineHeight: 10,
    fontWeight: "700",
    includeFontPadding: false,
    textAlign: "right",
  },
  compositionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalRow: { flexDirection: "row", gap: 10 },
  totalChip: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  totalLabel: { color: MUTED, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  totalLabelNoUpper: { textTransform: "none" },
  totalValue: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subText: { color: MUTED, fontSize: 12, lineHeight: 16 },
  muted: { color: MUTED, fontSize: 10, fontWeight: "600" },
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)",
  },
  sectionRowLeft: { gap: 2, flex: 1 },
  sectionRowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sectionRowRight: { alignItems: "flex-end", gap: 2, marginLeft: 8 },
  reorderCol: { marginLeft: 8, gap: 4 },
  reorderBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sectionRowMacro: { color: "#fff", fontSize: 14, fontWeight: "700" },
  historyRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.05)", gap: 12,
  },
  historyDateCol: { width: 50, alignItems: "center", gap: 6 },
  historyDate: { color: "#fff", fontSize: 12, fontWeight: "700" },
  adherenceDot: { width: 8, height: 8, borderRadius: 4 },
  historyStatsCol: { flex: 1, gap: 2 },
  historyProteinCol: { width: 60, alignItems: "flex-end", gap: 2 },
  historyValue: { color: "#fff", fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#171727",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 16,
    gap: 10,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryBtnText: { color: "#fff", fontWeight: "600" },
  primaryBtn: {
    backgroundColor: "#7b61ff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
});
