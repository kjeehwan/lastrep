import { useState } from "react";
import { Keyboard, Pressable, Text, View, useWindowDimensions } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { ProfileAction, ProfileField, ProfileSheet } from "../../profile/ProfileNotebookControls";
import { NotebookInfoButton } from "../../ui/notebook/NotebookInfoButton";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { showAppAlert } from "../../ui/appDialog";
import { exerciseTargetsChanged, exerciseTargetsDraft, readExerciseTargetsDraft, type ExerciseTargets } from "../exerciseTargets";
import type { EffortScale } from "../effortScale";

export function ExerciseTargetsSheet({ name, targets, effortScale, onClose, onApply }: {
  name: string; targets?: ExerciseTargets | null; effortScale: EffortScale;
  onClose: () => void; onApply: (targets: ExerciseTargets | null) => void;
}) {
  const { colors } = useNotebook(), { fontScale } = useWindowDimensions();
  const [draft, setDraft] = useState(() => exerciseTargetsDraft(targets, effortScale));
  const [editing, setEditing] = useState<"range" | "effort" | null>(null);
  const [error, setError] = useState("");
  const changed = exerciseTargetsChanged(targets, draft, effortScale);
  const text = { color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16 };
  const update = (key: keyof typeof draft, value: string) => { setDraft(before => ({ ...before, [key]: value })); setError(""); };
  const row = (key: "range" | "effort", label: string, value: string) => {
    const Icon = editing === key ? ChevronDown : ChevronRight;
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: editing === key }} onPress={() => { Keyboard.dismiss(); setEditing(editing === key ? null : key); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={[text, { flex: 1 }]}>{label}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}><Text style={[text, { color: colors.muted }]}>{value}</Text><Icon size={18} color={colors.muted} strokeWidth={1.5} /></View>
    </Pressable>;
  };
  return <ProfileSheet title="Targets" titleAccessory={<NotebookInfoButton label="About exercise targets" onPress={() => showAppAlert("Targets", "Set a rep range, target effort, or both for this exercise's normal working sets. Warm-ups are excluded.\n\nLog the reps and effort you actually perform in the set rows. They stay separate from your targets.\n\nTarget effort follows your RPE/RIR preference in Profile. Individual set targets in a shared plan are retained and take precedence over the exercise default.")} />} onClose={onClose} footer={changed || Object.values(draft).some(value => value.trim()) ? <>
    {changed ? <ProfileAction primary label="Done" onPress={() => { try { onApply(readExerciseTargetsDraft(draft, effortScale)); } catch (failure) { setError(failure instanceof Error ? failure.message : "Check the target values."); } }} /> : null}
    {Object.values(draft).some(value => value.trim()) ? <ProfileAction label="Clear targets" onPress={() => { Keyboard.dismiss(); setDraft({ min: "", max: "", effort: "" }); setEditing(null); setError(""); }} /> : null}
  </> : undefined}>
    <Text style={[text, { fontFamily: notebookFonts.semibold, fontSize: 20 }]}>{name}</Text>
    <View style={{ gap: 8 }}>
      <View>{row("range", "Target reps", draft.min.trim() || draft.max.trim() ? `${draft.min.trim() || "\u2014"}\u2013${draft.max.trim() || "\u2014"}` : "Not set")}
        {editing === "range" ? <View style={{ alignSelf: "flex-end", maxWidth: "100%", flexDirection: fontScale >= 1.5 ? "column" : "row", alignItems: "flex-end", gap: 12, paddingTop: 8, paddingBottom: 12 }}>
          <ProfileField label="Min" accessibilityLabel="Minimum reps" inputWidth={72} keyboardType="number-pad" value={draft.min} placeholder={"\u2014"} maxLength={3} onChangeText={value => update("min", value)} />
          {fontScale < 1.5 ? <Text style={[text, { color: colors.muted, paddingBottom: 12 }]}>–</Text> : null}
          <ProfileField label="Max" accessibilityLabel="Maximum reps" inputWidth={72} keyboardType="number-pad" value={draft.max} placeholder={"\u2014"} maxLength={3} onChangeText={value => update("max", value)} />
        </View> : null}</View>
      <View>{row("effort", `Target ${effortScale.toUpperCase()}`, draft.effort.trim() || "Not set")}
        {editing === "effort" ? <View style={{ alignSelf: "flex-end", paddingTop: 8, paddingBottom: 12 }}><ProfileField hideLabel label={effortScale.toUpperCase()} accessibilityLabel={`Target ${effortScale.toUpperCase()}`} inputWidth={72} value={draft.effort} onChangeText={value => update("effort", value)} keyboardType="decimal-pad" placeholder={"\u2014"} maxLength={5} /></View> : null}</View>
    </View>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[text, { color: colors.danger }]}>{error}</Text> : null}
  </ProfileSheet>;
}
