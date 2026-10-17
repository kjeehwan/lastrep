import React, { useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { getWorkoutVolumeKg, type WorkoutSummary } from "../workouts/homeInsights";
import { notebookSheet, useNotebookStyles } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import { recentWorkoutPeriods } from "./notebookPresentation";

export function HomeWorkoutComparison({ workouts, nowMs, weightUnit, showVolume }: {
  workouts: WorkoutSummary[]; nowMs: number; weightUnit: "kg" | "lbs"; showVolume: boolean;
}) {
  const styles = useNotebookStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const periods = useMemo(() => recentWorkoutPeriods(workouts, new Date(nowMs)), [workouts, nowMs]);
  return <View style={[styles.periods, fontScale >= 1.5 && { flexDirection: "column" }]}>
    {periods.map((period) => <View key={period.label} style={styles.period}>
      <Text style={styles.heading}>{period.label}</Text>
      <Text style={styles.count}>{period.workouts.length} session{period.workouts.length === 1 ? "" : "s"}</Text>
      {period.workouts.length === 0 ? <Text style={styles.meta}>No workouts logged</Text> : period.workouts.map((workout) => <View key={workout.id} style={styles.session}>
        <Text style={styles.title}>{workout.title || "Workout"}</Text>
        <Text style={styles.meta}>{workout.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>
        {showVolume ? <Text style={styles.meta}>{Math.round(getWorkoutVolumeKg(workout) * (weightUnit === "lbs" ? 2.20462 : 1)).toLocaleString()} {weightUnit} volume</Text> : null}
      </View>)}
    </View>)}
  </View>;
}

const createStyles = (colors: NotebookColors) => notebookSheet({
  periods: { flexDirection: "row", gap: 18, marginTop: 20, marginBottom: 16 },
  period: { flex: 1, minWidth: 0, gap: 8 },
  heading: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  count: { color: colors.muted, fontSize: 14 },
  session: { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 10, gap: 4 },
  title: { color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 14 },
});
