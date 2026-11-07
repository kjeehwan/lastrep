import { useNotebook, useNotebookStyles, notebookSheet } from "../../ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "../../ui/notebook/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import type { RecoveryInputs } from "../../services/decision/loadWorkoutPlanContext";
import { AccessibilityInfo, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NotebookModal as Modal } from "../../ui/notebook/NotebookModal";
import type { ExercisePlanAdjustment, LastResultPayload } from "../../types/decision";
import { exerciseAdjustmentText } from "../../services/decision/todayPlanPrescription";
import type { EffortScale } from "../effortScale";

type Props = {
  recoveryContent?:React.ReactNode;
  hideBanner?:boolean;
  onStartDeload?:()=>void;
  onEndDeload?:()=>void;
  hasDeloadBackup?:boolean;
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
  effortScale?: EffortScale;
  onOpen: () => void;
  onClose: () => void;
  onApply: (selected: string[]) => void;
  onUndo: () => void;
  onUpdate: () => void;
};

export function WorkoutTodayPlan(props: Props) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const resizeDisclosure = (update: () => void) => {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    update();
  };
  const [showWhy, setShowWhy] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const reviewKey=props.plan?.createdAt.toMillis()??null;
  const defaults=props.plan?.result.exerciseAdjustments?.filter(item=>item.action!=="avoid"&&(item.loadPct||item.setDelta||item.repsDelta)).map(item=>item.exerciseName)??[];
  const [selection,setSelection]=useState<{key:number|null;names:string[]}>({key:null,names:[]});
  const selected=selection.key===reviewKey?selection.names:defaults;
  const setSelected=(update:(previous:string[])=>string[])=>setSelection({key:reviewKey,names:update(selected)});

  const [showUnchanged, setShowUnchanged] = useState(false);
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
      {!props.hideBanner ? <View style={styles.banner}>
        <Pressable style={styles.bannerMain} onPress={props.onOpen} disabled={props.busy} accessibilityRole="button" accessibilityLabel={`Today's Plan. ${summary}. Review`}>
          <Ionicons name="document-text-outline" size={20} color={colors.accent} />
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>Today&apos;s Plan</Text>
          </View>
          <Text style={styles.link}>{props.busy ? "Reviewing..." : props.applied ? "View" : "Review"}</Text>
        </Pressable>
        {props.canUndo ? <Pressable onPress={props.onUndo} style={styles.undo} accessibilityRole="button"><Text style={styles.undoText}>Undo changes</Text></Pressable> : null}
      </View> : null}
      <Modal visible={props.visible||Boolean(props.recoveryContent)} transparent animationType="slide" onRequestClose={props.onClose}>
        {props.recoveryContent ? props.recoveryContent : <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} accessibilityLabel="Close today's plan" />
          <View style={styles.sheet}>
            <View style={styles.heading}>
              <Text style={styles.title}>Today&apos;s Plan</Text>
              <Pressable onPress={props.onClose} hitSlop={12} accessibilityLabel="Close"><Ionicons name="close" size={24} color={colors.ink} /></Pressable>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
              <Text style={styles.summary}>{summary}</Text>
              {props.error ? <Text style={styles.reason}>{props.error}</Text> : null}
              {fresh && props.plan?.inputs.plannedWorkout?.source === "none" ? <Text style={styles.reason}>{props.plan.result.headline}</Text> : null}
              {fresh && changes.map(item => <View key={item.exerciseName} style={[styles.exercise, { borderBottomWidth: 1, borderBottomColor: colors.rule, paddingVertical: 16 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {item.action !== "avoid" ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(item.exerciseName) }} accessibilityLabel={`Apply ${item.exerciseName}`} hitSlop={8} onPress={() => setSelected(previous => previous.includes(item.exerciseName) ? previous.filter(name => name !== item.exerciseName) : [...previous, item.exerciseName])}><Ionicons name={selected.includes(item.exerciseName) ? "checkbox" : "square-outline"} size={24} color={colors.ink} /></Pressable> : <Ionicons name="alert-circle-outline" size={24} color={colors.warning} />}
                  <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityRole="button" accessibilityState={{ expanded: expanded.includes(item.exerciseName) }} onPress={() => resizeDisclosure(() => setExpanded(previous => previous.includes(item.exerciseName) ? previous.filter(name => name !== item.exerciseName) : [...previous, item.exerciseName]))}>
                    <View style={{ flex: 1, gap: 8 }}><Text style={styles.exerciseName}>{item.exerciseName}</Text><Text style={[styles.prescription, item.action === "avoid" && styles.warning]}>{exerciseAdjustmentText(item, props.unitForExercise(item.exerciseName), props.plan?.inputs.plannedWorkout?.exercises?.find(exercise => exercise.name.trim().toLowerCase() === item.exerciseName.trim().toLowerCase()), props.effortScale, true)}</Text></View>
                    <Ionicons name={expanded.includes(item.exerciseName) ? "chevron-down" : "chevron-forward"} size={18} color={colors.muted} />
                  </Pressable>
                </View>
                {expanded.includes(item.exerciseName) ? <Text style={[styles.reason,{marginTop:12}]}>{item.reason}</Text> : null}
              </View>)}
              {fresh && (props.plan?.result.exerciseAdjustments?.length ?? 0) > changes.length ? <>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showUnchanged }} style={styles.expandRow} onPress={() => resizeDisclosure(() => setShowUnchanged(value => !value))}><Text style={styles.reason}>{showUnchanged ? "Hide" : "Show"} {(props.plan?.result.exerciseAdjustments?.length ?? 0) - changes.length} unchanged {(props.plan?.result.exerciseAdjustments?.length ?? 0) - changes.length === 1 ? "exercise" : "exercises"}</Text><Ionicons name={showUnchanged ? "chevron-down" : "chevron-forward"} size={18} color={colors.muted} /></Pressable>
                {showUnchanged ? props.plan?.result.exerciseAdjustments?.filter(item => !changes.includes(item)).map(item => <View key={item.exerciseName} style={styles.exercise}><Text style={styles.exerciseName}>{item.exerciseName}</Text><Text style={styles.reason}>{item.reason}</Text></View>) : null}
              </> : null}
              {fresh && caution ? <Text style={styles.warning}>{caution}</Text> : null}
              {fresh&&props.plan?.result.deloadSuggestion ? <View style={styles.group}><Text style={styles.reason}>{props.plan.result.deloadSuggestion}</Text><Pressable accessibilityRole="button" style={styles.expandRow} onPress={props.onStartDeload}><Text style={styles.link}>Plan a deload week</Text><Ionicons name="chevron-forward" size={18} color={colors.muted}/></Pressable></View>:null}
              {fresh&&(props.plan?.inputs.deload||props.hasDeloadBackup)?<View style={styles.group}>{props.plan?.inputs.deload?<Text style={styles.reason}>Deload through {props.plan.inputs.deload.endsDateKey}</Text>:null}<Pressable accessibilityRole="button" style={styles.expandRow} onPress={props.onEndDeload}><Text style={styles.link}>Return to normal plan</Text><Ionicons name="chevron-forward" size={18} color={colors.muted}/></Pressable></View>:null}
              {fresh ? (
                <Pressable onPress={() => resizeDisclosure(() => setShowWhy((previous) => !previous))} style={styles.expandRow} accessibilityRole="button" accessibilityState={{ expanded: showWhy }}>
                  <Text style={styles.disclosureTitle}>{showWhy ? "Hide explanation" : "Why these suggestions?"}</Text>
                  <Ionicons name={showWhy ? "chevron-down" : "chevron-forward"} size={18} color={colors.muted} />
                </Pressable>
              ) : null}
              {fresh && showWhy ? <View style={styles.group}>
                {groups.map(([reason, items]) => <Text key={reason} style={styles.reason}>{items.length > 1 ? reason.replace(/^This movement overlaps/i, "These movements overlap") : reason}</Text>)}
                {props.plan?.result.explanation.map((line, index) => <Text key={index} style={styles.reason}>{line}</Text>)}
              </View> : null}
              {!props.busy && props.plan ? (
                <>
                  <Pressable onPress={() => resizeDisclosure(() => setShowInputs((previous) => !previous))} style={styles.expandRow} accessibilityRole="button" accessibilityState={{ expanded: showInputs }}>
                    <Text style={styles.disclosureTitle}>Review context</Text>
                    <Ionicons name={showInputs ? "chevron-down" : "chevron-forward"} size={18} color={colors.muted} />
                  </Pressable>
                  {showInputs ? (
                    <View style={styles.contextGroup}>
                      <View style={styles.contextSection}>
                        <Pressable accessibilityRole="button" onPress={props.onEditContext} style={styles.expandRow}>
                          <Text style={[styles.contextAction, { flex: 1 }]}>Edit recovery check-in</Text>
                          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                        </Pressable>
                        <Text style={styles.contextValue}>Soreness {props.plan?.inputs.soreness}/10 · Fatigue {props.plan?.inputs.fatigue}/10 · Motivation {props.plan?.inputs.motivation}/10</Text>
                        <Text style={styles.contextValue}>{props.contextSummary === "Nothing reported" ? "No pain/discomfort or additional activity reported" : props.contextSummary}</Text>
                      </View>
                      <View style={styles.contextSection}>
                        <Text style={styles.contextLabel}>Recent performance</Text>
                        {props.plan?.inputs.recentTraining?.exercisePerformance.some(item => item.sessions > 0)
                          ? props.plan.inputs.recentTraining.exercisePerformance.filter(item => item.sessions > 0).map(item => (
                            <Text key={item.exerciseName} style={styles.contextValue}>{item.exerciseName}: {item.sessions} comparable {item.sessions === 1 ? "session" : "sessions"}</Text>
                          ))
                          : <Text style={styles.contextValue}>No comparable sessions recorded.</Text>}
                      </View>
                      <View style={styles.contextSection}>
                        <Text style={styles.contextLabel}>Training context</Text>
                        <Text style={styles.contextValue}>{props.plan?.inputs.trainingPhase}{props.plan?.inputs.trainingPhaseWeek ? ` · Week ${props.plan.inputs.trainingPhaseWeek}` : ""}</Text>
                        <Text style={styles.contextValue}>{props.plan?.inputs.dietPhase}{props.plan?.inputs.dietPhaseWeek ? ` · Week ${props.plan.inputs.dietPhaseWeek}` : ""}</Text>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
            {props.busy ? <View style={[styles.button, { opacity: 0.5 }]}><Text style={styles.buttonText}>Reviewing...</Text></View>
              : props.stale || props.error || !props.plan ? (
                <Pressable style={styles.button} onPress={props.onUpdate}><Text style={styles.buttonText}>{props.error ? "Try again" : "Update today's plan"}</Text></Pressable>
              ) : applicable.length && !props.applied ? (
                <Pressable style={[styles.button,!selected.length && {opacity:0.5}]} disabled={!selected.length} onPress={() => props.onApply(selected)}><Text style={styles.buttonText}>Apply changes</Text></Pressable>
              ) : <Pressable style={styles.button} onPress={props.onClose}><Text style={styles.buttonText}>Back to workout</Text></Pressable>}

          </View>
        </View>}
      </Modal>
    </>
  );
}

const createStyles = (colors: NotebookColors) => ({
  ...notebookSheet({
  banner: { borderBottomColor: colors.rule, borderBottomWidth: 1, marginBottom: 0 },
  bannerMain: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 48 },
  bannerCopy: { flex: 1, gap: 4 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  bannerTitle: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  undo: { paddingHorizontal: 16, paddingBottom: 14 },
  undoText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  link: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, maxHeight: "85%", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 20, fontWeight: "700" },
  body: { gap: 12, paddingBottom: 20 },
  summary: { color: colors.ink, fontSize: 17, fontWeight: "600" },
  disclosureTitle: { color: colors.ink, fontSize: 16, fontWeight: "500" },
  contextGroup: { gap: 20, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: colors.rule },
  contextSection: { gap: 6 },
  contextAction: { color: colors.ink, fontSize: 14, lineHeight: 21, fontWeight: "500" },
  contextLabel: { color: colors.ink, fontSize: 14, lineHeight: 21, fontWeight: "500" },
  reason: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  expandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  group: { gap: 10, borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 16 },
  exerciseGroup: { gap: 10 },
  exercise: { gap: 5, borderBottomWidth: 1, borderBottomColor: colors.rule, paddingBottom: 12 },
  exerciseName: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  prescription: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  warning: { color: colors.accent, fontSize: 13, lineHeight: 20 },
  button: { backgroundColor: colors.primary, borderRadius: 12, minHeight:48, padding: 15, flexShrink: 0, alignItems: "center", justifyContent:"center" },
  buttonText: { color: colors.onPrimary, fontWeight: "700", fontSize: 15, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
  }),
  // This approved compact detail size must bypass notebookSheet's minimums.
  ...StyleSheet.create({
    contextValue: { color: colors.muted, fontFamily: notebookFonts.body, fontSize: 12, lineHeight: 18, fontWeight: "400" },
  }),
});
