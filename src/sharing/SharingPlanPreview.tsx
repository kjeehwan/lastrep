import { Text, View, ScrollView } from "react-native";
import { useNotebookStyles } from "../ui/notebook/Notebook";
import { createStyles } from "../workouts/workoutLog/workoutLogStyles";
import { exerciseTargetsText } from "../workouts/exerciseTargets";
import { sharingPrescriptionRows } from "./sharingPresentation";
import type { SharedWorkoutPlan } from "./sharingContract";
export function SharingPlanPreview({ plan, showTitle = true }: { plan: SharedWorkoutPlan; showTitle?: boolean }) {
  const styles = useNotebookStyles(createStyles);
  return (
    <ScrollView style={{ maxHeight: 350 }}>
      {showTitle && <Text style={[styles.sessionTitle, { marginBottom: 16 }]}>{plan.title}</Text>}
      {plan.exercises.map((e, i) => {

        return (
          <View key={`${i}:${e.name}`} style={[styles.card, { borderTopWidth: 0, paddingHorizontal: 12, borderRadius: 12 }]}>
            <Text style={styles.sectionTitle}>
              {String(i + 1).padStart(2, "0")} · {e.name}
            </Text>
            {e.mode !== "cardio" && exerciseTargetsText(e.targets, plan.effortScale) ? <Text style={styles.muted}>Target: {exerciseTargetsText(e.targets, plan.effortScale)}</Text> : null}
            <Text style={styles.muted}>
              Rest {e.restSec}s{e.tempo ? ` · Tempo ${e.tempo}` : ""}
            </Text>
            {e.mode === "cardio" &&
              (e.cardioSessionType || e.cardioEffortLevel) && (
                <Text style={styles.muted}>
                  {[e.cardioSessionType, e.cardioEffortLevel]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
            {!!e.instructions && (
              <Text style={styles.modalText}>{e.instructions}</Text>
            )}
            {sharingPrescriptionRows(e,plan.effortScale).map((text,index)=><Text key={index} style={styles.modalText}>{text}</Text>)}
          </View>
        );
      })}
    </ScrollView>
  );
}
