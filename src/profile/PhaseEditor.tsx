import React, { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { Keyboard, Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react-native";
import { ProfileAction, ProfileChoices, ProfileField, ProfileSheet, ProfileText } from "./ProfileNotebookControls";
import { currentPhaseWeek, phaseType, type PhaseEdit, type PhaseKey } from "./phaseState";
import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import { useNotebook } from "../ui/notebook/Notebook";
import { showAppAlert } from "../ui/appDialog";
import { notebookFonts } from "../ui/notebook/tokens";

/** Shared editor: Home saves directly; Profile stages the returned change. */
export function PhaseEditor({ phaseKey, current, draft, staged = false, onClose, onApply }: {
  phaseKey: PhaseKey; current: Record<string, any>; draft?: PhaseEdit; staged?: boolean;
  onClose: () => void; onApply: (edit: PhaseEdit) => Promise<void> | void;
}) {
  const { colors } = useNotebook();
  const [baseline] = useState(current);
  const [initialWeek] = useState(() => currentPhaseWeek(baseline, phaseKey, Date.now()));
  const [mode, setMode] = useState<"Edit current phase" | "Start new phase">(draft?.mode === "new" ? "Start new phase" : "Edit current phase");
  const [phase, setPhase] = useState(draft?.phase ?? phaseType(baseline, phaseKey));
  const [name, setName] = useState(draft?.name ?? current[`${phaseKey}Name`] ?? "");
  const [week, setWeek] = useState(String(draft?.week ?? initialWeek ?? ""));
  const [initialFields] = useState(() => ({ name: draft?.name ?? current[`${phaseKey}Name`] ?? "", week: String(draft?.week ?? initialWeek ?? "") }));
  const [editingName, setEditingName] = useState(false);
  const [editingWeek, setEditingWeek] = useState(false);
  const [editingType, setEditingType] = useState(false);
  const [currentFields, setCurrentFields] = useState(() => ({ phase: phaseType(baseline, phaseKey), name: baseline[`${phaseKey}Name`] ?? "", week: String(initialWeek ?? "") }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => draft?.requestId ?? `phase-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const isNew = mode === "Start new phase";
  const changed = name.trim() !== initialFields.name.trim() || week.trim() !== initialFields.week.trim() || draft?.mode === "new" && !isNew;
  const close = () => { if (!busy) onClose(); };
  const switchForm = () => {
    if (busy) return;
    Keyboard.dismiss();
    setEditingName(false); setEditingWeek(false); setEditingType(false);
    if (isNew) {
      setMode("Edit current phase"); setPhase(currentFields.phase); setName(currentFields.name); setWeek(currentFields.week);
    } else {
      setCurrentFields({ phase, name, week });
      setMode("Start new phase"); setPhase(phaseType(baseline, phaseKey)); setName(""); setWeek("1");
    }
    setError("");
  };
  const apply = async () => {
    if (busy) return;
    const parsedWeek = week.trim() ? Number(week) : null;
    if ((isNew && parsedWeek == null) || (parsedWeek != null && (!/^\d+$/.test(week.trim()) || parsedWeek < 1 || parsedWeek > 999))) { setError("Enter a whole week from 1 to 999."); return; }
    if (!isNew && parsedWeek == null && initialWeek != null) { setError("Enter the current week."); return; }
    if (!draft && !isNew && name.trim() === (current[`${phaseKey}Name`] ?? "") && parsedWeek === initialWeek) { onClose(); return; }
    setBusy(true); setError("");
    try {
      await onApply({ mode: isNew ? "new" : "edit", phase, name: name.trim(), requestId,
        week: isNew || draft?.week != null || parsedWeek !== initialWeek ? parsedWeek : null,
        expectedPhase: draft ? draft.expectedPhase : phaseType(baseline, phaseKey),
        expectedStartMs: draft ? draft.expectedStartMs : (baseline[`${phaseKey}StartedAt`] instanceof Timestamp ? baseline[`${phaseKey}StartedAt`].toMillis() : null) });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't save phase. Please try again."); }
    finally { setBusy(false); }
  };
  const title = phaseKey === "trainingPhase" ? "Training phase" : "Diet phase";
  return <ProfileSheet title={isNew ? `New ${title.toLowerCase()}` : title} titleAccessory={<NotebookInfoButton label={`About ${title.toLowerCase()}`} onPress={() => showAppAlert(title,
    `${isNew ? "Starting a new phase creates a new history entry, even for the same phase type. Choose the week you want to start from." : "Edit the name or current week without restarting the phase. Leave the name blank to use its phase type."}\n\nWeeks advance automatically. ${phaseKey === "trainingPhase" ? "Recommendations" : "Nutrition targets"} continue to use the phase type.${staged ? "\n\nTap Done, then Save on Profile to apply your changes." : ""}`)} />} onClose={close} footer={isNew || changed || busy ? <ProfileAction primary disabled={busy} label={busy ? "Saving..." : staged ? "Done" : isNew ? "Start phase" : "Save changes"} onPress={() => void apply()} /> : undefined}>
    <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 20 }}>
        <View style={{ gap: 4 }}>
          {editingName ? <ProfileField autoFocus label="Name" value={name} onChangeText={setName} placeholder={phase} maxLength={60} editable={!busy} /> :
            <Pressable accessibilityRole="button" accessibilityLabel="Edit phase name" onPress={() => setEditingName(true)} style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, minHeight: 44 }}>
              <Text style={{ flexShrink: 1, color: isNew && !name.trim() ? colors.muted : colors.ink, fontFamily: notebookFonts.semibold, fontSize: 22 }}>{name.trim() || (isNew ? "Name this phase" : phase)}</Text>
              <View style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Pencil size={18} strokeWidth={1.5} color={colors.muted} /></View>
            </Pressable>}
          {!isNew ? <ProfileText muted>{phase}{week.trim() ? ` \u00b7 Week ${week}` : ""}</ProfileText> : null}
        </View>
        {isNew ? editingType ? <ProfileChoices label="Phase type" values={phaseKey === "trainingPhase" ? ["Hypertrophy", "Strength", "Power"] : ["Cut", "Maintain", "Bulk"]} selected={phase} onChange={(value) => { setPhase(value); setEditingType(false); }} /> :
          <Pressable accessibilityRole="button" accessibilityLabel="Choose phase type" onPress={() => { Keyboard.dismiss(); setEditingType(true); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <ProfileText>Phase type</ProfileText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ProfileText muted>{phase}</ProfileText><ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /></View>
          </Pressable> : null}
        {editingWeek ? <ProfileField autoFocus inline inputWidth={72} label={isNew ? "Starting week" : "Current week"} value={week} onChangeText={setWeek} placeholder={isNew ? "1" : "\u2014"} keyboardType="number-pad" maxLength={3} editable={!busy} /> :
          <Pressable accessibilityRole="button" accessibilityLabel={isNew ? "Edit starting week" : "Edit current week"} onPress={() => setEditingWeek(true)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <ProfileText>{isNew ? "Starting week" : "Current week"}</ProfileText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ProfileText muted>{week.trim() || "Not recorded"}</ProfileText><ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /></View>
          </Pressable>}
      {error ? <View accessibilityLiveRegion="polite"><ProfileText muted>{error}</ProfileText></View> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={isNew ? "Back to current phase" : "Start new phase"} onPress={switchForm} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: isNew ? "flex-start" : "space-between", gap: 12 }}>
          {isNew ? <ChevronLeft size={18} strokeWidth={1.5} color={colors.muted} /> : null}<ProfileText>{isNew ? "Back to current phase" : "Start new phase"}</ProfileText>{!isNew ? <ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /> : null}
        </Pressable>
      </View>
    </View>
  </ProfileSheet>;
}
