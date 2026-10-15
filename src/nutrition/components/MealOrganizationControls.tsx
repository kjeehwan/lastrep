import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
      title: mode === labels.mode ? "Reset meal names?" : "Change meal labels?",
      message: "Custom names will be reset across dates. Food entries and meal times will not change.",
      buttons: [{ text: "Cancel", role: "cancel" }, { text: "Continue", onPress: () => onChange({ mode, names: {} }) }],
    });
  };
  return <View style={styles.card}>
    <Text style={styles.title}>Meal labels</Text>
    <Text style={styles.description}>Choose a starting layout. Rename individual meals in Nutrition. Save your Profile changes to apply this preference.</Text>
    <View style={styles.row}>{(["named", "numbered"] as const).map((mode) =>
      <Pressable key={mode} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: labels.mode === mode, disabled }}
        style={[styles.button, labels.mode === mode && styles.selected]} onPress={() => { if (mode !== labels.mode) change(mode); }}>
        <Text style={styles.text}>{mode === "named" ? "Named" : "Numbered"}</Text>
      </Pressable>)}</View>
    <Pressable disabled={disabled} style={styles.button} onPress={() => change(labels.mode)}><Text style={styles.text}>Reset meal names</Text></Pressable>
  </View>;
}

export function MealOrganizationEditor({ uid, section, sections, meals, dateKey, onClose, initialMode = "menu", onMoveUp, onMoveDown }: {
  uid: string | null; section: string; sections: string[]; meals: NutritionMeal[]; dateKey: string; onClose: () => void;
  initialMode?: "menu" | "time";
  onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  const { labels, ready, saveLabels } = useMealLabels(uid);
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
      if (mode === "name") await saveLabels({ ...labels, names: { ...labels.names, [section]: clean } });
      else await saveSectionMealTime(uid, meals, minutes!);
      onClose();
    } catch { setError("Could not save changes. Please try again."); }
    finally { setPending(false); }
  };
  return <Modal transparent animationType="fade" visible onRequestClose={close}>
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
          <Text style={styles.description}>{mode === "name" ? "This name applies across all dates." : `${mealLabel(section, labels)} · ${dateKey} · 24-hour time`}</Text>
          {mode === "name" ? <TextInput accessibilityLabel="Meal name" style={styles.input}
            value={name ?? mealLabel(section, labels)} onChangeText={setName} editable={!pending} maxLength={24} autoCapitalize="sentences"
            placeholder="e.g. Post-workout" placeholderTextColor="#a5acc1" /> : <View style={styles.row}>
            <View style={{ flex: 1 }}><Text style={styles.description}>Hour (0-23)</Text>
              <TextInput accessibilityLabel="Meal hour" style={styles.input} value={hours} onChangeText={setHours} maxLength={2}
                editable={!pending} keyboardType="number-pad" placeholder="e.g. 18" placeholderTextColor="#a5acc1" />
            </View>
            <View style={{ flex: 1 }}><Text style={styles.description}>Minute (0-59)</Text>
              <TextInput accessibilityLabel="Meal minute" style={styles.input} value={minutesText} onChangeText={setMinutesText} maxLength={2}
                editable={!pending} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor="#a5acc1" />
            </View>
          </View>}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable disabled={pending || !ready} style={[styles.button, styles.selected]} onPress={() => void save()}><Text style={styles.text}>{pending ? "Saving..." : "Save"}</Text></Pressable>
        </>}
        <Pressable disabled={pending} style={styles.button} onPress={close}><Text style={styles.text}>{mode === "menu" ? "Close" : "Cancel"}</Text></Pressable>
      </AdaptiveModalCard>
    </KeyboardAwareModalFrame>
  </Modal>;
}

const styles = StyleSheet.create({
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
