import { useNotebook, useNotebookStyles, notebookSheet } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import { NotebookUtilityIcon } from "../ui/notebook/NotebookUtilityIcon";
import { NotebookModal } from "../ui/notebook/NotebookModal";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { KeyboardAwareModalFrame } from "../ui/KeyboardAwareModalFrame";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdaptiveModalCard } from "../ui/AdaptiveModalCard";
import { deleteBodyCompositionEntry, editBodyCompositionEntry, saveManualBodyCompositionEntry } from "./bodyComposition";
import type { BodyCompositionHistoryEntry } from "../contracts/bodyComposition";
import { latestMeasurementExamples, measurementDeletionMessage, measurementValues } from "./measurementEditing";
import { parseManualMeasurement } from "./manualMeasurement";
import { useNow } from "../hooks/useNow";

const fields = [
  ["weightKg", "Weight"], ["bodyFatPercent", "Body fat"],
  ["leanBodyMassKg", "Lean body mass"], ["skeletalMuscleMassKg", "Skeletal muscle mass"],
] as const;

export function AddMeasurementSheet({ uid, weightUnit, onClose, onSaved, onDeleted, entry, history }: { uid: string; weightUnit: "kg" | "lbs"; onClose: () => void; onSaved: (input: Record<string, number>, editedEntry?: BodyCompositionHistoryEntry) => void; onDeleted: () => void; entry?: BodyCompositionHistoryEntry; history: BodyCompositionHistoryEntry[] }) {
  const { fontsLoaded, colors } = useNotebook();
  const Surface = fontsLoaded ? NotebookModal : Modal;
  const notebookStyles = useNotebookStyles(createNotebookStyles);
  const styles = fontsLoaded ? notebookStyles : legacyStyles;
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.5;
  const [unit] = useState(weightUnit);
  const [initialValues] = useState(() => measurementValues(entry, unit));
  const [addValues, setAddValues] = useState<Record<string, string>>(() => measurementValues(undefined, unit));
  const [editValues, setEditValues] = useState<Record<string, string>>(initialValues);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeEntry = mode === "edit" ? entry : undefined;
  const values = mode === "edit" ? editValues : addValues;
  const setValues = mode === "edit" ? setEditValues : setAddValues;
  const examples = latestMeasurementExamples(history, unit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [definition, setDefinition] = useState<string | null>(null);
  const nowMs = useNow();
  const close = () => { if (!saving) onClose(); };
  const save = async () => {
    if (saving) return;
    let input;
    try { input = parseManualMeasurement(values, unit); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Check your measurements."); return; }
    try {
      setSaving(true);
      setError("");
      if (activeEntry) {
        const changes = Object.fromEntries(Object.entries(input).filter(([key]) => values[key].trim() !== initialValues[key]));
        if (Object.keys(changes).length) await editBodyCompositionEntry(uid, activeEntry, changes);
      } else await saveManualBodyCompositionEntry(uid, input);
      onSaved(input, activeEntry);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith("This measurement") ? failure.message : "Couldn't save. Check your connection and try again.");
    } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!activeEntry || saving) return;
    setSaving(true);
    setError("");
    try { await deleteBodyCompositionEntry(uid, activeEntry); onDeleted(); onClose(); }
    catch (failure) { setError(failure instanceof Error && failure.message.startsWith("This measurement") ? failure.message : "Couldn't delete. Check your connection and try again."); }
    finally { setSaving(false); }
  };
  const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <Surface transparent animationType="slide" onRequestClose={close}>
      <KeyboardAwareModalFrame>
      <SafeAreaView style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss measurement" />
          <AdaptiveModalCard contentSized style={styles.card}>
            <Text style={styles.title}>Body composition data</Text>
            <View style={styles.modeRow}>
              {(["add", ...(entry ? ["edit"] : [])] as ("add" | "edit")[]).map((option) => (
                <Pressable key={option} disabled={saving || confirmDelete} accessibilityRole="button" accessibilityState={{ selected: mode === option }} style={[styles.modeButton, mode === option && styles.modeButtonActive]} onPress={() => { setMode(option); setError(""); }}>
                  <Text style={styles.modeTitle}>{option === "add" ? "Add today" : "Edit selected"}</Text>
                  <Text style={styles.modeDate}>{shortDate(option === "add" ? nowMs : entry!.recordedAt!.toMillis())}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>{activeEntry ? "Editing" : "Adding for"} {new Date(activeEntry?.recordedAt?.toMillis() ?? nowMs).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</Text>
            {fields.map(([key, label]) => {
              const placeholder = `e.g. ${examples[key] || (key === "bodyFatPercent" ? "18.5" : key === "weightKg" ? (unit === "kg" ? "80.15" : "176.7") : key === "leanBodyMassKg" ? (unit === "kg" ? "65.3" : "144.0") : (unit === "kg" ? "34.2" : "75.4"))}`;
              return (
              <View key={key} style={styles.field}>
                <View style={[styles.dataRow, largeText && { flexDirection: "column", alignItems: "stretch" }]}>
                <View style={[styles.labelRow, largeText && { flex: 0 }]}>
                  <Text style={styles.label}>{label}</Text>
                  {key === "leanBodyMassKg" || key === "skeletalMuscleMassKg" ? (
                    <Pressable style={styles.helpButton} accessibilityRole="button" accessibilityLabel={`What is ${label.toLowerCase()}?`} accessibilityState={{ expanded: definition === key }} onPress={() => setDefinition((previous) => previous === key ? null : key)}>
                      <NotebookUtilityIcon name="help" size={fontsLoaded && largeText ? 24 : 18} color={fontsLoaded ? colors.muted : "#98a0b3"} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={[styles.inputRow, largeText && { width: "100%" }]}>
                  <View style={styles.valueField}>
                    <TextInput value={values[key] || ""} onChangeText={(value) => setValues((previous) => ({ ...previous, [key]: value }))} keyboardType="decimal-pad" disableFullscreenUI editable={!saving && !confirmDelete} accessibilityLabel={label} accessibilityHint={!values[key] ? placeholder : undefined} style={styles.input} />
                    {!values[key] ? <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.placeholderLayer]}><Text accessible={false} style={styles.placeholderText} numberOfLines={1}>{placeholder}</Text></View> : null}
                  </View>
                  <Text style={[styles.unit, fontsLoaded && { width: Math.ceil(26 * Math.max(1, fontScale)) }]}>{key === "bodyFatPercent" ? "%" : unit}</Text>
                </View>
                </View>
                {definition === key ? <Text style={styles.definition}>{key === "leanBodyMassKg" ? "Everything other than body fat, including muscle, bone, organs and water." : "Muscle attached to bones that produces movement. It is only part of lean body mass."}</Text> : null}
              </View>
              );
            })}
            {activeEntry ? <Text style={styles.hint}>Blank fields keep existing data.</Text> : null}
            {activeEntry?.source === "health" ? <Text style={styles.hint}>Changes are saved in Lastrep only, not your connected health service.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {confirmDelete && activeEntry ? (
              <>
                <Text style={styles.hint}>{measurementDeletionMessage(activeEntry, history)}</Text>
                <Pressable disabled={saving} onPress={() => void remove()} style={[styles.button, styles.deleteButton]} accessibilityRole="button"><Text style={styles.buttonText}>{saving ? "Deleting..." : "Delete entry"}</Text></Pressable>
              </>
            ) : (
              <>
                <Pressable disabled={saving} onPress={() => void save()} style={[styles.button, saving && { opacity: 0.5 }]} accessibilityRole="button"><Text style={styles.buttonText}>{saving ? "Saving..." : "Save data"}</Text></Pressable>
                {activeEntry ? <Pressable disabled={saving} onPress={() => { setConfirmDelete(true); setError(""); }} style={styles.cancel} accessibilityRole="button"><Text style={styles.error}>Delete entry</Text></Pressable> : null}
              </>
            )}
            <Pressable disabled={saving} onPress={confirmDelete ? () => setConfirmDelete(false) : close} style={styles.cancel} accessibilityRole="button"><Text style={styles.label}>{confirmDelete ? "Keep entry" : "Cancel"}</Text></Pressable>
          </AdaptiveModalCard>
      </SafeAreaView>
      </KeyboardAwareModalFrame>
    </Surface>
  );
}
const legacyStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)", padding: 16 },
  keyboard: { width: "100%" },
  card: { width: "100%", backgroundColor: "#111427", padding: 18, borderRadius: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  hint: { color: "#98a0b3", lineHeight: 19, marginVertical: 8 },
  field: { marginBottom: 14 }, label: { flexShrink: 1, color: "#d8daec", fontSize: 16, fontWeight: "600" },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  labelRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 2 },
  helpButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  definition: { color: "#a5acc1", lineHeight: 19, marginBottom: 8 },
  inputRow: { width: 116, flexShrink: 0, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#3a4055" },
  valueField: { flex: 1, minWidth: 0 },
  input: { width: "100%", minWidth: 0, color: "#fff", paddingVertical: 12, paddingHorizontal: 0, textAlign: "left", fontSize: 16 },
  placeholderLayer: { justifyContent: "center" },
  placeholderText: { color: "#727a91", textAlign: "left", fontSize: 16 },
  unit: { width: 26, flexShrink: 0, textAlign: "right", color: "#98a0b3", fontSize: 16 },
  modeRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  modeButton: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#343a50" },
  modeButtonActive: { borderColor: "#7b61ff", backgroundColor: "rgba(123,97,255,0.15)" },
  modeTitle: { color: "#fff", fontSize: 14, fontWeight: "600" }, modeDate: { color: "#98a0b3", marginTop: 4 },
  deleteButton: { backgroundColor: "#973d49" },
  button: { backgroundColor: "#7b61ff", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "700" }, cancel: { padding: 14, alignItems: "center" }, error: { color: "#ff9999" },
});

const createNotebookStyles = (colors: NotebookColors) => notebookSheet({
  ...legacyStyles,
  overlay: { ...legacyStyles.overlay, backgroundColor: colors.overlay, padding: 0 },
  card: { ...legacyStyles.card, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "600" }, hint: { ...legacyStyles.hint, color: colors.muted, fontSize: 14 },
  label: { ...legacyStyles.label, color: colors.ink }, definition: { ...legacyStyles.definition, color: colors.muted },
  helpButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  inputRow: { ...legacyStyles.inputRow, borderBottomColor: colors.border },
  input: { ...legacyStyles.input, color: colors.ink, fontSize: 16 }, placeholderText: { ...legacyStyles.placeholderText, color: colors.muted, fontSize: 16 },
  unit: { ...legacyStyles.unit, color: colors.muted }, modeButton: { ...legacyStyles.modeButton, borderColor: colors.rule, borderRadius: 4 },
  modeButtonActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, modeTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" }, modeDate: { color: colors.muted, marginTop: 4 },
  button: { ...legacyStyles.button, backgroundColor: colors.primary, borderRadius: 8, minHeight: 48 }, buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
  deleteButton: { backgroundColor: colors.danger }, error: { color: colors.danger, fontSize: 14 },
});
