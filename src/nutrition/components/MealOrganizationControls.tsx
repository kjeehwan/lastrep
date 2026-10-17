import { useNotebook, notebookSheet } from "../../ui/notebook/Notebook";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { notebookFonts } from "../../ui/notebook/tokens";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
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
  const [hours, setHours] = useState(() => clock === "Set time" ? "" : clock.split(":")[0]);
  const [minutesText, setMinutesText] = useState(() => clock === "Set time" ? "" : clock.split(":")[1]);
  const [pending, setPending] = useState(false);
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
  return <ModalView transparent animationType="fade" visible onRequestClose={close}>
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
            <TimePart label="Hour" count={24} value={hours} onChange={setHours} disabled={pending} />
            <TimePart label="Minute" count={60} value={minutesText} onChange={setMinutesText} disabled={pending} />
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
          <Pressable disabled={pending || !ready} style={[styles.button, styles.selected]} onPress={() => void save()}><Text style={styles.text}>{pending ? "Saving..." : "Save"}</Text></Pressable>
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

function TimePart({ label, count, value, onChange, disabled }: { label: string; count: number; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { colors } = useNotebook();
  const data = Array.from({ length: count }, (_, index) => String(index).padStart(2, "0"));
  const selected = value === "" ? 0 : Math.min(count - 1, Math.max(0, Number(value)));
  const [initialOffset] = useState(() => ({ x: 0, y: Math.max(0, selected - 1) * 48 }));
  return <View style={{ flex: 1, gap: 8 }}>
    <Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16 }}>{label}</Text>
    <ScrollView nestedScrollEnabled contentOffset={initialOffset} style={{ height: 192, borderWidth: 1, borderColor: colors.rule, borderRadius: 4 }}>
      {data.map((item) => <Pressable key={item} accessibilityLabel={`${label} ${item}`} accessibilityState={{ selected: value === item, disabled }} disabled={disabled} onPress={() => onChange(item)} style={{ height: 48, alignItems: "center", justifyContent: "center", backgroundColor: value === item ? colors.subtle : colors.surface }}>
        <Text style={{ color: colors.ink, fontFamily: value === item ? notebookFonts.semibold : notebookFonts.body, fontSize: 18 }}>{item}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}
