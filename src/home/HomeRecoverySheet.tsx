import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { WorkoutModalShell } from "../workouts/workoutLog/WorkoutModalShell";
import { notebookSheet, useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import type { RecoveryInputs } from "../services/decision/loadWorkoutPlanContext";

export function HomeRecoverySheet({ initial, contextSummary, onContext, onSave, onClose }: {
  initial: RecoveryInputs; contextSummary: string; onContext: () => void;
  onSave: (value: RecoveryInputs) => Promise<void>; onClose: () => void;
}) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { if (!saving) onClose(); };
  return <WorkoutModalShell visible onRequestClose={close} backdropStyle={styles.overlay} cardStyle={styles.card}>
    <Text style={styles.title}>Recovery check-in</Text>
    {(["soreness", "fatigue", "motivation"] as const).map((key) => <View key={key} style={styles.field}>
      <Text style={styles.label}>{key[0].toUpperCase() + key.slice(1)}: {draft[key]}/10</Text>
      <Slider accessibilityLabel={key} value={draft[key]} minimumValue={0} maximumValue={10} step={1} disabled={saving} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.rule} thumbTintColor={colors.ink} onValueChange={(value) => setDraft((previous) => ({ ...previous, [key]: value }))} />
    </View>)}
    <TouchableOpacity style={styles.linkRow} accessibilityRole="button" onPress={onContext} disabled={saving}><View style={{ flex: 1, gap: 6 }}><Text style={styles.link}>Pain, activity or notes</Text><Text style={styles.muted}>{contextSummary}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></TouchableOpacity>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <TouchableOpacity style={styles.primary} disabled={saving} onPress={() => { setSaving(true); setError(null); void onSave(draft).catch(() => { setError("Couldn't save your check-in. Please try again."); setSaving(false); }); }}><Text style={styles.primaryText}>{saving ? "Saving..." : "Save check-in"}</Text></TouchableOpacity>
    <TouchableOpacity style={styles.close} disabled={saving} onPress={close}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
  </WorkoutModalShell>;
}
const createStyles = (colors: NotebookColors) => notebookSheet({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  card: { width: "100%", maxWidth: 560, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "600", marginBottom: 16 },
  label: { color: colors.ink, fontSize: 16, fontWeight: "600" }, field: { gap: 8, marginBottom: 12 },
  muted: { color: colors.muted, fontSize: 14 }, link: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.rule },
  primary: { backgroundColor: colors.primary, minHeight: 48, padding: 12, borderRadius: 8, alignItems: "center", marginTop: 12 },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" }, close: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontSize: 14 },
});
