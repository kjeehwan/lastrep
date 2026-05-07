import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import type { NutritionMeal } from "@/src/contracts";
import type { FoodEntryMode, FoodItem } from "@/src/nutrition/foodDb";
import { createMeal, getMealsForDate, getRecentMeals, updateMeal } from "@/src/nutrition/meals";

type SelectionDraft = {
  key: string;
  food: FoodItem;
  mode: FoodEntryMode;
  value: string;
};

type BrowseTab = "search" | "recent" | "favorites";
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

function formatFoodHelper(food: FoodItem): string {
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

function normalizeServingInfo(label: string | null | undefined, servingGrams: number): string {
  const raw = String(label ?? "").trim();
  if (!raw) return "1 serving";
  const gramsPattern = /^\d+(?:\.\d+)?\s*g$/i;
  if (gramsPattern.test(raw)) return "1 serving";
  // Strings that are only numeric/gram tokens are not meaningful serving descriptors.
  const alphaOnly = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (alphaOnly === "g" || alphaOnly === "gram" || alphaOnly === "grams") return "1 serving";

  const gramsThenParen = raw.match(/^\d+(?:\.\d+)?\s*g\s*\(([^)]+)\)\s*$/i);
  if (gramsThenParen?.[1]) {
    const extracted = gramsThenParen[1].trim();
    if (/^\d+(?:\.\d+)?\s*g$/i.test(extracted)) return "1 serving";
    return extracted;
  }

  const textThenGramsParen = raw.match(/^(.+?)\s*\(\s*\d+(?:\.\d+)?\s*g\s*\)\s*$/i);
  if (textThenGramsParen?.[1]) return textThenGramsParen[1].trim();

  const normalizedRaw = raw.replace(/\s+/g, " ").trim();
  if (normalizedRaw.toLowerCase() === `${Math.round(servingGrams)} g`) return "1 serving";
  // Keep explicit serving descriptors (cup, piece, banana, scoop, etc.) as-is.
  if (/[a-z]/i.test(normalizedRaw)) return normalizedRaw;
  return normalizedRaw;
}

export default function MealSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = decodeURIComponent(params.section ?? "Breakfast");
  const goToSection = useCallback(
    () => router.replace({ pathname: "/nutrition/meal/[section]", params: { section } }),
    [router, section]
  );

  const [uid, setUid] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchNonce, setSearchNonce] = useState(0);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [staged, setStaged] = useState<Record<string, SelectionDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<FoodEntryMode>("grams");
  const [editorValue, setEditorValue] = useState("100");
  const [editorFood, setEditorFood] = useState<FoodItem | null>(null);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editorPreview, setEditorPreview] = useState("Enter a value");
  const [tab, setTab] = useState<BrowseTab>("search");
  const [recentMeals, setRecentMeals] = useState<NutritionMeal[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [foodById, setFoodById] = useState<Record<string, FoodItem>>({});

  const favoriteKey = uid ? `${FAVORITES_KEY_PREFIX}${uid}` : null;
  const stagedItems = useMemo(() => Object.values(staged), [staged]);
  const stagedCount = stagedItems.length;
  const canSearch = query.trim().length >= 2;
  const favoriteIds = useMemo(() => new Set(favorites.map((x) => x.food.id)), [favorites]);

  const getOneServingDefaults = useCallback((food: FoodItem) => {
    const grams = Math.round(food.servingGrams);
    const calories = Math.round((food.caloriesPer100g * food.servingGrams) / 100);
    return {
      grams: `${grams}`,
      calories: `${calories}`,
      servings: "1",
    } as const;
  }, []);

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
        if (!prewarmPromise) prewarmPromise = foodDb.prewarmFoodSearch();
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
      const foodDb = await getFoodDb();
      const next = await foodDb.searchFoodsAsync(submittedQuery, 20);
      if (!cancelled) {
        setSearchResults(next);
        setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submittedQuery, searchNonce]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!editorFood) {
        setEditorPreview("Enter a value");
        return;
      }
      const foodDb = await getFoodDb();
      const converted = foodDb.computeFromFood(editorFood, editorMode, editorValue);
      if (cancelled) return;
      if (!converted) {
        setEditorPreview("Enter a value");
        return;
      }
      const servingInfo = normalizeServingInfo(editorFood.servingLabel, editorFood.servingGrams);
      setEditorPreview(
        `${Math.round(converted.grams)}g / ${Math.round(converted.calories)} kcal / ${formatServingQuantity(
          converted.servings,
          servingInfo
        )}`
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [editorFood, editorMode, editorValue]);

  useFocusEffect(
    React.useCallback(() => {
      setQuery("");
      setSubmittedQuery("");
      setSearchResults([]);
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
    }, [editorVisible])
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
    const defaults = getOneServingDefaults(food);
    setEditorFood(food);
    setEditorKey(key);
    setEditorMode(existing?.mode ?? "grams");
    setEditorValue(
      existing?.value ??
        (existing?.mode === "calories"
          ? defaults.calories
          : existing?.mode === "servings"
          ? defaults.servings
          : defaults.grams)
    );
    setEditorVisible(true);
  };

  const handleEditorModeChange = (nextMode: FoodEntryMode) => {
    if (!editorFood) {
      setEditorMode(nextMode);
      return;
    }
    const defaults = getOneServingDefaults(editorFood);
    void (async () => {
      const foodDb = await getFoodDb();
      const converted = foodDb.computeFromFood(editorFood, editorMode, editorValue);
      if (!converted) {
        setEditorMode(nextMode);
        setEditorValue(defaults[nextMode]);
        return;
      }
      const nextValue =
        nextMode === "grams"
          ? `${Math.round(converted.grams)}`
          : nextMode === "calories"
          ? `${Math.round(converted.calories)}`
          : `${roundServing(converted.servings)}`;
      setEditorMode(nextMode);
      setEditorValue(nextValue);
    })();
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
    setSearching(false);
  };

  const runSearch = () => {
    if (!canSearch) return;
    setSearching(true);
    void (async () => {
      const foodDb = await getFoodDb();
      if (!prewarmPromise) prewarmPromise = foodDb.prewarmFoodSearch();
      await prewarmPromise;
      setSubmittedQuery(query.trim());
      setSearchNonce((n) => n + 1);
    })();
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
      const todayMeals = await getMealsForDate(uid, new Date());
      for (const entry of entries) {
        const converted = foodDb.computeFromFood(entry.food, entry.mode, entry.value);
        if (!converted) continue;
        const now = Timestamp.now();
        const existing = todayMeals.find((meal) => {
          const sameSection = (meal.mealSection?.trim() || "Breakfast") === section;
          if (!sameSection) return false;
          if (meal.source?.foodId && meal.source.foodId === entry.food.id) return true;
          return normalizeName(meal.name) === normalizeName(entry.food.name);
        });

        const baseSource = {
          foodId: entry.food.id,
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
            loggedAt: now,
            updatedAt: now,
            source: baseSource,
          } as any);
          todayMeals.unshift({
            id: `local-${entry.food.id}-${now.seconds}`,
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
            loggedAt: now,
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={goToSection}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Add to {section}</Text>
        <TouchableOpacity style={styles.nextBtn} onPress={commitStaged} disabled={submitting}>
          <Text style={styles.nextText}>{submitting ? "Saving..." : "Next"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Search foods</Text>
          <View style={styles.searchInlineRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={[styles.input, styles.searchInput]}
              placeholder="Search food"
              placeholderTextColor="#7a7a8c"
              returnKeyType="search"
              onSubmitEditing={runSearch}
            />
            {query.length > 0 ? (
              <TouchableOpacity style={styles.clearBtn} onPress={clearSearchState}>
                <Ionicons name="close-circle" size={18} color="#cfd3f8" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.searchIconBtn, !canSearch && styles.searchBtnDisabled]}
              onPress={runSearch}
              disabled={!canSearch}
            >
              <Ionicons name="search" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tabBtn, tab === "search" && styles.tabBtnActive]} onPress={() => setTab("search")}>
              <Text style={[styles.tabText, tab === "search" && styles.tabTextActive]}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === "recent" && styles.tabBtnActive]} onPress={() => setTab("recent")}>
              <Text style={[styles.tabText, tab === "recent" && styles.tabTextActive]}>Recently added</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === "favorites" && styles.tabBtnActive]} onPress={() => setTab("favorites")}>
              <Text style={[styles.tabText, tab === "favorites" && styles.tabTextActive]}>Favorites</Text>
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
                      <Ionicons name="close" size={14} color="#cfd3f8" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!canSearch ? <Text style={styles.subText}>Type at least 2 characters.</Text> : null}
          {searching ? <Text style={styles.subText}>Searching...</Text> : null}
          {!searching && tab === "search" && submittedQuery.trim().length >= 2 && searchResults.length === 0 ? (
            <Text style={styles.subText}>No results found.</Text>
          ) : null}

          {tab === "search" &&
            searchResults.map((item) => {
              const stageKey = `food:${item.id}`;
              const selected = Boolean(staged[stageKey]);
              const favored = favoriteIds.has(item.id);
              return (
                <TouchableOpacity key={item.id} style={styles.searchRow} onPress={() => openEditor(stageKey, item)}>
                  <TouchableOpacity onPress={() => toggleStaged(stageKey, item)} style={styles.checkboxWrap}>
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected ? "#7b61ff" : "#cfd3f8"}
                    />
                  </TouchableOpacity>
                  <View style={styles.searchBody}>
                    <Text style={styles.searchTitle}>{item.name}</Text>
                    <Text style={styles.subText}>{formatFoodHelper(item)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFavorite(item)}>
                    <Ionicons name={favored ? "star" : "star-outline"} size={18} color={favored ? "#ffd166" : "#cfd3f8"} />
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
                          color={selected ? "#7b61ff" : "#cfd3f8"}
                        />
                      </TouchableOpacity>
                      <View style={styles.searchBody}>
                        <Text style={styles.searchTitle}>{meal.name}</Text>
                        <Text style={styles.subText}>{formatFoodHelper(food)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleFavorite(food)}>
                        <Ionicons name={favored ? "star" : "star-outline"} size={18} color={favored ? "#ffd166" : "#cfd3f8"} />
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
                      color={selected ? "#7b61ff" : "#cfd3f8"}
                    />
                  </TouchableOpacity>
                  <View style={styles.searchBody}>
                    <Text style={styles.searchTitle}>{food.name}</Text>
                    <Text style={styles.subText}>{formatFoodHelper(food)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFavorite(food)}>
                    <Ionicons name="star" size={18} color="#ffd166" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          {tab === "favorites" && favorites.length === 0 ? (
            <Text style={styles.subText}>No favorites yet. Tap the star on a food to save it here.</Text>
          ) : null}

          <Text style={styles.subText}>{stagedCount} selected</Text>
        </View>
      </ScrollView>

      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={() => setEditorVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editorFood?.name ?? "Edit"}</Text>
            <View style={styles.rowWrap}>
              {ENTRY_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.chip, editorMode === mode && styles.chipActive]}
                  onPress={() => handleEditorModeChange(mode)}
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
              placeholder={
                editorFood
                  ? editorMode === "grams"
                    ? `${Math.round(editorFood.servingGrams)}g`
                    : editorMode === "calories"
                    ? `${Math.round((editorFood.caloriesPer100g * editorFood.servingGrams) / 100)} kcal`
                    : "1 serving"
                  : "100"
              }
              placeholderTextColor="#7a7a8c"
            />
            {editorFood ? <Text style={styles.subText}>{editorPreview}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditorVisible(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={confirmEditor}>
                <Text style={styles.primaryBtnText}>Confirm</Text>
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
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  title: { color: "#fff", fontSize: 19, fontWeight: "800" },
  nextBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  nextText: { color: "#fff", fontSize: 13, fontWeight: "700" },
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
  searchInlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1 },
  clearBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  searchIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tabBtnActive: { borderColor: "#7b61ff", backgroundColor: "rgba(123,97,255,0.2)" },
  tabText: { color: "#cfd3f8", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
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
  searchBtnDisabled: { opacity: 0.45 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkboxWrap: { padding: 2 },
  searchBody: { flex: 1, gap: 1 },
  searchTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  groupBlock: { gap: 4 },
  groupTitle: { color: "#e6e9ff", fontSize: 12, fontWeight: "700", marginTop: 6 },
  selectedBlock: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  selectedTitle: { color: "#fff", fontSize: 12, fontWeight: "700" },
  selectedWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 6,
    maxWidth: "100%",
  },
  selectedChipText: { color: "#fff", fontSize: 12, fontWeight: "600", maxWidth: 180 },
  selectedChipRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  subText: { color: "#a5acc1", fontSize: 12, lineHeight: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#171727",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 16,
    gap: 12,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipActive: { backgroundColor: "#fff", borderColor: "#7b61ff" },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#4a90e2", fontWeight: "700" },
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
