import { useNotebook, notebookSheet } from "../../ui/notebook/Notebook";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { notebookFonts } from "../../ui/notebook/tokens";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { centeredTimeIndex, wrapTimePart } from "../timeWheel";
import MealTimeWheel, { nativeMealTimeWheelAvailable } from "../../components/MealTimeWheel";
import type { MealTimeWheelProps } from "../../components/MealTimeWheel.types";
import type { NutritionMeal } from "../../contracts";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../ui/KeyboardAwareModalFrame";
import { showAppDialog } from "../../ui/appDialog";
import { formatMealTime, mealLabel, parseMealTime, sectionMealTime, type MealLabelMode, type MealLabels } from "../mealOrganization";
import { saveSectionMealTime } from "../meals";
import { useMealLabels } from "../useMealLabels";

export function MealPreferencesCard({ labels, onChange, disabled = false }: {
  labels: MealLabels; onChange: (labels: MealLabels) => void; disabled?: boolean;
}) {
  const change = (mode: MealLabelMode) => {
    showAppDialog({
      title: mode === labels.mode ? "Reset default meal names?" : "Change default meal labels?",
      message: "Default names will be reset. Date-specific names, food entries and meal times will not change.",
      buttons: [{ text: "Cancel", role: "cancel" }, { text: "Continue", onPress: () => onChange({ mode, names: {} }) }],
    });
  };
  return <View style={legacyStyles.card}>
    <Text style={legacyStyles.title}>Meal labels</Text>
    <Text style={legacyStyles.description}>Choose default meal names. Rename meals for individual dates in Nutrition. Save your Profile changes to apply this preference.</Text>
    <View style={legacyStyles.row}>{(["named", "numbered"] as const).map((mode) =>
      <Pressable key={mode} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: labels.mode === mode, disabled }}
        style={[legacyStyles.button, labels.mode === mode && legacyStyles.selected]} onPress={() => { if (mode !== labels.mode) change(mode); }}>
        <Text style={legacyStyles.text}>{mode === "named" ? "Named" : "Numbered"}</Text>
      </Pressable>)}</View>
    <Pressable disabled={disabled} style={legacyStyles.button} onPress={() => change(labels.mode)}><Text style={legacyStyles.text}>Reset default names</Text></Pressable>
  </View>;
}

export function MealOrganizationEditor({ uid, section, sections, meals, dateKey, onClose, initialMode = "menu", onMoveUp, onMoveDown }: {
  uid: string | null; section: string; sections: string[]; meals: NutritionMeal[]; dateKey: string; onClose: () => void;
  initialMode?: "menu" | "time" | "name";
  onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  const { colors, fontsLoaded } = useNotebook();
  const ModalView = fontsLoaded ? NotebookModal : Modal;
  const themed = notebookSheet({
    card: { backgroundColor: colors.surface, padding: 20, borderColor: colors.rule, borderBottomWidth: 1, gap: 12 },
    title: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22, marginBottom: 16 },
    description: { color: colors.muted, fontSize: 15, marginBottom: 12 },
    text: { color: colors.ink, fontSize: 16 },
    button: { minHeight: 48, padding: 12, borderRadius: 4, borderWidth: 1, borderColor: colors.rule, alignItems: "center", marginBottom: 12 },
    selected: { backgroundColor: colors.subtle, borderColor: colors.ink },
    overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.overlay },
    modal: { width: "100%", maxWidth: 560, backgroundColor: colors.surface, borderRadius: 8, padding: 20, borderWidth: 1, borderColor: colors.border },
    input: { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, padding: 14, fontSize: 18, minHeight: 56, marginBottom: 12 },
    error: { color: colors.danger, fontSize: 14, minHeight: 22, marginBottom: 12 },
  });
  const styles = fontsLoaded ? { ...legacyStyles, ...themed } : legacyStyles;
  const { labels, ready, saveName } = useMealLabels(uid, dateKey);
  const [useAsDefault, setUseAsDefault] = useState(false);
  const [mode, setMode] = useState<"menu" | "name" | "time">(initialMode);
  const [name, setName] = useState<string | null>(null);
  const clock = formatMealTime(sectionMealTime(meals));
  const [hours, setHours] = useState(() => clock === "Set time" ? "00" : clock.split(":")[0]);
  const [minutesText, setMinutesText] = useState(() => clock === "Set time" ? "00" : clock.split(":")[1]);
  const [pending, setPending] = useState(false);
  const [hourScrolling, setHourScrolling] = useState(false);
  const [minuteScrolling, setMinuteScrolling] = useState(false);
  const [error, setError] = useState("");
  const close = () => { if (!pending) onClose(); };
  const save = async () => {
    setError("");
    const clean = (name ?? mealLabel(section, labels)).trim();
    if (mode === "name" && (!clean || clean.length > 24)) { setError("Enter a meal name of 1-24 characters."); return; }
    if (mode === "name" && sections.some((id) => id !== section && mealLabel(id, labels).toLowerCase() === clean.toLowerCase())) {
      setError("Another meal already uses that name."); return;
    }
    const minutes = hours.trim() && minutesText.trim() ? parseMealTime(`${hours}:${minutesText.padStart(2, "0")}`) : null;
    if (mode === "time" && minutes == null) { setError("Enter a valid 24-hour time, such as 18:30."); return; }
    if (!uid) return;
    setPending(true);
    try {
      if (mode === "name") await saveName(section, clean, useAsDefault);
      else await saveSectionMealTime(uid, meals, minutes!);
      onClose();
    } catch { setError("Could not save changes. Please try again."); }
    finally { setPending(false); }
  };
  return <ModalView transparent animationType={mode === "time" ? "none" : "fade"} visible onRequestClose={close}>
    <KeyboardAwareModalFrame style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close meal options" />
      <AdaptiveModalCard contentSized style={styles.modal}>
        <Text style={styles.title}>{mode === "name" ? "Rename meal" : mode === "time" ? "Meal time" : mealLabel(section, labels)}</Text>
        {mode === "menu" ? <>
          <Pressable disabled={!ready} style={styles.button} onPress={() => setMode("name")}><Text style={styles.text}>Rename meal</Text></Pressable>
          <Pressable disabled={!meals.length} style={[styles.button, !meals.length && { opacity: 0.45 }]} onPress={() => setMode("time")}><Text style={styles.text}>Edit meal time</Text></Pressable>
          {!meals.length ? <Text style={styles.description}>Add food before setting a meal time.</Text> : null}
          {onMoveUp ? <Pressable style={styles.button} onPress={onMoveUp}><Text style={styles.text}>Move up</Text></Pressable> : null}
          {onMoveDown ? <Pressable style={styles.button} onPress={onMoveDown}><Text style={styles.text}>Move down</Text></Pressable> : null}
        </> : <>
          <Text style={styles.description}>{mode === "name" ? `Rename for ${dateKey}. Other dates keep their own names or the default.` : `${mealLabel(section, labels)} · ${dateKey} · 24-hour time`}</Text>
          {mode === "name" ? <TextInput disableFullscreenUI selectTextOnFocus accessibilityLabel="Meal name" style={styles.input}
            value={name ?? mealLabel(section, labels)} onChangeText={setName} editable={!pending} maxLength={24} autoCapitalize="sentences"
            placeholder="e.g. Post-workout" placeholderTextColor={fontsLoaded ? colors.muted : "#a5acc1"} /> : fontsLoaded ? <View style={styles.row}>
            <TimePart label="Hour" count={24} value={hours} onChange={setHours} onScrolling={setHourScrolling} disabled={pending} />
            <TimePart label="Minute" count={60} value={minutesText} onChange={setMinutesText} onScrolling={setMinuteScrolling} disabled={pending} />
          </View> : <View style={styles.row}>
            <View style={{ flex: 1 }}><Text style={styles.description}>Hour (0-23)</Text>
              <TextInput accessibilityLabel="Meal hour" style={styles.input} value={hours} onChangeText={setHours} maxLength={2}
                editable={!pending} keyboardType="number-pad" placeholder="e.g. 18" placeholderTextColor="#a5acc1" />
            </View>
            <View style={{ flex: 1 }}><Text style={styles.description}>Minute (0-59)</Text>
              <TextInput accessibilityLabel="Meal minute" style={styles.input} value={minutesText} onChangeText={setMinutesText} maxLength={2}
                editable={!pending} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor="#a5acc1" />
            </View>
          </View>}
          {mode === "name" ? <View style={[styles.row, { alignItems: "center", marginBottom: 12 }]}><Text style={[styles.text, { flex: 1 }]}>Use as default for other dates</Text><View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.subtle, paddingHorizontal: 3 }}><Switch accessibilityLabel="Use as default for other dates" value={useAsDefault} onValueChange={setUseAsDefault} disabled={pending} trackColor={{ false: colors.border, true: colors.ink }} thumbColor={useAsDefault ? colors.surface : colors.ink} /></View></View> : null}
          <Text accessibilityLiveRegion="polite" style={styles.error}>{error || " "}</Text>
          <Pressable disabled={pending || !ready || (mode === "time" && (hourScrolling || minuteScrolling))} style={[styles.button, styles.selected]} onPress={() => void save()}><Text style={styles.text}>{pending ? "Saving..." : "Save"}</Text></Pressable>
        </>}
        <Pressable disabled={pending} style={styles.button} onPress={close}><Text style={styles.text}>{mode === "menu" ? "Close" : "Cancel"}</Text></Pressable>
      </AdaptiveModalCard>
    </KeyboardAwareModalFrame>
  </ModalView>;
}

const legacyStyles = StyleSheet.create({
  card: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)" },
  title: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  description: { color: "#a5acc1", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10 },
  button: { minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", marginBottom: 10 },
  selected: { backgroundColor: "#373b67" },
  text: { color: "#fff", fontSize: 14, fontWeight: "600" },
  overlay: { justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.65)" },
  modal: { width: "100%", backgroundColor: "#171729", borderRadius: 16, padding: 20 },
  input: { color: "#fff", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14 },
  error: { color: "#fca5a5", fontSize: 13, marginBottom: 12 },
});

type TimePartProps = { label: string; count: number; value: string; onChange: (value: string) => void; onScrolling: (value: boolean) => void; disabled: boolean };

const TimePart = React.memo(function TimePart(props: TimePartProps) {
  return nativeMealTimeWheelAvailable ? <NativeTimePart {...props} /> : <FallbackTimePart {...props} />;
});

function NativeTimePart({ label, count, value, onChange, onScrolling, disabled }: TimePartProps) {
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(48, Math.ceil(32 * fontScale + 16));
  const change = useCallback<MealTimeWheelProps["onWheelChange"]>(event => {
    const { value: next, scrolling } = event.nativeEvent;
    if (!scrolling) onChange(String(next).padStart(2, "0"));
    onScrolling(scrolling);
  }, [onChange, onScrolling]);
  return <View style={{ flex: 1, gap: 8 }}>
    <Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16 }}>{label}</Text>
    <View style={{ height: rowHeight * 3, borderWidth: 1, borderColor: colors.rule, borderRadius: 4, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: rowHeight, left: 0, right: 0, height: rowHeight, backgroundColor: colors.subtle, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }} />
      <MealTimeWheel count={count} initialValue={value === "" ? 0 : Number(value)} inkColor={colors.ink} numberSize={18}
        accessibilityLabel={label} partLabel={label} enabled={!disabled} onWheelChange={change} style={{ width: "100%", height: "100%" }} />
    </View>
  </View>;
}

function FallbackTimePart({ label, count, value, onChange, onScrolling, disabled }: TimePartProps) {
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(48, Math.ceil(32 * fontScale + 16));
  const scroll = useRef<ScrollView>(null);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(0);
  const moving = useRef(false);
  const dragging = useRef(false);
  const selected = value === "" ? 0 : wrapTimePart(Number(value), count);
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  // contentOffset is a native command, not a controlled selection. Passing the
  // old selected offset again when Save's state changes can cancel the gesture.
  const [initialOffset] = useState(() => ({ x: 0, y: centeredTimeIndex(selected, count) * rowHeight }));
  const cancelSettle = () => { if (settling.current !== null) clearTimeout(settling.current); settling.current = null; };
  useEffect(() => {
    const y = centeredTimeIndex(selectedRef.current, count) * rowHeight;
    offset.current = y;
    scroll.current?.scrollTo({ y, animated: false });
  }, [count, rowHeight]);
  useEffect(() => () => { if (settling.current !== null) clearTimeout(settling.current); }, []);
  const select = (index: number) => {
    cancelSettle();
    moving.current = false;
    dragging.current = false;
    const next = wrapTimePart(index, count);
    const y = centeredTimeIndex(next, count) * rowHeight;
    offset.current = y;
    scroll.current?.scrollTo({ y, animated: false });
    onChange(String(next).padStart(2, "0"));
    onScrolling(false);
  };
  const settle = (y: number) => select(Math.round(y / rowHeight));
  return <View style={{ flex: 1, gap: 8 }}>
    <Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16 }}>{label}</Text>
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: value === "" ? "Not set" : value }} accessibilityState={{ disabled }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={event => { if (!disabled) select(selected + (event.nativeEvent.actionName === "increment" ? 1 : -1)); }}
      style={{ height: rowHeight * 3, borderWidth: 1, borderColor: colors.rule, borderRadius: 4, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: rowHeight, left: 0, right: 0, height: rowHeight, backgroundColor: colors.subtle, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }} />
      <ScrollView ref={scroll} nestedScrollEnabled scrollEnabled={!disabled} showsVerticalScrollIndicator={false}
        contentOffset={initialOffset} contentContainerStyle={{ paddingVertical: rowHeight }}
        snapToInterval={rowHeight} decelerationRate="fast" scrollEventThrottle={16}
        onScroll={event => { if (moving.current) offset.current = event.nativeEvent.contentOffset.y; }}
        onScrollBeginDrag={() => { cancelSettle(); moving.current = true; dragging.current = true; onScrolling(true); }}
        onMomentumScrollBegin={() => { if (moving.current) cancelSettle(); }}
        onScrollEndDrag={event => {
          dragging.current = false;
          offset.current = event.nativeEvent.contentOffset.y;
          cancelSettle();
          settling.current = setTimeout(() => { if (moving.current) settle(offset.current); }, 200);
        }}
        onMomentumScrollEnd={event => { if (moving.current && !dragging.current) settle(event.nativeEvent.contentOffset.y); }}>
        {Array.from({ length: count * 5 }, (_, index) => {
          const item = String(wrapTimePart(index, count)).padStart(2, "0");
          return <Pressable key={index} accessible={false} disabled={disabled} onPress={() => select(index)} style={{ height: rowHeight, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.ink, fontFamily: value === item ? notebookFonts.semibold : notebookFonts.body, fontSize: 18 }}>{item}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View>
  </View>;
}
