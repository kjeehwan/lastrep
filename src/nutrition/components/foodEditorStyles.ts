import { useNotebookStyles } from "../../ui/notebook/Notebook";
import type { NotebookColors } from "../../ui/notebook/tokens";

const createStyles = (colors: NotebookColors) => ({
  backdrop: { flex: 1 as const, backgroundColor: colors.overlay, alignItems: "center" as const, justifyContent: "center" as const, padding: 20 },
  card: { width: "100%" as const, maxWidth: 560, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20 },
  content: { gap: 20 },
});

export function useFoodEditorStyles() {
  return useNotebookStyles(createStyles);
}
