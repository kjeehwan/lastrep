import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Heart, X } from "lucide-react-native";
import { WorkoutModalShell } from "./WorkoutModalShell";
import type { WorkoutExerciseCardsProps } from "./WorkoutExerciseCards";

type Props = Pick<WorkoutExerciseCardsProps, "styles" | "colors"> & { zone: string; exerciseName: string; onApply: (zone: string) => void };

export function CardioZoneControl({ zone, exerciseName, onApply, styles, colors }: Props) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(zone);
  const close = () => setVisible(false);
  return <>
    <TouchableOpacity style={[styles.restTimerInlineButton, { flex: 0, paddingHorizontal: 0 }]} accessibilityRole="button" accessibilityLabel={`${exerciseName}, heart-rate zone ${zone || "not set"}`} onPress={() => { setDraft(zone); setVisible(true); }}>
      <Heart size={16} strokeWidth={1.5} color={colors.muted} /><Text style={styles.restTimerInlineText}>Zone{zone ? ` ${zone}` : ""}</Text>
    </TouchableOpacity>
    <WorkoutModalShell visible={visible} onRequestClose={close} backdropStyle={styles.modalBackdrop} cardStyle={styles.modalCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}><Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Heart-rate zone</Text><TouchableOpacity style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close heart-rate zone" onPress={close}><X size={20} color={colors.muted} /></TouchableOpacity></View>
      <Text style={styles.modalText}>Choose a zone. Tap the selected zone again to clear it.</Text>
      <View style={[styles.answerRow, { marginTop: 16, marginBottom: 16 }]}>{["1", "2", "3", "4", "5"].map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Zone ${value}`} accessibilityState={{ selected: draft === value }} onPress={() => setDraft(previous => previous === value ? "" : value)} style={[styles.answerChip, { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, draft === value && styles.answerChipActive]}><Text style={[styles.answerText, draft === value && styles.answerTextActive]}>{value}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => { onApply(draft); close(); }}><Text style={styles.primaryText}>Done</Text></TouchableOpacity>
    </WorkoutModalShell>
  </>;
}
