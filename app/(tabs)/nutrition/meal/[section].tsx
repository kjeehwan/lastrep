import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import type { NutritionMeal } from "@/src/contracts";
import {
  deleteMeal,
  formatDateKey,
  parseDateKey,
  subscribeToMealsForDate,
  updateMeal,
} from "@/src/nutrition/meals";
import type { FoodEntryMode, FoodItem } from "@/src/nutrition/foodDb";
import { showAppDialog } from "@/src/ui/appDialog";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";

const ENTRY_MODES: FoodEntryMode[] = ["grams", "calories", "servings"];

type MacroPreview = {
  calories: number;
  proteinGrams: number | null;
  carbGrams: number | null;
  fatGrams: number | null;
  grams: number | null;
  servings: number | null;
};

let foodDbPromise: Promise<typeof import("@/src/nutrition/foodDb")> | null = null;
async function getFoodDb() {
  if (!foodDbPromise) {
    foodDbPromise = import("@/src/nutrition/foodDb");
  }
  return foodDbPromise;
}

function parsePositiveNumber(value: string): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function roundMacro(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || part <= 0 || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

function spreadCenters(raw: number[], minGap = 12): number[] {
  if (raw.length === 0) return [];
  const out = [...raw];
  out[0] = Math.max(0, Math.min(100, out[0]));
  for (let i = 1; i < out.length; i += 1) {
    out[i] = Math.max(out[i], out[i - 1] + minGap);
  }
  if (out[out.length - 1] > 100) {
    out[out.length - 1] = 100;
    for (let i = out.length - 2; i >= 0; i -= 1) {
      out[i] = Math.min(out[i], out[i + 1] - minGap);
    }
  }
  out[0] = Math.max(0, out[0]);
  return out;
}

function formatMealQuantity(meal: NutritionMeal): string | null {
  const source = meal.source;
  if (!source) return null;
  if (
    typeof source.caloriesPer100g !== "number" ||
    !Number.isFinite(source.caloriesPer100g) ||
    source.caloriesPer100g <= 0 ||
    typeof source.servingGrams !== "number" ||
    !Number.isFinite(source.servingGrams) ||
    source.servingGrams <= 0
  ) {
    return null;
  }
  const grams = (meal.calories / source.caloriesPer100g) * 100;
  const servings = grams / source.servingGrams;
  const gramsRounded = Math.max(0, Math.round(grams));
  const servingsRounded = Math.round(servings * 100) / 100;
  return `${meal.calories} kcal / ${gramsRounded}g / ${servingsRounded} servings`;
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
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; date?: string }>();
  const section = decodeURIComponent(params.section ?? "Breakfast");
  const selectedDateKey = typeof params.date === "string" ? params.date : formatDateKey(new Date());
  const selectedDate = parseDateKey(selectedDateKey) ?? new Date();
  const [uid, setUid] = useState<string | null>(null);
  const [dayMeals, setDayMeals] = useState<NutritionMeal[]>([]);
  const [editingMeal, setEditingMeal] = useState<NutritionMeal | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<FoodEntryMode>("grams");
  const [editorValue, setEditorValue] = useState("100");
  const [editorPreview, setEditorPreview] = useState<MacroPreview | null>(null);
  const [editorFallback, setEditorFallback] = useState(false);
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFats, setManualFats] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
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
  }, [uid, selectedDateKey]);

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

  const macroCalories = useMemo(
    () => ({
      protein: sectionTotals.protein * 4,
      carbs: sectionTotals.carbs * 4,
      fats: sectionTotals.fats * 9,
    }),
    [sectionTotals]
  );
  const macroCalorieTotal = macroCalories.protein + macroCalories.carbs + macroCalories.fats;
  const pPct = Math.round(percent(macroCalories.protein, macroCalorieTotal));
  const cPct = Math.round(percent(macroCalories.carbs, macroCalorieTotal));
  const fPct = Math.round(percent(macroCalories.fats, macroCalorieTotal));
  const [pCenter, cCenter, fCenter] = useMemo(() => {
    const p = percent(macroCalories.protein, macroCalorieTotal);
    const c = percent(macroCalories.carbs, macroCalorieTotal);
    const f = percent(macroCalories.fats, macroCalorieTotal);
    const raw = [p / 2, p + c / 2, p + c + f / 2];
    return spreadCenters(raw, 16);
  }, [macroCalories, macroCalorieTotal]);
  const legendItems = useMemo(() => {
    const raw = [
      { key: "p", label: `P ${pPct}%`, pct: pPct, center: pCenter },
      { key: "c", label: `C ${cPct}%`, pct: cPct, center: cCenter },
      { key: "f", label: `F ${fPct}%`, pct: fPct, center: fCenter },
    ].filter((x) => x.pct > 0);
    const spread = spreadCenters(raw.map((x) => x.center), 16);
    return raw.map((item, idx) => ({ ...item, center: spread[idx] }));
  }, [pPct, cPct, fPct, pCenter, cCenter, fCenter]);

  const openEditorForMeal = async (meal: NutritionMeal) => {
    setEditingMeal(meal);
    const modeFromSource = meal.source?.mode;
    const valueFromSource = meal.source?.value;
    const canCompute =
      typeof meal.source?.caloriesPer100g === "number" &&
      Number.isFinite(meal.source.caloriesPer100g) &&
      meal.source.caloriesPer100g > 0 &&
      typeof meal.source?.proteinPer100g === "number" &&
      Number.isFinite(meal.source.proteinPer100g) &&
      typeof meal.source?.servingGrams === "number" &&
      Number.isFinite(meal.source.servingGrams) &&
      meal.source.servingGrams > 0;

    if (canCompute) {
      setEditorFallback(false);
      setEditorMode(
        modeFromSource === "grams" || modeFromSource === "servings" || modeFromSource === "calories"
          ? modeFromSource
          : "grams"
      );
      setEditorValue(valueFromSource && valueFromSource.trim().length > 0 ? valueFromSource : "100");
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
    setEditorPreview(null);
    setEditorVisible(true);
  };

  const handleDeleteMeal = (meal: NutritionMeal) => {
    if (!uid) return;
    showAppDialog({
      title: "Delete food",
      message: `Delete ${meal.name}?`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Delete",
          role: "destructive",
          onPress: async () => {
            await deleteMeal(uid, meal.id);
          },
        },
      ],
    });
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!editingMeal || editorFallback) {
        setEditorPreview(null);
        return;
      }
      const source = editingMeal.source;
      if (
        !source ||
        typeof source.caloriesPer100g !== "number" ||
        !Number.isFinite(source.caloriesPer100g) ||
        source.caloriesPer100g <= 0 ||
        typeof source.proteinPer100g !== "number" ||
        !Number.isFinite(source.proteinPer100g) ||
        typeof source.servingGrams !== "number" ||
        !Number.isFinite(source.servingGrams) ||
        source.servingGrams <= 0
      ) {
        setEditorPreview(null);
        return;
      }

      const modeValue = parsePositiveNumber(editorValue);
      if (!modeValue) {
        setEditorPreview(null);
        return;
      }
      const food: FoodItem = {
        id: source.foodId ?? editingMeal.id,
        name: editingMeal.name,
        aliases: [],
        servingLabel: `${source.servingGrams} g`,
        servingGrams: source.servingGrams,
        caloriesPer100g: source.caloriesPer100g,
        proteinPer100g: source.proteinPer100g,
        carbsPer100g:
          typeof source.carbsPer100g === "number" && Number.isFinite(source.carbsPer100g)
            ? source.carbsPer100g
            : undefined,
        fatPer100g:
          typeof source.fatPer100g === "number" && Number.isFinite(source.fatPer100g)
            ? source.fatPer100g
            : undefined,
      };
      const foodDb = await getFoodDb();
      const computed = foodDb.computeFromFood(food, editorMode, editorValue);
      if (cancelled) return;
      if (!computed) {
        setEditorPreview(null);
        return;
      }
      setEditorPreview({
        calories: Math.round(computed.calories),
        proteinGrams: roundMacro(computed.proteinGrams),
        carbGrams: roundMacro(computed.carbGrams),
        fatGrams: roundMacro(computed.fatGrams),
        grams: typeof computed.grams === "number" && Number.isFinite(computed.grams) ? Math.round(computed.grams) : null,
        servings:
          typeof computed.servings === "number" && Number.isFinite(computed.servings)
            ? Math.round(computed.servings * 100) / 100
            : null,
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [editingMeal, editorFallback, editorMode, editorValue]);

  const saveEditedMeal = async () => {
    if (!uid || !editingMeal) return;
    if (editorFallback) {
      const calories = Number(manualCalories);
      const protein = Number(manualProtein);
      const carbs = Number(manualCarbs);
      const fats = Number(manualFats);
      if (!Number.isFinite(calories) || calories <= 0) return;
      await updateMeal(uid, editingMeal.id, {
        calories: Math.round(calories),
        proteinGrams: Number.isFinite(protein) && protein >= 0 ? Math.round(protein) : null,
        carbGrams: Number.isFinite(carbs) && carbs >= 0 ? Math.round(carbs) : null,
        fatGrams: Number.isFinite(fats) && fats >= 0 ? Math.round(fats) : null,
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
  };

  const closeEditor = () => {
    setEditorVisible(false);
    setEditingMeal(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.replace({ pathname: "/nutrition", params: { date: selectedDateKey } })}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{section}</Text>
          <Text style={styles.subText}>{selectedDateKey}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{section} summary</Text>
          <Text style={styles.summaryCalories}>{sectionTotals.calories} kcal</Text>
          <Text style={styles.subText}>
            Protein {Math.round(sectionTotals.protein)}g / Carbs {Math.round(sectionTotals.carbs)}g / Fat{" "}
            {Math.round(sectionTotals.fats)}g
          </Text>
          <View style={styles.compositionBar}>
            <View
              style={[styles.compositionProtein, { width: `${percent(macroCalories.protein, macroCalorieTotal)}%` }]}
            />
            <View
              style={[styles.compositionCarb, { width: `${percent(macroCalories.carbs, macroCalorieTotal)}%` }]}
            />
            <View style={[styles.compositionFat, { width: `${percent(macroCalories.fats, macroCalorieTotal)}%` }]} />
          </View>
          <View style={styles.legendRow}>
            {legendItems.map((item) => (
              <Text key={item.key} style={[styles.legendText, styles.legendTextAbsolute, { left: `${item.center}%` }]}>
                {item.label}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Foods</Text>
          {sectionMeals.length === 0 ? <Text style={styles.subText}>No entries yet.</Text> : null}
          {sectionMeals.map((meal) => (
            <View key={meal.id} style={styles.mealRow}>
              <TouchableOpacity style={styles.mealBody} onPress={() => void openEditorForMeal(meal)}>
                <Text style={styles.mealTitle}>{meal.name}</Text>
                {formatMealQuantity(meal) ? <Text style={styles.subText}>{formatMealQuantity(meal)}</Text> : null}
                <Text style={styles.subText}>
                  P {meal.proteinGrams ?? 0}g / C {meal.carbGrams ?? 0}g / F {meal.fatGrams ?? 0}g
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteMeal(meal)} style={styles.iconBtnSmall}>
                <Ionicons name="trash-outline" size={17} color="#ff8f8f" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={styles.inlineAddBtn}
            onPress={() => router.push({ pathname: "/nutrition/meal/search", params: { section, date: selectedDateKey } })}
          >
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={styles.inlineAddBtnText}>Add items</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={closeEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit {editingMeal?.name ?? "meal"}</Text>

            {!editorFallback ? (
              <>
                <View style={styles.rowWrap}>
                  {ENTRY_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.chip, editorMode === mode && styles.chipActive]}
                      onPress={() => setEditorMode(mode)}
                    >
                  <Text style={[styles.chipText, editorMode === mode && styles.chipTextActive]}>
                        {mode === "grams" ? "Grams" : mode === "calories" ? "Calories" : "Servings"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.input}
                  value={editorValue}
                  onChangeText={setEditorValue}
                  keyboardType="decimal-pad"
                  placeholder={editorMode === "grams" ? "100" : editorMode === "servings" ? "1" : "200"}
                  placeholderTextColor="#7a7a8c"
                />

                {editorPreview ? (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewText}>
                      {editorPreview.grams ?? 0}g / {editorPreview.calories} kcal /{" "}
                      {normalizeServingInfo(
                        editingMeal?.source?.servingLabel,
                        Number(editingMeal?.source?.servingGrams ?? 0)
                      )}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.subText}>Enter a positive value.</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.subText}>This item uses manual editing.</Text>
                <View style={styles.editRow}>
                  <Text style={styles.subText}>Calories</Text>
                  <TextInput
                    style={styles.input}
                    value={manualCalories}
                    onChangeText={setManualCalories}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#7a7a8c"
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.subText}>Protein (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={manualProtein}
                    onChangeText={setManualProtein}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#7a7a8c"
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.subText}>Carbs (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={manualCarbs}
                    onChangeText={setManualCarbs}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#7a7a8c"
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.subText}>Fat (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={manualFats}
                    onChangeText={setManualFats}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#7a7a8c"
                  />
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={closeEditor}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => void saveEditedMeal()}>
                <Text style={styles.primaryBtnText}>Save</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconBtnSmall: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  summaryCalories: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subText: { color: "#a5acc1", fontSize: 12, lineHeight: 16 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  mealBody: { flex: 1, gap: 2 },
  mealTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  inlineAddBtn: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  inlineAddBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  compositionBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  compositionProtein: { backgroundColor: "#60a5fa", height: "100%" },
  compositionCarb: { backgroundColor: "#34d399", height: "100%" },
  compositionFat: { backgroundColor: "#f59e0b", height: "100%" },
  legendRow: { position: "relative", height: 16, marginTop: 2 },
  legendText: { color: "#cfd3f8", fontSize: 11, fontWeight: "600" },
  legendTextAbsolute: { position: "absolute", transform: [{ translateX: -18 }] },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#171727",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: "rgba(123,97,255,0.25)", borderColor: "#7b61ff" },
  chipText: { color: "#cfd3f8", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  editRow: { gap: 6 },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10,
    gap: 4,
  },
  previewText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
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



