import { NotebookGuidanceChip } from "../ui/notebook/NotebookGuidanceChip";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { Pressable, Text, View, ScrollView, useWindowDimensions } from "react-native";
import { useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import { createStyles } from "../workouts/workoutLog/workoutLogStyles";
import { exerciseTargetSummaries } from "../workouts/exerciseTargets";
import { sharingSetTable, sharingWorkoutTotals, type SharingPreviewUnits } from "./sharingSetTable";
import { showAppAlert } from "../ui/appDialog";
import type { SharedWorkoutPlan } from "./sharingContract";

function Instructions({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const long = text.length > 120 || text.split("\n").length > 2;
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <View style={{ gap: 4 }}>
      {long && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)}
        style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={styles.muted}>Instructions</Text>
        <Icon size={18} color={colors.muted} />
      </Pressable>}
      {(!long || expanded) && <Text style={[styles.muted, { lineHeight: 22 }]}>{text}</Text>}
    </View>
  );
}

export function SharingPlanPreview({ plan, showTitle = true, units }: { plan: SharedWorkoutPlan; showTitle?: boolean; units?: SharingPreviewUnits }) {
  const styles = useNotebookStyles(createStyles);
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  const totals = sharingWorkoutTotals(plan, units);
  return (
    <ScrollView nestedScrollEnabled style={{ maxHeight: 350 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}>
      {showTitle && <Text style={[styles.sessionTitle, { marginBottom: 16 }]}>{plan.title}</Text>}
      <View style={{ gap: 4, paddingBottom: 16 }}>
        <Text style={styles.modalText}>{totals.workingSets} working {totals.workingSets === 1 ? "set" : "sets"}</Text>
        {totals.missingWeights ? <Text style={styles.muted}>Weights not included</Text> : totals.volume != null && <Text style={styles.muted}>Planned volume {totals.volume.toLocaleString("en-US", { maximumFractionDigits: 2 })} {totals.weightUnit}</Text>}
      </View>
      {plan.exercises.map((exercise, index) => {
        const table = sharingSetTable(exercise, plan.effortScale, units);
        const cardio = exercise.mode === "cardio";
        const targets = exercise.mode === "cardio" ? [] : exerciseTargetSummaries(exercise, plan.effortScale);
        const rest = `${Math.floor(exercise.restSec / 60).toString().padStart(2, "0")}:${(exercise.restSec % 60).toString().padStart(2, "0")}`;
        return (
          <View key={`${index}:${exercise.name}`} style={{ paddingTop: index ? 20 : 8, paddingBottom: 20, gap: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.rule }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{String(index + 1).padStart(2, "0")}{"\u00a0\u00b7\u00a0"}{exercise.name}</Text>
            <View style={{ gap: 8 }}>
              {!!targets.length && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {targets.map(target => <NotebookGuidanceChip key={target} text={target.replace(/^(Normal|Top|Back-off) \u00b7 Target /, "$1 ").replace(/^Target /, "Target ")} />)}
              </View>}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <NotebookGuidanceChip text={`Rest ${rest}`} />
                {!!exercise.tempo && <NotebookGuidanceChip text={`Tempo ${exercise.tempo}`} />}
                {cardio && !!exercise.cardioSessionType && <NotebookGuidanceChip text={exercise.cardioSessionType} />}
                {cardio && !!exercise.cardioEffortLevel && <NotebookGuidanceChip text={exercise.cardioEffortLevel} />}
              </View>
            </View>
            {!!exercise.instructions && <Instructions text={exercise.instructions} />}
            <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flexGrow: 1, minWidth: (table.showEffort ? 340 : 260) * Math.max(1, fontScale) }}>
                <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="About set markers" accessibilityHint="Explains the set labels in this read-only preview."
                    onPress={() => showAppAlert("Set markers", "Numbers indicate Normal sets. W = Warm-up, T = Top, B = Back-off, D = Drop, F = Failure. Sets and units are read-only here.")}
                    style={{ flexGrow: 1, flexBasis: 0, width: 0, minWidth: 0, paddingHorizontal: 4, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                    <View style={{ borderBottomWidth: 1, borderStyle: "dotted", borderBottomColor: colors.muted }}>
                      <Text style={[styles.muted, { fontSize: 14, textAlign: "center" }]}>Set</Text>
                    </View>
                  </Pressable>
                  {[cardio ? "Duration" : table.unit, cardio ? `Distance (${table.unit})` : "Reps", ...(table.showEffort ? [`Target ${plan.effortScale.toUpperCase()}`] : [])].map(header => (
                    <View key={header} style={{ flexGrow: 1, flexBasis: 0, width: 0, minWidth: 0, paddingHorizontal: 4 }}><Text style={[styles.muted, { textAlign: "center", fontSize: 14 }]}>{header}</Text></View>
                  ))}
                </View>
                {table.rows.map((row, rowIndex) => (
                  <View key={rowIndex} accessible accessibilityLabel={`${row.label}, ${cardio ? `${row.duration} duration, ${row.distance} ${table.unit}` : `${row.load} ${table.unit}, ${row.reps} reps`}${table.showEffort ? `, target ${plan.effortScale.toUpperCase()} ${row.effort}` : ""}`}
                    style={{ flexDirection: "row", alignItems: "center", minHeight: 40, paddingVertical: 8 }}>
                    <View style={{ flexGrow: 1, flexBasis: 0, width: 0, minWidth: 0, paddingHorizontal: 4 }}><Text style={[styles.modalText, { marginBottom: 0, textAlign: "center", fontVariant: ["tabular-nums"] }]}>{row.marker}</Text></View>
                    {[cardio ? row.duration : row.load, cardio ? row.distance : row.reps, ...(table.showEffort ? [row.effort] : [])].map((value, column) => (
                      <View key={column} style={{ flexGrow: 1, flexBasis: 0, width: 0, minWidth: 0, paddingHorizontal: 4 }}><Text style={[styles.modalText, { marginBottom: 0, textAlign: "center", fontVariant: ["tabular-nums"] }]}>{value}</Text></View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}
