import { Ionicons } from "@expo/vector-icons";
import { Check, Clock3, Gauge, Play, X } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import WorkoutGestureTextInput from "../../components/WorkoutGestureTextInput";
import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import { notebookRowHeight } from "../../ui/notebook/tokens";
import {
  effortInputValue,
  effortLabel,
  rpeToEffort,
  type EffortScale,
} from "../effortScale";
import { EXERCISE_GROUPS, type ExerciseCatalogItem } from "../exerciseCatalog";
import { clockLabel, RestTimerText } from "./TimerText";
import { WorkoutNativeSetRows } from "./WorkoutNativeSetRows";
import { applyCardioZone } from "./cardioZone";
import { lastResistanceSet, setRowPresentation } from "./setPresentation";
import type { RestClock } from "./timerClock";
import type { WarmupUnit } from "./warmupSets";
import {
  CARDIO_EFFORT_LEVELS,
  CARDIO_SESSION_TYPES,
  Exercise,
  ExerciseMode,
  formatDistanceInput,
  formatDurationHoursMinutes,
  formatWeightInput,
  getSetTypeMarker,
  normalizeExerciseName,
  SetEntry,
  SetType,
  Unit,
} from "./workoutLogModel";
import type { createStyles } from "./workoutLogStyles";
export type WorkoutExerciseCardsProps = {
  planMode?: boolean;
  exercises: Exercise[];
  exerciseUnits: Record<string, Unit>;
  getExerciseMode: (exerciseName: string) => ExerciseMode;
  effortScale: EffortScale;
  previousExerciseSetsByName: Map<
    string,
    {
      weightKg: number | null;
      reps: string;
      rpe?: string;
      distanceKm?: number | null;
      durationSec?: number | null;
      zone?: string;
      setType?: SetType;
    }[]
  >;
  findCatalogExercise: (name: string) => ExerciseCatalogItem | null;
  restTimerByExercise: Record<string, RestClock>;
  replaceTarget: string | null;
  replaceSearch: string;
  replaceGroup: string;
  replacementOptions: ExerciseCatalogItem[];
  replacementLimit: number;
  replacementPageKey: string;
  isTabletLayout: boolean;
  formatLastSetSummary: (set: {
    weightKg: number | null;
    reps: string;
    rpe?: string;
    distanceKm?: number | null;
    durationSec?: number | null;
    zone?: string;
  }) => string;
  scrollNativeGesture: ReturnType<typeof Gesture.Native>;
  getExerciseZone: (exercise: Exercise) => string;
  undoDeletedSet: {
    exerciseId: string;
    setIndex: number;
    set: SetEntry;
  } | null;
  cardActions: {
    openWarmup: (id: string) => void;
    revealNote: () => void;
    openExerciseDemo: (exerciseName: string) => Promise<void>;
    openExerciseHistory: (exerciseName: string) => void;
    openExerciseActions: (exerciseId: string) => void;
    setReplaceSearch: React.Dispatch<React.SetStateAction<string>>;
    setReplaceGroup: React.Dispatch<React.SetStateAction<string>>;
    closeReplacement: () => void;
    replaceExercise: (exerciseId: string, newName: string) => void;
    updateExerciseNotes: (exerciseId: string, notes: string) => void;
    openTempoEditor: (exerciseId: string, currentTempo?: string) => void;
    openRestTimerModal: (exerciseId: string) => void;
    updateSetWeight: (
      exerciseId: string,
      setIndex: number,
      unit: Unit,
      value: string,
    ) => void;
    updateSetReps: (
      exerciseId: string,
      setIndex: number,
      value: string,
    ) => void;
    updateSetRpe: (exerciseId: string, setIndex: number, value: string) => void;
    toggleSetDone: (exerciseId: string, setIndex: number) => void;
    removeSetWithUndo: (exerciseId: string, setIndex: number) => void;
    openSetMenu: (exerciseId: string, setIndex: number) => void;
    copyLastSetToCurrent: (exerciseId: string, setIndex: number) => void;
    openCardioTimeModal: (
      exerciseId: string,
      setIndex: number,
      currentSec: number | null | undefined,
    ) => void;
    openCardioDistanceModal: (
      exerciseId: string,
      setIndex: number,
      currentKm: number | null,
      unit: Unit,
    ) => void;
    setExercises: React.Dispatch<React.SetStateAction<Exercise[]>>;
    updateCardioSessionType: (
      exerciseId: string,
      value: "steady" | "intervals" | "sprint" | "recovery",
    ) => void;
    updateCardioEffortLevel: (
      exerciseId: string,
      value: "easy" | "moderate" | "hard" | "max",
    ) => void;
    addEmptySet: (exerciseId: string) => void;
    duplicateLastSet: (exerciseId: string) => void;
    undoRemoveSet: () => void;
  };
  styles: ReturnType<typeof createStyles>;
  colors: {
    canvas: string;
    surface: string;
    input: string;
    subtle: string;
    ink: string;
    muted: string;
    rule: string;
    border: string;
    accent: string;
    accentSoft: string;
    primary: string;
    onPrimary: string;
    danger: string;
    success: string;
    warning: string;
    overlay: string;
  };
  fontScale: number;
  editingSet: string | null;
  warmupTarget: {
    uid: string;
    exercise: Exercise;
    unit: WarmupUnit;
    barbell: boolean;
  } | null;
  cardioTimeTarget: { exerciseId: string; setIndex: number } | null;
  cardioDistanceTarget: { exerciseId: string; setIndex: number } | null;
  showCardioTimeModal: boolean;
  showCardioDistanceModal: boolean;
  setEditingSet: React.Dispatch<React.SetStateAction<string | null>>;
  setReplacementPage: React.Dispatch<
    React.SetStateAction<{ key: string; limit: number }>
  >;
};
export function useWorkoutExerciseCards({
  planMode = false,
  exercises,
  exerciseUnits,
  getExerciseMode,
  effortScale,
  previousExerciseSetsByName,
  findCatalogExercise,
  restTimerByExercise,
  replaceTarget,
  replaceSearch,
  replaceGroup,
  replacementOptions,
  replacementLimit,
  replacementPageKey,
  isTabletLayout,
  formatLastSetSummary,
  scrollNativeGesture,
  getExerciseZone,
  undoDeletedSet,
  cardActions,
  styles,
  colors,
  fontScale,
  editingSet,
  warmupTarget,
  cardioTimeTarget,
  cardioDistanceTarget,
  showCardioTimeModal,
  showCardioDistanceModal,
  setEditingSet,
  setReplacementPage,
}: WorkoutExerciseCardsProps) {
  return useMemo(
    () =>
      exercises.map((ex, exerciseIndex) => {
        const unit = exerciseUnits[ex.id] || "kg";
        const mode = getExerciseMode(ex.name);
        const isCardio = mode === "cardio";
        const largeText = fontScale >= 1.5;
        const usesNativeSetRows = Platform.OS === "android" && !isCardio;
        const weightLabel = isCardio
          ? "Distance"
          : unit === "kg"
            ? "kg"
            : unit === "lbs"
              ? "lbs"
              : "Weight";
        const repsLabel = isCardio ? "Time" : "Reps";
        const rpeLabel = isCardio ? "Zone" : effortLabel(effortScale);
        const previousSets =
          previousExerciseSetsByName.get(normalizeExerciseName(ex.name)) ?? [];
        const setDisplays = setRowPresentation(ex.sets, previousSets);
        const exerciseCatalogItem = findCatalogExercise(ex.name);
        const restTimer = restTimerByExercise[ex.id] ?? {
          remainingSec: 90,
          running: false,
        };
        return (
          <View
            key={ex.id}
            style={[
              styles.card,
              planMode && {
                paddingHorizontal: 12,
                borderRadius: 12,
                borderTopWidth: 0,
              },
            ]}
          >
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseOrdinal}>
                {String(exerciseIndex + 1).padStart(2, "0")}
              </Text>
              <TouchableOpacity
                style={styles.exerciseNameButton}
                disabled={planMode}
                onPress={() => cardActions.openExerciseHistory(ex.name)}
                accessibilityLabel={`View ${ex.name} history`}
              >
                <Text style={styles.exerciseName}>{ex.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${ex.name} actions`}
                style={styles.iconButton}
                onPress={() => cardActions.openExerciseActions(ex.id)}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
            {replaceTarget === ex.id ? (
              <View style={[styles.pickerCard, { marginTop: 10 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0, flex: 1 }]}>Replace exercise</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Close replace exercise"
                    onPress={cardActions.closeReplacement}
                    style={{ minWidth: 48, minHeight: 44, justifyContent: "center", alignItems: "flex-end" }}
                  >
                    <X size={22} color={colors.ink} strokeWidth={1.7} />
                  </TouchableOpacity>
                </View>
                <NotebookTextInput
                  disableFullscreenUI
                  placeholder="Search to replace"
                  placeholderTextColor={colors.muted}
                  value={replaceSearch}
                  onChangeText={cardActions.setReplaceSearch}
                  style={[styles.input, { marginBottom: 8 }]}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.groupChips}
                >
                  <TouchableOpacity
                    style={[
                      styles.groupChip,
                      replaceGroup === "all" && styles.groupChipActive,
                    ]}
                    onPress={() => cardActions.setReplaceGroup("all")}
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
                      onPress={() => cardActions.setReplaceGroup(g.key)}
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
                  {replacementOptions.slice(0, replacementLimit).map((item) => (
                    <TouchableOpacity
                      key={`${item.id}-${ex.id}`}
                      style={styles.pickerRow}
                      onPress={() =>
                        cardActions.replaceExercise(ex.id, item.name)
                      }
                    >
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={18}
                        color={colors.accent}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerText}>{item.name}</Text>
                        <Text style={styles.muted}>
                          {item.primaryMuscles.slice(0, 2).join(", ")} |{" "}
                          {item.equipment.slice(0, 2).join(", ")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {replacementOptions.length > replacementLimit ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.routineMenuRow}
                      onPress={() =>
                        setReplacementPage({
                          key: replacementPageKey,
                          limit: replacementLimit + 24,
                        })
                      }
                    >
                      <Text style={styles.linkText}>Show more exercises</Text>
                    </TouchableOpacity>
                  ) : null}
                  {replacementOptions.length === 0 ? (
                    <Text style={styles.replacementEmptyText}>
                      {exerciseCatalogItem
                        ? "No close alternatives found. Search for another exercise."
                        : "No clear movement match. Search for the exercise you want instead."}
                    </Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}
            <View
              style={[
                styles.inlineTipRow,
                planMode && { marginTop: 12, marginBottom: 12, justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
                largeText && { flexDirection: "column" },
              ]}
            >
              <TouchableOpacity
                style={[styles.restTimerInlineButton, planMode && { flex: 0, paddingHorizontal: 0 }]}
                onPress={() => cardActions.openExerciseDemo(ex.name)}
                accessibilityLabel={`Open ${ex.name} demo`}
              >
                <Play size={16} strokeWidth={1.5} color={colors.muted} />
                <Text style={styles.restTimerInlineText}>Demo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.restTimerInlineButton, planMode && { flex: 0, paddingHorizontal: 0 }]}
                onPress={() => cardActions.openRestTimerModal(ex.id)}
              >
                <Clock3 size={16} strokeWidth={1.5} color={colors.muted} />
                {planMode ? (
                  <Text style={styles.restTimerInlineText}>
                    Rest {clockLabel(restTimer.remainingSec)}
                  </Text>
                ) : (
                  <RestTimerText
                    style={styles.restTimerInlineText}
                    clock={restTimer}
                    prefix="Rest "
                  />
                )}
              </TouchableOpacity>
              {!isCardio ? (
                <TouchableOpacity
                  style={[styles.restTimerInlineButton, planMode && { flex: 0, paddingHorizontal: 0 }]}
                  onPress={() => cardActions.openTempoEditor(ex.id, ex.tempo)}
                >
                  <Gauge size={16} strokeWidth={1.5} color={colors.muted} />
                  <Text style={styles.restTimerInlineText}>
                    Tempo{ex.tempo?.trim() ? " " + ex.tempo : ""}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.exerciseMetaNotesSingle}>
              {!planMode && <Text style={styles.noteLabel}>Note</Text>}
              <NotebookTextInput
                disableFullscreenUI
                placeholder="Keep the last rep controlled"
                placeholderTextColor={colors.muted}
                accessibilityLabel={`${ex.name} ${planMode ? "instructions" : "note"}`}
                onFocus={cardActions.revealNote}
                value={ex.notes ?? ""}
                onChangeText={(v) => cardActions.updateExerciseNotes(ex.id, v)}
                style={[styles.input, styles.metaInput]}
              />
            </View>
            {!isCardio ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Add warm-up sets for ${ex.name}`}
                onPress={() => cardActions.openWarmup(ex.id)}
                style={{
                  alignSelf: "flex-start",
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <Text style={styles.linkText}>+ Add warm-up</Text>
              </TouchableOpacity>
            ) : null}
            <View
              style={[
                styles.setHeaderRow,
                largeText && { display: "none" },
                isTabletLayout && styles.setHeaderRowTablet,
                usesNativeSetRows && styles.nativeSetHeaderRow,
              ]}
            >
              {!isCardio ? (
                <Text style={[styles.setHeaderText, styles.setHeaderSet]}>
                  Set
                </Text>
              ) : null}
              {!planMode ? (
                <Text
                  style={[
                    styles.setHeaderText,
                    styles.setHeaderLast,
                    usesNativeSetRows && styles.nativeSetHeaderLast,
                  ]}
                >
                  Last
                </Text>
              ) : null}
              <View
                style={[
                  styles.setHeaderInputsGroup,
                  usesNativeSetRows && styles.nativeSetHeaderInputsGroup,
                ]}
              >
                <Text
                  style={[
                    styles.setHeaderText,
                    styles.setColReps,
                    usesNativeSetRows && styles.nativeSetHeaderInput,
                    planMode && usesNativeSetRows && { marginLeft: 12 },
                  ]}
                >
                  {isCardio ? "Time" : weightLabel}
                </Text>
                <Text
                  style={[
                    styles.setHeaderText,
                    styles.setColWeight,
                    usesNativeSetRows && styles.nativeSetHeaderInput,
                    planMode && usesNativeSetRows && { marginLeft: 12 },
                  ]}
                >
                  {isCardio ? String(unit).toLowerCase() : repsLabel}
                </Text>
                {!isCardio ? (
                  <Text
                    style={[
                      styles.setHeaderText,
                      styles.setColRpe,
                      usesNativeSetRows && styles.nativeSetHeaderInput,
                      planMode && usesNativeSetRows && { marginLeft: 12 },
                    ]}
                  >
                    {rpeLabel}
                  </Text>
                ) : null}
              </View>
              {!planMode ? (
                <Text
                  style={[
                    styles.setHeaderText,
                    styles.setHeaderCheck,
                    isCardio && styles.cardioSetHeaderCheck,
                    usesNativeSetRows && styles.nativeSetHeaderCheck,
                  ]}
                >
                  Done
                </Text>
              ) : null}
            </View>
            {ex.sets.length === 0 ? (
              <Text style={styles.muted}>No sets yet.</Text>
            ) : Platform.OS === "android" && !isCardio ? (
              <WorkoutNativeSetRows
                planMode={planMode}
                activeSetIndex={ex.sets.findIndex(
                  (_set, index) => editingSet === `${ex.id}:${index}`,
                )}
                editingSuspended={
                  !!warmupTarget ||
                  showCardioTimeModal ||
                  showCardioDistanceModal
                }
                onActivate={(index) => setEditingSet(`${ex.id}:${index}`)}
                listKey={`native-set-list-${ex.id}-${ex.sets
                  .map(
                    (set, idx) =>
                      `${idx}:${getSetTypeMarker(set, idx, ex.sets)}`,
                  )
                  .join(
                    "|",
                  )}-${String(unit).toLowerCase()}-${weightLabel}-${repsLabel}-${rpeLabel}`}
                style={{
                  height:
                    Math.max(ex.sets.length, 1) * notebookRowHeight(fontScale),
                }}
                notebookColors={colors}
                fontFamily="NotebookSans"
                weightLabel={weightLabel}
                repsLabel={repsLabel}
                rpeLabel={effortScale === "rir" ? "0-4" : "6-10"}
                rows={ex.sets.map((set, idx) => ({
                  marker: getSetTypeMarker(set, idx, ex.sets),
                  last:
                    set.setType === "warmup"
                      ? ""
                      : setDisplays[idx].previous
                        ? lastResistanceSet(
                            setDisplays[idx].previous!,
                            unit,
                            effortScale,
                          )
                        : "-",
                  weight:
                    set.weightText ?? formatWeightInput(set.weightKg, unit),
                  reps: set.reps,
                  rpe: effortInputValue(set, effortScale),
                  rpeHint:
                    !planMode && set.targetRpe != null
                      ? String(rpeToEffort(set.targetRpe, effortScale))
                      : undefined,
                  done: set.done,
                }))}
                onChange={(index, field, value) => {
                  if (field === "weight") {
                    cardActions.updateSetWeight(ex.id, index, unit, value);
                    return;
                  }
                  if (field === "reps") {
                    cardActions.updateSetReps(ex.id, index, value);
                    return;
                  }
                  cardActions.updateSetRpe(ex.id, index, value);
                }}
                onToggleDone={(index) =>
                  cardActions.toggleSetDone(ex.id, index)
                }
                onDeleteSet={(index) =>
                  cardActions.removeSetWithUndo(ex.id, index)
                }
                onSetLabelPress={(index) =>
                  cardActions.openSetMenu(ex.id, index)
                }
                onLastPress={(index) =>
                  cardActions.copyLastSetToCurrent(ex.id, index)
                }
              />
            ) : (
              ex.sets.map((s, idx) => (
                <ReanimatedSwipeable
                  key={`${ex.id}-set-${idx}`}
                  simultaneousWithExternalGesture={scrollNativeGesture}
                  friction={1.2}
                  rightThreshold={12}
                  overshootRight={false}
                  dragOffsetFromLeftEdge={24}
                  dragOffsetFromRightEdge={24}
                  renderRightActions={() => (
                    <View style={styles.swipeDeleteContainer}>
                      <TouchableOpacity
                        style={styles.swipeDeleteButton}
                        onPress={() =>
                          cardActions.removeSetWithUndo(ex.id, idx)
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.ink}
                        />
                        <Text style={styles.swipeDeleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                >
                  <View
                    style={[
                      styles.setContainer,
                      (editingSet === `${ex.id}:${idx}` ||
                        (cardioTimeTarget?.exerciseId === ex.id &&
                          cardioTimeTarget.setIndex === idx) ||
                        (cardioDistanceTarget?.exerciseId === ex.id &&
                          cardioDistanceTarget.setIndex === idx)) &&
                        styles.activeSet,
                    ]}
                  >
                    <View
                      style={[
                        styles.setInlineRow,
                        isTabletLayout && styles.setInlineRowTablet,
                        largeText && { flexWrap: "wrap" },
                      ]}
                    >
                      {!isCardio ? (
                        <TouchableOpacity
                          onPress={() => cardActions.openSetMenu(ex.id, idx)}
                          style={styles.setLabelButton}
                          accessibilityLabel={`Adjust set ${idx + 1} intensity`}
                        >
                          <Text
                            style={[
                              styles.setLabel,
                              isTabletLayout && styles.setLabelTablet,
                            ]}
                          >
                            {getSetTypeMarker(s, idx, ex.sets)}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {!planMode ? (
                        <TouchableOpacity
                          style={styles.lastSetButton}
                          onPress={() =>
                            cardActions.copyLastSetToCurrent(ex.id, idx)
                          }
                          disabled={!setDisplays[idx].previous}
                          accessibilityLabel={`Copy previous values into set ${idx + 1}`}
                        >
                          <Text style={styles.lastSetText}>
                            {s.setType === "warmup"
                              ? ""
                              : setDisplays[idx].previous
                                ? formatLastSetSummary(
                                    setDisplays[idx].previous!,
                                  )
                                : "-"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <View
                        style={[
                          styles.setInputsGroup,
                          isTabletLayout && styles.setInputsGroupTablet,
                          largeText && { flexBasis: "100%", flexWrap: "wrap" },
                        ]}
                      >
                        {isCardio ? (
                          <>
                            <TouchableOpacity
                              style={[
                                styles.input,
                                styles.setInput,
                                styles.setInputCompact,
                                styles.setColReps,
                              ]}
                              onPress={() =>
                                cardActions.openCardioTimeModal(
                                  ex.id,
                                  idx,
                                  s.durationSec,
                                )
                              }
                            >
                              <Text style={styles.cardioTapValue}>
                                {formatDurationHoursMinutes(
                                  s.durationSec ?? null,
                                ) || "hh:mm"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.input,
                                styles.setInput,
                                styles.setInputCompact,
                                styles.setColWeight,
                              ]}
                              onPress={() =>
                                cardActions.openCardioDistanceModal(
                                  ex.id,
                                  idx,
                                  s.distanceKm ?? null,
                                  unit,
                                )
                              }
                            >
                              <Text style={styles.cardioTapValue}>
                                {formatDistanceInput(
                                  s.distanceKm ?? null,
                                  unit,
                                ) || String(unit)}
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <WorkoutGestureTextInput
                              placeholder={weightLabel}
                              placeholderTextColor={colors.muted}
                              keyboardType="decimal-pad"
                              value={
                                s.weightText ??
                                formatWeightInput(s.weightKg, unit)
                              }
                              onChangeText={(v) =>
                                cardActions.updateSetWeight(ex.id, idx, unit, v)
                              }
                              onFocus={() => setEditingSet(`${ex.id}:${idx}`)}
                              selectTextOnFocus
                              style={[
                                styles.input,
                                styles.setInput,
                                styles.setInputCompact,
                                styles.setColWeight,
                                isTabletLayout && styles.setInputTablet,
                              ]}
                            />
                            <WorkoutGestureTextInput
                              placeholder={repsLabel}
                              placeholderTextColor={colors.muted}
                              keyboardType="numeric"
                              value={s.reps}
                              onChangeText={(v) =>
                                cardActions.updateSetReps(ex.id, idx, v)
                              }
                              onFocus={() => setEditingSet(`${ex.id}:${idx}`)}
                              selectTextOnFocus={false}
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
                            <WorkoutGestureTextInput
                              placeholder={
                                !planMode && s.targetRpe != null
                                  ? String(rpeToEffort(s.targetRpe, effortScale))
                                  : effortScale === "rir"
                                    ? "0-4"
                                    : "6-10"
                              }
                              accessibilityLabel={`${ex.name}, set ${idx + 1}, ${effortScale === "rir" ? "RIR" : "RPE"}`}
                              accessibilityHint={!planMode && s.targetRpe != null ? `Target ${rpeToEffort(s.targetRpe, effortScale)}` : undefined}
                              placeholderTextColor={colors.muted}
                              keyboardType="decimal-pad"
                              value={effortInputValue(s, effortScale)}
                              onChangeText={(v) =>
                                cardActions.updateSetRpe(ex.id, idx, v)
                              }
                              onFocus={() => setEditingSet(`${ex.id}:${idx}`)}
                              selectTextOnFocus={false}
                              style={[
                                styles.input,
                                styles.setInput,
                                styles.setInputCompact,
                                styles.setColRpe,
                                isTabletLayout && styles.setInputTablet,
                              ]}
                            />
                          </>
                        )}
                      </View>
                      {!planMode ? (
                        <TouchableOpacity
                          style={[
                            styles.checkboxInline,
                            styles.checkboxHitbox,
                            largeText && { minWidth: 64, minHeight: 64 },
                          ]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: s.done }}
                          accessibilityLabel={`${ex.name}, set ${idx + 1} completed`}
                          onPress={() => {
                            setEditingSet(`${ex.id}:${idx}`);
                            cardActions.toggleSetDone(ex.id, idx);
                          }}
                          activeOpacity={0.8}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              s.done && styles.checkboxChecked,
                              largeText && {
                                width: 36,
                                height: 36,
                                borderWidth: 2,
                                borderRadius: 6,
                              },
                            ]}
                          >
                            {s.done ? (
                              <Check
                                size={largeText ? 28 : 16}
                                strokeWidth={2}
                                color={colors.onPrimary}
                              />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </ReanimatedSwipeable>
              ))
            )}
            {isCardio ? (
              <>
                <View style={styles.cardioMetaRow}>
                  <Text style={styles.cardioMetaLabel}>Heart-rate zone</Text>
                  <View style={styles.answerRow}>
                    {["1", "2", "3", "4", "5"].map((zone) => (
                      <TouchableOpacity
                        key={`cardio-zone-${ex.id}-${zone}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Zone ${zone}`}
                        accessibilityState={{
                          selected: getExerciseZone(ex) === zone,
                        }}
                        style={[
                          styles.answerChip,
                          getExerciseZone(ex) === zone &&
                            styles.answerChipActive,
                        ]}
                        onPress={() =>
                          cardActions.setExercises((previous) =>
                            previous.map((exercise) =>
                              exercise.id === ex.id
                                ? applyCardioZone(
                                    exercise,
                                    getExerciseZone(exercise) === zone
                                      ? ""
                                      : zone,
                                  )
                                : exercise,
                            ),
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.answerText,
                            getExerciseZone(ex) === zone &&
                              styles.answerTextActive,
                          ]}
                        >{`Zone ${zone}`}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.cardioMetaRow}>
                  <Text style={styles.cardioMetaLabel}>Session Type</Text>
                  <View style={styles.answerRow}>
                    {CARDIO_SESSION_TYPES.map((option) => (
                      <TouchableOpacity
                        key={`cardio-session-${ex.id}-${option.value}`}
                        style={[
                          styles.answerChip,
                          ex.cardioSessionType === option.value &&
                            styles.answerChipActive,
                        ]}
                        onPress={() =>
                          cardActions.updateCardioSessionType(
                            ex.id,
                            option.value,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.answerText,
                            ex.cardioSessionType === option.value &&
                              styles.answerTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.cardioMetaRow}>
                  <Text style={styles.cardioMetaLabel}>Effort Level</Text>
                  <View style={styles.answerRow}>
                    {CARDIO_EFFORT_LEVELS.map((option) => (
                      <TouchableOpacity
                        key={`cardio-effort-${ex.id}-${option.value}`}
                        style={[
                          styles.answerChip,
                          ex.cardioEffortLevel === option.value &&
                            styles.answerChipActive,
                        ]}
                        onPress={() =>
                          cardActions.updateCardioEffortLevel(
                            ex.id,
                            option.value,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.answerText,
                            ex.cardioEffortLevel === option.value &&
                              styles.answerTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            ) : null}
            <View style={styles.setActionsRow}>
              <TouchableOpacity
                style={[styles.textAction, styles.setActionButton]}
                onPress={() => cardActions.addEmptySet(ex.id)}
              >
                <Text style={styles.linkText}>+ Add set</Text>
              </TouchableOpacity>
              {ex.sets.length > 0 ? (
                <TouchableOpacity
                  style={[
                    styles.textAction,
                    styles.setActionButton,
                    { alignItems: "flex-end" },
                  ]}
                  onPress={() => cardActions.duplicateLastSet(ex.id)}
                >
                  <Text style={styles.linkText}>Duplicate last set</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.setActionButton} />
              )}
            </View>
            {undoDeletedSet?.exerciseId === ex.id ? (
              <View style={styles.inlineUndoBanner}>
                <Text style={styles.inlineUndoBannerText}>Set deleted</Text>
                <TouchableOpacity
                  onPress={cardActions.undoRemoveSet}
                  style={styles.inlineUndoBannerAction}
                >
                  <Text style={styles.inlineUndoBannerActionText}>Undo</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      }),
    [
      planMode,
      setEditingSet,
      setReplacementPage,
      exercises,
      exerciseUnits,
      getExerciseMode,
      effortScale,
      previousExerciseSetsByName,
      findCatalogExercise,
      restTimerByExercise,
      replaceTarget,
      replaceSearch,
      replaceGroup,
      replacementOptions,
      replacementLimit,
      replacementPageKey,
      isTabletLayout,
      formatLastSetSummary,
      scrollNativeGesture,
      getExerciseZone,
      undoDeletedSet,
      cardActions,
      styles,
      colors,
      fontScale,
      editingSet,
      warmupTarget,
      cardioTimeTarget,
      cardioDistanceTarget,
      showCardioTimeModal,
      showCardioDistanceModal,
    ],
  );
}
