import { Text, TouchableOpacity, View } from "react-native";
import { useNotebookStyles } from "../../ui/notebook/Notebook";
import { createStyles } from "./workoutLogStyles";

/** Shared selected/unselected treatment for exercise units and effort scales. */
export function WorkoutChoiceChips<T extends string>({ values, selected, onChange, disabled = false }: {
  values: readonly T[]; selected: T; onChange: (value: T) => void; disabled?: boolean;
}) {
  const styles = useNotebookStyles(createStyles);
  return <View style={styles.exerciseOptionUnits}>{values.map(value => (
    <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={value} accessibilityState={{ selected: value === selected, disabled }} disabled={disabled}
      onPress={() => onChange(value)} style={[styles.answerChip, styles.exerciseUnitChip, { minWidth: 64, minHeight: 44, alignItems: "center", justifyContent: "center" }, value === selected && styles.answerChipActive, disabled && styles.disabled]}>
      <Text style={[styles.answerText, value === selected && styles.answerTextActive]}>{value}</Text>
    </TouchableOpacity>
  ))}</View>;
}
