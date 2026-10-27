import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { NotebookColors } from "../../ui/notebook/tokens";
import type { Exercise, ExerciseMode, Unit } from "./workoutLogModel";
import type { createStyles } from "./workoutLogStyles";
type Props = {
  styles: ReturnType<typeof createStyles>;
  colors: NotebookColors;
  activeActionExercise: Exercise | null;
  activeActionMode: ExerciseMode;
  activeActionUnit: Unit;
  activeExerciseActionId: string | null;
  activeActionIndex: number;
  exercises: Exercise[];
  availableWeightsPreferences: { loaded: boolean; error?: unknown };
  setAvailableWeightsTarget: (value: {
    name: string;
    unit: "kg" | "lbs";
  }) => void;
  closeExerciseActions: () => void;
  moveExercise: (id: string, direction: -1 | 1) => void;
  setReplaceTarget: React.Dispatch<React.SetStateAction<string | null>>;
  setReplaceSearch: React.Dispatch<React.SetStateAction<string>>;
  setReplaceGroup: React.Dispatch<React.SetStateAction<string>>;
  toggleFavoriteExercise: (name: string) => void;
  activeActionIsFavorite: boolean;
  deleteExercise: (id: string) => void;
  toggleExerciseUnit: (id: string, unit: Unit) => void;
};
export function WorkoutExerciseActions({
  styles,
  colors,
  activeActionExercise,
  activeActionMode,
  activeActionUnit,
  activeExerciseActionId,
  activeActionIndex,
  exercises,
  availableWeightsPreferences,
  setAvailableWeightsTarget,
  closeExerciseActions,
  moveExercise,
  setReplaceTarget,
  setReplaceSearch,
  setReplaceGroup,
  toggleFavoriteExercise,
  activeActionIsFavorite,
  deleteExercise,
  toggleExerciseUnit,
}: Props) {
  return (
    <>
      <Text style={styles.modalTitle}>
        {activeActionExercise ? activeActionExercise.name : "Exercise Options"}
      </Text>

      <View style={styles.exerciseOptionRow}>
        <Ionicons
          name={
            activeActionMode === "cardio" ? "map-outline" : "barbell-outline"
          }
          size={18}
          color={colors.muted}
        />
        <View style={styles.exerciseOptionUnits}>
          {(activeActionMode === "cardio"
            ? (["km", "mi"] as Unit[])
            : (["kg", "lbs"] as Unit[])
          ).map((option) => (
            <TouchableOpacity
              key={`unit-${option}`}
              style={[
                styles.answerChip,
                styles.exerciseUnitChip,
                activeActionUnit === option && styles.answerChipActive,
              ]}
              onPress={() =>
                activeExerciseActionId
                  ? toggleExerciseUnit(activeExerciseActionId, option)
                  : undefined
              }
            >
              <Text
                style={[
                  styles.answerText,
                  activeActionUnit === option && styles.answerTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeActionMode === "resistance" ? (
        <TouchableOpacity
          style={[
            styles.exerciseOptionRow,
            !availableWeightsPreferences.loaded && styles.disabled,
          ]}
          disabled={!availableWeightsPreferences.loaded}
          onPress={() => {
            if (!activeActionExercise) return;
            setAvailableWeightsTarget({
              name: activeActionExercise.name,
              unit: activeActionUnit === "lbs" ? "lbs" : "kg",
            });
            closeExerciseActions();
          }}
        >
          <Ionicons name="options-outline" size={18} color={colors.muted} />
          <Text style={styles.exerciseOptionText}>
            {availableWeightsPreferences.loaded
              ? "Available weights"
              : availableWeightsPreferences.error
                ? "Weight settings unavailable"
                : "Loading weight settings..."}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.exerciseReorderRow}>
        <Ionicons name="swap-vertical-outline" size={18} color={colors.muted} />
        <Text style={styles.exerciseOptionText}>Reorder</Text>
        <View style={styles.exerciseMoveRow}>
          <TouchableOpacity
            style={[
              styles.exerciseMoveButton,
              activeActionIndex <= 0 && styles.disabled,
            ]}
            disabled={!activeExerciseActionId || activeActionIndex <= 0}
            onPress={() =>
              activeExerciseActionId && moveExercise(activeExerciseActionId, -1)
            }
          >
            <Ionicons name="arrow-up-outline" size={15} color={colors.muted} />
            <Text style={styles.exerciseMoveText}>Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.exerciseMoveButton,
              (activeActionIndex < 0 ||
                activeActionIndex >= exercises.length - 1) &&
                styles.disabled,
            ]}
            disabled={
              !activeExerciseActionId ||
              activeActionIndex < 0 ||
              activeActionIndex >= exercises.length - 1
            }
            onPress={() =>
              activeExerciseActionId && moveExercise(activeExerciseActionId, 1)
            }
          >
            <Ionicons
              name="arrow-down-outline"
              size={15}
              color={colors.muted}
            />
            <Text style={styles.exerciseMoveText}>Down</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.exerciseOptionRow}
        onPress={() => {
          if (!activeExerciseActionId) return;
          setReplaceTarget((prev) =>
            prev === activeExerciseActionId ? null : activeExerciseActionId,
          );
          setReplaceSearch("");
          setReplaceGroup("all");
          closeExerciseActions();
        }}
      >
        <Ionicons
          name="swap-horizontal-outline"
          size={18}
          color={colors.muted}
        />
        <Text style={styles.exerciseOptionText}>Replace exercise</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.exerciseOptionRow}
        onPress={() => {
          if (!activeActionExercise) return;
          toggleFavoriteExercise(activeActionExercise.name);
        }}
      >
        <Ionicons
          name={activeActionIsFavorite ? "star" : "star-outline"}
          size={18}
          color={colors.accent}
        />
        <Text style={styles.exerciseOptionText}>
          {activeActionIsFavorite ? "Added to favorites" : "Add to favorites"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.exerciseOptionRow}
        onPress={() => {
          if (!activeExerciseActionId) return;
          const targetId = activeExerciseActionId;
          closeExerciseActions();
          deleteExercise(targetId);
        }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={[styles.exerciseOptionText, { color: colors.danger }]}>
          Delete exercise
        </Text>
      </TouchableOpacity>
    </>
  );
}
