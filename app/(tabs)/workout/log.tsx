import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { db } from "../../../src/config/firebaseConfig";
import type { Decision } from "../../../src/types/decision";

type Unit = "kg" | "lbs";
type SetEntry = {
  weightKg: number | null;
  reps: string;
  done: boolean;
  baselineWeightKg?: number | null;
  baselineReps?: string;
  baselineAdjusted?: boolean;
};
type Exercise = { id: string; name: string; sets: SetEntry[] };
type FollowedAnswer = "yes" | "partial" | "no";
type HelpfulAnswer = "yes" | "neutral" | "no";
type PastWorkout = {
  id: string;
  title: string;
  date: Date;
  exercises: { name: string; sets: { weightKg: number | null; reps: string }[] }[];
};

const EXERCISE_GROUPS = [
  {
    key: "chest",
    label: "Chest",
    items: ["Bench Press", "Incline Dumbbell Press", "Chest Fly", "Push Ups"],
  },
  {
    key: "back",
    label: "Back",
    items: ["Deadlift", "Barbell Row", "Lat Pulldown", "Seated Cable Row", "Pull Ups"],
  },
  {
    key: "legs",
    label: "Legs",
    items: ["Squat", "Front Squat", "Leg Press", "Romanian Deadlift", "Lunges"],
  },
  {
    key: "shoulders",
    label: "Shoulders",
    items: ["Overhead Press", "Lateral Raise", "Rear Delt Fly", "Arnold Press"],
  },
  {
    key: "arms",
    label: "Arms",
    items: ["Bicep Curl", "Hammer Curl", "Tricep Pushdown", "Skullcrusher", "Dips"],
  },
  {
    key: "core",
    label: "Core",
    items: ["Plank", "Crunches", "Hanging Leg Raise", "Russian Twist"],
  },
  {
    key: "cardio",
    label: "Cardio",
    items: ["Treadmill", "Cycling", "Rowing", "Jump Rope"],
  },
];

const DRAFT_KEY = "workout-log-draft-v1";

export default function WorkoutLog() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [customExercise, setCustomExercise] = useState("");
  const [exerciseUnits, setExerciseUnits] = useState<Record<string, Unit>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceGroup, setReplaceGroup] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [sessionPhase, setSessionPhase] = useState("Hypertrophy");
  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [pastWorkouts, setPastWorkouts] = useState<PastWorkout[]>([]);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [followedAnswer, setFollowedAnswer] = useState<FollowedAnswer | null>(null);
  const [helpfulAnswer, setHelpfulAnswer] = useState<HelpfulAnswer | null>(null);
  const [baselineDate, setBaselineDate] = useState<Date | null>(null);
  const [latestDecision, setLatestDecision] = useState<{
    decision?: Decision;
    adjustments?: { intensityPct?: number };
  } | null>(null);
  const [activeSetMenu, setActiveSetMenu] = useState<{
    exerciseId: string;
    setIndex: number;
  } | null>(null);
  const routerParams = useLocalSearchParams<{ trainingPhase?: string }>();
  const auth = getAuth();
  const startTimeRef = useRef<Date>(new Date());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const convertWeight = (value: number, from: Unit, to: Unit) => {
    if (Number.isNaN(value)) return null;
    if (from === to) return value;
    return from === "kg" ? value * 2.20462 : value * 0.453592;
  };

  const formatWeight = (weightKg: number | null, targetUnit: Unit) => {
    if (weightKg === null || Number.isNaN(weightKg)) return "";
    const val = targetUnit === "kg" ? weightKg : weightKg * 2.20462;
    return `${Math.round(val * 10) / 10} ${targetUnit}`;
  };

  const formatWeightInput = (weightKg: number | null, targetUnit: Unit) => {
    if (weightKg === null || Number.isNaN(weightKg)) return "";
    const val = targetUnit === "kg" ? weightKg : weightKg * 2.20462;
    return `${Math.round(val * 10) / 10}`;
  };

  const roundWeightKg = (weightKg: number, unit: Unit) => {
    if (!Number.isFinite(weightKg)) return weightKg;
    if (unit === "kg") {
      const step = 2.5;
      return Math.round(weightKg / step) * step;
    }
    const lbs = weightKg * 2.20462;
    const step = 5;
    const roundedLbs = Math.round(lbs / step) * step;
    return roundedLbs * 0.453592;
  };

  const formatDecisionLabel = (decision?: Decision) =>
    decision ? decision.replace("_", " ") : "";

  const formatIntensityPct = (value?: number) => {
    if (value == null) return "0%";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}%`;
  };

  const getAdjustmentOptions = () => {
    const decision = latestDecision?.decision;
    if (decision === "PULL_BACK") return [0, -5, -10, -15, -20];
    if (decision === "PUSH") return [0, 5, 10, 15, 20];
    return [0];
  };

  const addExercise = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setExercises((prev) => {
      const exists = prev.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) return prev;
      return [...prev, { id, name: trimmed, sets: [] }];
    });
    // default to kg for new exercise
    setExerciseUnits((prev) => ({ ...prev, [id]: "kg" }));
    setCustomExercise("");
    setShowPicker(false);
  };

  const filteredExercises = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const baseList =
      activeGroup === "all"
        ? EXERCISE_GROUPS.flatMap((g) => g.items)
        : activeGroup === "recent"
          ? recentExercises
          : EXERCISE_GROUPS.find((g) => g.key === activeGroup)?.items || [];
    const byGroup = Array.from(new Set([...(activeGroup === "all" ? recentExercises : []), ...baseList]));
    if (!normalizedSearch) return byGroup;
    return byGroup.filter((item) => item.toLowerCase().includes(normalizedSearch));
  }, [activeGroup, searchQuery, recentExercises]);

  const replacementOptions = useMemo(() => {
    const normalized = replaceSearch.trim().toLowerCase();
    const raw =
      replaceGroup === "all"
        ? EXERCISE_GROUPS.flatMap((g) => g.items)
        : EXERCISE_GROUPS.find((g) => g.key === replaceGroup)?.items || [];
    // ??Deduplicate to avoid duplicate React keys (e.g., "Deadlift" appears in multiple groups)
    const byGroup = Array.from(new Set(raw));
    if (!normalized) return byGroup;
    return byGroup.filter((item) => item.toLowerCase().includes(normalized));
  }, [replaceGroup, replaceSearch]);

  const loadPastWorkouts = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const workoutsRef = collection(db, "users", user.uid, "workouts");
      const snap = await getDocs(query(workoutsRef, orderBy("date", "desc"), limit(20)));
      const names: string[] = [];
      const workouts: PastWorkout[] = [];
      snap.forEach((docSnap) => {
        const data: any = docSnap.data();
        const rawDate =
          data?.date?.toDate?.() ||
          data?.endedAt?.toDate?.() ||
          data?.createdAt?.toDate?.() ||
          null;
        if (rawDate) {
          workouts.push({
            id: docSnap.id,
            title: data?.title || "Workout",
            date: rawDate,
            exercises: (data?.exercises || []).map((ex: any) => ({
              name: ex?.name || "Exercise",
              sets: (ex?.sets || []).map((set: any) => ({
                weightKg: typeof set?.weightKg === "number" ? set.weightKg : null,
                reps: String(set?.reps ?? ""),
              })),
            })),
          });
        }
        (data.exercises || []).forEach((ex: any) => {
          if (ex?.name && !names.includes(ex.name)) names.push(ex.name);
        });
      });
      setRecentExercises(names);
      setPastWorkouts(workouts);
    } catch (e) {
      console.log("Failed to load recent exercises", e);
    }
  };

  const loadLatestDecision = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) return;
      const data: any = snap.data();
      const last = data?.usage?.decisions?.lastResult;
      if (last?.result) {
        setLatestDecision({
          decision: last.result.decision,
          adjustments: last.result.adjustments,
        });
      }
    } catch (e) {
      console.log("Failed to load latest decision", e);
    }
  };

  // Load draft and recent exercises
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.exercises) setExercises(parsed.exercises);
          if (parsed.exerciseUnits) setExerciseUnits(parsed.exerciseUnits);
          if (parsed.sessionTitle) setSessionTitle(parsed.sessionTitle);
          if (parsed.startTime) {
            const savedStart = new Date(parsed.startTime);
            const now = new Date();
            const sameDay =
              savedStart.getFullYear() === now.getFullYear() &&
              savedStart.getMonth() === now.getMonth() &&
              savedStart.getDate() === now.getDate();
            startTimeRef.current = sameDay ? savedStart : now;
          }
        }
      } catch (e) {
        console.log("Failed to load draft", e);
      }
    };
    loadDraft();
    loadPastWorkouts();
  }, [auth.currentUser]);

  useEffect(() => {
    if (routerParams.trainingPhase) {
      setSessionPhase(String(routerParams.trainingPhase));
    }
  }, [routerParams.trainingPhase]);

  useFocusEffect(
    React.useCallback(() => {
      loadLatestDecision();
    }, [auth.currentUser])
  );

  // Persist draft
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          exercises,
          exerciseUnits,
          sessionTitle,
          startTime: startTimeRef.current.toISOString(),
        })
      ).catch((e) => console.log("Failed to save draft", e));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [exercises, exerciseUnits, sessionTitle]);

  // Elapsed timer
  useEffect(() => {
    const updateElapsed = () => {
      const diff = Date.now() - startTimeRef.current.getTime();
      setElapsedMinutes(Math.max(0, Math.floor(diff / 60000)));
    };
    updateElapsed();
    const id = setInterval(() => {
      updateElapsed();
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const addEmptySet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: [...ex.sets, { weightKg: null, reps: "", done: false }] }
          : ex
      )
    );
  };

  const toggleSetDone = (exerciseId: string, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: ex.sets.map((s, idx) =>
              idx === setIndex ? { ...s, done: !s.done } : s
            ),
          }
          : ex
      )
    );
  };

  const deleteSet = (exerciseId: string, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.filter((_, idx) => idx !== setIndex) }
          : ex
      )
    );
  };

  const openSetMenu = (exerciseId: string, setIndex: number) => {
    setActiveSetMenu({ exerciseId, setIndex });
  };

  const closeSetMenu = () => {
    setActiveSetMenu(null);
  };

  const updateSetWeight = (exerciseId: string, setIndex: number, unit: Unit, value: string) => {
    const weightNum = parseFloat(value);
    const weightKg =
      value.trim() === "" || Number.isNaN(weightNum)
        ? null
        : unit === "kg"
          ? weightNum
          : convertWeight(weightNum, "lbs", "kg");
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: ex.sets.map((s, idx) =>
              idx === setIndex ? { ...s, weightKg } : s
            ),
          }
          : ex
      )
    );
  };

  const updateSetReps = (exerciseId: string, setIndex: number, value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: ex.sets.map((s, idx) =>
              idx === setIndex ? { ...s, reps: value } : s
            ),
          }
          : ex
      )
    );
  };

  const applySetAdjustment = (exerciseId: string, setIndex: number, unit: Unit, percent: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: ex.sets.map((s, idx) => {
              if (idx !== setIndex) return s;
              if (s.weightKg === null || s.weightKg <= 0) return s;
              const baseline = s.baselineWeightKg ?? s.weightKg;
              const adjustedFlag = percent === 0 ? s.baselineAdjusted ?? false : true;
              if (percent === 0) {
                return { ...s, baselineWeightKg: baseline, baselineAdjusted: adjustedFlag, weightKg: baseline };
              }
              const adjusted = baseline * (1 + percent / 100);
              return {
                ...s,
                baselineWeightKg: baseline,
                baselineAdjusted: adjustedFlag,
                weightKg: roundWeightKg(adjusted, unit),
              };
            }),
          }
          : ex
      )
    );
  };

  const replaceExercise = (exerciseId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const target = exercises.find((ex) => ex.id === exerciseId);
    const doReplace = () => {
      setExercises((prev) =>
        prev.map((ex) => (ex.id === exerciseId ? { ...ex, name: trimmed } : ex))
      );
      setReplaceTarget(null);
      setReplaceSearch("");
      setReplaceGroup("all");
    };
    if (target && target.sets.length > 0) {
      Alert.alert(
        "Replace exercise?",
        "Existing sets will stay but the exercise name will change.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", style: "destructive", onPress: doReplace },
        ]
      );
    } else {
      doReplace();
    }
  };

  const deleteExercise = (exerciseId: string) => {
    const target = exercises.find((ex) => ex.id === exerciseId);
    const doDelete = () => {
      setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
      setExerciseUnits((prev) => {
        const copy = { ...prev };
        delete copy[exerciseId];
        return copy;
      });
      if (replaceTarget === exerciseId) {
        setReplaceTarget(null);
        setReplaceSearch("");
        setReplaceGroup("all");
      }
    };

    if (target && target.sets.length > 0) {
      Alert.alert(
        "Delete exercise?",
        "This will remove the exercise and all its sets.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    } else {
      doDelete();
    }
  };

  const applyPastWorkout = (workout: PastWorkout) => {
    const nextExercises: Exercise[] = workout.exercises.map((ex) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: ex.name,
      sets: ex.sets.map((s) => ({
        weightKg: s.weightKg ?? null,
        reps: s.reps,
        done: false,
        baselineWeightKg: s.weightKg ?? null,
        baselineReps: s.reps,
      })),
    }));
    setExercises(nextExercises);
    setSessionTitle(workout.title || "Workout");
    setBaselineDate(workout.date);
    setExerciseUnits(() => {
      const next: Record<string, Unit> = {};
      nextExercises.forEach((ex) => {
        next[ex.id] = "kg";
      });
      return next;
    });
    startTimeRef.current = new Date();
    setShowRepeatPicker(false);
  };

  const finishWorkout = () => {
    if (!exercises.length) return;
    setFollowedAnswer(null);
    setHelpfulAnswer(null);
    setShowFinishModal(true);
  };

  const saveWorkout = async () => {
    if (saving) return;
    if (!followedAnswer || !helpfulAnswer) {
      Alert.alert("Quick questions", "Please answer both questions before saving.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not signed in", "Please sign in again to save your workout.");
      return;
    }
    try {
      setSaving(true);
      const sanitizedExercises = exercises
        .map((ex) => {
          const cleanedSets = ex.sets.filter((s) => {
            const repsVal = String(s.reps || "").trim();
            if (!repsVal) return false;
            return true;
          });
          return cleanedSets.length ? { ...ex, sets: cleanedSets } : null;
        })
        .filter(Boolean) as Exercise[];

      const totalCleanSets = sanitizedExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
      if (totalCleanSets === 0) {
        Alert.alert("Nothing to save", "Add reps to at least one set before saving.");
        setSaving(false);
        return;
      }

      const payload = {
        title: sessionTitle || "Workout",
        date: Timestamp.fromDate(new Date()),
        trainingPhase: sessionPhase,
        exercises: sanitizedExercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.map((s) => ({
            weightKg: s.weightKg,
            reps: s.reps,
          })),
        })),
        followedRecommendation: followedAnswer || "unknown",
        helpful: helpfulAnswer || "unknown",
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "users", user.uid, "workouts"), payload);
      if (__DEV__) {
        Alert.alert("Workout saved", `Saved as ${docRef.id}`);
      }
      setExercises([]);
      setExerciseUnits({});
      startTimeRef.current = new Date();
      setSessionTitle("");
      setBaselineDate(null);
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => { });
      setShowFinishModal(false);
      await loadPastWorkouts();
      if (!__DEV__) {
        Alert.alert("Workout saved", "Nice work.");
      }
      router.replace("/(tabs)/home");
    } catch (e) {
      console.log("Error saving workout", e);
      Alert.alert("Save failed", `We couldn't save this workout. ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleExerciseUnit = (exerciseId: string, next: Unit) => {
    setExerciseUnits((prev) => {
      const current = prev[exerciseId] || "kg";
      if (current === next) return prev;
      return { ...prev, [exerciseId]: next };
    });
  };

  const duplicateLastSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        if (!ex.sets.length) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, { ...last, done: false }],
        };
      })
    );
  };

  const totalSets = useMemo(
    () => exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    [exercises]
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Workout Log</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Session</Text>
        <TextInput
          placeholder="Session title (optional)"
          placeholderTextColor="#7a7a8c"
          value={sessionTitle}
          onChangeText={setSessionTitle}
          style={styles.input}
        />
        <View style={styles.sessionMeta}>
          <Text style={styles.muted}>
            {new Date(startTimeRef.current).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Text>
          <Text style={styles.muted}>
            Duration: {elapsedMinutes} min
          </Text>
        </View>
        <View style={styles.phaseRow}>
          <Text style={styles.muted}>Training phase: {sessionPhase}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/home")} style={styles.phaseLink}>
            <Text style={styles.phaseLinkText}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>

      {baselineDate ? (
        <View style={styles.baselineBanner}>
          <Text style={styles.baselineText}>
            Baseline copied from{" "}
            {baselineDate.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })}
          </Text>
          <Text style={styles.baselineSub}>
            Adjust per today&apos;s decision:{" "}
            {latestDecision?.decision
              ? `${formatDecisionLabel(latestDecision.decision)} (${formatIntensityPct(latestDecision.adjustments?.intensityPct)} weight)`
              : "??"}
          </Text>
        </View>
      ) : null}

      {pastWorkouts.length > 0 ? (
        <TouchableOpacity
          style={[styles.secondaryButton, { marginTop: 10 }]}
          onPress={() => setShowRepeatPicker(true)}
        >
          <Text style={styles.secondaryText}>Repeat past workout</Text>
        </TouchableOpacity>
      ) : null}

      {exercises.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.muted}>No exercises added yet.</Text>
        </View>
      ) : (
        exercises.map((ex) => {
          const unit = exerciseUnits[ex.id] || "kg";
          return (
            <View key={ex.id} style={styles.card}>
              <View style={styles.exerciseHeader}>
                <Text
                  style={styles.exerciseName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {ex.name}
                </Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleChip, unit === "kg" && styles.toggleChipActive]}
                    onPress={() => toggleExerciseUnit(ex.id, "kg")}
                  >
                    <Text style={[styles.toggleText, unit === "kg" && styles.toggleTextActive]}>kg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleChip, unit === "lbs" && styles.toggleChipActive]}
                    onPress={() => toggleExerciseUnit(ex.id, "lbs")}
                  >
                    <Text style={[styles.toggleText, unit === "lbs" && styles.toggleTextActive]}>lbs</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() =>
                      setReplaceTarget((prev) => (prev === ex.id ? null : ex.id))
                    }
                  >
                    <Ionicons
                      name={replaceTarget === ex.id ? "close" : "swap-horizontal-outline"}
                      size={18}
                      color="#cdd0e0"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconButton} onPress={() => deleteExercise(ex.id)}>
                    <Ionicons name="trash-outline" size={18} color="#ff7a7a" />
                  </TouchableOpacity>
                </View>
              </View>
              {replaceTarget === ex.id ? (
                <View style={[styles.pickerCard, { marginTop: 10 }]}>
                  <TextInput
                    placeholder="Search to replace"
                    placeholderTextColor="#7a7a8c"
                    value={replaceSearch}
                    onChangeText={setReplaceSearch}
                    style={[styles.input, { marginBottom: 8 }]}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.groupChips}
                  >
                    <TouchableOpacity
                      style={[styles.groupChip, replaceGroup === "all" && styles.groupChipActive]}
                      onPress={() => setReplaceGroup("all")}
                    >
                      <Text
                        style={[
                          styles.groupChipText,
                          replaceGroup === "all" && styles.groupChipTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    {EXERCISE_GROUPS.map((g) => (
                      <TouchableOpacity
                        key={g.key}
                        style={[
                          styles.groupChip,
                          replaceGroup === g.key && styles.groupChipActive,
                        ]}
                        onPress={() => setReplaceGroup(g.key)}
                      >
                        <Text
                          style={[
                            styles.groupChipText,
                            replaceGroup === g.key && styles.groupChipTextActive,
                          ]}
                        >
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <ScrollView
                    style={{ maxHeight: 180 }}
                    nestedScrollEnabled
                    bounces={false}
                    overScrollMode="never"
                    keyboardShouldPersistTaps="handled"
                    scrollEventThrottle={16}
                  >
                    {replacementOptions.map((item) => (
                      <TouchableOpacity
                        key={`${item}-${ex.id}`}
                        style={styles.pickerRow}
                        onPress={() => replaceExercise(ex.id, item)}
                      >
                        <Ionicons name="swap-horizontal-outline" size={18} color="#7b61ff" />
                        <Text style={styles.pickerText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {ex.sets.length === 0 ? (
                <Text style={styles.muted}>No sets yet.</Text>
              ) : (
                ex.sets.map((s, idx) => (
                  <View key={`${ex.id}-set-${idx}`} style={styles.setContainer}>
                    <View style={styles.setInlineRow}>
                      <Text style={styles.setLabel}>
                        {idx + 1}
                      </Text>
                      <TouchableOpacity
                        style={styles.checkboxInline}
                        onPress={() => toggleSetDone(ex.id, idx)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkbox, s.done && styles.checkboxChecked]}>
                          {s.done ? <Ionicons name="checkmark" size={14} color="#0d0d1a" /> : null}
                        </View>
                      </TouchableOpacity>
                      <TextInput
                        placeholder="Weight"
                        placeholderTextColor="#7a7a8c"
                        keyboardType="numeric"
                        value={formatWeightInput(s.weightKg, unit)}
                        onChangeText={(v) => updateSetWeight(ex.id, idx, unit, v)}
                        style={[styles.input, styles.setInput]}
                      />
                      <TextInput
                        placeholder="Reps"
                        placeholderTextColor="#7a7a8c"
                        keyboardType="numeric"
                        value={s.reps}
                        onChangeText={(v) => updateSetReps(ex.id, idx, v)}
                        style={[styles.input, styles.setInput, styles.setInputReps]}
                      />
                      <View style={styles.actions}>
                        <TouchableOpacity
                          onPress={() => deleteSet(ex.id, idx)}
                          style={styles.iconButton}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ff7a7a" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openSetMenu(ex.id, idx)}
                          style={styles.iconButton}
                        >
                          <Ionicons name="ellipsis-horizontal" size={18} color="#cdd0e0" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {s.baselineAdjusted && (typeof s.baselineWeightKg === "number" || s.baselineReps) ? (
                      <Text style={styles.baselineInline}>
                        Baseline:{" "}
                        {typeof s.baselineWeightKg === "number"
                          ? `${formatWeight(s.baselineWeightKg, unit)}`
                          : "-"}{" "}
                        x {s.baselineReps ?? "-"}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => addEmptySet(ex.id)}
              >
                <Text style={styles.primaryText}>Add set</Text>
              </TouchableOpacity>
              {ex.sets.length > 0 ? (
                <TouchableOpacity
                  style={[styles.secondaryButton, { marginTop: 8 }]}
                  onPress={() => duplicateLastSet(ex.id)}
                >
                  <Text style={styles.secondaryText}>Duplicate last set</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}

      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 12 }]}
        onPress={() => setShowPicker((v) => !v)}
      >
        <Text style={styles.secondaryText}>{showPicker ? "Hide list" : "Add exercise"}</Text>
      </TouchableOpacity>
      {showPicker ? (
        <View style={[styles.pickerCard, { marginTop: 10 }]}>
          <TextInput
            placeholder="Search exercises"
            placeholderTextColor="#7a7a8c"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.input, { marginBottom: 8 }]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChips}>
            <TouchableOpacity
              style={[styles.groupChip, activeGroup === "all" && styles.groupChipActive]}
              onPress={() => setActiveGroup("all")}
            >
              <Text style={[styles.groupChipText, activeGroup === "all" && styles.groupChipTextActive]}>All</Text>
            </TouchableOpacity>
            {recentExercises.length > 0 && (
              <TouchableOpacity
                style={[styles.groupChip, activeGroup === "recent" && styles.groupChipActive]}
                onPress={() => setActiveGroup("recent")}
              >
                <Text style={[styles.groupChipText, activeGroup === "recent" && styles.groupChipTextActive]}>
                  Recent
                </Text>
              </TouchableOpacity>
            )}
            {EXERCISE_GROUPS.map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.groupChip, activeGroup === g.key && styles.groupChipActive]}
                onPress={() => setActiveGroup(g.key)}
              >
                <Text
                  style={[styles.groupChipText, activeGroup === g.key && styles.groupChipTextActive]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView
            style={{ maxHeight: 220 }}
            nestedScrollEnabled
            bounces={false}
            overScrollMode="never"
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
          >
            {filteredExercises.map((item) => (
              <TouchableOpacity key={item} style={styles.pickerRow} onPress={() => addExercise(item)}>
                <Ionicons name="add-circle-outline" size={18} color="#7b61ff" />
                <Text style={styles.pickerText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.customRow}>
            <TextInput
              placeholder="Custom exercise"
              placeholderTextColor="#7a7a8c"
              value={customExercise}
              onChangeText={setCustomExercise}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
            <TouchableOpacity style={styles.miniButton} onPress={() => addExercise(customExercise)}>
              <Text style={styles.miniButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

        <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 16, opacity: saving ? 0.6 : 1 }]}
        onPress={finishWorkout}
        disabled={saving}
      >
        <Text style={styles.secondaryText}>
          {saving ? "Saving..." : `Finish workout (${totalSets} sets)`}
        </Text>
      </TouchableOpacity>

      <Modal visible={showRepeatPicker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Repeat a past workout</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {pastWorkouts.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.pickerRow}
                  onPress={() => applyPastWorkout(w)}
                >
                  <Ionicons name="repeat-outline" size={18} color="#7b61ff" />
                  <View>
                    <Text style={styles.pickerText}>{w.title}</Text>
                    <Text style={styles.muted}>
                      {w.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => setShowRepeatPicker(false)}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFinishModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quick questions</Text>
            <Text style={styles.modalText}>Followed recommendation?</Text>
            <View style={styles.answerRow}>
              {(["yes", "partial", "no"] as FollowedAnswer[]).map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.answerChip, followedAnswer === val && styles.answerChipActive]}
                  onPress={() => setFollowedAnswer(val)}
                >
                  <Text style={[styles.answerText, followedAnswer === val && styles.answerTextActive]}>
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalText, { marginTop: 12 }]}>Helpful?</Text>
            <View style={styles.answerRow}>
              {(["yes", "neutral", "no"] as HelpfulAnswer[]).map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.answerChip, helpfulAnswer === val && styles.answerChipActive]}
                  onPress={() => setHelpfulAnswer(val)}
                >
                  <Text style={[styles.answerText, helpfulAnswer === val && styles.answerTextActive]}>
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => setShowFinishModal(false)}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={saveWorkout}
                disabled={saving}
              >
                <Text style={styles.primaryText}>{saving ? "Saving..." : "Save workout"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(activeSetMenu)} transparent animationType="slide">
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <Text style={styles.modalTitle}>Set options</Text>
            {activeSetMenu ? (
              <>
                <Text style={[styles.modalText, { marginTop: 12 }]}>Apply decision adjustment</Text>
                <View style={styles.answerRow}>
                  {getAdjustmentOptions().map((pct) => (
                    <TouchableOpacity
                      key={`adj-${pct}`}
                      style={styles.answerChip}
                      onPress={() => {
                        const unit = exerciseUnits[activeSetMenu.exerciseId] || "kg";
                        applySetAdjustment(activeSetMenu.exerciseId, activeSetMenu.setIndex, unit, pct);
                      }}
                    >
                      <Text style={styles.answerText}>{pct >= 0 ? `+${pct}%` : `${pct}%`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.secondaryButton, { marginTop: 10 }]}
                  onPress={closeSetMenu}
                >
                  <Text style={styles.secondaryText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d0d1a" },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: { padding: 20, paddingBottom: 140 },
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
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: 10,
    rowGap: 8,
  },
  halfInput: { flexBasis: "48%", flexGrow: 1, minWidth: 120, marginBottom: 0 },
  primaryButton: {
    backgroundColor: "#7b61ff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#7b61ff", fontWeight: "700" },
  muted: { color: "#a3a3b5" },
  exerciseBlock: { marginTop: 8 },
  exerciseName: { color: "#fff", fontWeight: "700", marginBottom: 4, flex: 1, flexShrink: 1 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  setText: { color: "#cdd0e0" },
  setTextDone: { color: "#7b61ff", textDecorationLine: "line-through" },
  setInlineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  setLabel: { color: "#cdd0e0", fontWeight: "700", width: 22, textAlign: "center" },
  setInput: { width: 90, minWidth: 80, marginBottom: 0, paddingVertical: 8 },
  setInputReps: { marginRight: 8 },
  checkboxInline: { paddingRight: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cdd0e0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    backgroundColor: "#7b61ff",
    borderColor: "#7b61ff",
  },
  pickerCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pickerRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerText: { color: "#fff", fontWeight: "600" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  miniButton: {
    backgroundColor: "#7b61ff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  miniButtonText: { color: "#fff", fontWeight: "700" },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  toggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  toggleChipActive: {
    backgroundColor: "#7b61ff",
    borderColor: "#7b61ff",
  },
  toggleText: { color: "#d8daec", fontWeight: "700" },
  toggleTextActive: { color: "#0d0d1a" },
  groupChips: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  groupChipActive: {
    backgroundColor: "#7b61ff",
    borderColor: "#7b61ff",
  },
  groupChipText: { color: "#d8daec", fontWeight: "700" },
  groupChipTextActive: { color: "#0d0d1a" },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  setContainer: { marginBottom: 6 },
  setInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 6 },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  sessionMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  phaseLink: { paddingHorizontal: 6, paddingVertical: 2 },
  phaseLinkText: { color: "#7b61ff", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: "#111427",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modalText: { color: "#d8daec", marginBottom: 4 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalActionButton: { flex: 1 },
  modalPrimaryButton: { marginTop: 0, paddingVertical: 12 },
  answerRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  answerChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  answerChipActive: { backgroundColor: "#7b61ff", borderColor: "#7b61ff" },
  answerText: { color: "#d8daec", fontWeight: "700" },
  answerTextActive: { color: "#0d0d1a" },
  baselineBanner: {
    backgroundColor: "rgba(123,97,255,0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.4)",
  },
  baselineText: { color: "#fff", fontWeight: "700" },
  baselineSub: { color: "#c9cde4", marginTop: 4 },
  baselineInline: { color: "#9aa1c3", fontSize: 12, marginTop: 4 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: "#111427",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
});




