import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { parseManualFood, type ManualFood } from "../manualFood";
import { useNutritionColors } from "../notebookPalette";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { KeyboardAwareModalFrame } from "../../ui/KeyboardAwareModalFrame";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import { notebookFonts } from "../../ui/notebook/tokens";
import { useFoodEditorStyles } from "./foodEditorStyles";

export function ManualFoodEditor({ onClose, onSave }: { onClose: () => void; onSave: (food: ManualFood) => Promise<void> }) {
  const colors = useNutritionColors();
  const styles = useFoodEditorStyles();
  const [name, setName] = useState("");
  const [values, setValues] = useState(["", "", "", ""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const close = () => { if (!pending) onClose(); };
  const text = { fontFamily: notebookFonts.body, fontSize: 16, color: colors.ink };
  const input = { ...text, minHeight: 56, borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 12, backgroundColor: colors.surface };
  const save = async () => {
    if (pending) return;
    const food = parseManualFood(name, values);
    if (!food) { setError("Enter a name and a non-negative number for every nutrition field."); return; }
    setPending(true); setError("");
    try { await onSave(food); onClose(); }
    catch { setError("Could not save food. Your entries are still here. Check your connection and try again."); }
    finally { setPending(false); }
  };
  return <NotebookModal visible transparent animationType="fade" onRequestClose={close}>
    <KeyboardAwareModalFrame style={styles.backdrop} onDismiss={close}>
      <AdaptiveModalCard contentSized style={styles.card} contentContainerStyle={{ gap: 20 }}>
        <Text style={{ ...text, fontFamily: notebookFonts.editorial, fontSize: 22 }}>Manual food entry</Text>
        <View style={{ gap: 8 }}><Text style={text}>Food name</Text><NotebookTextInput accessibilityLabel="Manual food name" disableFullscreenUI editable={!pending} style={input} value={name} onChangeText={setName} maxLength={80} placeholder="e.g. Homemade rice bowl" placeholderTextColor={colors.muted} /></View>
        <Text style={{ ...text, color: colors.muted }}>Enter nutrition for the whole amount you are adding. No weight is inferred.</Text>
        {["Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)"].map((label, index) => <View key={label} style={{ gap: 8 }}>
          <Text style={text}>{label}</Text><NotebookTextInput accessibilityLabel={label} disableFullscreenUI selectTextOnFocus editable={!pending} keyboardType="decimal-pad" style={input} value={values[index]} onChangeText={(value) => setValues((current) => current.map((entry, i) => i === index ? value : entry))} placeholder={index === 0 ? "e.g. 420" : "e.g. 20"} placeholderTextColor={colors.muted} />
        </View>)}
        {error ? <Text accessibilityLiveRegion="polite" style={{ ...text, color: colors.danger }}>{error}</Text> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 12 }}>
          <Pressable disabled={pending} onPress={close} style={{ minHeight: 48, padding: 12, justifyContent: "center" }}><Text style={text}>Cancel</Text></Pressable>
          <Pressable disabled={pending} onPress={() => void save()} style={{ minHeight: 48, padding: 12, borderRadius: 4, backgroundColor: colors.primary, justifyContent: "center" }}><Text style={{ ...text, color: colors.onPrimary }}>{pending ? "Saving..." : "Add food"}</Text></Pressable>
        </View>
      </AdaptiveModalCard>
    </KeyboardAwareModalFrame>
  </NotebookModal>;
}
