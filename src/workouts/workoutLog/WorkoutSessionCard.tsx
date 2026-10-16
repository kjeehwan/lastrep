import React from "react";
import { useNotebook, useNotebookStyles, notebookSheet } from "../../ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "../../ui/notebook/tokens";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ElapsedTimerText } from "./TimerText";
import { Play, Clock3 } from "lucide-react-native";

type WorkoutSessionCardProps = {
  title: string;
  dateLabel: string;
  elapsedSeconds: number;
  startedAtMs: number | null;
  timerRunning: boolean;
  timerStarted: boolean;
  trainingPhase: string;
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
  onTitleChange,
  onDatePress,
  onTimerPress,
  onChangePhase,
}: WorkoutSessionCardProps) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  return <View style={styles.session}>
    <View style={styles.topRow}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change workout date" onPress={onDatePress} style={styles.dateButton}><Text style={styles.muted}>{dateLabel}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={timerRunning ? "Adjust workout timer" : timerStarted ? "Resume workout timer" : "Start workout timer"} onPress={onTimerPress} style={styles.timerButton}>
        {timerRunning ? <Clock3 size={16} strokeWidth={1.5} color={colors.accent} /> : <Play size={16} strokeWidth={1.5} color={colors.accent} />}
        <Text style={styles.timer}><ElapsedTimerText seconds={elapsedSeconds} startedAtMs={startedAtMs} /></Text>
      </TouchableOpacity>
    </View>
    <TextInput disableFullscreenUI accessibilityLabel="Workout title" placeholder="Workout session" placeholderTextColor={colors.muted} value={title} onChangeText={onTitleChange} style={styles.sessionTitle} multiline />
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change training phase in Profile" onPress={onChangePhase} style={styles.phase}><Text style={styles.muted}>{trainingPhase}</Text></TouchableOpacity>
  </View>;
}
const createStyles = (colors: NotebookColors) => notebookSheet({
  session: { paddingTop: 8, marginBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dateButton: { minHeight: 44, justifyContent: "center", flexShrink: 1 },
  timerButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 12 },
  muted: { color: colors.muted, fontSize: 14 },
  timer: { color: colors.ink, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  sessionTitle: { color: colors.ink, fontSize: 26, lineHeight: 32, fontFamily: notebookFonts.editorial, fontWeight: "600", padding: 0, minHeight: 40 },
  phase: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
