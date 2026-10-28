import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  Text,
  type TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { Pencil } from "lucide-react-native";
import { useEventCallbacks } from "../hooks/useEventCallbacks";
import { useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import { NotebookTextInput } from "../ui/notebook/NotebookTextInput";
import { notebookFonts } from "../ui/notebook/tokens";
import type { AvailableWeights } from "../workouts/availableWeights";
import { effortToRpe } from "../workouts/effortScale";
import {
  EXERCISE_CATALOG,
  EXERCISE_GROUPS,
  type ExerciseCatalogItem,
  type ExerciseGroupKey,
} from "../workouts/exerciseCatalog";
import {
  getExerciseSubstitutions,
  indexExerciseSearch,
  replacementSearchOptions,
  resolveReplacementTarget,
  searchExerciseIndex,
} from "../workouts/exerciseSearch";
import { loadFreeExerciseDbCatalog } from "../workouts/freeExerciseDbCatalog";
import { resolveFreeExerciseDbImagesForNames } from "../workouts/freeExerciseDbImages";
import { AvailableWeightsModal } from "../workouts/workoutLog/AvailableWeightsModal";
import { insertWarmupSets } from "../workouts/workoutLog/warmupSets";
import { WarmupSetsSheet } from "../workouts/workoutLog/WarmupSetsSheet";
import { WorkoutExerciseActions } from "../workouts/workoutLog/WorkoutExerciseActions";
import { useWorkoutExerciseCards } from "../workouts/workoutLog/WorkoutExerciseCards";
import { WorkoutExerciseDemo } from "../workouts/workoutLog/WorkoutExerciseDemo";
import {
  SET_TYPE_LABELS,
  DEFAULT_TEMPO_INDICES,
  TEMPO_TOKENS,
  formatTempoFromIndices,
  parseTempoToIndices,
  type Exercise,
  type SetEntry,
  type Unit,
} from "../workouts/workoutLog/workoutLogModel";
import { createStyles } from "../workouts/workoutLog/workoutLogStyles";
import { WorkoutModalShell } from "../workouts/workoutLog/WorkoutModalShell";
import { parseSharedWorkoutPlan } from "./sharingContract";
import { sharingPlanToExercises } from "./sharingPlan";
import type { SharedWorkoutPlan } from "./sharingService";

const emptySet = (): SetEntry => ({
  weightKg: null,
  reps: "",
  rpe: "",
  done: false,
  setType: "normal",
});
const newSharingExerciseId = () => `sharing-${Date.now()}-${Math.random()}`;
type Picker = {
  kind: "rest" | "tempo" | "time" | "distance";
  id: string;
  index?: number;
};
/** Owns only a plan copy. It never mounts workout persistence, account preferences or session clocks. */
export function SharingPlanEditor({
  plan,
  onCancel,
  onReview,
}: {
  plan: SharedWorkoutPlan;
  onCancel: () => void;
  onReview: (plan: SharedWorkoutPlan) => void;
}) {
  const { colors } = useNotebook(),
    styles = useNotebookStyles(createStyles),
    { fontScale, width } = useWindowDimensions();
  const initial = useMemo(() => sharingPlanToExercises(plan, "editor"), [plan]);
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    initial.exercises.map((e, i) => ({
      ...e,
      sets: e.sets.map((s, j) => ({
        ...s,
        rpe: plan.exercises[i].sets[j].targetRpe?.toString() || "",
      })),
    })),
  );
  const [exerciseUnits, setExerciseUnits] = useState(initial.units),
    [rest, setRest] = useState(initial.rest),
    [title, setTitle] = useState(plan.title);
  const titleInput = useRef<TextInput>(null);
  const [titleSelection, setTitleSelection] = useState<{ start: number; end: number }>();
  const [demo, setDemo] = useState<{
    exercise: ExerciseCatalogItem;
    images: string[];
  } | null>(null);
  const [catalog, setCatalog] = useState(EXERCISE_CATALOG),
    [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null),
    [warmupId, setWarmupId] = useState<string | null>(null),
    [weightsId, setWeightsId] = useState<string | null>(null);
  const [weights, setWeights] = useState<
      Record<string, AvailableWeights | null>
    >({}),
    [favorites, setFavorites] = useState<string[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null),
    [replaceSearch, setReplaceSearch] = useState(""),
    [replaceGroup, setReplaceGroup] = useState("all");
  const [replacementPage, setReplacementPage] = useState({
      key: "",
      limit: 24,
    }),
    [editingSet, setEditingSet] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<{ id: string; index: number } | null>(
      null,
    ),
    [undo, setUndo] = useState<{
      exerciseId: string;
      setIndex: number;
      set: SetEntry;
    } | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null),
    [field, setField] = useState(""),
    [minutes, setMinutes] = useState("");
  const [adding, setAdding] = useState(false),
    [addQuery, setAddQuery] = useState(""),
    [addGroup, setAddGroup] = useState<ExerciseGroupKey | "all">("all"),
    [customExercise, setCustomExercise] = useState("");
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  useEffect(() => {
    let live = true;
    void loadFreeExerciseDbCatalog()
      .then((remote) => {
        if (live)
          setCatalog([
            ...EXERCISE_CATALOG,
            ...remote.filter(
              (e) => !EXERCISE_CATALOG.some((base) => base.name === e.name),
            ),
          ]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const index = useMemo(() => indexExerciseSearch(catalog), [catalog]);
  const addOptions = useMemo(
    () => searchExerciseIndex(
      index.filter(({ item }) => addGroup === "all" || item.group === addGroup),
      addQuery,
    ).slice(0, 40),
    [index, addGroup, addQuery],
  );
  const find = (name: string): ExerciseCatalogItem | null =>
    resolveReplacementTarget(index, name) ?? null;
  const mode = (name: string): "resistance" | "cardio" =>
    exercises.find((e) => e.name === name)?.mode ??
    (find(name)?.group === "cardio" ? "cardio" : "resistance");
  const active = exercises.find((e) => e.id === activeId) ?? null,
    warmup = exercises.find((e) => e.id === warmupId),
    weightExercise = exercises.find((e) => e.id === weightsId);
  const target = exercises.find((e) => e.id === replaceTarget),
    targetItem = target ? find(target.name) : null;
  const replacements = replacementSearchOptions({
    index,
    query: replaceSearch,
    group: replaceGroup as ExerciseGroupKey | "all",
    targetName: targetItem?.name || target?.name || "",
    targetGroup: targetItem?.group,
    suggestions: targetItem
      ? getExerciseSubstitutions(catalog, targetItem, 80)
      : [],
    limit: 80,
  });
  const change = (id: string, update: (e: Exercise) => Exercise) => {
    setExercises((all) => all.map((e) => (e.id === id ? update(e) : e)));
    setError("");
  };
  const changeSet = (id: string, i: number, value: Partial<SetEntry>) =>
    change(id, (e) => ({
      ...e,
      sets: e.sets.map((s, j) => (j === i ? { ...s, ...value } : s)),
    }));
  const removeSet = (id: string, i: number) => {
    const e = exercises.find((e) => e.id === id);
    if (!e?.sets[i]) return;
    setUndo({ exerciseId: id, setIndex: i, set: e.sets[i] });
    change(id, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== i) }));
    setEditingSet(null);
  };
  const openPicker = (value: Picker, text: string, mins = "") => {
    Keyboard.dismiss();
    setPicker(value);
    setField(text);
    setMinutes(mins);
  };
  const addExercise = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = newSharingExerciseId();
    const exerciseMode = find(trimmed)?.group === "cardio" ? "cardio" : "resistance";
    setExercises((all) => [...all, { id, name: trimmed, mode: exerciseMode, sets: [emptySet()] }]);
    setExerciseUnits((all) => ({ ...all, [id]: exerciseMode === "cardio" ? "km" : "kg" }));
    setAdding(false);
    setAddQuery("");
    setCustomExercise("");
  };
  const actions = useEventCallbacks({
    openWarmup: setWarmupId,
    revealNote: () => {},
    openExerciseDemo: async (name: string) => {
      const exercise = find(name);
      if (!exercise) {
        setError("This custom exercise does not have a demo yet.");
        return;
      }
      const images = await resolveFreeExerciseDbImagesForNames([name]).catch(
        () => ({}) as Record<string, string[]>,
      );
      setDemo({ exercise, images: images[name.trim().toLowerCase()] ?? [] });
    },
    openExerciseHistory: () => {},
    openExerciseActions: setActiveId,
    setReplaceSearch,
    setReplaceGroup,
    closeReplacement: () => setReplaceTarget(null),
    replaceExercise: (id: string, name: string) => {
      change(id, (e) => ({
        ...e,
        name,
        mode: find(name)?.group === "cardio" ? "cardio" : "resistance",
        notes: "",
        tempo: "",
        sets: [emptySet()],
      }));
      setExerciseUnits((all) => ({
        ...all,
        [id]: mode(name) === "cardio" ? "km" : "kg",
      }));
      setReplaceTarget(null);
    },
    updateExerciseNotes: (id: string, notes: string) =>
      change(id, (e) => ({ ...e, notes })),
    openTempoEditor: (id: string, tempo?: string) =>
      openPicker({ kind: "tempo", id }, tempo || "3-0-X-0"),
    openRestTimerModal: (id: string) =>
      openPicker({ kind: "rest", id }, String(rest[id] ?? 90)),
    updateSetWeight: (id: string, i: number, unit: Unit, text: string) =>
      changeSet(id, i, {
        weightKg:
          text.trim() && Number.isFinite(Number(text))
            ? Number(text) / (unit === "lbs" ? 2.20462 : 1)
            : null,
        weightText: text,
      }),
    updateSetReps: (id: string, i: number, reps: string) =>
      changeSet(id, i, { reps }),
    updateSetRpe: (id: string, i: number, value: string) => {
      const rpe = effortToRpe(value, plan.effortScale);
      changeSet(id, i, {
        rpe: rpe == null ? "" : String(rpe),
        effortInput: { scale: plan.effortScale, value, canonicalRpe: rpe },
      });
    },
    toggleSetDone: () => {},
    removeSetWithUndo: removeSet,
    openSetMenu: (id: string, i: number) => setSetMenu({ id, index: i }),
    copyLastSetToCurrent: () => {},
    openCardioTimeModal: (
      id: string,
      i: number,
      sec: number | null | undefined,
    ) =>
      openPicker(
        { kind: "time", id, index: i },
        String(Math.floor((sec || 0) / 3600)),
        String(Math.floor(((sec || 0) % 3600) / 60)),
      ),
    openCardioDistanceModal: (
      id: string,
      i: number,
      km: number | null,
      unit: Unit,
    ) =>
      openPicker(
        { kind: "distance", id, index: i },
        km == null ? "" : String(km / (unit === "mi" ? 1.60934 : 1)),
      ),
    setExercises,
    updateCardioSessionType: (
      id: string,
      value: NonNullable<Exercise["cardioSessionType"]>,
    ) => change(id, (e) => ({ ...e, cardioSessionType: value })),
    updateCardioEffortLevel: (
      id: string,
      value: NonNullable<Exercise["cardioEffortLevel"]>,
    ) => change(id, (e) => ({ ...e, cardioEffortLevel: value })),
    addEmptySet: (id: string) =>
      change(id, (e) => ({ ...e, sets: [...e.sets, emptySet()] })),
    duplicateLastSet: (id: string) =>
      change(id, (e) => ({
        ...e,
        sets: [
          ...e.sets,
          { ...(e.sets.at(-1) || emptySet()), done: false, setType: "normal" },
        ],
      })),
    undoRemoveSet: () => {
      if (undo)
        change(undo.exerciseId, (e) => ({
          ...e,
          sets: [
            ...e.sets.slice(0, undo.setIndex),
            undo.set,
            ...e.sets.slice(undo.setIndex),
          ],
        }));
      setUndo(null);
    },
  });
  const cards = useWorkoutExerciseCards({
    planMode: true,
    exercises,
    exerciseUnits,
    getExerciseMode: mode,
    effortScale: plan.effortScale,
    previousExerciseSetsByName: new Map(),
    findCatalogExercise: find,
    restTimerByExercise: Object.fromEntries(
      exercises.map((e) => [
        e.id,
        { remainingSec: rest[e.id] ?? 90, running: false },
      ]),
    ),
    replaceTarget,
    replaceSearch,
    replaceGroup,
    replacementOptions: replacements,
    replacementLimit: replacementPage.limit,
    replacementPageKey: `${replaceTarget}:${replaceSearch}:${replaceGroup}`,
    isTabletLayout: width >= 700,
    formatLastSetSummary: () => "",
    scrollNativeGesture: scrollGesture,
    getExerciseZone: () => "",
    undoDeletedSet: undo,
    cardActions: actions,
    styles,
    colors,
    fontScale,
    editingSet,
    warmupTarget: warmup
      ? {
          uid: "sharing-editor",
          exercise: warmup,
          unit: exerciseUnits[warmup.id] === "lbs" ? "lbs" : "kg",
          barbell: /barbell|bench press/i.test(warmup.name),
        }
      : null,
    cardioTimeTarget:
      picker?.kind === "time"
        ? { exerciseId: picker.id, setIndex: picker.index! }
        : null,
    cardioDistanceTarget:
      picker?.kind === "distance"
        ? { exerciseId: picker.id, setIndex: picker.index! }
        : null,
    showCardioTimeModal: picker?.kind === "time",
    showCardioDistanceModal: picker?.kind === "distance",
    setEditingSet,
    setReplacementPage,
  });
  const review = () => {
    try {
      if (
        exercises.some((e) =>
          e.sets.some(
            (s) =>
              s.weightText?.trim() &&
              (!/^\d*(?:\.\d*)?$/.test(s.weightText.trim()) ||
                !Number.isFinite(Number(s.weightText))),
          ),
        )
      )
        throw Error("Enter a valid weight or leave it empty.");
      onReview(
        parseSharedWorkoutPlan({
          version: 1,
          title,
          effortScale: plan.effortScale,
          exercises: exercises.map((e) => ({
            name: e.name,
            mode: mode(e.name),
            unit: exerciseUnits[e.id],
            restSec: rest[e.id] ?? 90,
            tempo: e.tempo || "",
            instructions: e.notes || "",
            ...(mode(e.name) === "cardio" && e.cardioSessionType
              ? { cardioSessionType: e.cardioSessionType }
              : {}),
            ...(mode(e.name) === "cardio" && e.cardioEffortLevel
              ? { cardioEffortLevel: e.cardioEffortLevel }
              : {}),
            sets: e.sets.map((s) => ({
              weightKg: s.weightKg,
              reps: s.reps,
              targetRpe: s.rpe?.trim() ? Number(s.rpe) : null,
              setType: s.setType || "normal",
              durationSec: s.durationSec ?? null,
              distanceKm: s.distanceKm ?? null,
            })),
          })),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the workout values.");
    }
  };
  const applyPicker = () => {
    if (!picker) return;
    const n = Number(field);
    if (
      picker.kind !== "tempo" &&
      (!field.trim() || !Number.isFinite(n) || n < 0)
    ) {
      setError("Enter a valid value.");
      return;
    }
    if (picker.kind === "rest") {
      if (!Number.isInteger(n) || n > 3600) {
        setError("Enter 0 to 3600 seconds.");
        return;
      }
      setRest((r) => ({ ...r, [picker.id]: n }));
    }
    if (picker.kind === "tempo") {
      if (field && !/^(?:\d{1,2}|X)(?:-(?:\d{1,2}|X)){3}$/i.test(field)) {
        setError("Use four tempo parts, such as 3-0-X-0.");
        return;
      }
      change(picker.id, (e) => ({ ...e, tempo: field }));
    }
    if (picker.kind === "time") {
      const m = Number(minutes);
      if (
        !Number.isInteger(n) ||
        !Number.isInteger(m) ||
        m < 0 ||
        m > 59 ||
        n * 3600 + m * 60 > 86400
      ) {
        setError("Enter valid hours and minutes.");
        return;
      }
      changeSet(picker.id, picker.index!, { durationSec: n * 3600 + m * 60 });
    }
    if (picker.kind === "distance")
      changeSet(picker.id, picker.index!, {
        distanceKm: n * (exerciseUnits[picker.id] === "mi" ? 1.60934 : 1),
      });
    setPicker(null);
    setError("");
  };
  const button = (label: string, action: () => void) => (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.secondaryButton, { marginTop: 8 }]}
      onPress={action}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <>
      <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Edit workout</Text>
      <GestureDetector gesture={scrollGesture}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 4 }}>
            <NotebookTextInput
              ref={titleInput}
              accessibilityLabel="Workout title"
              placeholder="Workout title"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setTitleSelection(undefined);
              }}
              selection={titleSelection}
              onTouchStart={() => setTitleSelection(undefined)}
              onBlur={() => setTitleSelection(undefined)}
              onSelectionChange={({ nativeEvent: { selection } }) => {
                if (titleSelection && selection.start === titleSelection.start && selection.end === titleSelection.end) {
                  setTitleSelection(undefined);
                }
              }}
              maxLength={80}
              style={[styles.input, {
                fontFamily: notebookFonts.editorial, fontWeight: "600",
                fontSize: 26, lineHeight: 32, paddingVertical: 0, minHeight: 44, borderWidth: 0,
                borderRadius: 0, paddingHorizontal: 0, flexShrink: 1,
                minWidth: 100, marginBottom: 0,
              }]}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Edit workout title"
              onPress={() => {
                titleInput.current?.focus();
                setTitleSelection({ start: 0, end: title.length });
              }}
              style={{ width: 44, minHeight: 44, alignItems: "flex-start", paddingLeft: 4, justifyContent: "center" }}
            >
              <Pencil size={18} strokeWidth={1.5} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {cards}
          {button("Add exercise", () => setAdding(true))}
        </View>
      </GestureDetector>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
      {button("Review workout", review)}
      {button("Cancel", onCancel)}
      <WorkoutModalShell
        visible={!!demo}
        onRequestClose={() => setDemo(null)}
        backdropStyle={styles.modalBackdrop}
        cardStyle={styles.modalCard}
      >
        <WorkoutExerciseDemo
          styles={styles}
          activeDemoExercise={demo?.exercise ?? null}
          activeDemoImageUris={demo?.images ?? []}
          closeExerciseDemo={() => setDemo(null)}
        />
      </WorkoutModalShell>
      <WorkoutModalShell
        visible={!!active}
        onRequestClose={() => setActiveId(null)}
        backdropStyle={styles.modalBackdrop}
        cardStyle={styles.modalCard}
      >
        <WorkoutExerciseActions
          styles={styles}
          colors={colors}
          activeActionExercise={active}
          activeActionMode={mode(active?.name || "")}
          activeActionUnit={exerciseUnits[activeId || ""] || "kg"}
          activeExerciseActionId={activeId}
          activeActionIndex={exercises.findIndex((e) => e.id === activeId)}
          exercises={exercises}
          availableWeightsPreferences={{ loaded: true }}
          setAvailableWeightsTarget={() => {
            setWeightsId(activeId);
            setActiveId(null);
          }}
          closeExerciseActions={() => setActiveId(null)}
          moveExercise={(id, delta) =>
            setExercises((all) => {
              const list = [...all],
                at = list.findIndex((e) => e.id === id),
                to = at + delta;
              if (at >= 0 && to >= 0 && to < list.length)
                [list[at], list[to]] = [list[to], list[at]];
              return list;
            })
          }
          setReplaceTarget={setReplaceTarget}
          setReplaceSearch={setReplaceSearch}
          setReplaceGroup={setReplaceGroup}
          activeActionIsFavorite={favorites.includes(active?.name || "")}
          toggleFavoriteExercise={(name) =>
            setFavorites((all) =>
              all.includes(name)
                ? all.filter((n) => n !== name)
                : [...all, name],
            )
          }
          deleteExercise={(id) =>
            setExercises((all) => all.filter((e) => e.id !== id))
          }
          toggleExerciseUnit={(id, unit) => {
            change(id, (e) => ({
              ...e,
              sets: e.sets.map((s) => ({ ...s, weightText: undefined })),
            }));
            setExerciseUnits((all) => ({ ...all, [id]: unit }));
          }}
        />
      </WorkoutModalShell>
      {warmup && (
        <WarmupSetsSheet
          key={warmup.id}
          uid="sharing-editor"
          loadRemembered={false}
          name={warmup.name}
          sets={warmup.sets}
          unit={exerciseUnits[warmup.id] === "lbs" ? "lbs" : "kg"}
          barbell={/barbell|bench press/i.test(warmup.name)}
          settings={weights[warmup.id] ?? undefined}
          onClose={() => setWarmupId(null)}
          onApply={(rows) => {
            const result = insertWarmupSets(
              warmup.sets,
              rows,
              exerciseUnits[warmup.id] === "lbs" ? "lbs" : "kg",
            );
            change(warmup.id, (e) => ({
              ...e,
              sets: result.map((s) => ({
                ...s,
                setType: s.setType as SetEntry["setType"],
              })),
            }));
            setWarmupId(null);
            return null;
          }}
        />
      )}
      {weightExercise && (
        <AvailableWeightsModal
          name={weightExercise.name}
          settings={weights[weightExercise.id] ?? null}
          defaultUnit={
            exerciseUnits[weightExercise.id] === "lbs" ? "lbs" : "kg"
          }
          onClose={() => setWeightsId(null)}
          onSave={async (value) => {
            setWeights((all) => ({ ...all, [weightExercise.id]: value }));
            setWeightsId(null);
          }}
        />
      )}
      <WorkoutModalShell
        visible={!!setMenu}
        onRequestClose={() => setSetMenu(null)}
        backdropStyle={styles.modalBackdrop}
        cardStyle={styles.modalCard}
      >
        <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Set options</Text>
        <View style={styles.answerRow}>
          {SET_TYPE_LABELS.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={styles.answerChip}
              onPress={() => {
                if (setMenu)
                  changeSet(setMenu.id, setMenu.index, { setType: type.value });
                setSetMenu(null);
              }}
            >
              <Text style={styles.answerText}>{type.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {button("Duplicate set", () => {
          if (setMenu)
            change(setMenu.id, (e) => ({
              ...e,
              sets: [
                ...e.sets.slice(0, setMenu.index + 1),
                { ...e.sets[setMenu.index] },
                ...e.sets.slice(setMenu.index + 1),
              ],
            }));
          setSetMenu(null);
        })}
        {button("Delete set", () => {
          if (setMenu) removeSet(setMenu.id, setMenu.index);
          setSetMenu(null);
        })}
      </WorkoutModalShell>
      <WorkoutModalShell
        visible={!!picker}
        onRequestClose={() => {
          setPicker(null);
          setError("");
        }}
        backdropStyle={styles.modalBackdrop}
        cardStyle={styles.modalCard}
      >
        <Text style={[styles.modalTitle, { marginBottom: 12 }]}>
          {picker?.kind === "time"
            ? "Set Cardio Time"
            : picker?.kind === "rest"
              ? "Rest interval"
              : picker?.kind === "tempo"
                ? "Adjust Tempo"
                : "Distance"}
        </Text>
        {picker?.kind === "time" ? (
          <>
            <View style={styles.durationFieldRow}>
              <NotebookTextInput
                accessibilityLabel="Hours"
                keyboardType="number-pad"
                value={field}
                onChangeText={setField}
                style={styles.durationFieldInput}
              />
              <Text style={styles.durationFieldColon}>:</Text>
              <NotebookTextInput
                accessibilityLabel="Minutes"
                keyboardType="number-pad"
                value={minutes}
                onChangeText={setMinutes}
                style={styles.durationFieldInput}
              />
            </View>
            <View style={styles.durationFieldLabelRow}>
              <Text style={styles.durationFieldLabel}>Hours</Text>
              <Text style={styles.durationFieldLabel}>Minutes</Text>
            </View>
          </>
        ) : picker?.kind === "rest" ? (
          <>
            <Text style={styles.modalText}>Choose the rest interval for this workout.</Text>
            <View style={styles.answerRow}>
              {[60, 90, 120].map((seconds) => (
                <TouchableOpacity
                  key={seconds}
                  accessibilityRole="button"
                  style={[styles.answerChip, Number(field) === seconds && styles.answerChipActive]}
                  onPress={() => setField(String(seconds))}
                >
                  <Text style={[styles.answerText, Number(field) === seconds && styles.answerTextActive]}>{seconds}s</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: 12, gap: 4 }}>
              <Text style={styles.noteLabel}>Seconds</Text>
              <NotebookTextInput
                accessibilityLabel="Custom rest seconds"
                placeholder="Custom (sec)"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={field}
                onChangeText={setField}
                style={styles.input}
              />
            </View>
          </>
        ) : picker?.kind === "tempo" ? (
          <>
            <Text style={styles.modalText}>Eccentric - Hold - Concentric - Hold</Text>
            <Text style={[styles.muted, { marginBottom: 16 }]}>Values: X, 0, 1, 2, 3</Text>
            {[
              { label: "Eccentric", index: 0 },
              { label: "Hold", index: 1 },
              { label: "Concentric", index: 2 },
              { label: "Hold", index: 3 },
            ].map((segment) => {
              const indices = parseTempoToIndices(field);
              const value = indices[segment.index] ?? DEFAULT_TEMPO_INDICES[segment.index];
              return (
                <View key={segment.index} style={styles.tempoSliderRow}>
                  <Text style={styles.tempoSliderLabel}>{segment.label}</Text>
                  <Slider
                    style={styles.tempoSlider}
                    minimumValue={0}
                    maximumValue={4}
                    step={1}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.rule}
                    thumbTintColor={colors.muted}
                    value={value}
                    onValueChange={(next) => {
                      const changed = [...parseTempoToIndices(field)];
                      changed[segment.index] = Number(next);
                      setField(formatTempoFromIndices(changed));
                    }}
                  />
                  <Text style={styles.tempoSliderValue}>{TEMPO_TOKENS[value]}</Text>
                </View>
              );
            })}
            <Text style={styles.modalText}>Tempo: {field}</Text>
          </>
        ) : (
          <NotebookTextInput
            accessibilityLabel={picker?.kind || "Value"}
            keyboardType="decimal-pad"
            value={field}
            onChangeText={setField}
            style={styles.input}
          />
        )}
        {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
        {button(picker?.kind === "tempo" ? "Save" : picker?.kind === "rest" ? "Set interval" : "Apply", applyPicker)}
        {picker?.kind === "tempo" && button("Clear tempo", () => {
          if (picker) change(picker.id, (exercise) => ({ ...exercise, tempo: "" }));
          setPicker(null);
          setError("");
        })}
        {button("Cancel", () => {
          setPicker(null);
          setError("");
        })}
      </WorkoutModalShell>
      <WorkoutModalShell
        visible={adding}
        onRequestClose={() => setAdding(false)}
        backdropStyle={styles.modalBackdrop}
        cardStyle={styles.modalCard}
      >
        <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Add exercise</Text>
        <View style={{ position: "relative" }}>
          <NotebookTextInput
            accessibilityLabel="Search exercises"
            placeholder="Search exercises"
            placeholderTextColor={colors.muted}
            value={addQuery}
            onChangeText={setAddQuery}
            style={[styles.input, { marginBottom: 0, paddingRight: 52 }]}
          />
          {addQuery.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Clear exercise search"
              onPress={() => setAddQuery("")}
              style={{ position: "absolute", right: 2, top: 0, bottom: 0, width: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={styles.groupChips}>
          {([{ key: "all", label: "All" }, ...EXERCISE_GROUPS] as const).map((group) => (
            <TouchableOpacity
              key={group.key}
              style={[styles.groupChip, addGroup === group.key && styles.groupChipActive]}
              onPress={() => setAddGroup(group.key)}
            >
              <Text style={[styles.groupChipText, addGroup === group.key && styles.groupChipTextActive]}>{group.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 320, marginTop: 12 }}
        >
          {addOptions.map((e) => (
              <TouchableOpacity
                key={e.name}
                style={styles.pickerRow}
                onPress={() => addExercise(e.name)}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerText}>{e.name}</Text>
                  <Text style={styles.muted}>
                    {e.primaryMuscles.slice(0, 2).join(", ")} | {e.equipment.slice(0, 2).join(", ")}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <NotebookTextInput
            accessibilityLabel="Custom exercise"
            placeholder="Custom exercise"
            placeholderTextColor={colors.muted}
            value={customExercise}
            onChangeText={setCustomExercise}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add custom exercise"
            onPress={() => addExercise(customExercise)}
            style={[styles.secondaryButton, { minWidth: 60, minHeight: 44, justifyContent: "center" }]}
          >
            <Text style={styles.secondaryText}>Add</Text>
          </TouchableOpacity>
        </View>
      </WorkoutModalShell>
    </>
  );
}
