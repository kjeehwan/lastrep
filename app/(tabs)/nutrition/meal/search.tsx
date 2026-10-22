import { normalizeServingInfo } from "@/src/nutrition/servingLabel";
import { ManualFoodEditor } from "@/src/nutrition/components/ManualFoodEditor";
import { type ManualFood } from "@/src/nutrition/manualFood";
import { NotebookHeader } from "@/src/ui/notebook/NotebookHeader";
import { notebookSheet, useNotebookStyles } from "@/src/ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "@/src/ui/notebook/tokens";
import { NotebookModal as Modal } from "@/src/ui/notebook/NotebookModal";
import { nutritionPalette, useNutritionColors } from "@/src/nutrition/notebookPalette";
import { AdaptiveModalCard } from "../../../../src/ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../../../src/ui/KeyboardAwareModalFrame";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import type { NutritionMeal, NutritionSavedMeal } from "@/src/contracts";
import type { FoodEntryMode, FoodItem } from "@/src/nutrition/foodDb";
import {
  createMeal,
  formatDateKey,
  getMealsForDate,
  getRecentMeals,
  parseDateKey,
  updateMeal,
} from "@/src/nutrition/meals";
import { lookupFoodByBarcode } from "@/src/nutrition/barcode";
import {
  addSavedMealToDate,
  deleteSavedMeal,
  getSavedMeals,
} from "@/src/nutrition/quickLog";
import { showAppDialog } from "@/src/ui/appDialog";
import { NutritionFactsPreview } from "@/src/nutrition/components/NutritionFactsPreview";
import { useFoodEditorStyles } from "@/src/nutrition/components/foodEditorStyles";
import { quantityNutrition, quantityGrams, quantityValue, selectedFoodSummary } from "@/src/nutrition/foodQuantity";
import { useMealLabels } from "@/src/nutrition/useMealLabels";
import { initialMealTime, mealLabel, mealSectionId } from "@/src/nutrition/mealOrganization";

type SelectionDraft = {
  key: string;
  food: FoodItem;
  mode: FoodEntryMode;
  value: string;
};

type BrowseTab = "search" | "recent" | "favorites" | "saved";
type FavoriteEntry = { food: FoodItem };

const ENTRY_MODES: FoodEntryMode[] = ["grams", "calories", "servings"];
const FAVORITES_KEY_PREFIX = "nutrition-food-favorites:v1:";

let foodDbPromise: Promise<typeof import("@/src/nutrition/foodDb")> | null = null;
let prewarmPromise: Promise<void> | null = null;

async function getFoodDb() {
  if (!foodDbPromise) {
    foodDbPromise = import("@/src/nutrition/foodDb");
  }
  return foodDbPromise;
}

function formatFoodHelper(food: FoodItem, draft?: SelectionDraft): string {
  const selectedSummary = draft ? selectedFoodSummary(draft) : null;
  if (selectedSummary) return selectedSummary;
  const servingGrams = Math.round(food.servingGrams);
  const servingCalories = Math.round((food.caloriesPer100g * food.servingGrams) / 100);
  const servingText = normalizeServingInfo(food.servingLabel, food.servingGrams);
  return `${servingGrams}g / ${servingCalories} kcal / ${servingText}`;
}

function normalizeName(text: string): string {
  return text.trim().toLowerCase();
}

function roundServing(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatServingQuantity(servings: number, servingInfo: string): string {
  const s = roundServing(servings);
  const singular = Math.abs(s - 1) < 1e-9;
  if (servingInfo === "1 serving") return `${s} ${singular ? "serving" : "servings"}`;
  return `${s} x ${servingInfo}`;
}


export default function MealSearchScreen() {
  const colors = useNutritionColors();
  const foodEditorStyles = useFoodEditorStyles();
  const styles = useNotebookStyles(createStyles);

  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; date?: string }>();
  const section = decodeURIComponent(params.section ?? "Breakfast");
  const selectedDateKey = typeof params.date === "string" ? params.date : formatDateKey(new Date());
  const selectedDate = parseDateKey(selectedDateKey) ?? new Date();
  const goToSection = useCallback(
    () => {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace({ pathname: "/nutrition/meal/[section]", params: { section, date: selectedDateKey } });
    },
    [router, section, selectedDateKey]
  );

  const [uid, setUid] = useState<string | null>(null);
  const { labels } = useMealLabels(uid, selectedDateKey);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchNonce, setSearchNonce] = useState(0);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [staged, setStaged] = useState<Record<string, SelectionDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [manualFoodVisible, setManualFoodVisible] = useState(false);
  const [manualFoodMessage, setManualFoodMessage] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<FoodEntryMode>("grams");
  const [editorValue, setEditorValue] = useState("100");
  const editorGramsRef = useRef<number | null>(null);
  const [editorFood, setEditorFood] = useState<FoodItem | null>(null);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const editorNutrition = useMemo(() => editorFood ? quantityNutrition(editorValue, editorMode, editorFood) : null, [editorFood, editorValue, editorMode]);
  const editorPreview = editorNutrition ? `${Number(editorNutrition.grams.toFixed(2))}g / ${Math.round(editorNutrition.calories)} kcal / ${formatServingQuantity(editorNutrition.servings, "1 serving")}` : "Enter a positive amount";
  const [tab, setTab] = useState<BrowseTab>("search");
  const [recentMeals, setRecentMeals] = useState<NutritionMeal[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [foodById, setFoodById] = useState<Record<string, FoodItem>>({});
  const [savedMeals, setSavedMeals] = useState<NutritionSavedMeal[]>([]);
  const [savedMealPendingId, setSavedMealPendingId] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [cameraPermission, requestCameraPermission, getCameraPermission] = useCameraPermissions();
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void getCameraPermission(); });
    return () => subscription.remove();
  }, [getCameraPermission]);
  const scannerLockedRef = useRef(false);

  const favoriteKey = uid ? `${FAVORITES_KEY_PREFIX}${uid}` : null;
  const stagedItems = useMemo(() => Object.values(staged), [staged]);
  const stagedCount = stagedItems.length;
  const canSearch = query.trim().length >= 2;
  const favoriteIds = useMemo(() => new Set(favorites.map((x) => x.food.id)), [favorites]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      if (!user) router.replace("/auth/sign-in");
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const foodDb = await getFoodDb();
        if (!prewarmPromise) prewarmPromise = foodDb.prewarmFoodSearch().catch(error => { prewarmPromise = null; throw error; });
        await prewarmPromise;
      } catch (error) {
        if (!cancelled) console.log("Food search prewarm failed", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getRecentMeals(uid, 30);
        if (!cancelled) setRecentMeals(rows);
      } catch (error) {
        if (!cancelled) console.log("Failed to load recent meals", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const refreshSavedMeals = useCallback(async () => {
    if (!uid) {
      setSavedMeals([]);
      return;
    }
    try {
      setSavedMeals(await getSavedMeals(uid));
    } catch (error) {
      console.log("Failed to load saved meals", error);
    }
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!uid) return;
      try {
        const rows = await getSavedMeals(uid);
        if (!cancelled) setSavedMeals(rows);
      } catch (error) {
        if (!cancelled) console.log("Failed to load saved meals", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = recentMeals
        .map((meal) => String(meal.source?.foodId ?? "").trim())
        .filter((id) => id.length > 0)
        .filter((id, idx, arr) => arr.indexOf(id) === idx);
      if (ids.length === 0) {
        if (!cancelled) setFoodById({});
        return;
      }
      try {
        const foodDb = await getFoodDb();
        const rows = await foodDb.getFoodsByIdsAsync(ids);
        if (cancelled) return;
        const next: Record<string, FoodItem> = {};
        for (const row of rows) {
          next[row.id] = row;
        }
        setFoodById(next);
      } catch (error) {
        if (!cancelled) {
          console.log("Failed to hydrate food labels for recent meals", error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recentMeals]);

  useEffect(() => {
    if (!favoriteKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(favoriteKey);
        if (cancelled) return;
        if (!raw) {
          setFavorites([]);
          return;
        }
        const parsed = JSON.parse(raw) as FavoriteEntry[];
        setFavorites(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (!cancelled) setFavorites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [favoriteKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (submittedQuery.trim().length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        const foodDb = await getFoodDb();
        const next = await foodDb.searchFoodsAsync(submittedQuery, 20);
        if (!cancelled) setSearchResults(next);
      } catch {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError("Couldn't search foods. Tap Search to try again.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submittedQuery, searchNonce]);

  useFocusEffect(
    React.useCallback(() => {
      setQuery("");
      setSubmittedQuery("");
      setSearchResults([]);
      setSearchError(null);
      setSearchNonce(0);
      setSearching(false);
      setStaged({});
      setTab("search");
      const onBackPress = () => {
        goToSection();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => {
        sub.remove();
      };
    }, [goToSection])
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!editorVisible) return undefined;
      const onBackPress = () => {
        setEditorVisible(false);
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => {
        sub.remove();
      };
    }, [editorVisible, setEditorVisible])
  );

  const recentGroups = useMemo(() => {
    // Keep only the most recent record per food identity.
    const latestByFood = new Map<string, NutritionMeal>();
    for (const meal of recentMeals) {
      const foodIdKey = String(meal.source?.foodId ?? "").trim();
      const identity =
        foodIdKey.length > 0 ? `id:${foodIdKey}` : `name:${normalizeName(meal.name)}`;
      const current = latestByFood.get(identity);
      if (!current || meal.loggedAt.toMillis() > current.loggedAt.toMillis()) {
        latestByFood.set(identity, meal);
      }
    }

    const grouped = new Map<string, NutritionMeal[]>();
    for (const meal of latestByFood.values()) {
      const d = meal.loggedAt?.toDate?.() ?? new Date();
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = grouped.get(key) ?? [];
      existing.push(meal);
      grouped.set(key, existing);
    }
    return [...grouped.entries()]
      .map(([key, rows]) => {
      const date = rows[0].loggedAt.toDate();
      const today = new Date();
      const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayDiff = Math.round((startToday - startDate) / 86400000);
      let label = `${date.toLocaleString("en-US", { month: "short" })} ${date.getDate()}`;
      if (dayDiff === 0) label = "Today";
      if (dayDiff === 1) label = "Yesterday";
      return { key, label, rows, startDate, dayDiff };
      })
      .filter((group) =>
        group.rows.some((meal) => {
          const src = meal.source;
          return (
            !!src &&
            typeof src.servingGrams === "number" &&
            Number.isFinite(src.servingGrams) &&
            src.servingGrams > 0 &&
            typeof src.caloriesPer100g === "number" &&
            Number.isFinite(src.caloriesPer100g) &&
            src.caloriesPer100g > 0 &&
            typeof src.proteinPer100g === "number" &&
            Number.isFinite(src.proteinPer100g)
          );
        })
      )
      .sort((a, b) => {
        if (a.dayDiff === 0 && b.dayDiff !== 0) return -1;
        if (b.dayDiff === 0 && a.dayDiff !== 0) return 1;
        if (a.dayDiff === 1 && b.dayDiff > 1) return -1;
        if (b.dayDiff === 1 && a.dayDiff > 1) return 1;
        return b.startDate - a.startDate;
      });
  }, [recentMeals]);

  const toFoodItemFromMeal = (meal: NutritionMeal): FoodItem | null => {
    const src = meal.source;
    if (
      !src ||
      typeof src.servingGrams !== "number" ||
      !Number.isFinite(src.servingGrams) ||
      src.servingGrams <= 0 ||
      typeof src.caloriesPer100g !== "number" ||
      !Number.isFinite(src.caloriesPer100g) ||
      src.caloriesPer100g <= 0 ||
      typeof src.proteinPer100g !== "number" ||
      !Number.isFinite(src.proteinPer100g)
    ) {
      return null;
    }
    const resolvedId = src.foodId ?? `meal:${meal.id}`;
    const dbFood = src.foodId ? foodById[src.foodId] : undefined;
    const sourceLabel = String(src.servingLabel ?? "").trim();
    const dbLabel = String(dbFood?.servingLabel ?? "").trim();
    const normalizedSource = normalizeServingInfo(sourceLabel, src.servingGrams);
    const normalizedDb = normalizeServingInfo(dbLabel, src.servingGrams);
    const effectiveServingLabel =
      normalizedSource !== "1 serving"
        ? sourceLabel
        : normalizedDb !== "1 serving"
        ? dbLabel
        : sourceLabel || dbLabel || `${src.servingGrams} g`;

    return {
      id: resolvedId,
      barcode: src.barcode ?? dbFood?.barcode,
      name: meal.name,
      aliases: [],
      servingLabel: effectiveServingLabel,
      servingGrams: src.servingGrams,
      caloriesPer100g: src.caloriesPer100g,
      proteinPer100g: src.proteinPer100g,
      carbsPer100g: typeof src.carbsPer100g === "number" ? src.carbsPer100g : undefined,
      fatPer100g: typeof src.fatPer100g === "number" ? src.fatPer100g : undefined,
    };
  };

  const toggleStaged = (key: string, food: FoodItem) => {
    setStaged((prev) => {
      if (prev[key]) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: { key, food, mode: "servings", value: "1" } };
    });
  };

  const openEditor = (key: string, food: FoodItem) => {
    const existing = staged[key];
    const mode = existing?.mode ?? "grams";
    const value = existing?.value ?? quantityValue(food.servingGrams, "grams", food);
    editorGramsRef.current = quantityGrams(value, mode, food);
    setEditorFood(food);
    setEditorKey(key);
    setEditorMode(mode);
    setEditorValue(value);
    setEditorVisible(true);
  };

  const handleEditorModeChange = (nextMode: FoodEntryMode) => {
    if (!editorFood || nextMode === editorMode) return;
    if (nextMode === "calories" && !(editorFood.caloriesPer100g > 0)) return;
    setEditorValue(quantityValue(editorGramsRef.current, nextMode, editorFood));
    setEditorMode(nextMode);
  };

  const handleEditorValueChange = (value: string) => {
    setEditorValue(value);
    editorGramsRef.current = editorFood ? quantityGrams(value, editorMode, editorFood) : null;
  };

  const confirmEditor = () => {
    if (!editorFood) {
      setEditorVisible(false);
      return;
    }
    if (!editorKey) {
      setEditorVisible(false);
      return;
    }
    setStaged((prev) => ({
      ...prev,
      [editorKey]: { key: editorKey, food: editorFood, mode: editorMode, value: editorValue },
    }));
    setEditorVisible(false);
  };

  const toggleFavorite = (food: FoodItem) => {
    if (!favoriteKey) return;
    setFavorites((prev) => {
      const exists = prev.some((x) => x.food.id === food.id);
      const next = exists ? prev.filter((x) => x.food.id !== food.id) : [{ food }, ...prev];
      AsyncStorage.setItem(favoriteKey, JSON.stringify(next.slice(0, 200))).catch(() => {});
      return next.slice(0, 200);
    });
  };

  const clearSearchState = () => {
    setQuery("");
    setSubmittedQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSearching(false);
  };

  const runSearch = () => {
    if (!canSearch) return;
    setSearching(true);
    setSearchError(null);
    setSubmittedQuery(query.trim());
    setSearchNonce((n) => n + 1);
  };

  const lookupBarcode = async (barcode: string) => {
    if (scannerLockedRef.current) return;
    scannerLockedRef.current = true;
    setScannerBusy(true);
    setScannerMessage("Looking up product...");
    try {
      const food = await lookupFoodByBarcode(barcode);
      if (!food) {
          setScannerMessage("This barcode is not in our product database. Search by name or try another item.");
        return;
      }
      setScannerVisible(false);
      setScannerMessage("");
      setManualBarcode("");
      openEditor(`barcode:${food.barcode ?? food.id}`, food);
    } catch (error) {
      console.log("Barcode lookup failed", error);
      setScannerMessage(
        error instanceof Error && error.message === "invalid_barcode"
          ? "Enter a valid 8-14 digit barcode."
          : "Could not look up this barcode. Check your connection and try again."
      );
    } finally {
      scannerLockedRef.current = false;
      setScannerBusy(false);
    }
  };

  const openScanner = async () => {
    scannerLockedRef.current = false;
    setScannerMessage("");
    setManualBarcode("");
    setScannerVisible(true);
    if (!cameraPermission?.granted && cameraPermission?.canAskAgain !== false) {
      await requestCameraPermission();
    }
    setScannerVisible(true);
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (!scannerBusy) void lookupBarcode(data);
  };

  const handleAddSavedMeal = async (savedMeal: NutritionSavedMeal) => {
    if (!uid || savedMealPendingId) return;
    setSavedMealPendingId(savedMeal.id);
    try {
      await addSavedMealToDate(uid, savedMeal, section, selectedDate);
      goToSection();
    } catch (error) {
      console.log("Failed to add saved meal", error);
      showAppDialog({
        title: "Could not add saved meal",
        message: "Check your connection and try again.",
        buttons: [{ text: "OK" }],
      });
    } finally {
      setSavedMealPendingId(null);
    }
  };

  const handleDeleteSavedMeal = (savedMeal: NutritionSavedMeal) => {
    if (!uid) return;
    showAppDialog({
      title: "Delete saved meal",
      message: `Delete ${savedMeal.name}? Logged meals will not be affected.`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Delete",
          role: "destructive",
          onPress: async () => {
            await deleteSavedMeal(uid, savedMeal.id);
            await refreshSavedMeals();
          },
        },
      ],
    });
  };

  const saveManualFood = async (food: ManualFood) => {
    if (!uid) throw new Error("Not signed in");
    const now = new Date();
    await createMeal(uid, { ...food, source: null, mealSection: section,
      loggedAt: Timestamp.fromDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), now.getHours(), now.getMinutes())), updatedAt: Timestamp.now() });
    if (stagedCount === 0) goToSection();
    else setManualFoodMessage(`Added ${food.name} to ${mealLabel(section, labels)}. Your other selections are kept until you tap Add.`);
  };

  const commitStaged = async () => {
    if (!uid || submitting) return;
    const entries = Object.values(staged);
    if (entries.length === 0) {
      goToSection();
      return;
    }
    setSubmitting(true);
    try {
      const foodDb = await getFoodDb();
      const targetMeals = await getMealsForDate(uid, selectedDate);
      const mealTimeMinutes = initialMealTime(targetMeals.filter((meal) => mealSectionId(meal) === section));
      for (const entry of entries) {
        const converted = foodDb.computeFromFood(entry.food, entry.mode, entry.value);
        if (!converted) continue;
        const now = Timestamp.now();
        const loggedAt = Timestamp.fromDate(
          new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            new Date().getHours(),
            new Date().getMinutes(),
            0,
            0
          )
        );
        const existing = targetMeals.find((meal) => {
          const sameSection = (meal.mealSection?.trim() || "Breakfast") === section;
          if (!sameSection) return false;
          if (meal.source?.foodId && meal.source.foodId === entry.food.id) return true;
          return normalizeName(meal.name) === normalizeName(entry.food.name);
        });

        const baseSource = {
          foodId: entry.food.id,
          barcode: entry.food.barcode ?? null,
          servingLabel: entry.food.servingLabel,
          servingGrams: entry.food.servingGrams,
          caloriesPer100g: entry.food.caloriesPer100g,
          proteinPer100g: entry.food.proteinPer100g,
          carbsPer100g:
            typeof entry.food.carbsPer100g === "number" && Number.isFinite(entry.food.carbsPer100g)
              ? entry.food.carbsPer100g
              : null,
          fatPer100g:
            typeof entry.food.fatPer100g === "number" && Number.isFinite(entry.food.fatPer100g)
              ? entry.food.fatPer100g
              : null,
          mode: entry.mode,
          value: entry.value,
        };

        if (!existing) {
          await createMeal(uid, {
            name: entry.food.name,
            calories: Math.round(converted.calories),
            proteinGrams: Math.round(converted.proteinGrams),
            carbGrams:
              typeof converted.carbGrams === "number" && Number.isFinite(converted.carbGrams)
                ? Math.round(converted.carbGrams)
                : null,
            fatGrams:
              typeof converted.fatGrams === "number" && Number.isFinite(converted.fatGrams)
                ? Math.round(converted.fatGrams)
                : null,
            mealSection: section,
            loggedAt,
            updatedAt: now,
            source: baseSource,
          } as any, targetMeals);
          targetMeals.unshift({
            id: `local-${entry.food.id}-${now.seconds}`,
            mealTimeMinutes,
            name: entry.food.name,
            calories: Math.round(converted.calories),
            proteinGrams: Math.round(converted.proteinGrams),
            carbGrams:
              typeof converted.carbGrams === "number" && Number.isFinite(converted.carbGrams)
                ? Math.round(converted.carbGrams)
                : null,
            fatGrams:
              typeof converted.fatGrams === "number" && Number.isFinite(converted.fatGrams)
                ? Math.round(converted.fatGrams)
                : null,
            mealSection: section,
            loggedAt,
            updatedAt: now,
            source: baseSource as any,
          });
          continue;
        }

        const nextCalories = Math.round((existing.calories || 0) + converted.calories);
        const nextProtein = Math.round((existing.proteinGrams || 0) + converted.proteinGrams);
        const nextCarbs =
          typeof converted.carbGrams === "number" && Number.isFinite(converted.carbGrams)
            ? Math.round((existing.carbGrams || 0) + converted.carbGrams)
            : existing.carbGrams ?? null;
        const nextFats =
          typeof converted.fatGrams === "number" && Number.isFinite(converted.fatGrams)
            ? Math.round((existing.fatGrams || 0) + converted.fatGrams)
            : existing.fatGrams ?? null;

        const existingGrams =
          typeof existing.source?.caloriesPer100g === "number" &&
          Number.isFinite(existing.source.caloriesPer100g) &&
          existing.source.caloriesPer100g > 0
            ? (existing.calories / existing.source.caloriesPer100g) * 100
            : null;
        const addedGrams =
          typeof converted.grams === "number" && Number.isFinite(converted.grams) ? converted.grams : null;
        const mergedGrams =
          typeof existingGrams === "number" && Number.isFinite(existingGrams) && typeof addedGrams === "number"
            ? existingGrams + addedGrams
            : null;

        await updateMeal(uid, existing.id, {
          name: entry.food.name,
          calories: nextCalories,
          proteinGrams: nextProtein,
          carbGrams: nextCarbs,
          fatGrams: nextFats,
          mealSection: section,
          loggedAt: existing.loggedAt,
          updatedAt: now,
          source: {
            ...baseSource,
            mode: mergedGrams != null ? "grams" : entry.mode,
            value: mergedGrams != null ? `${Math.round(mergedGrams)}` : entry.value,
          },
        } as any);

        existing.calories = nextCalories;
        existing.proteinGrams = nextProtein;
        existing.carbGrams = nextCarbs;
        existing.fatGrams = nextFats;
        existing.updatedAt = now;
        existing.source = {
          ...baseSource,
          mode: mergedGrams != null ? "grams" : entry.mode,
          value: mergedGrams != null ? `${Math.round(mergedGrams)}` : entry.value,
        } as any;
      }
      goToSection();
    } catch (error) {
      console.log("Failed to commit staged foods", error);
      showAppDialog({ title: "Could not add all foods", message: "Check the meal before trying again; some items may already have been saved.", buttons: [{ text: "OK" }] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <NotebookHeader title={`Add to ${mealLabel(section, labels)}`} onBack={goToSection} action={submitting ? "Saving..." : `Add (${stagedCount})`} onAction={commitStaged} disabled={submitting || stagedCount === 0} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { borderTopWidth: 0, paddingTop: 0 }]}>
          <Text style={[styles.subText, { textAlign: "center" }]}>{(parseDateKey(selectedDateKey) ?? new Date()).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text>
          <View style={styles.searchInlineRow}>
            <View style={[styles.input, { flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 0, paddingRight: 0 }]}><TextInput disableFullscreenUI
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, { color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16, minHeight: 54, paddingVertical: 12 }]}
              placeholder="Search food"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              onSubmitEditing={runSearch}
            />
            {query.length > 0 ? (
              <TouchableOpacity accessibilityLabel="Clear food search" style={styles.clearBtn} onPress={clearSearchState}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
            </View>
            <TouchableOpacity
              accessibilityLabel="Search foods"
              style={[styles.searchIconBtn, !canSearch && styles.searchBtnDisabled]}
              onPress={runSearch}
              disabled={!canSearch}
            >
              <Ionicons name="search" size={20} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Scan barcode" style={styles.searchIconBtn} onPress={() => void openScanner()}>
              <Ionicons name="barcode-outline" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualFoodVisible(true)}><Text style={styles.secondaryBtnText}>Enter food manually</Text></TouchableOpacity>
          {manualFoodMessage ? <Text accessibilityLiveRegion="polite" style={styles.subText}>{manualFoodMessage}</Text> : null}
          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tabBtn, tab === "search" && styles.tabBtnActive]} onPress={() => setTab("search")}>
              <Text style={[styles.tabText, tab === "search" && styles.tabTextActive]}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === "recent" && styles.tabBtnActive]} onPress={() => setTab("recent")}>
              <Text style={[styles.tabText, tab === "recent" && styles.tabTextActive]}>Recent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === "favorites" && styles.tabBtnActive]} onPress={() => setTab("favorites")}>
              <Text style={[styles.tabText, tab === "favorites" && styles.tabTextActive]}>Favorites</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === "saved" && styles.tabBtnActive]} onPress={() => setTab("saved")}>
              <Text style={[styles.tabText, tab === "saved" && styles.tabTextActive]}>Saved meals</Text>
            </TouchableOpacity>
          </View>

          {stagedItems.length > 0 ? (
            <View style={styles.selectedBlock}>
              <Text style={styles.selectedTitle}>Selected</Text>
              <View style={styles.selectedWrap}>
                {stagedItems.map((entry) => (
                  <View key={entry.key} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText} numberOfLines={1}>
                      {entry.food.name}
                    </Text>
                    <TouchableOpacity style={styles.selectedChipRemove} onPress={() => toggleStaged(entry.key, entry.food)}>
                      <Ionicons name="close" size={14} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {tab === "search" && !canSearch ? <Text style={styles.subText}>Type at least 2 characters or scan a barcode.</Text> : null}
          {tab === "search" && searching ? <Text style={styles.subText}>Searching...</Text> : null}
          {tab === "search" && searchError ? <Text style={styles.subText}>{searchError}</Text> : null}
          {!searching && !searchError && tab === "search" && submittedQuery.trim().length >= 2 && searchResults.length === 0 ? (
            <Text style={styles.subText}>No matching foods in the current database. Try another food name, scan a barcode, or choose Enter food manually.</Text>
          ) : null}

          {tab === "search" &&
            searchResults.map((item) => {
              const stageKey = `food:${item.id}`;
              const selected = Boolean(staged[stageKey]);
              const favored = favoriteIds.has(item.id);
              return (
                <TouchableOpacity key={item.id} style={styles.searchRow} onPress={() => openEditor(stageKey, item)}>
                  <TouchableOpacity onPress={() => toggleStaged(stageKey, item)} accessibilityLabel={`Select ${item.name}`} style={styles.checkboxWrap}>
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected ? colors.accent : colors.muted}
                    />
                  </TouchableOpacity>
                  <View style={styles.searchBody}>
                    <Text style={styles.searchTitle}>{item.name}</Text>
                    <Text style={styles.subText}>{formatFoodHelper(item, staged[stageKey])}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFavorite(item)}>
                    <Ionicons name={favored ? "star" : "star-outline"} size={18} color={favored ? colors.accent : colors.muted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

          {tab === "recent" &&
            recentGroups.map((group) => (
              <View key={group.key} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                {group.rows.map((meal) => {
                  const food = toFoodItemFromMeal(meal);
                  if (!food) return null;
                  const stageKey = `recent:${meal.id}`;
                  const selected = Boolean(staged[stageKey]);
                  const favored = favoriteIds.has(food.id);
                  return (
                    <TouchableOpacity key={meal.id} style={styles.searchRow} onPress={() => openEditor(stageKey, food)}>
                      <TouchableOpacity onPress={() => toggleStaged(stageKey, food)} style={styles.checkboxWrap}>
                        <Ionicons
                          name={selected ? "checkbox" : "square-outline"}
                          size={20}
                          color={selected ? colors.accent : colors.muted}
                        />
                      </TouchableOpacity>
                      <View style={styles.searchBody}>
                        <Text style={styles.searchTitle}>{meal.name}</Text>
                        <Text style={styles.subText}>{formatFoodHelper(food, staged[stageKey])}</Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleFavorite(food)}>
                        <Ionicons name={favored ? "star" : "star-outline"} size={18} color={favored ? "#ffd166" : colors.muted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          {tab === "recent" && recentGroups.length === 0 ? (
            <Text style={styles.subText}>No recently added foods yet. Add foods to see them here.</Text>
          ) : null}

          {tab === "favorites" &&
            favorites.map(({ food }) => {
              const stageKey = `food:${food.id}`;
              const selected = Boolean(staged[stageKey]);
              return (
                <TouchableOpacity key={food.id} style={styles.searchRow} onPress={() => openEditor(stageKey, food)}>
                  <TouchableOpacity onPress={() => toggleStaged(stageKey, food)} style={styles.checkboxWrap}>
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected ? colors.accent : colors.muted}
                    />
                  </TouchableOpacity>
                  <View style={styles.searchBody}>
                    <Text style={styles.searchTitle}>{food.name}</Text>
                    <Text style={styles.subText}>{formatFoodHelper(food, staged[stageKey])}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFavorite(food)}>
                    <Ionicons name="star" size={18} color={colors.accent} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          {tab === "favorites" && favorites.length === 0 ? (
            <Text style={styles.subText}>No favorites yet. Tap the star on a food to save it here.</Text>
          ) : null}

          {tab === "saved" &&
            savedMeals.map((savedMeal) => {
              const calories = savedMeal.items.reduce((sum, item) => sum + item.calories, 0);
              return (
                <View key={savedMeal.id} style={styles.savedMealRow}>
                  <TouchableOpacity
                    style={styles.searchBody}
                    onPress={() => void handleAddSavedMeal(savedMeal)}
                    disabled={savedMealPendingId != null}
                  >
                    <Text style={styles.searchTitle}>{savedMeal.name}</Text>
                    <Text style={styles.subText}>
                      {savedMeal.items.length} item{savedMeal.items.length === 1 ? "" : "s"} / {Math.round(calories)} kcal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.savedAddBtn}
                    onPress={() => void handleAddSavedMeal(savedMeal)}
                    disabled={savedMealPendingId != null}
                  >
                    <Text style={styles.savedAddText}>
                      {savedMealPendingId === savedMeal.id ? "Adding..." : "Add"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.savedDeleteBtn} onPress={() => handleDeleteSavedMeal(savedMeal)}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}
          {tab === "saved" && savedMeals.length === 0 ? (
            <Text style={styles.subText}>No saved meals yet. Save a logged meal from its meal section.</Text>
          ) : null}

          <Text style={styles.subText}>{stagedCount} selected</Text>
        </View>
      </ScrollView>

      {manualFoodVisible ? <ManualFoodEditor onClose={() => setManualFoodVisible(false)} onSave={saveManualFood} /> : null}
      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={() => setEditorVisible(false)}>
        <KeyboardAwareModalFrame style={foodEditorStyles.backdrop} onDismiss={() => setEditorVisible(false)}>
          <AdaptiveModalCard contentSized style={foodEditorStyles.card} focusPlacement="start" footer={
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditorVisible(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, !editorNutrition && { opacity: 0.45 }]} disabled={!editorNutrition} onPress={confirmEditor}>
                  <Text style={styles.primaryBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
          }>
            <View style={foodEditorStyles.content}>
              <Text style={styles.modalTitle}>{editorFood?.name ?? "Edit"}</Text>
              <View style={styles.rowWrap}>
                {ENTRY_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.chip, editorMode === mode && styles.chipActive]}
                    disabled={mode === "calories" && (editorFood?.caloriesPer100g ?? 0) <= 0}
                    onPress={() => handleEditorModeChange(mode)}
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
                onChangeText={handleEditorValueChange}
                keyboardType="decimal-pad"
                placeholder={
                  editorFood
                    ? editorMode === "grams"
                      ? `${Math.round(editorFood.servingGrams)}g`
                      : editorMode === "calories"
                      ? `${Math.round((editorFood.caloriesPer100g * editorFood.servingGrams) / 100)} kcal`
                      : "1 serving"
                    : "100"
                }
                placeholderTextColor={colors.muted}
              /><Text style={styles.subText}>{editorMode === "grams" ? "g" : editorMode === "calories" ? "kcal" : "servings"}</Text></View></View>
              {editorFood ? <Text style={[styles.subText, { minHeight: 42 }]}>{editorPreview}</Text> : null}
              {editorFood ? (
                <NutritionFactsPreview
                  calories={editorNutrition?.calories ?? null}
                  proteinGrams={editorNutrition?.proteinGrams ?? null}
                  carbGrams={editorNutrition?.carbGrams ?? null}
                  fatGrams={editorNutrition?.fatGrams ?? null}
                  reference={`Reference: ${normalizeServingInfo(editorFood.servingLabel, editorFood.servingGrams)} / ${Math.round(editorFood.servingGrams)}g`}
                />
              ) : null}

            </View>
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>

      <Modal
        visible={scannerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScannerVisible(false)}
      >
        <KeyboardAwareModalFrame style={styles.modalBackdrop} onDismiss={() => setScannerVisible(false)}>
          <AdaptiveModalCard contentSized style={styles.scannerCard} contentContainerStyle={{ gap: 16 }}>
            <View style={styles.scannerHeader}>
              <View style={styles.searchBody}>
                <Text style={styles.modalTitle}>Scan packaged food</Text>
                <Text style={styles.subText}>Center an EAN or UPC barcode in the frame.</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setScannerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>
            {cameraPermission?.granted ? (
              <View style={styles.cameraFrame}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
                  onBarcodeScanned={scannerBusy ? undefined : handleBarcodeScanned}
                />
                <View style={styles.scanGuide} />
              </View>
            ) : (
              <View style={styles.permissionPanel}>
                <Ionicons name="camera-outline" size={28} color={colors.muted} />
                <Text style={styles.subText}>Camera access is off. Allow access to scan, or enter the barcode below.</Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => cameraPermission?.canAskAgain === false ? void Linking.openSettings() : void requestCameraPermission()}><Text style={styles.secondaryBtnText}>{cameraPermission?.canAskAgain === false ? "Open camera settings" : "Allow camera access"}</Text></TouchableOpacity>
              </View>
            )}
            {scannerMessage ? <><Text style={styles.scannerMessage}>{scannerMessage}</Text><TouchableOpacity disabled={scannerBusy} style={styles.secondaryBtn} onPress={() => { setScannerVisible(false); setManualFoodVisible(true); }}><Text style={styles.secondaryBtnText}>Enter food manually</Text></TouchableOpacity></> : null}
            <View style={styles.searchInlineRow}>
              <TextInput disableFullscreenUI
                style={[styles.input, styles.searchInput]}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                keyboardType="number-pad"
                placeholder="Enter barcode"
                placeholderTextColor={colors.muted}
                onSubmitEditing={() => void lookupBarcode(manualBarcode)}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (!manualBarcode.trim() || scannerBusy) && styles.searchBtnDisabled]}
                onPress={() => void lookupBarcode(manualBarcode)}
                disabled={!manualBarcode.trim() || scannerBusy}
              >
                <Text style={styles.primaryBtnText}>Look up</Text>
              </TouchableOpacity>
            </View>
          </AdaptiveModalCard>
        </KeyboardAwareModalFrame>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (baseColors: NotebookColors) => {
  const colors = nutritionPalette(baseColors);
  return notebookSheet({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { width: "100%", maxWidth: 800, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.rule },
  iconBtn: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "600", flexShrink: 1 },
  nextBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  nextText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 20 },
  card: { backgroundColor: "transparent", borderRadius: 0, borderWidth: 0, borderTopWidth: 1, borderTopColor: colors.rule, paddingHorizontal: 0, paddingVertical: 20, gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  searchInlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1 },
  clearBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  searchIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabBtn: { flexGrow: 1, flexBasis: "20%", minWidth: 60, borderBottomWidth: 2, borderBottomColor: "transparent", minHeight: 48, paddingHorizontal: 4, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  tabBtnActive: { borderBottomColor: colors.accent },
  tabText: { fontSize: 14, textAlign: "center", color: colors.muted },
  tabTextActive: { color: colors.ink },
  input: { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, minHeight: 56, padding: 12, fontSize: 16 },
  searchBtnDisabled: { opacity: 0.45 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkboxWrap: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  searchBody: { flex: 1, gap: 1 },
  searchTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  savedMealRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 },
  savedAddBtn: { borderRadius: 9, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8 },
  savedAddText: { color: colors.onPrimary, fontSize: 12, fontWeight: "800" },
  savedDeleteBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  groupBlock: { gap: 4 },
  groupTitle: { color: colors.ink, fontSize: 12, fontWeight: "700", marginTop: 6 },
  selectedBlock: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    borderRadius: 10,
    padding: 8,
    backgroundColor: colors.subtle,
  },
  selectedTitle: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  selectedWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 6,
    maxWidth: "100%",
  },
  selectedChipText: { color: colors.ink, fontSize: 12, fontWeight: "600", maxWidth: 180 },
  selectedChipRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
  },
  subText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.overlay },
  scannerCard: { width: "100%", maxWidth: 560, padding: 20, gap: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8 },
  scannerHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cameraFrame: { height: 250, borderRadius: 14, overflow: "hidden", backgroundColor: colors.subtle },
  scanGuide: {
    position: "absolute",
    left: 28,
    right: 28,
    top: 86,
    height: 78,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  permissionPanel: {
    height: 130,
    borderRadius: 14,
    backgroundColor: colors.subtle,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  scannerMessage: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  modalTitle: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22, marginBottom: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  chipActive: { borderColor: colors.ink, backgroundColor: colors.subtle },
  chipText: { color: colors.muted, fontSize: 16 },
  chipTextActive: { color: colors.ink, fontSize: 16 },
  modalActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-end", marginTop: 12 },
  secondaryBtn: { borderWidth: 1, borderColor: colors.border, minHeight: 48, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: colors.ink, fontSize: 16 },
  primaryBtn: { backgroundColor: colors.primary, minHeight: 48, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" }
  });
};
