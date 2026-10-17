import { notebookSheet, useNotebookStyles } from "../../ui/notebook/Notebook";
import { type NotebookColors } from "../../ui/notebook/tokens";
import React from "react";
import { Text, View, useWindowDimensions } from "react-native";

type Props = {
  calories: number | null;
  proteinGrams: number | null;
  carbGrams: number | null;
  fatGrams: number | null;
  reference?: string | null;
};

function formatMacro(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 10) / 10}g`;
}

export function NutritionFactsPreview({
  calories,
  proteinGrams,
  carbGrams,
  fatGrams,
  reference,
}: Props) {
  const styles = useNotebookStyles(createStyles);
  const large = useWindowDimensions().fontScale >= 1.5;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition for selected amount</Text>
        {reference ? <Text style={styles.reference}>{reference}</Text> : null}
      </View>
      <View style={[styles.row, large && { flexWrap: "wrap" }]}>
        <View style={[styles.fact, large && { minWidth: 100 }]}>
          <Text style={styles.value}>
            {typeof calories === "number" && Number.isFinite(calories) ? Math.round(calories) : "-"}
          </Text>
          <Text style={styles.label}>kcal</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.value}>{formatMacro(proteinGrams)}</Text>
          <Text style={styles.label}>Protein</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.value}>{formatMacro(carbGrams)}</Text>
          <Text style={styles.label}>Carbs</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.value}>{formatMacro(fatGrams)}</Text>
          <Text style={styles.label}>Fat</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: NotebookColors) => notebookSheet({
  card: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.subtle,
    padding: 12,
    gap: 12,
  },
  header: { gap: 3 },
  title: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  reference: { color: colors.muted, fontSize: 14, lineHeight: 14 },
  row: { flexDirection: "row", gap: 8 },
  fact: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
  value: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  label: { color: colors.muted, fontSize: 10, fontWeight: "600" },
});
