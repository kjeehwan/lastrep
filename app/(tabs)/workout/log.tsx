import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth } from "firebase/auth";
import { addDoc, collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { db } from "../../../src/config/firebaseConfig";

type Unit = "kg" | "lbs";
type SetEntry = { weightKg: number | null; reps: string; done: boolean };
type Exercise = { id: string; name: string; sets: SetEntry[] };

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
  const [setDrafts, setSetDrafts] = useState<Record<string, { weight: string; reps: string }>>({});
  const [exerciseUnits, setExerciseUnits] = useState<Record<string, Unit>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [editingSet, setEditingSet] = useState<{
    exerciseId: string | null;
    setIndex: number | null;
    weight: string;
    reps: string;
  }>({ exerciseId: null, setIndex: null, weight: "", reps: "" });
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceGroup, setReplaceGroup] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<null | {
    title: string;
    totalSets: number;
    totalVolumeKg: number;
    totalExercises: number;
    durationMinutes: number;
  }>(null);
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
    const byGroup =
      replaceGroup === "all"
        ? EXERCISE_GROUPS.flatMap((g) => g.items)
        : EXERCISE_GROUPS.find((g) => g.key === replaceGroup)?.items || [];
    if (!normalized) return byGroup;
    return byGroup.filter((item) => item.toLowerCase().includes(normalized));
  }, [replaceGroup, replaceSearch]);

  // Load draft and recent exercises
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.exercises) setExercises(parsed.exercises);
          if (parsed.setDrafts) setSetDrafts(parsed.setDrafts);
          if (parsed.exerciseUnits) setExerciseUnits(parsed.exerciseUnits);
          if (parsed.sessionTitle) setSessionTitle(parsed.sessionTitle);
          if (parsed.startTime) startTimeRef.current = new Date(parsed.startTime);
        }
      } catch (e) {
        console.log("Failed to load draft", e);
      }
    };
    const loadRecent = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const workoutsRef = collection(db, "users", user.uid, "workouts");
        const snap = await getDocs(query(workoutsRef, orderBy("endedAt", "desc"), limit(10)));
        const names: string[] = [];
        snap.forEach((docSnap) => {
          const data: any = docSnap.data();
          (data.exercises || []).forEach((ex: any) => {
            if (ex?.name && !names.includes(ex.name)) names.push(ex.name);
          });
        });
        setRecentExercises(names);
      } catch (e) {
        console.log("Failed to load recent exercises", e);
      }
    };
    loadDraft();
    loadRecent();
  }, [auth.currentUser]);

  // Persist draft
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          exercises,
          setDrafts,
          exerciseUnits,
          sessionTitle,
          startTime: startTimeRef.current.toISOString(),
        })
      ).catch((e) => console.log("Failed to save draft", e));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [exercises, setDrafts, exerciseUnits, sessionTitle]);

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

  const updateDraft = (exerciseId: string, field: "weight" | "reps", value: string) => {
    setSetDrafts((prev) => ({
      ...prev,
      [exerciseId]: {
        weight: prev[exerciseId]?.weight || "",
        reps: prev[exerciseId]?.reps || "",
        [field]: value,
      },
    }));
  };

  const addSetToExercise = (exerciseId: string, unit: Unit) => {
    const draft = setDrafts[exerciseId] || { weight: "", reps: "" };
    if (!draft.reps.trim()) return;
    const weightNum = parseFloat(draft.weight);
    const weightKg =
      Number.isNaN(weightNum) || draft.weight.trim() === ""
        ? null
        : unit === "kg"
        ? weightNum
        : convertWeight(weightNum, "lbs", "kg");
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: [...ex.sets, { weightKg, reps: draft.reps.trim(), done: false }] }
          : ex
      )
    );
    setSetDrafts((prev) => ({ ...prev, [exerciseId]: { weight: "", reps: "" } }));
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
    if (editingSet.exerciseId === exerciseId && editingSet.setIndex === setIndex) {
      setEditingSet({ exerciseId: null, setIndex: null, weight: "", reps: "" });
    }
  };

  const startEditSet = (exerciseId: string, setIndex: number, set: SetEntry, unit: Unit) => {
    setEditingSet({
      exerciseId,
      setIndex,
      weight: formatWeightInput(set.weightKg, unit),
      reps: set.reps,
    });
  };

  const saveEditSet = (exerciseId: string, setIndex: number, unit: Unit) => {
    if (editingSet.exerciseId !== exerciseId || editingSet.setIndex !== setIndex) return;
    const weightNum = parseFloat(editingSet.weight);
    const weightKg =
      editingSet.weight.trim() === "" || Number.isNaN(weightNum)
        ? null
        : unit === "kg"
        ? weightNum
        : convertWeight(weightNum, "lbs", "kg");
    const repsVal = editingSet.reps.trim();
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) =>
                idx === setIndex ? { ...s, weightKg, reps: repsVal || s.reps } : s
              ),
            }
          : ex
      )
    );
    setEditingSet({ exerciseId: null, setIndex: null, weight: "", reps: "" });
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
      setSetDrafts((prev) => {
        const copy = { ...prev };
        delete copy[exerciseId];
        return copy;
      });
      setExerciseUnits((prev) => {
        const copy = { ...prev };
        delete copy[exerciseId];
        return copy;
      });
      if (editingSet.exerciseId === exerciseId) {
        setEditingSet({ exerciseId: null, setIndex: null, weight: "", reps: "" });
      }
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

  const finishWorkout = async () => {
    if (!exercises.length) return;
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Not signed in", "Please sign in again to save your workout.");
      return;
    }
    try {
      setSaving(true);
      const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
      const totalVolumeKg = exercises.reduce((sum, ex) => {
        const exVol = ex.sets.reduce((s, set) => {
          const repsNum = parseFloat(set.reps);
          if (Number.isNaN(repsNum) || set.weightKg === null) return s;
          return s + set.weightKg * repsNum;
        }, 0);
        return sum + exVol;
      }, 0);
      const durationMinutes = Math.max(
        0,
        Math.floor((Date.now() - startTimeRef.current.getTime()) / 60000)
      );
      const payload = {
        title: sessionTitle || "Workout",
        exercises: exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.map((s) => ({
            weightKg: s.weightKg,
            reps: s.reps,
            done: s.done,
          })),
        })),
        totalSets,
        totalVolumeKg,
        totalExercises: exercises.length,
        startedAt: Timestamp.fromDate(startTimeRef.current),
        endedAt: Timestamp.fromDate(new Date()),
        createdAt: Timestamp.now(),
        status: "completed",
        durationMinutes,
      };
      await addDoc(collection(db, "users", user.uid, "workouts"), payload);
      setExercises([]);
      setSetDrafts({});
      setExerciseUnits({});
      startTimeRef.current = new Date();
      setSessionTitle("");
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      setSummary({
        title: payload.title,
        totalSets,
        totalVolumeKg,
        totalExercises: exercises.length,
        durationMinutes,
      });
      setShowSummary(true);
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
    const currentUnit = exerciseUnits[exerciseId] || "kg";
    if (currentUnit === next) return;
    setSetDrafts((prev) => {
      const draft = prev[exerciseId];
      if (!draft) return prev;
      const w = parseFloat(draft.weight);
      if (Number.isNaN(w)) return prev;
      const converted = convertWeight(w, currentUnit, next);
      return {
        ...prev,
        [exerciseId]: {
          ...draft,
          weight: converted === null ? draft.weight : `${Math.round(converted * 10) / 10}`,
        },
      };
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
  const totalVolumeKg = useMemo(() => {
    return exercises.reduce((sum, ex) => {
      const exVol = ex.sets.reduce((s, set) => {
        const repsNum = parseFloat(set.reps);
        if (Number.isNaN(repsNum) || set.weightKg === null) return s;
        return s + set.weightKg * repsNum;
      }, 0);
      return sum + exVol;
    }, 0);
  }, [exercises]);

  return (
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
      </View>

      {exercises.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.muted}>No exercises added yet.</Text>
        </View>
      ) : (
        exercises.map((ex) => {
          const draft = setDrafts[ex.id] || { weight: "", reps: "" };
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
                        key={item}
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
                  <View key={idx} style={styles.setContainer}>
                    {editingSet.exerciseId === ex.id && editingSet.setIndex === idx ? (
                      <>
                        <View style={styles.row}>
                          <TextInput
                            placeholder={`Weight (${unit})`}
                            placeholderTextColor="#7a7a8c"
                            keyboardType="numeric"
                            value={editingSet.weight}
                            onChangeText={(v) =>
                              setEditingSet((prev) => ({ ...prev, weight: v }))
                            }
                            style={[styles.input, styles.halfInput]}
                          />
                          <TextInput
                            placeholder="Reps"
                            placeholderTextColor="#7a7a8c"
                            keyboardType="numeric"
                            value={editingSet.reps}
                            onChangeText={(v) =>
                              setEditingSet((prev) => ({ ...prev, reps: v }))
                            }
                            style={[styles.input, styles.halfInput]}
                          />
                        </View>
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={[styles.miniButton, { backgroundColor: "#7b61ff" }]}
                            onPress={() => saveEditSet(ex.id, idx, unit)}
                          >
                            <Text style={styles.miniButtonText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.miniButton, { backgroundColor: "rgba(255,255,255,0.15)" }]}
                            onPress={() =>
                              setEditingSet({ exerciseId: null, setIndex: null, weight: "", reps: "" })
                            }
                          >
                            <Text style={styles.miniButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.setRow, { justifyContent: "space-between" }]}>
                        <TouchableOpacity
                          style={styles.setInfo}
                          onPress={() => toggleSetDone(ex.id, idx)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.checkbox, s.done && styles.checkboxChecked]}>
                            {s.done ? <Ionicons name="checkmark" size={14} color="#0d0d1a" /> : null}
                          </View>
                          <Text style={[styles.setText, s.done && styles.setTextDone]}>
                            Set {idx + 1}: {s.reps} reps{" "}
                            {s.weightKg === null ? "" : `@ ${formatWeight(s.weightKg, unit)}`}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.actions}>
                          <TouchableOpacity
                            onPress={() => startEditSet(ex.id, idx, s, unit)}
                            style={styles.iconButton}
                          >
                            <Ionicons name="create-outline" size={18} color="#cdd0e0" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => deleteSet(ex.id, idx)}
                            style={styles.iconButton}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ff7a7a" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              )}
              <View style={styles.row}>
                <TextInput
                  placeholder={`Weight (${unit})`}
                  placeholderTextColor="#7a7a8c"
                  keyboardType="numeric"
                  value={draft.weight}
                  onChangeText={(v) => updateDraft(ex.id, "weight", v)}
                  style={[styles.input, styles.halfInput]}
                />
                <TextInput
                  placeholder="Reps"
                  placeholderTextColor="#7a7a8c"
                  keyboardType="numeric"
                  value={draft.reps}
                  onChangeText={(v) => updateDraft(ex.id, "reps", v)}
                  style={[styles.input, styles.halfInput]}
                />
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => addSetToExercise(ex.id, unit)}
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

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.muted}>Exercises: {exercises.length}</Text>
        <Text style={styles.muted}>Total sets: {totalSets}</Text>
        <Text style={styles.muted}>
          Volume: {Math.round(totalVolumeKg * 10) / 10} kg
        </Text>
        <Text style={styles.muted}>Duration: {elapsedMinutes} min</Text>
      </View>

      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 16, opacity: saving ? 0.6 : 1 }]}
        onPress={finishWorkout}
        disabled={saving}
      >
        <Text style={styles.secondaryText}>
          {saving ? "Saving..." : `Finish workout (${totalSets} sets)`}
        </Text>
      </TouchableOpacity>

      <Modal visible={showSummary} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{summary?.title || "Workout saved"}</Text>
            <Text style={styles.modalText}>Exercises: {summary?.totalExercises ?? 0}</Text>
            <Text style={styles.modalText}>Sets: {summary?.totalSets ?? 0}</Text>
            <Text style={styles.modalText}>
              Volume: {summary ? Math.round(summary.totalVolumeKg * 10) / 10 : 0} kg
            </Text>
            <Text style={styles.modalText}>
              Duration: {summary?.durationMinutes ?? 0} min
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalActionButton, styles.modalPrimaryButton]}
                onPress={() => {
                  setShowSummary(false);
                  router.replace("/(tabs)/home");
                }}
              >
                <Text style={styles.primaryText}>Back to Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.modalActionButton, styles.modalSecondaryButton]}
                onPress={() => {
                  setShowSummary(false);
                  Alert.alert("Share", "Sharing is coming soon.");
                }}
              >
                <Text style={styles.secondaryText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  row: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1, marginBottom: 0 },
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
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
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
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  modalSecondaryButton: { marginTop: 0, paddingVertical: 12 },
});
