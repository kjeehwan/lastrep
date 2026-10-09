import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { convertAvailableWeightsUnit, normalizeAvailableWeights, type AvailableWeights } from "../availableWeights";

type Props = {
  name: string;
  settings: AvailableWeights | null;
  defaultUnit: "kg" | "lbs";
  onClose: () => void;
  onSave: (settings: AvailableWeights | null) => Promise<void>;
};

export function AvailableWeightsModal({ name, settings, defaultUnit, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"regular" | "custom">(settings?.mode ?? "regular");
  const [unit, setUnit] = useState(settings?.unit ?? defaultUnit);
  const [minimum, setMinimum] = useState(settings?.mode === "regular" ? String(settings.minimum) : "");
  const [increment, setIncrement] = useState(settings?.mode === "regular" ? String(settings.increment) : "");
  const [values, setValues] = useState(settings?.mode === "custom" ? settings.values.join(", ") : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const parse = (): AvailableWeights | null => {
    const numberPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
    if (mode === "regular") {
      if (!numberPattern.test(minimum.trim()) || !numberPattern.test(increment.trim())) return null;
      return normalizeAvailableWeights({ mode, unit, minimum: Number(minimum), increment: Number(increment) });
    }
    const list = values.trim().split(/[,;\n]+/).map((value) => value.trim());
    if (!list.every((value) => numberPattern.test(value))) return null;
    return normalizeAvailableWeights({ mode, unit, values: list.map(Number) });
  };
  const switchUnit = (nextUnit: "kg" | "lbs") => {
    const current = parse();
    if (current) {
      const next = convertAvailableWeightsUnit(current, nextUnit);
      if (next.mode === "regular") { setMinimum(String(next.minimum)); setIncrement(String(next.increment)); }
      else setValues(next.values.join(", "));
    }
    setUnit(nextUnit);
    setError(null);
  };
  const save = async (clear = false) => {
    if (saving) return;
    const next = clear ? null : parse();
    if (!clear && !next) {
      setError(mode === "regular" ? "Enter a starting weight of 0 or more and a positive increment." : "Enter up to 200 weights separated by commas, such as 10, 12, 14, 17.5.");
      return;
    }
    setSaving(true);
    setError(null);
    try { await onSave(next); setSaving(false); onClose(); }
    catch { setSaving(false); setError("Could not save available weights. Please try again."); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!saving) onClose(); }} accessibilityLabel="Close available weights" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.heading}><Text style={styles.title}>Available weights</Text><Pressable disabled={saving} onPress={onClose} hitSlop={12} accessibilityLabel="Close"><Ionicons name="close" size={24} color="#fff" /></Pressable></View>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={styles.exerciseName}>{name}</Text>
            <Text style={styles.hint}>Optional. Used for future suggestions; your current sets stay unchanged.</Text>
            <View style={styles.row}>{(["kg", "lbs"] as const).map((choice) => <Pressable key={choice} style={[styles.chip, unit === choice && styles.active]} onPress={() => switchUnit(choice)}><Text style={styles.text}>{choice}</Text></Pressable>)}</View>
            <Text style={styles.hint}>Use the unit on your equipment. Changing workout display units does not change these weights.</Text>
            <View style={styles.row}>{(["regular", "custom"] as const).map((choice) => <Pressable key={choice} style={[styles.chip, mode === choice && styles.active]} onPress={() => { setMode(choice); setError(null); }}><Text style={styles.text}>{choice === "regular" ? "Regular increments" : "Custom list"}</Text></Pressable>)}</View>
            {mode === "regular" ? (
              <>
                <Text style={styles.label}>Starting weight ({unit})</Text>
                <TextInput style={styles.input} value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" placeholder="e.g. 20" placeholderTextColor="#858ba4" accessibilityLabel={`Starting weight in ${unit}`} />
                <Text style={styles.label}>Increment ({unit})</Text>
                <TextInput style={styles.input} value={increment} onChangeText={setIncrement} keyboardType="decimal-pad" placeholder="e.g. 2 or 2.5" placeholderTextColor="#858ba4" accessibilityLabel={`Weight increment in ${unit}`} />
                <Text style={styles.hint}>For a barbell, use total weight including both sides. For dumbbells, use the weight of one dumbbell.</Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>Weights ({unit}), separated by commas</Text>
                <TextInput style={[styles.input, styles.list]} value={values} onChangeText={setValues} multiline textAlignVertical="top" placeholder="10, 12, 14, 17.5, 20" placeholderTextColor="#858ba4" accessibilityLabel={`Available weights in ${unit}`} />
              </>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {settings ? <Pressable disabled={saving} onPress={() => void save(true)} style={styles.clear}><Text style={styles.link}>Clear saved settings</Text></Pressable> : null}
          </ScrollView>
          <Pressable disabled={saving} style={[styles.button, saving && { opacity: 0.5 }]} onPress={() => void save()}><Text style={styles.buttonText}>{saving ? "Saving..." : "Save available weights"}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { maxHeight: "88%", backgroundColor: "#14182b", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  body: { gap: 12, paddingBottom: 18 },
  exerciseName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: { color: "#9aa1c3", fontSize: 13, lineHeight: 19 },
  text: { color: "#fff", fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#24283e", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  active: { backgroundColor: "#7b61ff" },
  label: { color: "#cdd0e0", fontSize: 13, fontWeight: "600" },
  input: { color: "#fff", backgroundColor: "#24283e", borderRadius: 10, padding: 12, fontSize: 16 },
  list: { minHeight: 95 },
  error: { color: "#ffb8b8", fontSize: 13, lineHeight: 19 },
  clear: { paddingVertical: 10 },
  link: { color: "#c9c0ff", fontSize: 13, fontWeight: "600" },
  button: { backgroundColor: "#7b61ff", padding: 14, alignItems: "center", borderRadius: 12 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
