import React from "react";
import { Text, TouchableOpacity, View, type TextStyle, type ViewStyle } from "react-native";

type RoutineSectionStyles = {
  card: ViewStyle;
  sectionTitle: TextStyle;
  muted: TextStyle;
  routineActionRow: ViewStyle;
  routineActionButton: ViewStyle;
  primaryButton: ViewStyle;
  secondaryButton: ViewStyle;
  primaryText: TextStyle;
  secondaryText: TextStyle;
  disabled: ViewStyle;
  routineBuilderBanner: ViewStyle;
  recommendationLine: TextStyle;
};

type WorkoutRoutineSectionProps = {
  styles: RoutineSectionStyles;
  routineCount: number;
  builderMode: boolean;
  onCreateRoutine: () => void;
  onRepeatPastWorkout: () => void;
  onViewRoutines: () => void;
  onSaveRoutine: () => void;
  onExitBuilder: () => void;
};

export function WorkoutRoutineSection({
  styles,
  routineCount,
  builderMode,
  onCreateRoutine,
  onRepeatPastWorkout,
  onViewRoutines,
  onSaveRoutine,
  onExitBuilder,
}: WorkoutRoutineSectionProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Routines</Text>
      <Text style={styles.muted}>Reuse saved structures instead of rebuilding each session.</Text>
      <View style={styles.routineActionRow}>
        <TouchableOpacity style={[styles.primaryButton, styles.routineActionButton, { marginTop: 0 }]} onPress={onCreateRoutine}>
          <Text style={styles.primaryText}>Create routine</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, styles.routineActionButton]} onPress={onRepeatPastWorkout}>
          <Text style={styles.secondaryText}>Repeat past workout</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.secondaryButton, { marginTop: 10 }, routineCount === 0 && styles.disabled]}
        onPress={onViewRoutines}
        disabled={routineCount === 0}
      >
        <Text style={styles.secondaryText}>My routines</Text>
      </TouchableOpacity>
      {routineCount === 0 ? (
        <Text style={[styles.muted, { marginTop: 8 }]}>No routines yet. Tap Create routine to build your first one.</Text>
      ) : null}
      {builderMode ? (
        <View style={styles.routineBuilderBanner}>
          <Text style={styles.recommendationLine}>Routine builder mode: use the workout editor below, then save.</Text>
          <View style={styles.routineActionRow}>
            <TouchableOpacity style={[styles.primaryButton, styles.routineActionButton, { marginTop: 0 }]} onPress={onSaveRoutine}>
              <Text style={styles.primaryText}>Save routine</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.routineActionButton]} onPress={onExitBuilder}>
              <Text style={styles.secondaryText}>Exit builder</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}
