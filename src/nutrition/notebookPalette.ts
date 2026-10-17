import { useNotebook } from "../ui/notebook/Notebook";
import { notebookDark, type NotebookColors } from "../ui/notebook/tokens";

export function nutritionPalette(colors: NotebookColors) {
  const dark = colors === notebookDark;
  return { ...colors, protein: dark ? "#A8BEA6" : "#4C6454", carbs: dark ? "#CDB78F" : "#86643C", fats: dark ? "#B2B7BE" : "#666A70", macroText: dark ? colors.canvas : colors.surface };
}
export function useNutritionColors() { return nutritionPalette(useNotebook().colors); }
