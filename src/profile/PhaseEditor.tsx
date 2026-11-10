import React, { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { Keyboard, Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react-native";
import { ProfileAction, ProfileChoices, ProfileField, ProfileSheet, ProfileText } from "./ProfileNotebookControls";
import { currentPhaseWeek, phaseDateKey, parsePhaseStartDate, phaseWeekFromDate, phaseType, phaseHistorySignature, phaseTimeline, type PhaseEdit, type PhaseKey } from "./phaseState";
import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import { useNotebook } from "../ui/notebook/Notebook";
import { showAppAlert, confirmAppDialog } from "../ui/appDialog";
import { notebookFonts } from "../ui/notebook/tokens";
import { NotebookDateCalendar } from "../ui/notebook/NotebookDateCalendar";

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
  const baselineStart = baseline[`${phaseKey}StartedAt`];
  const [startDate, setStartDate] = useState(draft?.startDateKey ?? (draft?.mode === "new" ? phaseDateKey(new Date()) : baselineStart instanceof Timestamp ? phaseDateKey(baselineStart.toDate()) : ""));
  const [dateTouched, setDateTouched] = useState(draft?.startDateKey !== undefined);
  const [initialFields] = useState(() => ({ name: draft?.name ?? current[`${phaseKey}Name`] ?? "", startDate: draft?.startDateKey ?? (baselineStart instanceof Timestamp ? phaseDateKey(baselineStart.toDate()) : "") }));
  const [editingName, setEditingName] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyDates, setHistoryDates] = useState<Record<number, string>>(() => Object.fromEntries((draft?.historyDates ?? []).map(item => [item.index, item.startDateKey])));
  const [removedHistoryIndices, setRemovedHistoryIndices] = useState<number[]>(draft?.removedHistoryIndices ?? []);
  const [editingType, setEditingType] = useState(false);
  const [currentFields, setCurrentFields] = useState(() => ({ phase: phaseType(baseline, phaseKey), name: baseline[`${phaseKey}Name`] ?? "", startDate: baselineStart instanceof Timestamp ? phaseDateKey(baselineStart.toDate()) : "", dateTouched: false }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => draft?.requestId ?? `phase-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const isNew = mode === "Start new phase";
  const week = isNew || dateTouched ? phaseWeekFromDate(startDate) : draft?.week ?? initialWeek;
  const history = Array.isArray(baseline[`${phaseKey}History`]) ? baseline[`${phaseKey}History`] : [];
  const currentHistoryIndex = history.findLastIndex((entry: any) => entry?.phase === baseline[phaseKey] && entry?.startedAt instanceof Timestamp && baselineStart instanceof Timestamp && entry.startedAt.isEqual(baselineStart));
  const pastHistory = history.map((entry: any, index: number) => ({ entry, index })).filter(({ entry, index }: any) => index !== currentHistoryIndex && !removedHistoryIndices.includes(index) && entry?.startedAt instanceof Timestamp);
  const timeline = phaseTimeline(pastHistory.map(({entry,index}: any) => ({ index, phase: entry.phase, name: entry.name, startDate: historyDates[index] ?? phaseDateKey(entry.startedAt.toDate()) })), { phase: isNew ? currentFields.phase : phase, name: isNew ? currentFields.name : name, startDate: isNew ? currentFields.startDate : startDate });
  const historyEdits = Object.entries(historyDates).filter(([index, key]) => !removedHistoryIndices.includes(Number(index)) && key !== (history[Number(index)]?.startedAt instanceof Timestamp ? phaseDateKey(history[Number(index)].startedAt.toDate()) : "")).map(([index, startDateKey]) => ({ index: Number(index), startDateKey }));
  const changed = name.trim() !== initialFields.name.trim() || dateTouched || historyEdits.length > 0 || removedHistoryIndices.length > 0 || draft?.mode === "new" && !isNew;
  const close = () => { if (!busy) onClose(); };
  const switchForm = () => {
    if (busy) return;
    Keyboard.dismiss();
    setEditingName(false); setEditingDate(false); setEditingType(false);
    if (isNew) {
      setMode("Edit current phase"); setPhase(currentFields.phase); setName(currentFields.name); setStartDate(currentFields.startDate); setDateTouched(currentFields.dateTouched);
    } else {
      setCurrentFields({ phase, name, startDate, dateTouched });
      setMode("Start new phase"); setPhase(phaseType(baseline, phaseKey)); setName(""); setStartDate(phaseDateKey(new Date())); setDateTouched(true);
    }
    setError("");
  };
  const apply = async () => {
    if (busy) return;
    if ((isNew || dateTouched) && (!parsePhaseStartDate(startDate) || startDate > phaseDateKey(new Date()))) { setError("Enter a valid start date on or before today (YYYY-MM-DD)."); return; }
    if (!draft && !isNew && !changed) { onClose(); return; }
    setBusy(true); setError("");
    try {
      await onApply({ mode: isNew ? "new" : "edit", phase, name: name.trim(), requestId,
        week: isNew ? 1 : draft?.week ?? null,
        ...(historyEdits.length || removedHistoryIndices.length ? { historyDates: historyEdits, removedHistoryIndices, expectedHistory: draft?.expectedHistory ?? phaseHistorySignature(history) } : {}),
        ...((isNew || dateTouched) ? { startDateKey: startDate } : {}),
        expectedPhase: draft ? draft.expectedPhase : phaseType(baseline, phaseKey),
        expectedStartMs: draft ? draft.expectedStartMs : (baseline[`${phaseKey}StartedAt`] instanceof Timestamp ? baseline[`${phaseKey}StartedAt`].toMillis() : null) });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't save phase. Please try again."); }
    finally { setBusy(false); }
  };
  const title = phaseKey === "trainingPhase" ? "Training phase" : "Diet phase";
  return <ProfileSheet title={editingDate ? "Start date" : historyOpen ? "Phase history" : isNew ? `New ${title.toLowerCase()}` : title} titleAccessory={editingDate || historyOpen ? undefined : <NotebookInfoButton label={`About ${title.toLowerCase()}`} onPress={() => showAppAlert(title,
    `${isNew ? "Starting a new phase creates a new history entry, even for the same phase type. Choose the date it began." : "Edit the name or confirm its start date without restarting the phase. Leave the name blank to use its phase type."}\n\nWeek 1 covers the start date and the next six days. Weeks then advance automatically. Existing week values stay unchanged until you confirm a start date. ${phaseKey === "trainingPhase" ? "Recommendations" : "Nutrition targets"} continue to use the phase type.${staged ? "\n\nTap Done, then Save on Profile to apply your changes." : ""}`)} />} onClose={editingDate ? () => setEditingDate(false) : historyOpen ? () => setHistoryOpen(false) : close} footer={historyOpen && !editingDate ? <ProfileAction label="Back to phase" onPress={() => setHistoryOpen(false)} /> : !editingDate && (isNew || changed || busy) ? <ProfileAction primary disabled={busy} label={busy ? "Saving..." : staged ? "Done" : isNew ? "Start phase" : "Save changes"} onPress={() => void apply()} /> : undefined}>
    {editingDate ? <NotebookDateCalendar selected={historyIndex === null ? startDate : historyDates[historyIndex] ?? phaseDateKey(history[historyIndex].startedAt.toDate())} maximum={phaseDateKey(new Date())} onSelect={key => { if (historyIndex === null) { setStartDate(key); setDateTouched(true); } else setHistoryDates(values => ({ ...values, [historyIndex]: key })); setEditingDate(false); setError(""); }} /> : historyOpen ? <View style={{ gap: 16 }}>
      <ProfileText muted>Each phase ends when the next begins. Changes apply when you save.</ProfileText>
      <View>{timeline.map((entry, position) => <View key={entry.index} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderBottomWidth: position === timeline.length - 1 ? 0 : 1, borderBottomColor: colors.rule }}><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${entry.name || entry.phase} start date${entry.current ? ", current phase" : ""}`} onPress={() => { setHistoryIndex(entry.current ? null : entry.index); setEditingDate(true); }} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
        <View style={{ flex: 1, gap: 4 }}><ProfileText>{entry.name || entry.phase}{entry.current ? " · Current" : ""}</ProfileText>{entry.name && entry.name !== entry.phase ? <ProfileText muted>{entry.phase}</ProfileText> : null}<ProfileText muted>{entry.startDate} – {entry.current ? "Present" : entry.endDate ?? "End not recorded"}</ProfileText></View><ChevronRight size={18} color={colors.muted} />
      </Pressable>{!entry.current ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${entry.name || entry.phase}, ${position + 1}`} onPress={() => void confirmAppDialog("Remove past phase?", "Remove this entry from phase history? Workouts and health records stay saved. The removal applies when you save the phase.", "Remove").then(accepted => { if (accepted) setRemovedHistoryIndices(values => [...values, entry.index]); })} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Trash2 size={20} strokeWidth={1.5} color={colors.danger} /></Pressable> : <View style={{width:44}} />}</View>)}</View>
      {removedHistoryIndices.length ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ flex: 1 }}><ProfileText muted>{removedHistoryIndices.length} {removedHistoryIndices.length === 1 ? "phase" : "phases"} removed on save.</ProfileText></View><Pressable accessibilityRole="button" onPress={() => setRemovedHistoryIndices(values => values.slice(0, -1))} style={{ minHeight: 44, justifyContent: "center" }}><ProfileText>Undo</ProfileText></Pressable></View> : null}
    </View> : <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 20 }}>
        <View style={{ gap: 4 }}>
          {editingName ? <ProfileField autoFocus label="Name" value={name} onChangeText={setName} placeholder={phase} maxLength={60} editable={!busy} /> :
            <Pressable accessibilityRole="button" accessibilityLabel="Edit phase name" onPress={() => setEditingName(true)} style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, minHeight: 44 }}>
              <Text style={{ flexShrink: 1, color: isNew && !name.trim() ? colors.muted : colors.ink, fontFamily: notebookFonts.semibold, fontSize: 22 }}>{name.trim() || (isNew ? "Name this phase" : phase)}</Text>
              <View style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Pencil size={18} strokeWidth={1.5} color={colors.muted} /></View>
            </Pressable>}
          {!isNew ? <ProfileText muted>{phase}{week != null ? ` \u00b7 Week ${week}` : ""}</ProfileText> : null}
        </View>
        {isNew ? editingType ? <ProfileChoices label="Phase type" values={phaseKey === "trainingPhase" ? ["Hypertrophy", "Strength", "Power"] : ["Cut", "Maintain", "Bulk"]} selected={phase} onChange={(value) => { setPhase(value); setEditingType(false); }} /> :
          <Pressable accessibilityRole="button" accessibilityLabel="Choose phase type" onPress={() => { Keyboard.dismiss(); setEditingType(true); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <ProfileText>Phase type</ProfileText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ProfileText muted>{phase}</ProfileText><ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /></View>
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Edit phase start date" onPress={() => { Keyboard.dismiss(); setHistoryIndex(null); setEditingDate(true); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <ProfileText>Start date</ProfileText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ProfileText muted>{startDate || "Not recorded"}</ProfileText><ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /></View>
          </Pressable>
        <View style={{gap: 6}}><ProfileText>{week != null ? `Week ${week}` : "Week not recorded"}</ProfileText>{!parsePhaseStartDate(startDate) ? <ProfileText muted>Add a start date to calculate weeks.</ProfileText> : null}</View>
        {!isNew ? <Pressable accessibilityRole="button" onPress={() => { Keyboard.dismiss(); setHistoryOpen(true); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><ProfileText>Phase history</ProfileText><ChevronRight size={18} color={colors.muted} /></Pressable> : null}
      {error ? <View accessibilityLiveRegion="polite"><Text accessibilityRole="alert" style={{ color: colors.danger, fontFamily: notebookFonts.body, fontSize: 14 }}>{error}</Text></View> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={isNew ? "Back to current phase" : "Start new phase"} onPress={switchForm} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: isNew ? "flex-start" : "space-between", gap: 12 }}>
          {isNew ? <ChevronLeft size={18} strokeWidth={1.5} color={colors.muted} /> : null}<ProfileText>{isNew ? "Back to current phase" : "Start new phase"}</ProfileText>{!isNew ? <ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /> : null}
        </Pressable>
      </View>
    </View>}
  </ProfileSheet>;
}
