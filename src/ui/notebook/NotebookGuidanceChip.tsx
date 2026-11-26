import { Text, View } from "react-native";
import { useNotebook } from "./Notebook";
import { notebookFonts } from "./tokens";

/** Quiet, read-only guidance. Wrap in an existing action when editing is offered. */
export function NotebookGuidanceChip({ text }: { text: string }) {
  const { colors } = useNotebook();
  return <View style={{ backgroundColor: colors.subtle, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, maxWidth: "100%" }}>
    <Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 14, lineHeight: 20 }}>{text}</Text>
  </View>;
}
