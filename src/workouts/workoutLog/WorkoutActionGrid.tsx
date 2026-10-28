import React from "react";
import { Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { BookOpen, FilePlus2, RotateCcw, Sparkles, Share2, Trash2 } from "lucide-react-native";
import { useNotebook, useNotebookStyles, notebookSheet } from "../../ui/notebook/Notebook";
import type { NotebookColors } from "../../ui/notebook/tokens";

type Props = {
  hasWorkout: boolean;
  onRoutines: () => void;
  onCreate: () => void;
  onRepeat: () => void;
  onRecommend: () => void;
  onShare: () => void;
  onDiscard: () => void;
};

export function WorkoutActionGrid({ hasWorkout, onRoutines, onCreate, onRepeat, onRecommend, onShare, onDiscard }: Props) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const columns = fontScale >= 1.5 ? 2 : 3;
  const actions = [
    { label: "My routines", name: "My routines", Icon: BookOpen, onPress: onRoutines },
    { label: "Create routine", name: "Create routine", Icon: FilePlus2, onPress: onCreate },
    { label: "Repeat workout", name: "Repeat workout", Icon: RotateCcw, onPress: onRepeat },
    { label: "Recommend", name: "Recommend workout", Icon: Sparkles, onPress: onRecommend },
    ...(hasWorkout ? [
      { label: "Share", name: "Share workout", Icon: Share2, onPress: onShare },
      { label: "Discard", name: "Discard workout", Icon: Trash2, onPress: onDiscard },
    ] : []),
  ];
  return <View style={styles.grid}>
    {Array.from({ length: Math.ceil(actions.length / columns) }, (_, index) => <View key={index} style={styles.row}>
      {Array.from({ length: columns }, (_, column) => {
        const action = actions[index * columns + column];
        if (!action) return <View key={column} style={styles.spacer} />;
        const destructive = action.name === "Discard workout";
        return <TouchableOpacity key={action.name} style={styles.action} accessibilityRole="button" accessibilityLabel={action.name} onPress={action.onPress}>
          <action.Icon accessible={false} size={24} strokeWidth={1.5} color={destructive ? colors.danger : colors.muted} />
          <Text style={[styles.label, destructive && { color: colors.danger }]}>{action.label}</Text>
        </TouchableOpacity>;
      })}
    </View>)}
  </View>;
}
const createStyles = (colors: NotebookColors) => notebookSheet({
  grid: { gap: 24, paddingVertical: 16 },
  row: { flexDirection: "row", alignItems: "stretch", gap: 12 },
  spacer: { flex: 1 },
  action: { flex: 1, minWidth: 0, minHeight: 52, alignItems: "center", justifyContent: "flex-start", gap: 8, paddingHorizontal: 4 },
  label: { color: colors.ink, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
