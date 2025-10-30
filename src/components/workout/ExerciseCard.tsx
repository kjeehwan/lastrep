import { Repeat, Trash } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme } from "../../contexts/ThemeContext";

type ExerciseSet = {
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
};

type ExerciseCardProps = {
  exercise: {
    name: string;
    sets: ExerciseSet[];
  };
  onUpdateSet: (setIndex: number, field: keyof ExerciseSet, value: string) => void;
  onToggleSetDone: (setIndex: number) => void;
  onAddSet: () => void;
  onRemove: () => void;
  onReplaceExercise: () => void;
  onRemoveSet: (setIndex: number) => void;
};

export default function ExerciseCard({
  exercise,
  onUpdateSet,
  onToggleSetDone,
  onAddSet,
  onRemove,
  onReplaceExercise,
  onRemoveSet,
}: ExerciseCardProps) {
  const { theme } = useTheme();

  const renderRightActions = (setIndex: number) => {
    return (
      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: theme.primary }]}
        onPress={() => onRemoveSet(setIndex)}
        activeOpacity={0.8}
      >
        <Trash size={18} color={theme.surface} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {/* Header Row: Exercise name + buttons */}
      <View style={styles.headerRow}>
        <Text style={[styles.exerciseName, { color: theme.textPrimary }]}>
          {exercise.name}
        </Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={onReplaceExercise} activeOpacity={0.8} style={styles.iconButton}>
            <Repeat size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onRemove} activeOpacity={0.8} style={styles.iconButton}>
            <Trash size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Header row for sets */}
      <View style={styles.setHeader}>
        <Text style={[styles.setLabel, { color: theme.textPrimary }]}>Set</Text>
        <Text style={[styles.setLabel, { color: theme.textPrimary }]}>Weight</Text>
        <Text style={[styles.setLabel, { color: theme.textPrimary }]}>Reps</Text>
        <Text style={[styles.setLabel, { color: theme.textPrimary }]}>RPE</Text>
        <Text style={[styles.setLabel, { color: theme.textPrimary }]}>Done</Text>
      </View>

      {/* Each Set with Swipe-to-Delete */}
      {exercise.sets.map((set, setIndex) => (
        <Swipeable
          key={setIndex}
          renderRightActions={() => renderRightActions(setIndex)}
          overshootRight={false}
        >
          <View style={styles.setRow}>
            <Text style={[styles.setNumber, { color: theme.textPrimary }]}>
              {setIndex + 1}
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.textPrimary }]}
              value={set.weight}
              onChangeText={(text) => onUpdateSet(setIndex, "weight", text)}
              placeholder="–"
              keyboardType="numeric"
              placeholderTextColor={theme.placeholder}
            />

            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.textPrimary }]}
              value={set.reps}
              onChangeText={(text) => onUpdateSet(setIndex, "reps", text)}
              placeholder="–"
              keyboardType="numeric"
              placeholderTextColor={theme.placeholder}
            />

            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.textPrimary }]}
              value={set.rpe}
              onChangeText={(text) => onUpdateSet(setIndex, "rpe", text)}
              placeholder="–"
              keyboardType="numeric"
              placeholderTextColor={theme.placeholder}
            />

            <TouchableOpacity
              onPress={() => onToggleSetDone(setIndex)}
              style={[
                styles.checkbox,
                {
                  borderColor: set.done ? theme.primary : theme.border,
                  backgroundColor: set.done ? theme.primary : theme.surface,
                },
              ]}
              activeOpacity={0.7}
            >
              {set.done && <View style={styles.checkboxInner} />}
            </TouchableOpacity>
          </View>
        </Swipeable>
      ))}

      {/* ➕ Add Set */}
      <TouchableOpacity style={styles.addSetButton} onPress={onAddSet}>
        <Text style={[styles.addSetText, { color: theme.primary }]}>+ Add Set</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    padding: 6,
  },
  setHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  setLabel: {
    width: "18%",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  setNumber: {
    width: "18%",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
  input: {
    width: "18%",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    textAlign: "center",
    fontSize: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: "white",
  },
  addSetButton: {
    marginTop: 10,
    alignItems: "center",
  },
  addSetText: {
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 60,
    height: "100%",
  },
});
