import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import Slider from "@react-native-community/slider";
import type { RecoveryInputs } from "../../services/decision/loadWorkoutPlanContext";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ExercisePlanAdjustment, LastResultPayload } from "../../types/decision";
import { exerciseAdjustmentText } from "../../services/decision/todayPlanPrescription";

type Props = {
  plan: LastResultPayload | null;
  busy: boolean;
  error: string | null;
  recovery: RecoveryInputs;
  contextSummary: string;
  onRecoveryChange: (key: keyof RecoveryInputs, value: number) => void;
  onEditContext: () => void;
  visible: boolean;
  stale: boolean;
  applied: boolean;
  canUndo: boolean;
  unitForExercise: (name: string) => "kg" | "lbs";
  onOpen: () => void;
  onClose: () => void;
  onApply: () => void;
  onUndo: () => void;
  onUpdate: () => void;
};

export function WorkoutTodayPlan(props: Props) {
  const insets = useSafeAreaInsets();
  const [showWhy, setShowWhy] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  const changes = useMemo(() => props.plan?.result.exerciseAdjustments?.filter(
    (item) => item.action !== "as_planned" || item.loadPct !== 0 || item.setDelta !== 0 || item.repsDelta !== 0
  ) ?? [], [props.plan]);
  const applicable = changes.filter((item) => item.action !== "avoid" && (item.loadPct || item.setDelta || item.repsDelta));
  const groups = useMemo(() => {
    const grouped = new Map<string, ExercisePlanAdjustment[]>();
    changes.forEach((item) => grouped.set(item.reason, [...(grouped.get(item.reason) ?? []), item]));
    return [...grouped.entries()];
  }, [changes]);
  const summary = props.busy ? "Reviewing today's workout..."
    : props.error ? "Try reviewing today's plan again"
      : !props.plan ? "Review today's plan"
        : props.stale ? "Update today's plan"
          : props.applied ? "Changes applied to your workout"
            : props.plan.inputs.plannedWorkout?.source === "none" ? "Check training readiness"
              : changes.length ? `${changes.length} exercise${changes.length === 1 ? " needs" : "s need"} adjustment`
                : "Train as planned";
  const caution = props.plan?.inputs.dailyContext?.pain?.affectsPlannedWorkout ? props.plan.result.caution : null;
  const fresh = Boolean(props.plan && !props.stale && !props.busy && !props.error);
  return (
    <>
      <View style={styles.banner}>
        <Pressable style={styles.bannerMain} onPress={props.onOpen} disabled={props.busy} accessibilityRole="button">
          <Ionicons name="sparkles-outline" size={20} color="#fbbf24" />
          <View style={styles.bannerCopy}>
            <Text style={styles.caption}>Today&apos;s Plan</Text>
            <Text style={styles.bannerTitle}>{summary}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color="#9aa1c3" />
        </Pressable>
        {props.canUndo ? <Pressable onPress={props.onUndo} style={styles.undo} accessibilityRole="button"><Text style={styles.undoText}>Undo changes</Text></Pressable> : null}
      </View>
      <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} accessibilityLabel="Close today's plan" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.heading}>
              <Text style={styles.title}>Today&apos;s Plan</Text>
              <Pressable onPress={props.onClose} hitSlop={12} accessibilityLabel="Close"><Ionicons name="close" size={24} color="#fff" /></Pressable>
            </View>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
              <Text style={styles.summary}>{summary}</Text>
              {props.error ? <Text style={styles.reason}>{props.error}</Text> : null}
              {fresh && props.plan?.inputs.plannedWorkout?.source === "none" ? <Text style={styles.reason}>{props.plan.result.headline}</Text> : null}
              {fresh && groups.map(([reason, items]) => (
                <View key={reason} style={styles.group}>
                  {items.map((item, index) => (
                    <View key={`${item.exerciseName}-${index}`} style={styles.exercise}>
                      <Text style={styles.exerciseName}>{item.exerciseName}</Text>
                      <Text style={[styles.prescription, item.action === "avoid" && styles.warning]}>{exerciseAdjustmentText(item, props.unitForExercise(item.exerciseName), props.plan?.inputs.plannedWorkout?.exercises?.find((exercise) => exercise.name.trim().toLowerCase() === item.exerciseName.trim().toLowerCase()))}</Text>
                    </View>
                  ))}
                  {showWhy ? <Text style={styles.reason}>{items.length > 1 ? reason.replace(/^This movement overlaps/i, "These movements overlap") : reason}</Text> : null}
                </View>
              ))}
              {fresh && caution ? <Text style={styles.warning}>{caution}</Text> : null}
              {fresh ? (
                <Pressable onPress={() => setShowWhy((previous) => !previous)} style={styles.expandRow} accessibilityRole="button" accessibilityState={{ expanded: showWhy }}>
                  <Text style={styles.link}>{showWhy ? "Hide explanation" : "Why these suggestions?"}</Text>
                  <Ionicons name={showWhy ? "chevron-up" : "chevron-down"} size={16} color="#9aa1c3" />
                </Pressable>
              ) : null}
              {fresh && showWhy ? props.plan?.result.explanation.map((line, index) => <Text key={index} style={styles.reason}>{line}</Text>) : null}
              {!props.busy && props.plan ? (
                <>
                  <Pressable onPress={() => setShowInputs((previous) => !previous)} style={styles.expandRow} accessibilityRole="button" accessibilityState={{ expanded: showInputs }}>
                    <Text style={styles.link}>{showInputs ? "Hide today's inputs" : "Edit today's inputs"}</Text>
                    <Ionicons name={showInputs ? "chevron-up" : "chevron-down"} size={16} color="#9aa1c3" />
                  </Pressable>
                  {showInputs ? (
                    <View style={styles.group}>
                      {(["soreness", "fatigue", "motivation"] as const).map((key) => (
                        <View key={key}>
                          <Text style={styles.reason}>{key[0].toUpperCase() + key.slice(1)}: {props.recovery[key]}/10</Text>
                          <Slider value={props.recovery[key]} minimumValue={0} maximumValue={10} step={1}
                            minimumTrackTintColor="#7b61ff" maximumTrackTintColor="rgba(255,255,255,0.22)" thumbTintColor="#cdd0e0"
                            onValueChange={(value) => props.onRecoveryChange(key, value)} />
                        </View>
                      ))}
                      <Pressable onPress={props.onEditContext} style={styles.expandRow}>
                        <View style={styles.bannerCopy}><Text style={styles.link}>Pain, activity or notes</Text><Text style={styles.caption}>{props.contextSummary}</Text></View>
                        <Ionicons name="chevron-forward" size={18} color="#9aa1c3" />
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
            {props.busy ? <View style={[styles.button, { opacity: 0.5 }]}><Text style={styles.buttonText}>Reviewing...</Text></View>
              : props.stale || props.error || !props.plan ? (
                <Pressable style={styles.button} onPress={props.onUpdate}><Text style={styles.buttonText}>{props.error ? "Try again" : "Update today's plan"}</Text></Pressable>
              ) : applicable.length && !props.applied ? (
                <Pressable style={styles.button} onPress={props.onApply}><Text style={styles.buttonText}>Apply changes</Text></Pressable>
              ) : <Pressable style={styles.button} onPress={props.onClose}><Text style={styles.buttonText}>Back to workout</Text></Pressable>}

          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#171c31", borderColor: "#303650", borderWidth: 1, borderRadius: 16, marginBottom: 14 },
  bannerMain: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  bannerCopy: { flex: 1, gap: 4 },
  caption: { color: "#9aa1c3", fontSize: 12, lineHeight: 18 },
  bannerTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  undo: { paddingHorizontal: 16, paddingBottom: 14 },
  undoText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  link: { color: "#c9c0ff", fontSize: 13, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#14182b", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", paddingHorizontal: 20, paddingTop: 20 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  body: { gap: 12, paddingBottom: 20 },
  summary: { color: "#fff", fontSize: 17, fontWeight: "600" },
  reason: { color: "#c4c9df", fontSize: 14, lineHeight: 21 },
  expandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  group: { gap: 10, borderTopWidth: 1, borderTopColor: "#303650", paddingTop: 16 },
  exercise: { gap: 5 },
  exerciseName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  prescription: { color: "#fff", fontSize: 13, lineHeight: 20 },
  warning: { color: "#fbbf24", fontSize: 13, lineHeight: 20 },
  button: { backgroundColor: "#7b61ff", borderRadius: 12, padding: 15, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
