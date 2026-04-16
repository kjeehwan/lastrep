import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "../../../src/config/firebaseConfig";
import type { Decision } from "../../../src/types/decision";
import { isExpectedOfflineError } from "../../../src/utils/networkErrors";
import {
  DEFAULT_WORKOUT_TEMPLATES,
  getAverageRpe,
  getDominantGroup,
  goalToLabel,
  isPhaseGoalAligned,
  pickTemplate,
  resolveRecommendationTargets,
  type WorkoutLike,
} from "../../../src/workouts/recommendationHeuristics";

type Unit = "kg" | "lbs";
type SetEntry = {
  weightKg: number | null;
  reps: string;
  rpe?: string;
  done: boolean;
  baselineWeightKg?: number | null;
  baselineReps?: string;
  baselineAdjusted?: boolean;
};
type Exercise = {
  id: string;
  name: string;
  notes?: string;
  tempo?: string;
  sets: SetEntry[];
};
type FollowedAnswer = "yes" | "partial" | "no";
type HelpfulAnswer = "yes" | "neutral" | "no";
type PastWorkout = {
  id: string;
  title: string;
  date: Date;
  exercises: {
    name: string;
    notes?: string;
    tempo?: string;
    sets: { weightKg: number | null; reps: string; rpe?: string }[];
  }[];
};

type Routine = {
  id: string;
  name: string;
  exercises: {
    name: string;
    notes?: string;
    tempo?: string;
    sets: { reps: string; targetRpe?: string; defaultWeightKg?: number | null }[];
  }[];
  createdAt: Date | null;
  updatedAt: Date | null;
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
const TEMPO_FORMAT_HINT =
  "Use eccentric-hold-concentric-hold (e.g. 3-0-X-0). Numbers are seconds, X is explosive.";

const isValidTempo = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^(?:\d+|[xX])-(?:\d+|[xX])-(?:\d+|[xX])-(?:\d+|[xX])$/.test(trimmed);
};

export default function WorkoutLog() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTabletLayout = width >= 600;
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
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showRoutineNameModal, setShowRoutineNameModal] = useState(false);
  const [showRoutineStartModal, setShowRoutineStartModal] = useState(false);
  const [showRoutineActionsModal, setShowRoutineActionsModal] = useState(false);
  const [showRoutineDeleteModal, setShowRoutineDeleteModal] = useState(false);
  const [routineNameInput, setRoutineNameInput] = useState("");
  const [routineFormError, setRoutineFormError] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [routineBuilderMode, setRoutineBuilderMode] = useState(false);
  const [routineSaving, setRoutineSaving] = useState(false);
  const [uiFeedback, setUiFeedback] = useState<string | null>(null);
  const [lastAppliedRoutineId, setLastAppliedRoutineId] = useState<string | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendationSummary, setRecommendationSummary] = useState<string[]>([]);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showTempoHelpModal, setShowTempoHelpModal] = useState(false);
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);
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

  const formatWeightInput = (weightKg: number | null, targetUnit: Unit) => {
    if (weightKg === null || Number.isNaN(weightKg)) return "";
    const val = targetUnit === "kg" ? weightKg : weightKg * 2.20462;
    return `${Math.round(val * 10) / 10}`;
  };

  const formatDecisionLabel = (decision?: Decision) =>
    decision ? decision.replace("_", " ") : "";

  const formatIntensityPct = (value?: number) => {
    if (value == null) return "0%";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}%`;
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

  const getAdjustmentOptions = () => [-20, -10, 0, 10, 20];


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

  const loadPastWorkouts = useCallback(async () => {
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
              notes: typeof ex?.notes === "string" ? ex.notes : "",
              tempo: typeof ex?.tempo === "string" ? ex.tempo : "",
              sets: (ex?.sets || []).map((set: any) => ({
                weightKg: typeof set?.weightKg === "number" ? set.weightKg : null,
                reps: String(set?.reps ?? ""),
                rpe:
                  typeof set?.rpe === "number" || typeof set?.rpe === "string"
                    ? String(set.rpe)
                    : "",
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
      if (!isExpectedOfflineError(e)) {
        console.log("Failed to load recent exercises", e);
      }
    }
  }, [auth]);

  const loadRoutines = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const routinesRef = collection(db, "users", user.uid, "routines");
      const snap = await getDocs(query(routinesRef, orderBy("updatedAt", "desc"), limit(50)));
      const next: Routine[] = [];
      snap.forEach((docSnap) => {
        const data: any = docSnap.data();
        next.push({
          id: docSnap.id,
          name: typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "Routine",
          exercises: (data?.exercises || []).map((exercise: any) => ({
            name: typeof exercise?.name === "string" ? exercise.name : "Exercise",
            notes: typeof exercise?.notes === "string" ? exercise.notes : "",
            tempo: typeof exercise?.tempo === "string" ? exercise.tempo : "",
            sets: (exercise?.sets || []).map((set: any) => ({
              reps: String(set?.reps ?? ""),
              targetRpe:
                typeof set?.targetRpe === "number" || typeof set?.targetRpe === "string"
                  ? String(set.targetRpe)
                  : "",
              defaultWeightKg: typeof set?.defaultWeightKg === "number" ? set.defaultWeightKg : null,
            })),
          })),
          createdAt: data?.createdAt?.toDate?.() ?? null,
          updatedAt: data?.updatedAt?.toDate?.() ?? null,
        });
      });
      setRoutines(next);
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load routines", error);
      }
    }
  }, [auth]);

  const loadLatestDecision = useCallback(async () => {
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
      if (!isExpectedOfflineError(e)) {
        console.log("Failed to load latest decision", e);
      }
    }
  }, [auth]);

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
        console.log("Failed to load draft, clearing cache", e);
        try {
          await AsyncStorage.removeItem(DRAFT_KEY);
        } catch {
          // no-op
        }
      }
    };
    loadDraft();
    loadPastWorkouts();
    loadRoutines();
  }, [auth.currentUser, loadPastWorkouts, loadRoutines]);

  useEffect(() => {
    if (routerParams.trainingPhase) {
      setSessionPhase(String(routerParams.trainingPhase));
    }
  }, [routerParams.trainingPhase]);

  useFocusEffect(
    useCallback(() => {
      void loadLatestDecision();
    }, [loadLatestDecision])
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

  useEffect(() => {
    if (!uiFeedback) return;
    const timer = setTimeout(() => setUiFeedback(null), 2800);
    return () => clearTimeout(timer);
  }, [uiFeedback]);

  const addEmptySet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: [...ex.sets, { weightKg: null, reps: "", rpe: "", done: false }],
            }
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

  const updateSetRpe = (exerciseId: string, setIndex: number, value: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) => (idx === setIndex ? { ...s, rpe: value } : s)),
            }
          : ex
      )
    );
  };

  const updateExerciseNotes = (exerciseId: string, notes: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, notes } : ex))
    );
  };

  const updateExerciseTempo = (exerciseId: string, tempo: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, tempo } : ex))
    );
  };

  const openSetMenu = (exerciseId: string, setIndex: number) => {
    setActiveSetMenu({ exerciseId, setIndex });
  };

  const closeSetMenu = () => {
    setActiveSetMenu(null);
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
                  return {
                    ...s,
                    baselineWeightKg: baseline,
                    baselineAdjusted: adjustedFlag,
                    weightKg: baseline,
                  };
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
    closeSetMenu();
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
        notes: ex.notes ?? "",
        tempo: ex.tempo ?? "",
        sets: ex.sets.map((s) => ({
          weightKg: s.weightKg ?? null,
          reps: s.reps,
          rpe: s.rpe ?? "",
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

  const discardWorkout = () => {
    if (!exercises.length && !sessionTitle.trim()) return;
    setShowDiscardConfirmModal(true);
  };

  const confirmDiscardWorkout = () => {
    setExercises([]);
    setExerciseUnits({});
    setSessionTitle("");
    setBaselineDate(null);
    setFollowedAnswer(null);
    setHelpfulAnswer(null);
    setShowFinishModal(false);
    setShowDiscardConfirmModal(false);
    setRecommendationSummary([]);
    setLastAppliedRoutineId(null);
    startTimeRef.current = new Date();
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
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
          return cleanedSets.length
            ? {
                ...ex,
                notes: String(ex.notes || "").trim(),
                tempo: String(ex.tempo || "").trim(),
                sets: cleanedSets.map((set) => ({
                  ...set,
                  rpe: String(set.rpe || "").trim(),
                })),
              }
            : null;
        })
        .filter(Boolean) as Exercise[];

      const invalidTempoExercise = sanitizedExercises.find((exercise) => !isValidTempo(exercise.tempo || ""));
      if (invalidTempoExercise) {
        Alert.alert("Invalid tempo", `${invalidTempoExercise.name}: ${TEMPO_FORMAT_HINT}`);
        setSaving(false);
        return;
      }

      const invalidRpe = sanitizedExercises.find((exercise) =>
        exercise.sets.some((set) => {
          const raw = String(set.rpe || "").trim();
          if (!raw) return false;
          const parsed = Number(raw);
          return !Number.isFinite(parsed) || parsed < 1 || parsed > 10;
        })
      );
      if (invalidRpe) {
        Alert.alert("Invalid RPE", "RPE must be a number between 1 and 10.");
        setSaving(false);
        return;
      }

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
          notes: String(ex.notes || "").trim(),
          tempo: String(ex.tempo || "").trim(),
          sets: ex.sets.map((s) => ({
            weightKg: s.weightKg,
            reps: s.reps,
            rpe:
              String(s.rpe || "").trim() === ""
                ? null
                : Number.isFinite(Number(s.rpe))
                ? Number(String(s.rpe).trim())
                : null,
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
      setRecommendationSummary([]);
      setLastAppliedRoutineId(null);
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
      Alert.alert("Save failed", "We couldn't save your workout. Please try again.");
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

  const buildRoutineExercisesFromEditor = () =>
    exercises.map((exercise) => ({
      name: exercise.name,
      notes: String(exercise.notes || "").trim(),
      tempo: String(exercise.tempo || "").trim(),
      sets: exercise.sets.map((set) => ({
        reps: String(set.reps || "").trim(),
        targetRpe: String(set.rpe || "").trim(),
        defaultWeightKg: typeof set.weightKg === "number" ? set.weightKg : null,
      })),
    }));

  const startRoutineBuilderEmpty = () => {
    setExercises([]);
    setExerciseUnits({});
    setSessionTitle("");
    setRoutineBuilderMode(true);
    setShowRoutineStartModal(false);
  };

  const startRoutineBuilderWithCurrent = () => {
    setRoutineBuilderMode(true);
    setShowRoutineStartModal(false);
  };

  const beginCreateRoutine = () => {
    if (!exercises.length && !sessionTitle.trim()) {
      startRoutineBuilderEmpty();
      return;
    }
    setShowRoutineStartModal(true);
  };

  const openCreateRoutineModal = () => {
    setEditingRoutineId(null);
    setRoutineNameInput(sessionTitle.trim() || "New routine");
    setRoutineFormError(null);
    setShowRoutineNameModal(true);
  };

  const openEditRoutineModal = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setRoutineNameInput(routine.name);
    setRoutineFormError(null);
    setRoutineBuilderMode(true);
    setShowRoutineNameModal(true);
  };

  const saveRoutine = async () => {
    const user = auth.currentUser;
    if (!user || routineSaving) return;
    const name = routineNameInput.trim();
    if (!name) {
      setRoutineFormError("Please enter a routine name.");
      return;
    }
    const routineExercises = buildRoutineExercisesFromEditor();
    if (!routineExercises.length) {
      setRoutineFormError("Add at least one exercise before saving a routine.");
      return;
    }
    setRoutineFormError(null);
    setRoutineSaving(true);
    try {
      const payload = {
        name,
        exercises: routineExercises,
        updatedAt: Timestamp.now(),
        ...(editingRoutineId ? {} : { createdAt: Timestamp.now() }),
      };
      if (editingRoutineId) {
        await setDoc(doc(db, "users", user.uid, "routines", editingRoutineId), payload, { merge: true });
      } else {
        await addDoc(collection(db, "users", user.uid, "routines"), payload);
      }
      setShowRoutineNameModal(false);
      setRoutineNameInput("");
      setEditingRoutineId(null);
      setRoutineBuilderMode(false);
      await loadRoutines();
      setUiFeedback(editingRoutineId ? "Routine updated." : "Routine saved.");
    } catch (error) {
      console.log("Failed to save routine", error);
      setRoutineFormError("Couldn't save routine right now. Please try again.");
    } finally {
      setRoutineSaving(false);
    }
  };

  const deleteRoutineById = async (routine: Routine) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "routines", routine.id));
      await loadRoutines();
      setUiFeedback("Routine deleted.");
    } catch (error) {
      console.log("Failed to delete routine", error);
      setUiFeedback("Couldn't delete routine right now.");
    }
  };

  const applyRoutineToEditor = (routine: Routine, mode: "replace" | "append") => {
    const mapped: Exercise[] = routine.exercises.map((exercise) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: exercise.name,
      notes: exercise.notes ?? "",
      tempo: exercise.tempo ?? "",
      sets: exercise.sets.map((set) => ({
        weightKg: typeof set.defaultWeightKg === "number" ? set.defaultWeightKg : null,
        reps: set.reps,
        rpe: set.targetRpe ?? "",
        done: false,
        baselineWeightKg: typeof set.defaultWeightKg === "number" ? set.defaultWeightKg : null,
        baselineReps: set.reps,
      })),
    }));
    setExercises((prev) => (mode === "append" ? [...prev, ...mapped] : mapped));
    setExerciseUnits((prev) => {
      const next = { ...prev };
      mapped.forEach((exercise) => {
        next[exercise.id] = "kg";
      });
      return next;
    });
    setSessionTitle(routine.name);
    if (mode === "replace") {
      startTimeRef.current = new Date();
      setLastAppliedRoutineId(routine.id);
      setUiFeedback(`Applied "${routine.name}".`);
    } else {
      setUiFeedback(`Appended "${routine.name}".`);
      setLastAppliedRoutineId(null);
    }
  };

  const handleApplyRoutine = (routine: Routine) => {
    applyRoutineToEditor(routine, "replace");
  };

  const appendLastAppliedRoutine = () => {
    if (!lastAppliedRoutineId) return;
    const routine = routines.find((item) => item.id === lastAppliedRoutineId);
    if (!routine) return;
    applyRoutineToEditor(routine, "append");
  };

  const openRoutineActions = (routine: Routine) => {
    setSelectedRoutine(routine);
    setShowRoutineActionsModal(true);
  };

  const closeRoutineActions = () => {
    setShowRoutineActionsModal(false);
    setSelectedRoutine(null);
  };

  const handleUpdateSelectedRoutine = () => {
    if (!selectedRoutine) return;
    setShowRoutineActionsModal(false);
    openEditRoutineModal(selectedRoutine);
  };

  const handleAskDeleteSelectedRoutine = () => {
    setShowRoutineActionsModal(false);
    setShowRoutineDeleteModal(true);
  };

  const handleConfirmDeleteSelectedRoutine = async () => {
    if (!selectedRoutine) {
      setShowRoutineDeleteModal(false);
      return;
    }
    await deleteRoutineById(selectedRoutine);
    setShowRoutineDeleteModal(false);
    setSelectedRoutine(null);
  };

  const buildLastKnownWeightMap = () => {
    const map = new Map<string, number>();
    pastWorkouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        const key = exercise.name.toLowerCase();
        if (map.has(key)) return;
        const firstWeight = exercise.sets.find((set) => typeof set.weightKg === "number")?.weightKg;
        if (typeof firstWeight === "number") {
          map.set(key, firstWeight);
        }
      });
    });
    return map;
  };

  const recommendWorkout = async () => {
    if (recommending) return;
    setRecommending(true);
    try {
      const user = auth.currentUser;
      const userSnap = user ? await getDoc(doc(db, "users", user.uid)) : null;
      const userData: any = userSnap?.data?.() ?? {};
      const goal = String(userData?.goal || "");
      const goalLabel = goalToLabel(goal);
      const trainingPhase =
        typeof userData?.trainingPhase === "string" ? userData.trainingPhase : sessionPhase;
      const dietPhase = typeof userData?.dietPhase === "string" ? userData.dietPhase : "Maintain";

      const latestWorkout = pastWorkouts[0] ?? null;
      const latestWorkoutForHeuristics: WorkoutLike | null = latestWorkout
        ? {
            exercises: latestWorkout.exercises.map((exercise) => ({
              name: exercise.name,
              sets: exercise.sets.map((set) => ({ rpe: set.rpe })),
            })),
          }
        : null;
      const yesterdayGroup = getDominantGroup(latestWorkoutForHeuristics);
      const avgRpe = getAverageRpe(latestWorkoutForHeuristics);
      const highFatigue = avgRpe != null && avgRpe >= 9;
      const pickedTemplate = pickTemplate(
        DEFAULT_WORKOUT_TEMPLATES,
        yesterdayGroup,
        Math.max(0, Math.floor(Date.now() / (24 * 60 * 60 * 1000)))
      );
      const targets = resolveRecommendationTargets(
        trainingPhase,
        goal,
        dietPhase,
        latestDecision?.adjustments?.intensityPct ?? 0,
        highFatigue
      );
      const { targetSets, targetReps, intensityPct, tempo } = targets;
      const intensityFactor = 1 + intensityPct / 100;
      const lastKnownWeights = buildLastKnownWeightMap();
      const phaseGoalAligned = isPhaseGoalAligned(trainingPhase, goal);

      const recommendedExercises: Exercise[] = pickedTemplate.exercises.map((name) => {
        const knownWeight = lastKnownWeights.get(name.toLowerCase());
        const adjustedWeight =
          typeof knownWeight === "number" ? Math.round(knownWeight * intensityFactor * 10) / 10 : null;
        return {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          notes: "",
          tempo,
          sets: Array.from({ length: targetSets }, () => ({
            weightKg: adjustedWeight,
            reps: targetReps,
            rpe: "",
            done: false,
            baselineWeightKg: adjustedWeight,
            baselineReps: targetReps,
          })),
        };
      });
      setExercises(recommendedExercises);
      setExerciseUnits(() => {
        const next: Record<string, Unit> = {};
        recommendedExercises.forEach((exercise) => {
          next[exercise.id] = "kg";
        });
        return next;
      });
      setSessionTitle(`${pickedTemplate.name} (Recommended)`);
      setRecommendationSummary([
        phaseGoalAligned
          ? `Built for your ${trainingPhase} phase in a ${dietPhase} diet context.`
          : `Prioritized your ${trainingPhase} phase, while keeping your long-term goal (${goalLabel}) in mind.`,
        yesterdayGroup
          ? `Avoided repeating yesterday's main focus (${yesterdayGroup}).`
          : "No recent day focus detected, so a balanced split was selected.",
        highFatigue
          ? "Recent RPE trend was high, so today's set count/intensity was reduced."
          : "Intensity was tuned from your latest decision and training context.",
      ]);
      startTimeRef.current = new Date();
      setUiFeedback("Recommended workout applied.");
      setLastAppliedRoutineId(null);
    } catch (error) {
      console.log("Failed to recommend workout", error);
      Alert.alert("Recommendation unavailable", "Please try again in a moment.");
    } finally {
      setRecommending(false);
    }
  };

  const totalSets = useMemo(
    () => exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    [exercises]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
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
          <Text style={styles.title}>{routineBuilderMode ? "Create Routine" : "Workout"}</Text>
          <TouchableOpacity
            onPress={discardWorkout}
            style={[styles.backButton, styles.discardHeaderButton]}
            disabled={saving}
          >
            <Ionicons name="trash-outline" size={18} color="#ffb8b8" />
          </TouchableOpacity>
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
          <TouchableOpacity onPress={() => router.push("/profile")} style={styles.phaseLink}>
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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Routines</Text>
        <Text style={styles.muted}>Reuse saved structures instead of rebuilding each session.</Text>
        <View style={styles.routineActionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.routineActionButton, { marginTop: 0 }]}
            onPress={beginCreateRoutine}
          >
            <Text style={styles.primaryText}>Create routine</Text>
          </TouchableOpacity>
          {pastWorkouts.length > 0 ? (
            <TouchableOpacity
              style={[styles.secondaryButton, styles.routineActionButton]}
              onPress={() => setShowRepeatPicker(true)}
            >
              <Text style={styles.secondaryText}>Repeat past workout</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.routineActionButton} />
          )}
        </View>

        {routineBuilderMode ? (
          <View style={styles.routineBuilderBanner}>
            <Text style={styles.recommendationLine}>
              Routine builder mode: use the workout editor below, then save.
            </Text>
            <View style={styles.routineActionRow}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.routineActionButton, { marginTop: 0 }]}
                onPress={openCreateRoutineModal}
              >
                <Text style={styles.primaryText}>Save routine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.routineActionButton]}
                onPress={() => setRoutineBuilderMode(false)}
              >
                <Text style={styles.secondaryText}>Exit builder</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {routines.length === 0 ? (
          <Text style={[styles.muted, { marginTop: 10 }]}>
            No routines yet. Tap Create routine to build your first one.
          </Text>
        ) : (
          <View style={{ marginTop: 10, gap: 8 }}>
            {routines.map((routine) => (
              <View key={routine.id} style={styles.routineCard}>
                <View style={styles.routineCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerText}>{routine.name}</Text>
                    <Text style={styles.muted}>
                      {routine.exercises.map((exercise) => exercise.name).slice(0, 4).join(" | ")}
                      {routine.exercises.length > 4 ? " | ..." : ""}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.iconButton} onPress={() => openRoutineActions(routine)}>
                    <Ionicons name="ellipsis-horizontal" size={16} color="#cdd0e0" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.routineUseButton} onPress={() => handleApplyRoutine(routine)}>
                  <Text style={styles.primaryText}>Apply routine</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recommendation</Text>
        <Text style={styles.muted}>Autofill today&apos;s workout from your context and recent history.</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 10, opacity: recommending ? 0.7 : 1 }]}
          onPress={recommendWorkout}
          disabled={recommending}
        >
          <Text style={styles.primaryText}>
            {recommending ? "Building recommendation..." : "Recommend workout"}
          </Text>
        </TouchableOpacity>
      </View>

      {uiFeedback ? (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackBannerText}>{uiFeedback}</Text>
          {lastAppliedRoutineId ? (
            <TouchableOpacity onPress={appendLastAppliedRoutine} style={styles.feedbackBannerAction}>
              <Text style={styles.feedbackBannerActionText}>Append instead</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {recommendationSummary.length > 0 ? (
        <View style={styles.recommendationCard}>
          <Text style={styles.sectionTitle}>Why this workout?</Text>
          {recommendationSummary.map((line, index) => (
            <Text key={`rec-line-${index}`} style={styles.recommendationLine}>
              - {line}
            </Text>
          ))}
        </View>
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
              <View style={styles.exerciseMetaNotesSingle}>
                <Text style={styles.metaLabel}>Notes</Text>
                <TextInput
                  placeholder="Add notes"
                  placeholderTextColor="#7a7a8c"
                  value={ex.notes ?? ""}
                  onChangeText={(v) => updateExerciseNotes(ex.id, v)}
                  style={[styles.input, styles.metaInput]}
                />
              </View>
              <View style={styles.exerciseMetaTempoRow}>
                <View style={styles.metaLabelRow}>
                  <Text style={styles.metaLabel}>Tempo</Text>
                  <TouchableOpacity
                    style={styles.tempoHelpButton}
                    onPress={() => setShowTempoHelpModal(true)}
                    accessibilityLabel="Tempo format help"
                  >
                    <Ionicons name="help-circle-outline" size={16} color="#9aa1c3" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="3-0-X-0"
                  placeholderTextColor="#7a7a8c"
                  value={ex.tempo ?? ""}
                  onChangeText={(v) => updateExerciseTempo(ex.id, v)}
                  autoCapitalize="characters"
                  style={[
                    styles.input,
                    styles.metaInput,
                    !isValidTempo(ex.tempo ?? "") && styles.metaInputInvalid,
                  ]}
                />
              </View>
              <View style={[styles.setHeaderRow, isTabletLayout && styles.setHeaderRowTablet]}>
                <Text style={[styles.setHeaderText, styles.setHeaderSet]}>Set</Text>
                <Text style={[styles.setHeaderText, styles.setHeaderCheck]}>{"\u2713"}</Text>
                <View style={styles.setHeaderInputsGroup}>
                  <Text style={[styles.setHeaderText, styles.setColWeight]}>Weight</Text>
                  <Text style={[styles.setHeaderText, styles.setColReps]}>Reps</Text>
                  <Text style={[styles.setHeaderText, styles.setColRpe]}>RPE</Text>
                </View>
              </View>
              {ex.sets.length === 0 ? (
                <Text style={styles.muted}>No sets yet.</Text>
              ) : (
                ex.sets.map((s, idx) => (
                  <View key={`${ex.id}-set-${idx}`} style={styles.setContainer}>
                    <View style={[styles.setInlineRow, isTabletLayout && styles.setInlineRowTablet]}>
                      <TouchableOpacity
                        onPress={() => openSetMenu(ex.id, idx)}
                        style={styles.setLabelButton}
                        accessibilityLabel={`Adjust set ${idx + 1} intensity`}
                      >
                        <Text style={[styles.setLabel, isTabletLayout && styles.setLabelTablet]}>
                          {idx + 1}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.checkboxInline}
                        onPress={() => toggleSetDone(ex.id, idx)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.checkbox, s.done && styles.checkboxChecked]}>
                          {s.done ? <Ionicons name="checkmark" size={14} color="#0d0d1a" /> : null}
                        </View>
                      </TouchableOpacity>
                      <View style={[styles.setInputsGroup, isTabletLayout && styles.setInputsGroupTablet]}>
                        <TextInput
                          placeholder="Weight"
                          placeholderTextColor="#7a7a8c"
                          keyboardType="numeric"
                          value={formatWeightInput(s.weightKg, unit)}
                          onChangeText={(v) => updateSetWeight(ex.id, idx, unit, v)}
                          style={[
                            styles.input,
                            styles.setInput,
                            styles.setInputCompact,
                            styles.setColWeight,
                            isTabletLayout && styles.setInputTablet,
                          ]}
                        />
                        <TextInput
                          placeholder="Reps"
                          placeholderTextColor="#7a7a8c"
                          keyboardType="numeric"
                          value={s.reps}
                          onChangeText={(v) => updateSetReps(ex.id, idx, v)}
                          style={[
                            styles.input,
                            styles.setInput,
                            styles.setInputCompact,
                            styles.setColReps,
                            isTabletLayout && styles.setInputTablet,
                            styles.setInputReps,
                            isTabletLayout && styles.setInputRepsTablet,
                          ]}
                        />
                        <TextInput
                          placeholder="RPE"
                          placeholderTextColor="#7a7a8c"
                          keyboardType="decimal-pad"
                          value={s.rpe ?? ""}
                          onChangeText={(v) => updateSetRpe(ex.id, idx, v)}
                          style={[
                            styles.input,
                            styles.setInput,
                            styles.setInputCompact,
                            styles.setColRpe,
                            isTabletLayout && styles.setInputTablet,
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}
              <View style={styles.setActionsRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.setActionButton]}
                  onPress={() => addEmptySet(ex.id)}
                >
                  <Text style={styles.primaryText}>Add set</Text>
                </TouchableOpacity>
                {ex.sets.length > 0 ? (
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.setActionButton]}
                    onPress={() => duplicateLastSet(ex.id)}
                  >
                    <Text style={styles.secondaryText}>Duplicate last set</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.setActionButton} />
                )}
              </View>
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

      <Modal visible={showRoutineStartModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create routine</Text>
            <Text style={styles.modalText}>
              Start with an empty editor or use your current workout draft.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={startRoutineBuilderWithCurrent}
            >
              <Text style={styles.primaryText}>Use current workout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={startRoutineBuilderEmpty}
            >
              <Text style={styles.secondaryText}>Start empty</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => setShowRoutineStartModal(false)}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoutineActionsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedRoutine ? selectedRoutine.name : "Routine actions"}
            </Text>
            <Text style={styles.modalText}>Choose what you want to do with this routine.</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={handleUpdateSelectedRoutine}
              disabled={!selectedRoutine}
            >
              <Text style={styles.primaryText}>Update from current workout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dangerButton, { marginTop: 10 }]}
              onPress={handleAskDeleteSelectedRoutine}
              disabled={!selectedRoutine}
            >
              <Text style={styles.primaryText}>Delete routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={closeRoutineActions}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoutineDeleteModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete this routine?</Text>
            <Text style={styles.modalText}>
              {selectedRoutine
                ? `This will permanently remove "${selectedRoutine.name}".`
                : "This will permanently remove this routine."}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => {
                  setShowRoutineDeleteModal(false);
                  setSelectedRoutine(null);
                }}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, styles.modalActionButton]}
                onPress={handleConfirmDeleteSelectedRoutine}
              >
                <Text style={styles.primaryText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoutineNameModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingRoutineId ? "Update routine" : "Save routine"}</Text>
            <TextInput
              placeholder="Routine name"
              placeholderTextColor="#7a7a8c"
              value={routineNameInput}
              onChangeText={setRoutineNameInput}
              style={styles.input}
            />
            {routineFormError ? <Text style={styles.modalErrorText}>{routineFormError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => {
                  setShowRoutineNameModal(false);
                  setEditingRoutineId(null);
                  setRoutineFormError(null);
                }}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={saveRoutine}
                disabled={routineSaving}
              >
                <Text style={styles.primaryText}>{routineSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
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

      <Modal visible={showTempoHelpModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tempo Guide</Text>
            <Text style={styles.modalText}>
              Tempo uses four parts: eccentric - hold - concentric - hold.
            </Text>
            <Text style={styles.modalText}>Example: 3-0-X-0</Text>
            <Text style={styles.modalText}>Numbers are seconds. X means explosive.</Text>
            <TouchableOpacity
              style={[styles.primaryButton, styles.modalPrimaryButton]}
              onPress={() => setShowTempoHelpModal(false)}
            >
              <Text style={styles.primaryText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDiscardConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Discard this workout?</Text>
            <Text style={styles.modalText}>
              This will clear your current workout draft. You can&apos;t undo it.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton]}
                onPress={() => setShowDiscardConfirmModal(false)}
              >
                <Text style={styles.secondaryText}>Keep editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, styles.modalActionButton]}
                onPress={confirmDiscardWorkout}
              >
                <Text style={styles.primaryText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(activeSetMenu)} transparent animationType="slide">
        <View style={[styles.sheetBackdrop, { paddingBottom: insets.bottom + 72 }]}>
          <View style={styles.sheetCard}>
            <Text style={styles.modalTitle}>Adjust set intensity</Text>
            <Text style={styles.modalText}>
              Apply percentage to this set&apos;s baseline weight.
            </Text>
            <View style={styles.answerRow}>
              {getAdjustmentOptions().map((pct) => (
                <TouchableOpacity
                  key={`adj-${pct}`}
                  style={styles.answerChip}
                  onPress={() => {
                    if (!activeSetMenu) return;
                    const unit = exerciseUnits[activeSetMenu.exerciseId] || "kg";
                    applySetAdjustment(activeSetMenu.exerciseId, activeSetMenu.setIndex, unit, pct);
                  }}
                >
                  <Text style={styles.answerText}>{pct >= 0 ? `+${pct}%` : `${pct}%`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 12 }]}
              onPress={closeSetMenu}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d0d1a" },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: { padding: 20, paddingTop: 20, paddingBottom: 140 },
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
  discardHeaderButton: {
    borderColor: "rgba(255,122,122,0.6)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(255,122,122,0.15)",
  },
  headerSpacer: { width: 22 },
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
  exerciseMetaNotesSingle: { marginBottom: 6 },
  exerciseMetaTempoRow: { marginBottom: 8 },
  metaLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaLabel: { color: "#cdd0e0", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  tempoHelpButton: { paddingVertical: 2 },
  metaInput: { marginBottom: 0, paddingVertical: 8 },
  metaInputInvalid: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(248,113,113,0.85)",
  },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    marginBottom: 2,
  },
  setHeaderRowTablet: { gap: 10 },
  setHeaderText: { color: "#9aa1c3", fontSize: 12, fontWeight: "700" },
  setHeaderSet: { width: 24, textAlign: "center" },
  setHeaderCheck: { width: 24, textAlign: "center" },
  setHeaderInputsGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  setColWeight: { flex: 1, textAlign: "center" },
  setColReps: { flex: 1, textAlign: "center" },
  setColRpe: { flex: 0.8, textAlign: "center" },
  setInlineRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  setInlineRowTablet: { gap: 10, width: "100%" },
  setLabelButton: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  setLabel: { color: "#cdd0e0", fontWeight: "700", fontSize: 13, width: 24, textAlign: "center" },
  setLabelTablet: { width: 28, fontSize: 15 },
  setInputsGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  setInputsGroupTablet: { flex: 1 },
  setInput: { marginBottom: 0, paddingVertical: 8 },
  setInputCompact: { fontSize: 12, paddingHorizontal: 6, textAlign: "center" },
  setInputTablet: { flex: undefined, width: undefined, minWidth: undefined },
  setInputReps: { marginRight: 0 },
  setInputRepsTablet: { marginRight: 0 },
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
  routineActionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  routineActionButton: { flex: 1 },
  routineBuilderBanner: {
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(123,97,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.45)",
    gap: 4,
  },
  feedbackBanner: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(166,227,161,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(166,227,161,0.45)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  feedbackBannerText: { color: "#d7f5d3", fontSize: 12, fontWeight: "700", flex: 1 },
  feedbackBannerAction: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedbackBannerActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  recommendationCard: {
    backgroundColor: "rgba(123,97,255,0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(123,97,255,0.4)",
    gap: 4,
  },
  recommendationLine: { color: "#d8daec", fontSize: 12, lineHeight: 18 },
  routineCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  routineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routineUseButton: {
    backgroundColor: "#7b61ff",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
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
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  setActionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  setActionButton: { flex: 1, marginTop: 0 },
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
  modalErrorText: { color: "#ff9a9a", marginBottom: 8, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalActionButton: { flex: 1 },
  modalPrimaryButton: { marginTop: 0, paddingVertical: 12 },
  dangerButton: {
    backgroundColor: "rgba(248,113,113,0.9)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
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
