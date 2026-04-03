import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, Redirect, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import { useOfflineStatus } from "@/src/hooks/useOfflineStatus";
import {
  computeDailyCalorieProgress,
  computeNutritionTotals,
  createMeal,
  DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE,
  DEFAULT_MEAL_FORM_VALUES,
  deleteMeal,
  formatMealTime,
  getCalorieTargetForDietPhase,
  getDefaultMealTime,
  getNutritionProfile,
  parseMealForm,
  subscribeToTodayMeals,
  toEditableTime,
  updateMeal,
  type MealFormValues,
} from "@/src/nutrition/meals";
import type { NutritionMeal } from "@/src/contracts";
import type { DietPhase } from "@/src/types/decision";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";
const HOME_INPUTS_KEY = "home-inputs-v1";
const DIET_PHASES: DietPhase[] = ["Cut", "Maintain", "Bulk"];

function buildInitialFormValues(): MealFormValues {
  return {
    ...DEFAULT_MEAL_FORM_VALUES,
    time: getDefaultMealTime(),
  };
}

function isDietPhase(value: string): value is DietPhase {
  return DIET_PHASES.includes(value as DietPhase);
}

export default function NutritionIndex() {
  const router = useRouter();
  const { isOffline } = useOfflineStatus();
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [meals, setMeals] = useState<NutritionMeal[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [formValues, setFormValues] = useState<MealFormValues>(buildInitialFormValues);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentDietPhase, setCurrentDietPhase] = useState<DietPhase>("Maintain");
  const [calorieTargets, setCalorieTargets] = useState(DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
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
    if (!uid) {
      setMeals([]);
      setLoadingMeals(false);
      return;
    }

    setLoadingMeals(true);
    const unsubscribe = subscribeToTodayMeals(
      uid,
      (nextMeals) => {
        setMeals(nextMeals);
        setLoadingMeals(false);
      },
      (error) => {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to load meals", error);
        }
        setLoadingMeals(false);
        setFeedback(
          isExpectedOfflineError(error)
            ? "You're offline. Meals will refresh when you reconnect."
            : "Unable to refresh today's meals right now."
        );
      }
    );

    return unsubscribe;
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return undefined;

      let cancelled = false;
      const loadNutritionContext = async () => {
        try {
          const [profile, rawHomeInputs] = await Promise.all([
            getNutritionProfile(uid),
            AsyncStorage.getItem(HOME_INPUTS_KEY),
          ]);

          if (cancelled) return;

          setCalorieTargets(profile.calorieTargetsByDietPhase);

          if (!rawHomeInputs) {
            setCurrentDietPhase("Maintain");
            return;
          }

          const parsed = JSON.parse(rawHomeInputs) as { dietPhase?: string };
          if (typeof parsed.dietPhase === "string" && isDietPhase(parsed.dietPhase)) {
            setCurrentDietPhase(parsed.dietPhase);
            return;
          }

          setCurrentDietPhase("Maintain");
        } catch (error) {
          if (!isExpectedOfflineError(error)) {
            console.log("Failed to load nutrition targets", error);
          }
        }
      };

      void loadNutritionContext();
      return () => {
        cancelled = true;
      };
    }, [uid])
  );

  const totals = useMemo(() => computeNutritionTotals(meals), [meals]);
  const calorieTarget = useMemo(
    () => getCalorieTargetForDietPhase(calorieTargets, currentDietPhase),
    [calorieTargets, currentDietPhase]
  );
  const calorieProgress = useMemo(
    () => computeDailyCalorieProgress(totals.calories, calorieTarget),
    [totals.calories, calorieTarget]
  );

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const resetForm = () => {
    setEditingMealId(null);
    setFormValues(buildInitialFormValues());
  };

  const handleChange = (field: keyof MealFormValues, value: string) => {
    setFormValues((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!uid || submitting) return;

    const parsed = parseMealForm(formValues);
    if (!parsed.ok) {
      setFeedback(parsed.message);
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const request = editingMealId
        ? updateMeal(uid, editingMealId, parsed.payload)
        : createMeal(uid, parsed.payload);

      if (isOffline) {
        void request.catch((error) => {
          if (!isExpectedOfflineError(error)) {
            console.log("Queued meal write failed", error);
            setFeedback("Queued meal changes failed. Please try again.");
          }
        });
        setFeedback("Saved offline. Meal changes will sync when you reconnect.");
        resetForm();
        return;
      }

      await request;
      setFeedback(editingMealId ? "Meal updated." : "Meal added.");
      resetForm();
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to save meal", error);
      }
      setFeedback(
        isExpectedOfflineError(error)
          ? "You're offline. Meal changes couldn't be saved."
          : "Unable to save this meal right now."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditMeal = (meal: NutritionMeal) => {
    setEditingMealId(meal.id);
    setFormValues({
      name: meal.name,
      calories: String(meal.calories),
      proteinGrams: meal.proteinGrams == null ? "" : String(meal.proteinGrams),
      time: toEditableTime(meal.loggedAt),
    });
    setFeedback(null);
  };

  const handleDeleteMeal = (meal: NutritionMeal) => {
    if (!uid) return;

    Alert.alert("Delete meal", `Delete ${meal.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const request = deleteMeal(uid, meal.id);
            if (isOffline) {
              void request.catch((error) => {
                if (!isExpectedOfflineError(error)) {
                  console.log("Queued meal delete failed", error);
                  setFeedback("Queued delete failed. Please try again.");
                }
              });
              if (editingMealId === meal.id) {
                resetForm();
              }
              setFeedback("Deleted offline. Changes will sync when you reconnect.");
              return;
            }

            await request;
            if (editingMealId === meal.id) {
              resetForm();
            }
            setFeedback("Meal deleted.");
          } catch (error) {
            if (!isExpectedOfflineError(error)) {
              console.log("Failed to delete meal", error);
            }
            setFeedback(
              isExpectedOfflineError(error)
                ? "You're offline. Meal changes couldn't be saved."
                : "Unable to delete this meal right now."
            );
          }
        },
      },
    ]);
  };

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} style={styles.container} bounces>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Nutrition</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Today</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalChip}>
              <Text style={styles.totalLabel}>Consumed</Text>
              <Text style={styles.totalValue}>{totals.calories}</Text>
            </View>
            <View style={styles.totalChip}>
              <Text style={styles.totalLabel}>{currentDietPhase} target</Text>
              <Text style={styles.totalValue}>{calorieTarget == null ? "Set" : calorieTarget}</Text>
            </View>
          </View>
          <View style={styles.totalRow}>
            <View style={styles.totalChip}>
              <Text style={styles.totalLabel}>Protein</Text>
              <Text style={styles.totalValue}>
                {totals.proteinGrams > 0 ? `${totals.proteinGrams} g` : "-"}
              </Text>
            </View>
            <View style={styles.totalChip}>
              <Text style={styles.totalLabel}>
                {calorieProgress.overTargetCalories && calorieProgress.overTargetCalories > 0
                  ? "Over target"
                  : "Remaining"}
              </Text>
              <Text style={styles.totalValue}>
                {calorieTarget == null
                  ? "Set"
                  : calorieProgress.overTargetCalories && calorieProgress.overTargetCalories > 0
                    ? calorieProgress.overTargetCalories
                    : calorieProgress.remainingCalories}
              </Text>
            </View>
          </View>
          <Text style={styles.subText}>
            {calorieTarget == null
              ? `Set your ${currentDietPhase} calorie target in Profile to track progress.`
              : `Today is for tracking. Decisions rely mainly on completed-day adherence, not partial same-day intake.`}
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/profile" as Href)}
          >
            <Text style={styles.secondaryButtonText}>Edit calorie targets</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingMealId ? "Edit meal" : "Add meal"}</Text>

          <Text style={styles.label}>Meal name</Text>
          <TextInput
            style={styles.input}
            value={formValues.name}
            onChangeText={(value) => handleChange("name", value)}
            placeholder="Chicken bowl"
            placeholderTextColor="#7a7a8c"
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldColumn}>
              <Text style={styles.label}>Calories</Text>
              <TextInput
                style={styles.input}
                value={formValues.calories}
                onChangeText={(value) => handleChange("calories", value)}
                keyboardType="numeric"
                placeholder="650"
                placeholderTextColor="#7a7a8c"
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={styles.label}>Protein (optional)</Text>
              <TextInput
                style={styles.input}
                value={formValues.proteinGrams}
                onChangeText={(value) => handleChange("proteinGrams", value)}
                keyboardType="numeric"
                placeholder="40"
                placeholderTextColor="#7a7a8c"
              />
            </View>
          </View>

          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            value={formValues.time}
            onChangeText={(value) => handleChange("time", value)}
            placeholder="08:30"
            placeholderTextColor="#7a7a8c"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={submitting || !authReady || !uid}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? "Saving..." : editingMealId ? "Save meal" : "Add meal"}
            </Text>
          </TouchableOpacity>

          {editingMealId ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>Cancel edit</Text>
            </TouchableOpacity>
          ) : null}

          {feedback ? <Text style={styles.subText}>{feedback}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Today's meals</Text>
          {loadingMeals ? <Text style={styles.subText}>Loading meals...</Text> : null}
          {!loadingMeals && meals.length === 0 ? (
            <Text style={styles.subText}>No meals logged yet.</Text>
          ) : null}
          {meals.map((meal) => (
            <View key={meal.id} style={styles.mealRow}>
              <View style={styles.mealBody}>
                <Text style={styles.mealTitle}>{meal.name}</Text>
                <Text style={styles.subText}>
                  {meal.calories} kcal
                  {meal.proteinGrams != null ? ` - ${meal.proteinGrams} g protein` : ""}
                  {` - ${formatMealTime(meal.loggedAt)}`}
                </Text>
              </View>
              <View style={styles.mealActions}>
                <TouchableOpacity style={styles.iconButton} onPress={() => handleEditMeal(meal)}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteMeal(meal)}>
                  <Ionicons name="trash-outline" size={18} color="#ff8f8f" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0d0d1a",
  },
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
  },
  content: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 140,
    gap: 14,
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
  headerSpacer: {
    width: 22,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  totalRow: {
    flexDirection: "row",
    gap: 10,
  },
  totalChip: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  totalLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
  totalValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  label: {
    color: "#cfcfe6",
    fontSize: 14,
    fontWeight: "600",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 10,
  },
  fieldColumn: {
    flex: 1,
    gap: 8,
  },
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
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  subText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.6,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  mealBody: {
    flex: 1,
    gap: 4,
  },
  mealTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  mealActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
