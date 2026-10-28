import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import React, { useRef, useState } from "react";
import { useNotebook, useNotebookStyles, notebookSheet } from "../../ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "../../ui/notebook/tokens";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ElapsedTimerText } from "./TimerText";
import { Play, Clock3, Pencil } from "lucide-react-native";
type WorkoutSessionCardProps = {
  title: string;
  dateLabel: string;
  elapsedSeconds: number;
  startedAtMs: number | null;
  timerRunning: boolean;
  timerStarted: boolean;
  trainingPhase: string;
  plannedSummary: string;
  onTitleChange: (value: string) => void;
  onDatePress: () => void;
  onTimerPress: () => void;
  onChangePhase: () => void;
};
export function WorkoutSessionCard({
  title,
  dateLabel,
  elapsedSeconds,
  startedAtMs,
  timerRunning,
  timerStarted,
  trainingPhase,
  plannedSummary,
  onTitleChange,
  onDatePress,
  onTimerPress,
  onChangePhase,
}: WorkoutSessionCardProps) {
  const { colors } = useNotebook();
  const titleRef = useRef<TextInput>(null);
  const [titleSelection, setTitleSelection] = useState<{ start: number; end: number }>();
  const styles = useNotebookStyles(createStyles);
  return <View style={styles.session}>
    <View style={styles.topRow}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change workout date" onPress={onDatePress} style={styles.dateButton}><Text style={styles.muted}>{dateLabel}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={timerRunning ? "Adjust workout timer" : timerStarted ? "Resume workout timer" : "Start workout timer"} onPress={onTimerPress} style={styles.timerButton}>
        {timerRunning ? <Clock3 size={16} strokeWidth={1.5} color={colors.accent} /> : <Play size={16} strokeWidth={1.5} color={colors.accent} />}
        <Text style={styles.timer}><ElapsedTimerText seconds={elapsedSeconds} startedAtMs={startedAtMs} /></Text>
      </TouchableOpacity>
    </View>
    <View style={styles.titleRow}>
      <View style={styles.titleField}>
        <Text accessible={false} importantForAccessibility="no" style={[styles.sessionTitle, styles.titleMeasure]}>{title || "Workout session"}</Text>
        <NotebookTextInput ref={titleRef} surface="canvas" disableFullscreenUI accessibilityLabel="Workout title" placeholder="Workout session" value={title} onChangeText={value => { setTitleSelection(undefined); onTitleChange(value); }} style={[styles.sessionTitle, styles.titleInput]} multiline selection={titleSelection} onTouchStart={() => setTitleSelection(undefined)} onBlur={() => setTitleSelection(undefined)} onSelectionChange={({ nativeEvent: { selection } }) => { if (titleSelection && selection.start === titleSelection.start && selection.end === titleSelection.end) setTitleSelection(undefined); }} />
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit workout title" style={styles.pencil} onPress={() => { titleRef.current?.focus(); setTitleSelection({ start: 0, end: title.length }); }}><Pencil size={18} strokeWidth={1.5} color={colors.muted} /></TouchableOpacity>
    </View>
    <View style={styles.sessionMeta}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change training phase in Profile" onPress={onChangePhase} style={styles.phase}><Text style={styles.muted}>{trainingPhase}</Text></TouchableOpacity>
      {plannedSummary ? <Text style={styles.muted} accessibilityLabel={`Planned: ${plannedSummary} weighted volume`}>{"\u00b7 "}{plannedSummary}</Text> : null}
    </View>
  </View>;
}
const createStyles = (colors: NotebookColors) => notebookSheet({
  session: { paddingTop: 8, marginBottom: 8, gap: 12 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dateButton: { minHeight: 44, justifyContent: "center", flexShrink: 1 },
  timerButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 12 },
  muted: { color: colors.muted, fontSize: 14 },
  timer: { color: colors.ink, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  sessionTitle: { color: colors.ink, fontSize: 26, lineHeight: 32, fontFamily: notebookFonts.editorial, fontWeight: "600", padding: 0, minHeight: 44, borderWidth: 0, borderRadius: 0 },
  titleField: { flexShrink: 1, minWidth: 40 },
  titleMeasure: { opacity: 0 },
  titleInput: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pencil: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  sessionMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8 },
  phase: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
