import React from "react";
import { Text, TextInput, TouchableOpacity, View, type TextStyle, type ViewStyle } from "react-native";

type SessionCardStyles = {
  card: ViewStyle;
  sectionTitle: TextStyle;
  input: TextStyle;
  sessionButtonRow: ViewStyle;
  secondaryButton: ViewStyle;
  primaryButton: ViewStyle;
  sessionActionButton: ViewStyle;
  secondaryText: TextStyle;
  primaryText: TextStyle;
  phaseRow: ViewStyle;
  muted: TextStyle;
  phaseLink: ViewStyle;
  phaseLinkText: TextStyle;
};

type WorkoutSessionCardProps = {
  styles: SessionCardStyles;
  title: string;
  dateLabel: string;
  elapsedLabel: string;
  timerRunning: boolean;
  timerStarted: boolean;
  trainingPhase: string;
  onTitleChange: (value: string) => void;
  onDatePress: () => void;
  onTimerPress: () => void;
  onChangePhase: () => void;
};

export function WorkoutSessionCard({
  styles,
  title,
  dateLabel,
  elapsedLabel,
  timerRunning,
  timerStarted,
  trainingPhase,
  onTitleChange,
  onDatePress,
  onTimerPress,
  onChangePhase,
}: WorkoutSessionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Session</Text>
      <TextInput
        placeholder="Session title (optional)"
        placeholderTextColor="#7a7a8c"
        value={title}
        onChangeText={onTitleChange}
        style={styles.input}
      />
      <View style={styles.sessionButtonRow}>
        <TouchableOpacity style={[styles.secondaryButton, styles.sessionActionButton]} onPress={onDatePress}>
          <Text style={styles.secondaryText}>Date: {dateLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[timerRunning ? styles.primaryButton : styles.secondaryButton, styles.sessionActionButton]}
          onPress={onTimerPress}
        >
          <Text style={timerRunning ? styles.primaryText : styles.secondaryText}>
            {timerRunning ? elapsedLabel : timerStarted ? "Resume Workout" : "Start Workout"}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.phaseRow}>
        <Text style={styles.muted}>Training phase: {trainingPhase}</Text>
        <TouchableOpacity onPress={onChangePhase} style={styles.phaseLink}>
          <Text style={styles.phaseLinkText}>Change</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
