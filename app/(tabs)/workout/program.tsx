import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../src/config/firebaseConfig";
import { saveUserData, getUserData } from "../../../src/userData";
import { loadFreeExerciseDbCatalog } from "../../../src/workouts/freeExerciseDbCatalog";
import {
  buildProgramPayload,
  buildSampleProgramDays,
  normalizeProgram,
  type ProgramDay,
} from "../../../src/workouts/program";
import {
  EXERCISE_CATALOG,
  EXERCISE_GROUPS,
  type ExerciseCatalogItem,
} from "../../../src/workouts/exerciseCatalog";

type Routine = {
  id: string;
  name: string;
};

const availabilityToDays = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(7, Math.round(value)));
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized === "2-3") return 3;
    if (normalized === "4-5") return 5;
    if (normalized === "6+") return 6;
    if (/^\d+$/.test(normalized)) {
      return Math.max(1, Math.min(7, Math.round(Number(normalized))));
    }
  }
  return 4;
};

export default function WorkoutProgramScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [uid, setUid] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [pickerDayNumber, setPickerDayNumber] = useState<number | null>(null);
  const [exercisePickerDayNumber, setExercisePickerDayNumber] = useState<number | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseGroup, setExerciseGroup] = useState<string>("all");
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>(EXERCISE_CATALOG);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRedirectTo("/auth/sign-in");
        setLoading(false);
        return;
      }
      setUid(user.uid);
      setRedirectTo(null);

      try {
        const [userData, routinesSnap] = await Promise.all([
          getUserData(user.uid),
          getDocs(query(collection(db, "users", user.uid, "routines"), orderBy("updatedAt", "desc"), limit(80))),
        ]);

        const availabilityDays = availabilityToDays(userData?.availabilityDays ?? userData?.availability);
        const createMode = params.mode === "create";
        if (createMode) {
          setDays(
            buildSampleProgramDays(availabilityDays, {
              withTemplateTitles: false,
              withTemplateExercises: false,
            })
          );
        } else {
          const normalized = normalizeProgram(userData?.workoutProgram);
          if (normalized?.days?.length) {
            setDays(normalized.days);
          } else {
            setDays(buildSampleProgramDays(availabilityDays));
          }
        }

        const loadedRoutines: Routine[] = [];
        routinesSnap.forEach((snap) => {
          const data: any = snap.data();
          const name = typeof data?.name === "string" ? data.name : "Routine";
          loadedRoutines.push({ id: snap.id, name });
        });
        setRoutines(loadedRoutines);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [params.mode]);

  useEffect(() => {
    let cancelled = false;
    const hydrateCatalog = async () => {
      const remote = await loadFreeExerciseDbCatalog();
      if (cancelled || !remote.length) return;
      const dedup = new Map<string, ExerciseCatalogItem>();
      [...EXERCISE_CATALOG, ...remote].forEach((item) => {
        const key = item.name.trim().toLowerCase();
        if (!key || dedup.has(key)) return;
        dedup.set(key, item);
      });
      setCatalog(Array.from(dedup.values()));
    };
    void hydrateCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickerDay = useMemo(
    () => days.find((day) => day.dayNumber === pickerDayNumber) ?? null,
    [days, pickerDayNumber]
  );
  const exercisePickerDay = useMemo(
    () => days.find((day) => day.dayNumber === exercisePickerDayNumber) ?? null,
    [days, exercisePickerDayNumber]
  );

  const updateDay = (dayNumber: number, updater: (prev: ProgramDay) => ProgramDay) => {
    setDays((prev) =>
      prev.map((day) => (day.dayNumber === dayNumber ? updater(day) : day))
    );
  };

  const toggleDayType = (dayNumber: number, nextType: "workout" | "rest") => {
    updateDay(dayNumber, (prev) => ({
      ...prev,
      type: nextType,
      title: nextType === "rest" ? "Rest / Recovery" : prev.title || "",
      routineId: nextType === "rest" ? null : prev.routineId ?? null,
    }));
  };

  const assignRoutine = (routineId: string | null) => {
    if (pickerDayNumber == null) return;
    const routine = routines.find((item) => item.id === routineId) ?? null;
    updateDay(pickerDayNumber, (prev) => ({
      ...prev,
      type: "workout",
      routineId,
      title: routine ? routine.name : prev.title,
    }));
    setPickerDayNumber(null);
  };

  const openExercisePicker = (dayNumber: number) => {
    const day = days.find((item) => item.dayNumber === dayNumber);
    setExercisePickerDayNumber(dayNumber);
    setExerciseSearch("");
    setExerciseGroup("all");
    setSelectedExercises(day?.exercises ?? []);
  };

  const toggleExerciseSelection = (exerciseName: string) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseName) ? prev.filter((name) => name !== exerciseName) : [...prev, exerciseName]
    );
  };

  const saveExerciseSelection = () => {
    if (exercisePickerDayNumber == null) return;
    updateDay(exercisePickerDayNumber, (prev) => ({
      ...prev,
      exercises: selectedExercises,
      type: "workout",
    }));
    setExercisePickerDayNumber(null);
  };

  const filteredExercises = useMemo(() => {
    const queryText = exerciseSearch.trim().toLowerCase();
    const filtered = catalog.filter((exercise) => {
      const matchesGroup = exerciseGroup === "all" || exercise.group === exerciseGroup;
      if (!matchesGroup) return false;
      if (!queryText) return true;
      const name = exercise.name.toLowerCase();
      return (
        name.includes(queryText) ||
        exercise.primaryMuscles.some((muscle) => muscle.toLowerCase().includes(queryText)) ||
        exercise.equipment.some((item) => item.toLowerCase().includes(queryText))
      );
    });
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [exerciseGroup, exerciseSearch, catalog]);

  const saveProgram = async () => {
    if (!uid || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload = buildProgramPayload(days, {
        isActive: true,
        startedAt: Timestamp.now(),
      });
      await saveUserData(uid, { workoutProgram: payload }, true);
      setFeedback("Program saved and applied.");
    } catch (error) {
      console.log("Failed to save program", error);
      setFeedback("Couldn't save program right now.");
    } finally {
      setSaving(false);
    }
  };

  if (redirectTo) return <Redirect href={redirectTo} />;
  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <Text style={styles.muted}>Loading program...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>My Program</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Program days</Text>
          <Text style={styles.muted}>
            Configure Day 1-7. Workout days can point to your saved routines.
          </Text>
        </View>

        {days.map((day) => {
          const linkedRoutine = routines.find((routine) => routine.id === day.routineId) ?? null;
          return (
            <View key={`program-day-${day.dayNumber}`} style={styles.card}>
              <Text style={styles.dayTitle}>Day {day.dayNumber}</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.answerChip, day.type === "workout" && styles.answerChipActive]}
                  onPress={() => toggleDayType(day.dayNumber, "workout")}
                >
                  <Text style={[styles.answerText, day.type === "workout" && styles.answerTextActive]}>
                    Workout
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.answerChip, day.type === "rest" && styles.answerChipActive]}
                  onPress={() => toggleDayType(day.dayNumber, "rest")}
                >
                  <Text style={[styles.answerText, day.type === "rest" && styles.answerTextActive]}>
                    Rest
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.muted}>
                {day.type === "rest"
                  ? "Recovery day"
                  : linkedRoutine
                    ? `Routine: ${linkedRoutine.name}`
                    : "No routine assigned"}
              </Text>
              {day.type === "workout" ? (
                <>
                  <TextInput
                    placeholder={`Session title for Day ${day.dayNumber}`}
                    placeholderTextColor="#7a7a8c"
                    value={day.title}
                    onChangeText={(value) =>
                      updateDay(day.dayNumber, (prev) => ({
                        ...prev,
                        title: value,
                      }))
                    }
                    style={styles.input}
                  />
                  <View style={styles.typeRow}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.halfButton]}
                      onPress={() => setPickerDayNumber(day.dayNumber)}
                    >
                      <Text style={styles.secondaryText}>
                        {linkedRoutine ? "Change routine" : "Assign routine"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.halfButton]}
                      onPress={() => openExercisePicker(day.dayNumber)}
                    >
                      <Text style={styles.secondaryText}>
                        {day.exercises?.length ? "Edit exercises" : "Add exercises"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {day.exercises?.length ? (
                    <Text style={styles.muted}>
                      Exercises: {day.exercises.slice(0, 4).join(" | ")}
                      {day.exercises.length > 4 ? " | ..." : ""}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabled]}
          onPress={saveProgram}
          disabled={saving}
        >
          <Text style={styles.primaryText}>{saving ? "Saving..." : "Save and apply program"}</Text>
        </TouchableOpacity>
        {feedback ? <Text style={styles.muted}>{feedback}</Text> : null}
      </ScrollView>

      <Modal visible={pickerDay != null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pickerDay ? `Day ${pickerDay.dayNumber} routine` : "Pick routine"}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {routines.length === 0 ? (
                <Text style={styles.muted}>No routines yet. Create one first.</Text>
              ) : (
                routines.map((routine) => (
                  <TouchableOpacity
                    key={routine.id}
                    style={styles.pickerRow}
                    onPress={() => assignRoutine(routine.id)}
                  >
                    <Ionicons name="list-outline" size={16} color="#cdd0e0" />
                    <Text style={styles.pickerText}>{routine.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => assignRoutine(null)}
            >
              <Text style={styles.secondaryText}>Clear routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 8 }]}
              onPress={() => setPickerDayNumber(null)}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={exercisePickerDay != null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {exercisePickerDay ? `Day ${exercisePickerDay.dayNumber} exercises` : "Pick exercises"}
            </Text>
            <TextInput
              placeholder="Search exercises"
              placeholderTextColor="#7a7a8c"
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              style={[styles.input, { marginBottom: 8 }]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupChips}
            >
              <TouchableOpacity
                style={[styles.answerChip, exerciseGroup === "all" && styles.answerChipActive]}
                onPress={() => setExerciseGroup("all")}
              >
                <Text style={[styles.answerText, exerciseGroup === "all" && styles.answerTextActive]}>All</Text>
              </TouchableOpacity>
              {EXERCISE_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group.key}
                  style={[styles.answerChip, exerciseGroup === group.key && styles.answerChipActive]}
                  onPress={() => setExerciseGroup(group.key)}
                >
                  <Text
                    style={[styles.answerText, exerciseGroup === group.key && styles.answerTextActive]}
                  >
                    {group.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {filteredExercises.map((exercise) => {
                const selected = selectedExercises.includes(exercise.name);
                return (
                  <TouchableOpacity
                    key={exercise.id}
                    style={styles.pickerRow}
                    onPress={() => toggleExerciseSelection(exercise.name)}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={16}
                      color={selected ? "#7b61ff" : "#cdd0e0"}
                    />
                    <Text style={styles.pickerText}>{exercise.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 10 }]}
              onPress={saveExerciseSelection}
            >
              <Text style={styles.primaryText}>Save exercises</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 8 }]}
              onPress={() => setExercisePickerDayNumber(null)}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d0d1a" },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: { padding: 16, paddingBottom: 100, gap: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  headerSpacer: { width: 22 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 8,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  dayTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  muted: { color: "#a8afc7", fontSize: 13 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderRadius: 10,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  typeRow: { flexDirection: "row", gap: 8 },
  halfButton: { flex: 1 },
  answerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  answerChipActive: {
    backgroundColor: "#fff",
    borderColor: "#7b61ff",
  },
  answerText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  answerTextActive: { color: "#4a90e2" },
  primaryButton: {
    backgroundColor: "#7b61ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  secondaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.65 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#111427",
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "800", marginBottom: 10 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  pickerText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  groupChips: { gap: 8, paddingVertical: 2 },
});
