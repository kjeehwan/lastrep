import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotebook } from "../../ui/notebook/Notebook";
import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import { WorkoutModalShell } from "./WorkoutModalShell";
import type { ProgressionPreferences } from "../performanceProgression";

export function ProgressionSettingsSheet({ name, initial, unit, onClose, onSave }: {
  name: string; initial: ProgressionPreferences; unit: "kg" | "lbs";
  onClose: () => void; onSave: (value: ProgressionPreferences) => Promise<void>;
}) {
  const { colors } = useNotebook();
  const factor = unit === "lbs" ? 0.45359237 : 1;
  const [reps, setReps] = useState(initial.repSteps.join(", "));
  const [preferred, setPreferred] = useState(String(Math.round(initial.preferredIncreaseKg / factor * 100) / 100));
  const [maximum, setMaximum] = useState(String(Math.round(initial.maxIncreaseKg / factor * 100) / 100));
  const [busy, setBusy] = useState(false), [error,setError] = useState<string | null>(null);
  const input = { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: colors.ink };
  return <WorkoutModalShell compactLandscape androidBehavior="padding" visible onRequestClose={() => { if (!busy) onClose(); }} backdropStyle={{ flex:1,justifyContent:"flex-end",backgroundColor:colors.overlay }} cardStyle={{ backgroundColor:colors.surface,padding:20,borderTopLeftRadius:16,borderTopRightRadius:16 }}>
    <View style={{ flexDirection:"row",alignItems:"center",gap:12,marginBottom:20 }}><Text style={{ flex:1,color:colors.ink,fontSize:22,fontWeight:"600" }}>Progression settings</Text><Pressable onPress={onClose} disabled={busy} accessibilityLabel="Close"><Ionicons name="close" size={24} color={colors.ink} /></Pressable></View>
    <Text style={{ color:colors.muted,marginBottom:20 }}>{name}</Text>
    <View style={{ gap:20 }}>
      <View style={{ gap:8 }}><Text style={{ color:colors.ink }}>Rep sequence</Text><NotebookTextInput disableFullscreenUI accessibilityLabel="Rep sequence" value={reps} onChangeText={setReps} style={input} editable={!busy} placeholder="6, 8, 10, 12, 15, 18" /><Text style={{ color:colors.muted }}>Uses the next step within your target reps.</Text></View>
      <View style={{ gap:8 }}><Text style={{ color:colors.ink }}>Preferred weight increase ({unit})</Text><NotebookTextInput disableFullscreenUI accessibilityLabel="Preferred weight increase" keyboardType="decimal-pad" value={preferred} onChangeText={setPreferred} style={input} editable={!busy} /><Text style={{ color:colors.muted }}>A larger increase needs recent comparable performance at the target effort.</Text></View>
      <View style={{ gap:8 }}><Text style={{ color:colors.ink }}>Max weight increase ({unit})</Text><NotebookTextInput disableFullscreenUI accessibilityLabel="Max weight increase" keyboardType="decimal-pad" value={maximum} onChangeText={setMaximum} style={input} editable={!busy} /><Text style={{ color:colors.muted }}>A limit, not a goal. If no available increase fits, repeat.</Text></View>
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color:colors.danger,paddingVertical:12 }}>{error}</Text> : null}
    <Pressable disabled={busy} accessibilityRole="button" style={{ backgroundColor:colors.primary,minHeight:48,borderRadius:8,padding:12,alignItems:"center",justifyContent:"center",marginTop:20 }} onPress={() => {
      const repSteps = reps.split(/[,\s]+/).filter(Boolean).map(Number), preferredValue = Number(preferred.replace(",",".")), maxValue=Number(maximum.replace(",","."));
      if (!repSteps.length || repSteps.some(value => !Number.isInteger(value) || value < 1 || value > 100) || repSteps.length > 100) { setError("Enter whole rep steps from 1 to 100, separated by commas."); return; }
      if (!(preferredValue > 0 && maxValue > 0 && preferredValue <= maxValue && maxValue * factor <= 100)) { setError("Enter positive increases, with preferred no greater than maximum (up to 100 kg)."); return; }
      setBusy(true);setError(null);
      void onSave({ repSteps:[...new Set(repSteps)].sort((a,b)=>a-b),preferredIncreaseKg:preferredValue*factor,maxIncreaseKg:maxValue*factor }).then(onClose).catch(()=>setError("Couldn't save settings. Try again.")).finally(()=>setBusy(false));
    }}><Text style={{ color:colors.onPrimary,fontSize:16,fontWeight:"600" }}>{busy ? "Saving..." : "Save settings"}</Text></Pressable>
  </WorkoutModalShell>;
}
