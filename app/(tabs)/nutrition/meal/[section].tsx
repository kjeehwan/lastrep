import { Star, ArrowRightLeft, Trash2 } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loggedFoodReference } from "@/src/nutrition/loggedFood";
import { MacroComposition } from "@/src/nutrition/components/NotebookNutrition";
import { DEFAULT_MEAL_IDS, mealSectionId , formatMealTime, mealLabel, sectionMealTime } from "@/src/nutrition/mealOrganization";
import { getNutritionProfile ,
  deleteMeal,
  formatDateKey,
  parseDateKey,
  subscribeToMealsForDate,
  updateMeal,
} from "@/src/nutrition/meals";
import { notebookSheet, useNotebookStyles } from "@/src/ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "@/src/ui/notebook/tokens";
import { NotebookModal as Modal } from "@/src/ui/notebook/NotebookModal";
import { nutritionPalette, useNutritionColors } from "@/src/nutrition/notebookPalette";
import { AdaptiveModalCard } from "../../../../src/ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../../../src/ui/KeyboardAwareModalFrame";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
    ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { auth } from "@/src/config/firebaseConfig";
import type { NutritionMeal } from "@/src/contracts";
import type { FoodEntryMode } from "@/src/nutrition/foodDb";
import { showAppDialog } from "@/src/ui/appDialog";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";
import { copyPreviousMealToDate, createSavedMeal } from "@/src/nutrition/quickLog";
import { NutritionFactsPreview } from "@/src/nutrition/components/NutritionFactsPreview";
import { useFoodEditorStyles } from "@/src/nutrition/components/foodEditorStyles";
import { quantityNutrition, quantityGrams, quantityValue, recordedMealGrams } from "@/src/nutrition/foodQuantity";
import { useMealLabels } from "@/src/nutrition/useMealLabels";
import { MealOrganizationEditor } from "@/src/nutrition/components/MealOrganizationControls";

const ENTRY_MODES: FoodEntryMode[] = ["grams", "calories", "servings"];


function roundMacro(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function formatMealQuantity(meal: NutritionMeal): string | null {
  const grams = recordedMealGrams(meal);
  const servingGrams = meal.source?.servingGrams;
  const parts = [`${Math.round(meal.calories)} kcal`];
  if (grams != null) parts.push(`${Math.round(grams * 100) / 100}g`);
  if (grams != null && servingGrams && servingGrams > 0) parts.push(`${Math.round(grams / servingGrams * 100) / 100} servings`);
  return parts.join(" / ");
}

function normalizeServingInfo(label: string | null | undefined, servingGrams: number): string {
  const raw = String(label ?? "").trim();
  if (!raw) return "1 serving";
  const gramsPattern = /^\d+(?:\.\d+)?\s*g$/i;
  if (gramsPattern.test(raw)) return "1 serving";

  const gramsThenParen = raw.match(/^\d+(?:\.\d+)?\s*g\s*\(([^)]+)\)\s*$/i);
  if (gramsThenParen?.[1]) return gramsThenParen[1].trim();

  const textThenGramsParen = raw.match(/^(.+?)\s*\(\s*\d+(?:\.\d+)?\s*g\s*\)\s*$/i);
  if (textThenGramsParen?.[1]) return textThenGramsParen[1].trim();

  const normalizedRaw = raw.replace(/\s+/g, " ").trim();
  if (normalizedRaw.toLowerCase() === `${Math.round(servingGrams)} g`) return "1 serving";
  if (/[a-z]/i.test(normalizedRaw)) return normalizedRaw;
  return normalizedRaw;
}

export default function MealSectionScreen() {
  const colors = useNutritionColors();
  const foodEditorStyles = useFoodEditorStyles();
  const styles = useNotebookStyles(createStyles);

  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; date?: string }>();
  const section = decodeURIComponent(params.section ?? "Breakfast");
  const selectedDateKey = typeof params.date === "string" ? params.date : formatDateKey(new Date());
  const selectedDate = useMemo(
    () => parseDateKey(selectedDateKey) ?? new Date(),
    [selectedDateKey]
  );
  const [uid, setUid] = useState<string | null>(null);
  const { labels } = useMealLabels(uid, selectedDateKey);
  const sectionName = mealLabel(section, labels);
  const [timeEditorVisible, setTimeEditorVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [foodOptions, setFoodOptions] = useState<NutritionMeal | null>(null);
  const [foodPending, setFoodPending] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<NutritionMeal | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const toggleLoggedFavorite = async (meal: NutritionMeal) => {
    if (!uid || foodPending) return;
    const food = loggedFoodReference(meal);
    if (!food) return;
    setFoodPending(true);
    try {
      const key = `nutrition-food-favorites:v1:${uid}`;
      const raw = await AsyncStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      const entries = Array.isArray(parsed) ? parsed : [];
      const next = entries.some((entry) => entry?.food?.id === food.id) ? entries.filter((entry) => entry?.food?.id !== food.id) : [{ food }, ...entries];
      await AsyncStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
      setFavoriteIds(next.map((entry) => entry.food.id));
    } catch {
      showAppDialog({ title: "Could not update favorites", message: "Please try again.", buttons: [{ text: "OK" }] });
    } finally { setFoodPending(false); }
  };
  const [deletedFood, setDeletedFood] = useState<NutritionMeal | null>(null);
  const [configuredSections, setConfiguredSections] = useState<string[]>(DEFAULT_MEAL_IDS);
  useEffect(() => {
    let active = true;
    if (uid) void getNutritionProfile(uid).then((profile) => { if (active && profile?.mealSections?.length) setConfiguredSections(profile.mealSections); }).catch(() => {});
    return () => { active = false; };
  }, [uid]);
  const [dayMeals, setDayMeals] = useState<NutritionMeal[]>([]);
  useEffect(() => {
    let active = true;
    if (uid) void AsyncStorage.getItem(`nutrition-food-favorites:v1:${uid}`).then((raw) => {
      const entries = raw ? JSON.parse(raw) : [];
      if (active) setFavoriteIds(Array.isArray(entries) ? entries.map((entry) => entry?.food?.id).filter(Boolean) : []);
    }).catch(() => {});
    return () => { active = false; };
  }, [uid, dayMeals]);
  const [editingMeal, setEditingMeal] = useState<NutritionMeal | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<FoodEntryMode>("grams");
  const [editorValue, setEditorValue] = useState("100");
  const editorGramsRef = useRef<number | null>(null);
  const [editorFallback, setEditorFallback] = useState(false);
  const editorPreview = useMemo(() => {
    const result = !editorFallback && editingMeal?.source ? quantityNutrition(editorValue, editorMode, editingMeal.source) : null;
    return result ? { ...result, calories: Math.round(result.calories), proteinGrams: roundMacro(result.proteinGrams), carbGrams: roundMacro(result.carbGrams), fatGrams: roundMacro(result.fatGrams) } : null;
  }, [editingMeal, editorFallback, editorValue, editorMode]);
  const [manualName, setManualName] = useState("");
  const [editorError, setEditorError] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFats, setManualFats] = useState("");
  const [saveMealVisible, setSaveMealVisible] = useState(false);
  const [savedMealName, setSavedMealName] = useState("");
  const [quickActionPending, setQuickActionPending] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setDeletedFood(null); setFoodOptions(null); setEditorVisible(false); setDeleteCandidate(null);
      if (!user) {
        router.replace("/auth/sign-in");
      }
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!uid) return undefined;
    const unsub = subscribeToMealsForDate(
      uid,
      selectedDate,
      (meals) => setDayMeals(meals),
      (error) => {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to load section meals", error);
        }
      }
    );
    return unsub;
  }, [uid, selectedDate]);

  const sectionMeals = useMemo(
    () => dayMeals.filter((meal) => (meal.mealSection?.trim() || "Breakfast") === section),
    [dayMeals, section]
  );

  const sectionTotals = useMemo(() => {
    return sectionMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.proteinGrams || 0),
        carbs: acc.carbs + (meal.carbGrams || 0),
        fats: acc.fats + (meal.fatGrams || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [sectionMeals]);

  const openEditorForMeal = async (meal: NutritionMeal) => {
    setEditingMeal(meal);
    setManualName(meal.name);
    setEditorError("");
    const recordedGrams = recordedMealGrams(meal);
    editorGramsRef.current = recordedGrams;
    const canCompute =
      typeof meal.source?.caloriesPer100g === "number" &&
      Number.isFinite(meal.source.caloriesPer100g) &&
      meal.source.caloriesPer100g >= 0 &&
      typeof meal.source?.proteinPer100g === "number" &&
      Number.isFinite(meal.source.proteinPer100g) &&
      typeof meal.source?.servingGrams === "number" &&
      Number.isFinite(meal.source.servingGrams) &&
      meal.source.servingGrams > 0;

    if (canCompute && recordedGrams != null) {
      setEditorFallback(false);
      setEditorMode("grams");
      setEditorValue(quantityValue(recordedGrams, "grams", meal.source!));
      setManualCalories("");
      setManualProtein("");
      setManualCarbs("");
      setManualFats("");
      setEditorVisible(true);
      return;
    }

    setEditorFallback(true);
    setManualCalories(String(meal.calories ?? ""));
    setManualProtein(meal.proteinGrams == null ? "" : String(meal.proteinGrams));
    setManualCarbs(meal.carbGrams == null ? "" : String(meal.carbGrams));
    setManualFats(meal.fatGrams == null ? "" : String(meal.fatGrams));
    setEditorVisible(true);
  };

  const changeEditorValue = (value: string) => {
    setEditorValue(value);
    editorGramsRef.current = editingMeal?.source ? quantityGrams(value, editorMode, editingMeal.source) : null;
  };

  const changeEditorMode = (mode: FoodEntryMode) => {
    if (mode === editorMode || !editingMeal?.source) return;
    if (mode === "calories" && (editingMeal.source.caloriesPer100g ?? 0) <= 0) return;
    setEditorValue(quantityValue(editorGramsRef.current, mode, editingMeal.source));
    setEditorMode(mode);
  };

  const handleDeleteMeal = (meal: NutritionMeal) => {
    if (!uid || deletePending) return;
    setDeleteError(""); setDeleteCandidate(meal);
  };
  const closeDelete = () => { if (!deletePending) setDeleteCandidate(null); };
  const confirmDelete = async () => {
    if (!uid || !deleteCandidate || deletePending) return;
    setDeletePending(true); setDeleteError("");
    try {
      await deleteMeal(uid, deleteCandidate.id);
      setDeletedFood(deleteCandidate); setDeleteCandidate(null);
    } catch { setDeleteError("Could not delete food. Check your connection and try again."); }
    finally { setDeletePending(false); }
  };

  const restoreDeletedFood = async () => {
    if (!uid || !deletedFood || foodPending || formatDateKey(deletedFood.loggedAt.toDate()) !== selectedDateKey || mealSectionId(deletedFood) !== section) return;
    setFoodPending(true);
    try {
      const { id, ...record } = deletedFood;
      await updateMeal(uid, id, { ...record, updatedAt: Timestamp.now() });
      setDeletedFood(null);
    } catch {
      showAppDialog({ title: "Could not restore food", message: "Check your connection and try again.", buttons: [{ text: "OK" }] });
    } finally { setFoodPending(false); }
  };
  const moveFood = async (target: string) => {
    if (!uid || !foodOptions || foodPending) return;
    setFoodPending(true);
    try {
      const { id, ...record } = foodOptions;
      const destination = dayMeals.filter((meal) => mealSectionId(meal) === target);
      await updateMeal(uid, id, { ...record, mealSection: target, mealTimeMinutes: sectionMealTime(destination) ?? record.mealTimeMinutes ?? null, updatedAt: Timestamp.now() });
      setFoodOptions(null);
    } catch {
      showAppDialog({ title: "Could not move food", message: "Check your connection and try again.", buttons: [{ text: "OK" }] });
    } finally { setFoodPending(false); }
  };

  const handleCopyPrevious = () => {
    if (!uid || quickActionPending) return;
    showAppDialog({
      title: "Copy meal",
      message: `Add the most recent earlier ${sectionName} to ${selectedDateKey}? Existing food stays unchanged.`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Copy",
          onPress: async () => {
            setQuickActionPending(true);
            try {
              const result = await copyPreviousMealToDate(uid, section, selectedDate);
              showAppDialog({
                title: result.copied > 0 ? "Meal copied" : "No previous meal",
                message:
                  result.copied > 0 && result.sourceDate
                    ? `${result.copied} item${result.copied === 1 ? "" : "s"} copied from ${formatDateKey(result.sourceDate)}.`
                    : `No earlier ${sectionName} was found in the last 90 days.`,
                buttons: [{ text: "OK" }],
              });
            } catch (error) {
              console.log("Failed to copy previous meal", error);
              showAppDialog({
                title: "Could not copy meal",
                message: "Check your connection and try again.",
                buttons: [{ text: "OK" }],
              });
            } finally {
              setQuickActionPending(false);
            }
          },
        },
      ],
    });
  };

  const openSaveMeal = () => {
    if (sectionMeals.length === 0) return;
    setSavedMealName(`${sectionName} meal`);
    setSaveMealVisible(true);
  };

  const handleSaveMeal = async () => {
    if (!uid || quickActionPending || !savedMealName.trim() || sectionMeals.length === 0) return;
    setQuickActionPending(true);
    try {
      await createSavedMeal(uid, savedMealName, sectionMeals);
      setSaveMealVisible(false);
      showAppDialog({
        title: "Meal saved",
        message: "To log this meal again, open the destination meal, tap Add items, then Saved meals and Add.",
        buttons: [{ text: "OK" }],
      });
    } catch (error) {
      console.log("Failed to save meal", error);
      showAppDialog({
        title: "Could not save meal",
        message: "Check your connection and try again.",
        buttons: [{ text: "OK" }],
      });
    } finally {
      setQuickActionPending(false);
    }
  };

  const saveEditedMeal = async () => {
    if (!uid || !editingMeal || editorSaving) return;
    setEditorSaving(true);
    try {
    if (editorFallback) {
      const calories = Number(manualCalories);
      const protein = Number(manualProtein);
      const carbs = Number(manualCarbs);
      const fats = Number(manualFats);
      if (!manualName.trim() || !manualCalories.trim() || !Number.isFinite(calories) || calories < 0 || [manualProtein, manualCarbs, manualFats].some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
        setEditorError("Enter a food name and non-negative nutrition values."); return;
      }
      await updateMeal(uid, editingMeal.id, {
        name: manualName.trim(),
        calories: Math.round(calories),
        proteinGrams: manualProtein.trim() && Number.isFinite(protein) && protein >= 0 ? Math.round(protein) : null,
        carbGrams: manualCarbs.trim() && Number.isFinite(carbs) && carbs >= 0 ? Math.round(carbs) : null,
        fatGrams: manualFats.trim() && Number.isFinite(fats) && fats >= 0 ? Math.round(fats) : null,
        updatedAt: Timestamp.now(),
      } as any);
      setEditorVisible(false);
      setEditingMeal(null);
      return;
    }

    if (!editorPreview) return;
    await updateMeal(uid, editingMeal.id, {
      calories: editorPreview.calories,
      proteinGrams: editorPreview.proteinGrams,
      carbGrams: editorPreview.carbGrams,
      fatGrams: editorPreview.fatGrams,
      source: {
        ...(editingMeal.source ?? {}),
        mode: editorMode,
        value: editorValue,
      },
      updatedAt: Timestamp.now(),
    } as any);
    setEditorVisible(false);
    setEditingMeal(null);
    } catch {
      showAppDialog({ title: "Could not save food", message: "Your changes are still here. Check your connection and try again.", buttons: [{ text: "OK" }] });
    } finally { setEditorSaving(false); }
  };

  const closeEditor = () => {
    if (editorSaving) return;
    setEditorVisible(false);
    setEditingMeal(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.replace({ pathname: "/nutrition", params: { date: selectedDateKey } })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 8 }}>
          <Text style={[styles.title, { textAlign: "center" }]}>{sectionName}</Text>
          <Text style={[styles.subText, { textAlign: "center" }]}>{selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { borderTopWidth: 0, paddingTop: 0 }]}>
          <View style={styles.quickActionRow}><Text style={[styles.sectionTitle, { flex: 1 }]}>{sectionName}</Text><TouchableOpacity accessibilityLabel="Rename meal" style={styles.quickActionBtn} onPress={() => setRenameVisible(true)}><Text style={styles.quickActionText}>Rename</Text></TouchableOpacity></View>
          {sectionMeals.length ? <TouchableOpacity style={{ minHeight: 44, justifyContent: "center" }} onPress={() => setTimeEditorVisible(true)}>
            <Text style={styles.subText}>Meal time: {formatMealTime(sectionMealTime(sectionMeals))} · Edit</Text>
          </TouchableOpacity> : null}
          <Text style={styles.summaryCalories}>{sectionTotals.calories} kcal</Text>
          <Text style={styles.subText}>
            Protein {Math.round(sectionTotals.protein)}g / Carbs {Math.round(sectionTotals.carbs)}g / Fat{" "}
            {Math.round(sectionTotals.fats)}g
          </Text>
          <MacroComposition title="Meal composition" grams={[sectionTotals.protein, sectionTotals.carbs, sectionTotals.fats]} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Foods</Text>
          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={handleCopyPrevious}
              disabled={quickActionPending}
            >
              <Ionicons name="copy-outline" size={15} color={colors.muted} />
              <Text style={styles.quickActionText}>Copy meal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, sectionMeals.length === 0 && styles.quickActionDisabled]}
              onPress={openSaveMeal}
              disabled={quickActionPending || sectionMeals.length === 0}
            >
              <Ionicons name="bookmark-outline" size={15} color={colors.muted} />
              <Text style={styles.quickActionText}>Save meal</Text>
            </TouchableOpacity>
            {quickActionPending ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          </View>
          {sectionMeals.length === 0 ? <Text style={styles.subText}>No entries yet.</Text> : null}
          {sectionMeals.map((meal) => (
            <ReanimatedSwipeable
              key={meal.id}
              friction={1.2}
              rightThreshold={18}
              overshootRight={false}
              childrenContainerStyle={{ backgroundColor: colors.canvas }}
              renderRightActions={() => (
                <View style={styles.swipeDeleteContainer}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${meal.name}`} style={styles.swipeDeleteButton} onPress={() => handleDeleteMeal(meal)}>
                    <Trash2 size={20} strokeWidth={1.5} color={colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              )}
            >
              <View style={styles.mealRow}>
                <TouchableOpacity style={styles.mealBody} accessibilityRole="button" accessibilityHint="Tap to edit. Long press for delete confirmation, or swipe left to delete." accessibilityActions={[{ name: "delete", label: "Delete food" }]} onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "delete") handleDeleteMeal(meal); }} onLongPress={() => handleDeleteMeal(meal)} onPress={() => void openEditorForMeal(meal)}>
                  <Text style={styles.mealTitle}>{meal.name}</Text>
                  {formatMealQuantity(meal) ? <Text style={styles.subText}>{formatMealQuantity(meal)}</Text> : null}
                  <Text style={styles.subText}>
                    P {meal.proteinGrams ?? 0}g / C {meal.carbGrams ?? 0}g / F {meal.fatGrams ?? 0}g
                  </Text>
                </TouchableOpacity>
                {loggedFoodReference(meal) ? <TouchableOpacity accessibilityLabel={`${favoriteIds.includes(meal.source!.foodId!) ? "Unfavorite" : "Favorite"} ${meal.name}`} accessibilityState={{ selected: favoriteIds.includes(meal.source!.foodId!), disabled: foodPending }} disabled={foodPending} style={styles.iconBtn} onPress={() => void toggleLoggedFavorite(meal)}><Star size={20} strokeWidth={1.5} color={favoriteIds.includes(meal.source!.foodId!) ? colors.accent : colors.muted} fill={favoriteIds.includes(meal.source!.foodId!) ? colors.accent : "none"} /></TouchableOpacity> : null}
                <TouchableOpacity accessibilityLabel={`Move ${meal.name} to another meal`} style={styles.iconBtn} onPress={() => setFoodOptions(meal)}><ArrowRightLeft size={20} strokeWidth={1.5} color={colors.muted} /></TouchableOpacity>
              </View>
            </ReanimatedSwipeable>
          ))}
          {deletedFood ? <View style={[styles.quickActionRow, { paddingVertical: 12 }]}><Text style={[styles.subText, { flex: 1 }]}>{deletedFood.name} deleted</Text><TouchableOpacity disabled={foodPending} style={styles.quickActionBtn} onPress={() => void restoreDeletedFood()}><Text style={styles.quickActionText}>{foodPending ? "Restoring..." : "Undo"}</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="Dismiss deletion message" style={styles.iconBtn} onPress={() => setDeletedFood(null)}><Ionicons name="close" size={20} color={colors.muted} /></TouchableOpacity></View> : null}
          <TouchableOpacity
            style={styles.inlineAddBtn}
            onPress={() => router.push({ pathname: "/nutrition/meal/search", params: { section, date: selectedDateKey } })}
          >
            <Ionicons name="add" size={14} color={colors.ink} />
            <Text style={styles.inlineAddBtnText}>Add items</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={closeEditor}>
        <KeyboardAwareModalFrame style={foodEditorStyles.backdrop} onDismiss={closeEditor}>
          <AdaptiveModalCard contentSized style={foodEditorStyles.card} focusPlacement="start" footer={
              <View style={styles.modalActions}>
                <TouchableOpacity disabled={editorSaving} style={styles.secondaryBtn} onPress={closeEditor}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, !editorFallback && !editorPreview && { opacity: 0.45 }]} disabled={editorSaving || (!editorFallback && !editorPreview)} onPress={() => void saveEditedMeal()}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
          }>
            <View style={foodEditorStyles.content}>
              <Text style={styles.modalTitle}>Edit {editingMeal?.name ?? "meal"}</Text>

              {!editorFallback ? (
                <>
                  <View style={styles.rowWrap}>
                    {ENTRY_MODES.map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.chip, editorMode === mode && styles.chipActive]}
                        disabled={mode === "calories" && (editingMeal?.source?.caloriesPer100g ?? 0) <= 0}
                        onPress={() => changeEditorMode(mode)}
                      >
                        <Text style={[styles.chipText, editorMode === mode && styles.chipTextActive]}>
                          {mode === "grams" ? "Grams" : mode === "calories" ? "Calories" : "Servings"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ gap: 8 }}><Text style={styles.subText}>Amount</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><TextInput disableFullscreenUI
                    style={[styles.input, { flex: 1 }]}
                    selectTextOnFocus
                    accessibilityLabel="Food amount"
                    value={editorValue}
                    onChangeText={changeEditorValue}
                    keyboardType="decimal-pad"
                    placeholder={editorMode === "grams" ? "100" : editorMode === "servings" ? "1" : "200"}
                    placeholderTextColor={colors.muted}
                  /><Text style={styles.subText}>{editorMode === "grams" ? "g" : editorMode === "calories" ? "kcal" : "servings"}</Text></View></View>

                  <NutritionFactsPreview
                    calories={editorPreview?.calories ?? null}
                    proteinGrams={editorPreview?.proteinGrams ?? null}
                    carbGrams={editorPreview?.carbGrams ?? null}
                    fatGrams={editorPreview?.fatGrams ?? null}
                    reference={`Reference: ${normalizeServingInfo(editingMeal?.source?.servingLabel, Number(editingMeal?.source?.servingGrams ?? 0))} / ${Number(editingMeal?.source?.servingGrams ?? 0)}g`}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.subText}>Nutrition for the whole recorded amount. No weight is inferred.</Text>
                  <Text style={styles.subText}>Food name</Text>
                  <TextInput accessibilityLabel="Food name" disableFullscreenUI selectTextOnFocus editable={!editorSaving} style={styles.input} value={manualName} onChangeText={setManualName} maxLength={80} />
                  <View style={styles.editRow}>
                    <Text style={styles.subText}>Calories</Text>
                    <TextInput disableFullscreenUI
                      style={styles.input}
                      value={manualCalories}
                      onChangeText={setManualCalories}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={styles.editRow}>
                    <Text style={styles.subText}>Protein (g)</Text>
                    <TextInput disableFullscreenUI
                      style={styles.input}
                      value={manualProtein}
                      onChangeText={setManualProtein}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={styles.editRow}>
                    <Text style={styles.subText}>Carbs (g)</Text>
                    <TextInput disableFullscreenUI
                      style={styles.input}
                      value={manualCarbs}
                      onChangeText={setManualCarbs}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={styles.editRow}>
                    <Text style={styles.subText}>Fat (g)</Text>
                    <TextInput disableFullscreenUI
                      style={styles.input}
                      value={manualFats}
                      onChangeText={setManualFats}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <NutritionFactsPreview
                    calories={manualCalories.trim() ? Number(manualCalories) : null}
                    proteinGrams={manualProtein.trim() ? Number(manualProtein) : null}
                    carbGrams={manualCarbs.trim() ? Number(manualCarbs) : null}
                    fatGrams={manualFats.trim() ? Number(manualFats) : null}
                  />
                </>
              )}

              {editorError ? <Text accessibilityLiveRegion="polite" style={[styles.subText, { color: colors.danger }]}>{editorError}</Text> : null}

            </View>
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal
        visible={saveMealVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveMealVisible(false)}
      >
        <KeyboardAwareModalFrame style={styles.modalBackdrop} onDismiss={() => { if (!quickActionPending) setSaveMealVisible(false); }}>
          <AdaptiveModalCard contentSized style={styles.modalCard} contentContainerStyle={{ gap: 16 }}>
            <Text style={styles.modalTitle}>Save this meal</Text>
            <Text style={styles.subText}>Save all {sectionMeals.length} items for one-tap logging later.</Text>
            <TextInput disableFullscreenUI
              style={styles.input}
              value={savedMealName}
              onChangeText={setSavedMealName}
              placeholder="Meal name"
              placeholderTextColor={colors.muted}
              autoFocus
              maxLength={60}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSaveMealVisible(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, !savedMealName.trim() && styles.quickActionDisabled]}
                onPress={() => void handleSaveMeal()}
                disabled={!savedMealName.trim() || quickActionPending}
              >
                <Text style={styles.primaryBtnText}>{quickActionPending ? "Saving..." : "Save meal"}</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>
      {deleteCandidate ? <Modal visible transparent animationType="fade" onRequestClose={closeDelete}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop} onDismiss={closeDelete}>
          <AdaptiveModalCard contentSized style={styles.modalCard} contentContainerStyle={{ gap: 20 }}>
            <Text style={styles.modalTitle}>Delete food?</Text>
            <Text style={styles.subText}>Remove {deleteCandidate.name} from {sectionName}? You can undo this after deleting.</Text>
            {deleteError ? <Text accessibilityLiveRegion="polite" style={[styles.subText, { color: colors.danger }]}>{deleteError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity disabled={deletePending} style={[styles.cancelRow, { marginTop: 0, paddingHorizontal: 16 }]} onPress={closeDelete}><Text style={styles.menuText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={deletePending} style={[styles.primaryBtn, { backgroundColor: colors.danger }]} onPress={() => void confirmDelete()}><Text style={styles.primaryBtnText}>{deletePending ? "Deleting..." : "Delete food"}</Text></TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal> : null}
      {foodOptions ? <Modal visible transparent animationType="fade" onRequestClose={() => { if (!foodPending) setFoodOptions(null); }}>
        <KeyboardAwareModalFrame style={styles.modalBackdrop} onDismiss={() => { if (!foodPending) setFoodOptions(null); }}>
          <AdaptiveModalCard contentSized style={styles.modalCard}>
            <Text style={styles.modalTitle}>Move to meal</Text>
            {Array.from(new Set([...configuredSections, ...dayMeals.map(mealSectionId)])).filter((id) => id !== section).map((id) => <TouchableOpacity disabled={foodPending} key={id} style={styles.menuRow} onPress={() => void moveFood(id)}><Text style={styles.menuText}>{mealLabel(id, labels)}</Text></TouchableOpacity>)}
            <TouchableOpacity disabled={foodPending} style={styles.cancelRow} onPress={() => setFoodOptions(null)}><Text style={styles.menuText}>{foodPending ? "Moving..." : "Cancel"}</Text></TouchableOpacity>
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal> : null}
      {renameVisible ? <MealOrganizationEditor uid={uid} section={section} sections={Array.from(new Set([...configuredSections, ...dayMeals.map(mealSectionId)]))} meals={sectionMeals} dateKey={selectedDateKey} initialMode="name" onClose={() => setRenameVisible(false)} /> : null}
      {timeEditorVisible ? <MealOrganizationEditor uid={uid} section={section} sections={[section]} meals={sectionMeals} dateKey={selectedDateKey}
        initialMode="time" onClose={() => setTimeEditorVisible(false)} /> : null}
    </SafeAreaView>
  );
}

const createStyles = (baseColors: NotebookColors) => {
  const colors = nutritionPalette(baseColors);
  return notebookSheet({
  menuRow: { minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule, justifyContent: "center" },
  menuText: { color: colors.ink, fontSize: 16 },
  cancelRow: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center" },
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { width: "100%", maxWidth: 800, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.rule },
  title: { color: colors.ink, fontSize: 20, fontWeight: "600", flexShrink: 1 },
  iconBtn: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 20 },
  card: { backgroundColor: "transparent", borderRadius: 0, borderWidth: 0, borderTopWidth: 1, borderTopColor: colors.rule, paddingHorizontal: 0, paddingVertical: 20, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  summaryCalories: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  subText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  mealBody: { flex: 1, gap: 2 },
  mealTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  swipeDeleteContainer: { justifyContent: "center", alignItems: "flex-end", width: 56 },
  swipeDeleteButton: { width: 48, minHeight: 48, justifyContent: "center", borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: colors.danger },
  inlineAddBtn: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.subtle,
  },
  inlineAddBtnText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  quickActionRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickActionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  quickActionDisabled: { opacity: 0.45 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.overlay },
  modalCard: { width: "100%", maxWidth: 560, padding: 20, gap: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8 },
  modalTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22, marginBottom: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  chipActive: { borderColor: colors.ink, backgroundColor: colors.subtle },
  chipText: { color: colors.muted, fontSize: 16 },
  chipTextActive: { color: colors.ink, fontSize: 16 },
  input: { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, minHeight: 56, padding: 12, fontSize: 16 },
  editRow: { gap: 6 },
  modalActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-end", marginTop: 12 },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, minHeight: 48, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: colors.ink, fontSize: 16 },
  primaryBtn: { backgroundColor: colors.primary, minHeight: 48, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" }
  });
};
