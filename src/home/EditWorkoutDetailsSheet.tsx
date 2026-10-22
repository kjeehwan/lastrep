import React, { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Keyboard, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { mondayCalendarMatrix } from "./notebookPresentation";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { KeyboardAwareModalFrame } from "../ui/KeyboardAwareModalFrame";
import { AdaptiveModalCard } from "../ui/AdaptiveModalCard";
import { NotebookModal } from "../ui/notebook/NotebookModal";
import { notebookSheet, useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import { toDateKey, type WorkoutSummary } from "../workouts/homeInsights";
import { detailsChanged, detailsDraft, parseWorkoutDetails, type SavedWorkoutDetails } from "../workouts/workoutDetails";
import { saveWorkoutDetails, WorkoutDetailsConflict } from "../workouts/saveWorkoutDetails";

const OFFLINE = "You are offline. Reconnect and try again.";

export function EditWorkoutDetailsSheet({ uid, workout, onClose, onSaved, onRefresh }: {
  uid: string; workout: WorkoutSummary; onClose: () => void;
  onRefresh: () => void;
  onSaved: (details: SavedWorkoutDetails) => void;
}) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const { fontScale, height } = useWindowDimensions();
  const [original] = useState(() => ({ date: workout.date, durationMin: workout.durationMin ?? null }));
  const [draft, setDraft] = useState(() => detailsDraft(original));
  const [calendar, setCalendar] = useState(false);
  const [month, setMonth] = useState(() => new Date(workout.date.getFullYear(), workout.date.getMonth(), 1));
  const [saveError, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const inFlight = useRef(false);
  const { ready, isOffline } = useOfflineStatus();
  const error = ready && !isOffline && saveError === OFFLINE ? "" : saveError;
  let changed = true;
  try { changed = detailsChanged(parseWorkoutDetails(draft, original), original); } catch { /* Save shows validation beside the inputs. */ }
  const close = () => { if (inFlight.current) return; if (calendar) setCalendar(false); else onClose(); };
  const save = async () => {
    if (inFlight.current || !changed) return;
    if (!ready) { setError("Checking connection. Please try again shortly."); return; }
    if (isOffline) { setError(OFFLINE); return; }
    inFlight.current = true; setSaving(true); setError("");
    try { const result = await saveWorkoutDetails(uid, workout.id, original, draft); onSaved(result); }
    catch (failure) {
      setConflict(failure instanceof WorkoutDetailsConflict);
      const code = (failure as { code?: string })?.code;
      setError(code ? "Couldn't save your changes. Check your connection and try again." : failure instanceof Error ? failure.message : "Couldn't save your changes. Try again.");
    } finally { inFlight.current = false; setSaving(false); }
  };
  const title = calendar ? "Workout date" : "Edit workout details";
  const today = toDateKey(new Date());
  return <NotebookModal visible transparent animationType="fade" onRequestClose={close} dismissOnBackdropPress={!saving}>
    <KeyboardAwareModalFrame androidBehavior="padding" style={styles.overlay} onDismiss={saving ? undefined : close}>
      <AdaptiveModalCard contentSized viewportMargin={height < 500 ? 8 : 32} style={[styles.card, height < 500 && { paddingVertical: 8 }]}>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>{title}</Text><TouchableOpacity disabled={saving} onPress={close} accessibilityRole="button" accessibilityLabel={calendar ? "Close date picker" : "Close workout details editor"} style={styles.iconButton}><Ionicons name="close" size={22} color={colors.ink} /></TouchableOpacity></View>
        {calendar ? <>
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={colors.ink} /></TouchableOpacity>
            <Text style={styles.month}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
            <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityRole="button" accessibilityLabel="Next month" style={styles.iconButton}><Ionicons name="chevron-forward" size={22} color={colors.ink} /></TouchableOpacity>
          </View>
          <View style={styles.week}>{["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <Text key={i} style={styles.weekday}>{day}</Text>)}</View>
          {mondayCalendarMatrix(month).map((week, index) => <View key={index} style={styles.week}>{week.map(date => {
            const key = toDateKey(date), selected = key === draft.date, outside = date.getMonth() !== month.getMonth(), future = key > today;
            return <TouchableOpacity key={key} disabled={future} onPress={() => { setDraft(old => ({ ...old, date: key })); setError(""); setCalendar(false); }} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} accessibilityState={{ selected, disabled: future }} style={[styles.day, selected && styles.selected, (future || outside) && styles.mutedDay]}><Text style={styles.dayText}>{date.getDate()}</Text></TouchableOpacity>;
          })}</View>)}
        </> : <>
          <Text style={styles.workout}>{workout.title}</Text>
          <Text style={styles.muted}>Update this saved workout.</Text>
          <Text style={styles.label}>Workout date</Text>
          <TouchableOpacity disabled={saving || conflict} style={styles.date} accessibilityRole="button" accessibilityLabel={`Workout date, ${draft.date}`} onPress={() => { Keyboard.dismiss(); const [year, m] = draft.date.split("-").map(Number); setMonth(new Date(year, m - 1, 1)); setCalendar(true); }}><Text style={styles.body}>{new Date(`${draft.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text><Ionicons name="calendar-outline" size={22} color={colors.ink} /></TouchableOpacity>
          <Text style={styles.label}>Duration</Text>
          <View style={styles.durationRow}>{(["hours", "minutes"] as const).map((part, index) => <React.Fragment key={part}>
            {index ? <Text accessible={false} style={styles.colon}>:</Text> : null}
            <View style={styles.durationColumn}><TextInput selectTextOnFocus disableFullscreenUI editable={!saving && !conflict} keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={colors.muted} value={draft[part]} onChangeText={value => { setDraft(old => ({ ...old, [part]: value })); setError(""); }} accessibilityLabel={part === "hours" ? "Hours" : "Minutes"} style={[styles.input, { minHeight: Math.max(52, Math.ceil(34 * fontScale + 20)) }]} /><Text style={styles.unit}>{part === "hours" ? "Hours" : "Minutes"}</Text></View>
          </React.Fragment>)}</View>
          <Text style={styles.muted}>{original.durationMin == null ? "No duration was recorded. Leave both fields blank to keep it that way." : "Tap a number to edit the duration."}</Text>
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity disabled={saving || (!conflict && !changed)} onPress={conflict ? onRefresh : save} accessibilityRole="button" accessibilityState={{ disabled: saving || (!conflict && !changed), busy: saving }} style={[styles.primary, (saving || (!conflict && !changed)) && styles.disabled]}><Text style={styles.primaryText}>{saving ? "Saving…" : conflict ? "Refresh workout" : "Save changes"}</Text></TouchableOpacity>
        </>}
        <TouchableOpacity disabled={saving} onPress={close} accessibilityRole="button" style={styles.cancel}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
      </AdaptiveModalCard>
    </KeyboardAwareModalFrame>
  </NotebookModal>;
}

const createStyles = (colors: NotebookColors) => notebookSheet({
  overlay: { flex: 1, alignItems: "center", justifyContent: "flex-end", backgroundColor: colors.overlay },
  card: { width: "100%", maxWidth: 560, padding: 20, borderRadius: 16, backgroundColor: colors.surface },
  heading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  title: { flex: 1, color: colors.ink, fontFamily: "NotebookSerif", fontSize: 24, fontWeight: "600" },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  workout: { color: colors.ink, fontFamily: "NotebookSerif", fontSize: 22, marginBottom: 4 },
  muted: { color: colors.muted, fontSize: 14 }, label: { color: colors.ink, fontSize: 16, marginTop: 20, marginBottom: 8 },
  body: { color: colors.ink, fontSize: 16 }, date: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  durationRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 },
  durationColumn: { width: 112, flexShrink: 1, gap: 6 },
  input: { backgroundColor: colors.subtle, borderWidth: 0, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 10, textAlign: "center", color: colors.ink, fontSize: 24, fontWeight: "600" },
  colon: { color: colors.ink, fontSize: 28, paddingTop: 10 }, unit: { color: colors.muted, fontSize: 14, textAlign: "center" },
  error: { color: colors.danger, fontSize: 14, marginTop: 12 },
  primary: { backgroundColor: colors.primary, borderRadius: 8, padding: 12, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 20 },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" }, disabled: { opacity: 0.45 },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 }, link: { color: colors.accent, fontSize: 16 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 12 }, month: { flex: 1, textAlign: "center", color: colors.ink, fontSize: 18, fontWeight: "600" },
  week: { flexDirection: "row" }, weekday: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 13, marginBottom: 8 },
  day: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 6 }, dayText: { color: colors.ink, fontSize: 16 }, selected: { backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.ink }, mutedDay: { opacity: 0.3 },
});
