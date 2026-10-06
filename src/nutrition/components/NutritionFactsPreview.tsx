import React from "react";
import { StyleSheet, Text, View } from "react-native";

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
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition for selected amount</Text>
        {reference ? <Text style={styles.reference}>{reference}</Text> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.fact}>
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 12,
  },
  header: { gap: 3 },
  title: { color: "#fff", fontSize: 13, fontWeight: "800" },
  reference: { color: "#9098ae", fontSize: 10, lineHeight: 14 },
  row: { flexDirection: "row", gap: 8 },
  fact: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
  value: { color: "#fff", fontSize: 14, fontWeight: "800" },
  label: { color: "#a5acc1", fontSize: 10, fontWeight: "600" },
});
