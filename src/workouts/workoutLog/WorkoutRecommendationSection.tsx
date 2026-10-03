import React from "react";
import { ScrollView, Text, TouchableOpacity, View, type TextStyle, type ViewStyle } from "react-native";

type RecommendationSectionStyles = {
  card: ViewStyle;
  sectionTitle: TextStyle;
  muted: TextStyle;
  focusChipRow: ViewStyle;
  answerChip: ViewStyle;
  answerChipActive: ViewStyle;
  answerText: TextStyle;
  answerTextActive: TextStyle;
  primaryButton: ViewStyle;
  primaryText: TextStyle;
  recommendationCard: ViewStyle;
  recommendationLine: TextStyle;
};

type RecommendationFocus<TId extends string> = { id: TId; label: string };

type WorkoutRecommendationSectionProps<TId extends string> = {
  styles: RecommendationSectionStyles;
  focuses: readonly RecommendationFocus<TId>[];
  selectedFocus: TId;
  recommending: boolean;
  summary: string[];
  onSelectFocus: (id: TId) => void;
  onOpenLengthPicker: () => void;
};

export function WorkoutRecommendationSection<TId extends string>({
  styles,
  focuses,
  selectedFocus,
  recommending,
  summary,
  onSelectFocus,
  onOpenLengthPicker,
}: WorkoutRecommendationSectionProps<TId>) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recommendation</Text>
        <Text style={styles.muted}>Choose a focus, or let Lastrep choose from your context and recent history.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusChipRow}>
          {focuses.map((focus) => (
            <TouchableOpacity
              key={focus.id}
              style={[styles.answerChip, selectedFocus === focus.id && styles.answerChipActive]}
              onPress={() => onSelectFocus(focus.id)}
            >
              <Text style={[styles.answerText, selectedFocus === focus.id && styles.answerTextActive]}>{focus.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 10, opacity: recommending ? 0.7 : 1 }]}
          onPress={onOpenLengthPicker}
          disabled={recommending}
        >
          <Text style={styles.primaryText}>{recommending ? "Building recommendation..." : "Recommend workout"}</Text>
        </TouchableOpacity>
      </View>
      {summary.length > 0 ? (
        <View style={styles.recommendationCard}>
          <Text style={styles.sectionTitle}>Why this workout?</Text>
          {summary.map((line, index) => (
            <Text key={`rec-line-${index}`} style={styles.recommendationLine}>- {line}</Text>
          ))}
        </View>
      ) : null}
    </>
  );
}
