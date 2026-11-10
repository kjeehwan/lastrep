import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { type NotebookColors } from "../../ui/notebook/tokens";

/** Matches ItemTouchHelper's growing reveal, 10/6 insets and centered trash icon. */
export function AndroidSetDeleteAction({ translation, width, colors, onDelete }: { translation: SharedValue<number>; width: number; colors: NotebookColors; onDelete: () => void }) {
  const reveal = useAnimatedStyle(() => ({ width: Math.max(0, -translation.value - 20) }));
  return <View style={{ width }}><Animated.View style={[{ position: "absolute", right: 10, top: 6, bottom: 6, borderRadius: 10, backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.danger, overflow: "hidden" }, reveal]}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete set" onPress={onDelete} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Trash2 size={20} strokeWidth={1.5} color={colors.canvas} /></TouchableOpacity></Animated.View></View>;
}
