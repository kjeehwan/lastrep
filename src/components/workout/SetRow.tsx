import { CheckCircle, Circle } from "lucide-react-native";
import React from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

type Props = {
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
  onToggleDone: () => void;
};

export default function SetRow({ weight, reps, rpe, done, onChange, onToggleDone }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: done ? theme.highlight : "transparent" }]}>
      <TextInput
        placeholder="kg"
        value={weight}
        onChangeText={(v) => onChange("weight", v)}
        keyboardType="numeric"
        style={[
          styles.input,
          { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
        placeholderTextColor={theme.placeholder}
      />
      <TextInput
        placeholder="Reps"
        value={reps}
        onChangeText={(v) => onChange("reps", v)}
        keyboardType="numeric"
        style={[
          styles.input,
          { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
        placeholderTextColor={theme.placeholder}
      />
      <TextInput
        placeholder="RPE"
        value={rpe}
        onChangeText={(v) => onChange("rpe", v)}
        keyboardType="numeric"
        style={[
          styles.input,
          { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
        placeholderTextColor={theme.placeholder}
      />

      {/* ✅ Checkbox (Done) */}
      <TouchableOpacity onPress={onToggleDone} activeOpacity={0.8} style={styles.checkbox}>
        {done ? (
          <CheckCircle size={22} color={theme.primary} />
        ) : (
          <Circle size={22} color={theme.border} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1, // 🧩 Make it responsive
    minWidth: 0, // prevents flexbox overflow
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    textAlign: "center",
  },
  checkbox: {
    paddingHorizontal: 4,
    width: 30,
    alignItems: "center",
  },
});
