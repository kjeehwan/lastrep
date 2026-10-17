import React, { useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { notebookSheet, useNotebookStyles } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import { recentDailyPeriods } from "./notebookPresentation";

export function HomeDailyComparison({ points, nowMs, unit }: {
  points: { key: string; value: number }[]; nowMs: number; unit: "kcal" | "kJ" | "h";
}) {
  const styles = useNotebookStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const periods = useMemo(() => recentDailyPeriods(points, new Date(nowMs)), [points, nowMs]);
  const format = (value: number) => `${unit === "h" ? Math.round(value * 10) / 10 : Math.round(value).toLocaleString()} ${unit}`;
  return <View style={styles.wrap}>
    <Text style={styles.note}>Averages use days with recorded amounts; blank days are not counted as zero.</Text>
    <View style={[styles.periods, fontScale >= 1.5 && { flexDirection: "column" }]}>
      {periods.map((period) => <View key={period.label} style={styles.period}>
        <Text style={styles.heading}>{period.label}</Text>
        <Text style={styles.value}>{period.average == null ? "No values recorded" : `${format(period.average)} / day`}</Text>
        <Text style={styles.note}>{period.recordedDays} of 7 days with values</Text>
        {period.days.map((day) => <View key={day.key} style={styles.day}>
          <Text style={styles.note}>{day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>
          <Text style={styles.value}>{day.value == null ? "Not recorded" : format(day.value)}</Text>
        </View>)}
      </View>)}
    </View>
  </View>;
}
const createStyles = (colors: NotebookColors) => notebookSheet({
  wrap: { marginTop: 20, gap: 12 }, periods: { flexDirection: "row", gap: 18 },
  period: { flex: 1, minWidth: 0, gap: 8 }, heading: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  note: { color: colors.muted, fontSize: 14 }, value: { color: colors.ink, fontSize: 16 },
  day: { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 10, gap: 4 },
});
