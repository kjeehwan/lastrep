import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import { WorkoutNativeSetRows } from "./WorkoutNativeSetRows";
import { notebookRowHeight } from "../../ui/notebook/tokens";
import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Keyboard, Platform, Text, TouchableOpacity, View, useWindowDimensions, type TextInputProps } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../ui/KeyboardAwareModalFrame";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { notebookSheet, useNotebook, useNotebookStyles } from "../../ui/notebook/Notebook";
import type { NotebookColors } from "../../ui/notebook/tokens";
import type { AvailableWeights } from "../availableWeights";
import { defaultWarmupPattern, orderedWarmupRows, readWarmupPattern, suggestWarmupRows, unmatchedWarmups, warmupKg, warmupKey, warmupPatternFromRows, warmupValidation, warmupWeight, type WarmupPattern, type WarmupRow, type WarmupSet, type WarmupUnit } from "./warmupSets";

function WarmupInput({ gesture, ...props }: TextInputProps & { gesture: ReturnType<typeof Gesture.Native> }) {
  return <GestureDetector gesture={gesture}><NotebookTextInput {...props} /></GestureDetector>;
}

function WarmupPreviewRow({ row, index, unit, styles, onChange, onRemove, onRegister, onOpen }: {
  row: WarmupRow; index: number; unit: WarmupUnit; styles: ReturnType<typeof createStyles>;
  onChange: (id: string, field: "weight" | "reps", value: string) => void;
  onRemove: (id: string) => void; onRegister: (id: string, value: SwipeableMethods | null) => void; onOpen: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const swipe = useRef<SwipeableMethods | null>(null);
  const gestures = useMemo(() => ({ weight: Gesture.Native().disallowInterruption(false), reps: Gesture.Native().disallowInterruption(false) }), []);
  return <ReanimatedSwipeable ref={value => { swipe.current = value; onRegister(row.id, value); }} overshootRight={false} rightThreshold={12} friction={1.2} dragOffsetFromLeftEdge={24} dragOffsetFromRightEdge={24} simultaneousWithExternalGesture={Object.values(gestures)} onSwipeableWillOpen={onOpen}
    renderRightActions={() => <TouchableOpacity style={styles.delete} onPress={() => onRemove(row.id)} accessibilityRole="button" accessibilityLabel={`Delete warm-up ${index + 1}`}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>}>
    <View style={styles.editRow}>
      <TouchableOpacity style={styles.column} accessibilityRole="button" accessibilityLabel={`Warm-up ${index + 1}, show Delete`} onPress={() => { Keyboard.dismiss(); swipe.current?.openRight(); }}><Text style={styles.center}>W</Text></TouchableOpacity>
      {(["weight", "reps"] as const).map(field => <WarmupInput key={field} gesture={gestures[field]} disableFullscreenUI selectTextOnFocus value={row[field]} onChangeText={value => onChange(row.id, field, value)} keyboardType={field === "weight" ? "decimal-pad" : "number-pad"} accessibilityLabel={`Warm-up ${index + 1}, ${field === "weight" ? unit : "reps"}`} style={[styles.input, styles.valueColumn, { minHeight: Math.max(48, Math.ceil(24 * fontScale + 16)) }]} placeholder={field === "weight" ? unit : "Reps"} placeholderTextColor={styles.muted.color} />)}
    </View>
  </ReanimatedSwipeable>;
}

export function WarmupSetsSheet({ uid, name, sets, unit, barbell, settings, loadRemembered = true, onClose, onApply }: {
  loadRemembered?: boolean;
  uid: string; name: string; sets: WarmupSet[]; unit: WarmupUnit; barbell: boolean; settings?: AvailableWeights;
  onClose: () => void; onApply: (rows: WarmupRow[], pattern: WarmupPattern) => string | null;
}) {
  const { colors } = useNotebook(), styles = useNotebookStyles(createStyles);
  const { height, fontScale } = useWindowDimensions();
  const first = sets.find(set => set.setType !== "warmup");
  const existing = sets.filter(set => set.setType === "warmup");
  const [reference, setReference] = useState(first?.weightKg ? warmupWeight(first.weightKg, unit) : "");
  const referenceKg = warmupKg(Number(reference), unit);
  const [pattern, setPattern] = useState<WarmupPattern>(() => defaultWarmupPattern(barbell, unit));
  const [rows, setRows] = useState<WarmupRow[]>([]), [kept, setKept] = useState<WarmupRow[]>([]);
  const [activeRow, setActiveRow] = useState(-1);
  const [deleteRow, setDeleteRow] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ row: WarmupRow; index: number } | null>(null);
  const [loaded, setLoaded] = useState(false), [remembered, setRemembered] = useState(false), [error, setError] = useState("");
  const serial = useRef(0), swipeables = useRef(new Map<string, SwipeableMethods>()), opened = useRef<SwipeableMethods | null>(null);
  useEffect(() => {
    let current = true;
    void (loadRemembered ? AsyncStorage.getItem(warmupKey(uid, name)) : Promise.resolve(null)).then(raw => {
      if (!current) return;
      const saved = readWarmupPattern(raw), next = saved ?? defaultWarmupPattern(barbell, unit);
      setPattern(next); setRemembered(!!saved);
      const suggested = unmatchedWarmups(suggestWarmupRows(first?.weightKg ?? 0, unit, next, settings), sets, unit);
      setRows(suggested.additions); setKept(suggested.kept); setLoaded(true);
    }).catch(() => { if (current) { setLoaded(true); setError("Couldn't load your last setup. Enter the sets you want to add."); } });
    return () => { current = false; };
    // This editor owns a snapshot; switching account/exercise remounts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const errorForRows = warmupValidation(rows, referenceKg, unit);
  const count = unmatchedWarmups(rows, sets, unit).additions.length;
  const changeRow = (id: string, field: "weight" | "reps", value: string) => {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row)); setError("");
  };
  const remove = (id: string) => {
    const index = rows.findIndex(row => row.id === id);
    if (index < 0) return;
    Keyboard.dismiss(); setUndo({ row: rows[index], index }); setActiveRow(-1); setDeleteRow(null);
    setRows(current => current.filter(row => row.id !== id)); setError("");
  };
  const suggest = () => {
    if (!Number.isFinite(referenceKg) || referenceKg <= 0) { setError("Enter a working weight above zero."); return; }
    Keyboard.dismiss(); const next = unmatchedWarmups(suggestWarmupRows(referenceKg, unit, pattern, settings), sets, unit);
    setRows(next.additions); setKept(next.kept); setError("");
  };
  const apply = () => {
    if (errorForRows) { setError(errorForRows); return; }
    const failure = onApply(unmatchedWarmups(rows, sets, unit).additions, warmupPatternFromRows(orderedWarmupRows(kept, rows), referenceKg, unit));
    if (failure) setError(failure);
  };
  const missing = !first?.weightKg;
  return <NotebookModal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAwareModalFrame androidBehavior="padding" style={styles.overlay} onDismiss={onClose}>
      <GestureHandlerRootView pointerEvents="box-none" style={styles.gestureRoot}>
        <AdaptiveModalCard contentSized viewportMargin={height < 500 ? 8 : 32} style={[styles.card, height < 500 && { paddingVertical: 8 }]}>
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Add warm-up sets</Text><TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close warm-up helper" style={styles.icon}><Ionicons name="close" size={22} color={colors.ink} /></TouchableOpacity></View>
          <Text style={styles.muted}>{name}</Text><Text style={[styles.muted, { marginTop: 8 }]}>First working set</Text>
          <Text style={styles.working}>{first?.weightKg ? warmupWeight(first.weightKg, unit) : "—"} {unit} × {first?.reps || "—"} reps</Text>
          {missing ? <View style={styles.reference}>
            <Text style={styles.muted}>Working weight / {unit}</Text><NotebookTextInput disableFullscreenUI selectTextOnFocus value={reference} onChangeText={value => { setReference(value); setError(""); }} keyboardType="decimal-pad" accessibilityLabel={`Working weight, ${unit}`} placeholder="e.g. 100" placeholderTextColor={colors.muted} style={styles.input} />
            <TouchableOpacity disabled={!loaded} onPress={suggest} style={styles.textButton} accessibilityRole="button"><Text style={styles.link}>Suggest sets</Text></TouchableOpacity>
            <Text style={styles.muted}>Used for this preview; your working set stays unchanged.</Text>
          </View> : null}
          {existing.length ? <View style={styles.existing}><Text style={styles.muted}>Already in your workout</Text>{existing.map((set, index) => <Text key={index} style={styles.body}>W   {set.weightKg != null ? warmupWeight(set.weightKg, unit) : "—"} {unit} × {set.reps} reps{set.done ? " · Done" : ""}</Text>)}</View> : null}
          <Text style={[styles.muted, { marginVertical: 12 }]}>{!loaded ? "Loading your warm-up setup…" : remembered ? "Your last setup, adapted to this working weight." : "Adjust the weights and reps to suit your warm-up."}</Text>
          <View style={styles.row}><Text style={[styles.column, styles.center]}>Set</Text><Text style={[styles.valueColumn, styles.center] }>{unit}</Text><Text style={[styles.valueColumn, styles.center]}>Reps</Text></View>
          {Platform.OS === "android" ? rows.length ? <WorkoutNativeSetRows previewMode
            activeSetIndex={activeRow} editingSuspended={false} onActivate={setActiveRow} notebookColors={colors} fontFamily="NotebookSans"
            listKey={`warmup-preview:${rows.map(row => row.id).join("|")}`} style={{ height: rows.length * notebookRowHeight(fontScale) }} weightLabel={unit} repsLabel="Reps" rpeLabel="RPE"
            rows={rows.map(row => ({ marker: "W", last: "", weight: row.weight, reps: row.reps, rpe: "", done: false }))}
            onChange={(index, field, value) => { if (field !== "rpe") changeRow(rows[index].id, field, value); }} onToggleDone={() => {}} onLastPress={() => {}}
            onDeleteSet={index => remove(rows[index].id)} onSetLabelPress={index => { Keyboard.dismiss(); setDeleteRow(rows[index].id); }} /> : null : (
rows.map((row, index) => <WarmupPreviewRow key={row.id} row={row} index={index} unit={unit} styles={styles} onChange={changeRow} onRemove={remove}
            onRegister={(id, value) => { if (value) swipeables.current.set(id, value); else swipeables.current.delete(id); }}
            onOpen={() => { Keyboard.dismiss(); const next = swipeables.current.get(row.id) ?? null; if (opened.current !== next) opened.current?.close(); opened.current = next; }} />))}
          {deleteRow ? <View style={styles.undo}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete selected warm-up" onPress={() => remove(deleteRow)} style={styles.textButton}><Text style={styles.link}>Delete warm-up</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setDeleteRow(null)} style={styles.textButton}><Text style={styles.link}>Cancel</Text></TouchableOpacity></View> : null}
          {undo ? <View style={styles.undo}><Text style={styles.muted}>Set deleted</Text><TouchableOpacity accessibilityRole="button" onPress={() => { setRows(current => { const next = current.slice(); next.splice(Math.min(undo.index, next.length), 0, undo.row); return next; }); setUndo(null); }} style={styles.textButton}><Text style={styles.link}>Undo</Text></TouchableOpacity></View> : null}
          {rows.length ? <Text style={styles.hint}>Swipe left on a set to delete.</Text> : null}
          <TouchableOpacity disabled={!loaded || rows.length + kept.length >= 12} accessibilityRole="button" onPress={() => { setRows(current => [...current, { id: `manual-${serial.current++}`, weight: "", reps: "", fixed: false }]); setError(""); }} style={styles.textButton}><Text style={styles.link}>+ Add a set</Text></TouchableOpacity>
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <Text style={styles.memory}>{loadRemembered ? `This setup is remembered for ${name} when you add it. Working sets stay unchanged.` : "Warm-up sets are added to this shared plan. Working sets stay unchanged."}</Text>
          <TouchableOpacity disabled={!loaded || !!errorForRows || !count} accessibilityState={{ disabled: !loaded || !!errorForRows || !count }} onPress={apply} accessibilityRole="button" style={[styles.primary, (!loaded || !!errorForRows || !count) && styles.disabled]}><Text style={styles.primaryText}>{count ? `Add ${count} warm-up set${count === 1 ? "" : "s"}` : existing.length ? "Warm-up sets already added" : "Add warm-up sets"}</Text></TouchableOpacity>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" style={styles.textButton}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
        </AdaptiveModalCard>
      </GestureHandlerRootView>
    </KeyboardAwareModalFrame>
  </NotebookModal>;
}

const createStyles = (colors: NotebookColors) => notebookSheet({
  overlay: { flex: 1, backgroundColor: colors.overlay }, gestureRoot: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  card: { width: "100%", maxWidth: 560, padding: 20, borderRadius: 16, backgroundColor: colors.surface },
  heading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }, title: { flex: 1, fontFamily: "NotebookSerif", fontSize: 24, fontWeight: "600", color: colors.ink },
  icon: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.muted, fontSize: 14 }, body: { color: colors.ink, fontSize: 16 }, working: { color: colors.ink, fontSize: 24, fontWeight: "600", marginTop: 4, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 }, editRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingVertical: 6, backgroundColor: colors.surface },
  column: { width: 40, minHeight: 44, justifyContent: "center", textAlignVertical: "center" }, valueColumn: { flex: 1, minWidth: 0 }, center: { textAlign: "center", color: colors.muted, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.subtle, color: colors.ink, fontSize: 20, textAlign: "center", paddingVertical: 8, paddingHorizontal: 4, minHeight: 48 },
  delete: { minWidth: 88, padding: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger }, deleteText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 13, marginTop: 8 }, reference: { gap: 8, marginVertical: 8 }, existing: { backgroundColor: colors.subtle, borderRadius: 6, padding: 12, gap: 6 },
  memory: { color: colors.muted, fontSize: 14, borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 12, marginTop: 8 },
  undo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  error: { color: colors.danger, fontSize: 14, marginVertical: 8 }, textButton: { minHeight: 48, justifyContent: "center", alignItems: "center" }, link: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  primary: { backgroundColor: colors.primary, borderRadius: 8, padding: 12, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 16 }, primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" }, disabled: { opacity: .45 },
});
