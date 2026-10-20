import { useNotebook } from "../ui/notebook/Notebook";
import { notebookDark, type NotebookColors } from "../ui/notebook/tokens";

export function nutritionPalette(colors: NotebookColors) {
  const dark = colors === notebookDark;
  return { ...colors, protein: "#A8BEA6", carbs: "#CDB78F", fats: "#B2B7BE", macroText: dark ? colors.canvas : colors.ink };
}
export function useNutritionColors() { return nutritionPalette(useNotebook().colors); }
