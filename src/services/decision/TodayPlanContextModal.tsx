import { Ionicons } from "@expo/vector-icons";
import { painEntries, primaryPain } from "./painContext";
import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import { useNotebook, useNotebookStyles, notebookSheet } from "../../ui/notebook/Notebook";
import type { NotebookColors } from "../../ui/notebook/tokens";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import type {
  ActivityDuration,
  ActivityEffort,
  ActivityTiming,
  ActivityType,
  DailyDecisionContext,
  PainArea,
  PainSeverity,
  PainSide,
  PainTrigger,
  PlannedWorkoutSummary,
} from "../../types/decision";
import {
  ACTIVITY_DURATIONS,
  ACTIVITY_EFFORTS,
  ACTIVITY_TIMINGS,
  ACTIVITY_TYPES,
  PAIN_AREAS,
  PAIN_SEVERITIES,
  PAIN_SIDES,
  PAIN_TRIGGERS,
  activityOverlapsWorkout,
  painAffectsWorkout,
  toLocalDateKey,
} from "./todayPlanContext";

type Props = {
  embedded?: boolean;
  title?: string;
  saveLabel?: string;
  children?: React.ReactNode;
  saveError?: string | null;
  loading?: boolean;
  intro?: string;
  visible: boolean;
  context: DailyDecisionContext | null;
  plan: PlannedWorkoutSummary;
  saving: boolean;
  onClose: () => void;
  onSave: (context: DailyDecisionContext) => void;
};

type Option<T extends string> = { value: T; label: string };

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { fontsLoaded } = useNotebook();
  const notebookStyles = useNotebookStyles(createNotebookStyles);
  const styles = fontsLoaded ? notebookStyles : legacyStyles;
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            accessibilityRole="button" accessibilityState={{selected}}
            key={option.value}
            style={[styles.choiceChip, selected && styles.choiceChipSelected]}
            onPress={() => onChange(option.value)}
          >
            <Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type PainDraft={area:PainArea|null;side:PainSide|null;severity:PainSeverity|null;trigger:PainTrigger|null;note:string};

/** Keep the native host mounted while loading data or replacing its form. */
export function TodayPlanContextModal(props:Props) {
  const {fontsLoaded}=useNotebook();
  const Surface=fontsLoaded?NotebookModal:Modal;
  const notebookStyles=useNotebookStyles(createNotebookStyles);
  const styles=fontsLoaded?notebookStyles:legacyStyles;
  const frame=<KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS==="ios"?"padding":"height"}>
    <TouchableWithoutFeedback onPress={()=>{if(!props.saving)props.onClose();}}><View style={styles.dismissArea}/></TouchableWithoutFeedback>
    <AdaptiveModalCard style={[styles.sheet,{height:"85%",paddingBottom:20}]}>
      <ContextForm key={props.loading?"loading":"ready"} {...props}/>
    </AdaptiveModalCard>
  </KeyboardAvoidingView>;
  return props.embedded?frame:<Surface visible={props.visible} transparent animationType="fade" onRequestClose={()=>{if(!props.saving)props.onClose();}}>{frame}</Surface>;
}

function ContextForm({ context, plan, saving, onClose, onSave, title, saveLabel, children, saveError, loading, intro }: Props) {
  const { colors, fontsLoaded } = useNotebook();
  const notebookStyles = useNotebookStyles(createNotebookStyles);
  const styles = fontsLoaded ? notebookStyles : legacyStyles;
  const [pains,setPains]=useState<PainDraft[]>(()=>painEntries(context).map(pain=>({...pain,side:pain.side==="not_applicable"?null:pain.side,note:pain.note??""})));
  const [painEditor,setPainEditor]=useState<{index:number;draft:PainDraft&{area:PainArea}}|null>(null);
  const openPain=(area:PainArea,index=pains.findIndex(pain=>pain.area===area))=>setPainEditor({index,draft:index>=0?{...pains[index],area}:{area,side:null,severity:null,trigger:null,note:""}});
  const [activityEnabled, setActivityEnabled] = useState(Boolean(context?.additionalActivity));
  const [activityType, setActivityType] = useState<ActivityType | null>(context?.additionalActivity?.type ?? null);
  const [activityTiming, setActivityTiming] = useState<ActivityTiming | null>(context?.additionalActivity?.timing ?? null);
  const [activityEffort, setActivityEffort] = useState<ActivityEffort | null>(context?.additionalActivity?.effort ?? null);
  const [activityDuration, setActivityDuration] = useState<ActivityDuration | null>(context?.additionalActivity?.duration ?? null);
  const [note, setNote] = useState(context?.note ?? "");

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = () => {
    if (pains.some(pain=>!pain.area||!pain.severity||!pain.trigger||PAIN_AREAS.find(item=>item.value===pain.area)?.sided&&!pain.side)) {
      setValidationError("Choose the pain area, side (if shown), severity and movement trigger, or remove Pain or discomfort."); return;
    }
    if (activityEnabled && (!activityType || !activityTiming || !activityEffort || !activityDuration)) {
      setValidationError("Choose the activity, timing, effort and duration, or remove Additional activity."); return;
    }
    setValidationError(null);
    const reported = pains.map(pain => ({
      area:pain.area!, side:PAIN_AREAS.find(item=>item.value===pain.area)?.sided?pain.side!:"not_applicable" as const,
      severity:pain.severity!,trigger:pain.trigger!,note:pain.note.trim().slice(0,240)||null,
      affectsPlannedWorkout:painAffectsWorkout({area:pain.area!,severity:pain.severity!,trigger:pain.trigger!},plan),
    }));
    const pain=primaryPain(reported);
    const additionalActivity = activityEnabled && activityType && activityTiming && activityEffort && activityDuration
      ? {
          type: activityType,
          timing: activityTiming,
          effort: activityEffort,
          duration: activityDuration,
          overlapsPlannedWorkout: activityOverlapsWorkout(
            { type: activityType, effort: activityEffort },
            plan
          ),
        }
      : null;
    onSave({
      dateKey: toLocalDateKey(new Date()),
      pain,
      pains:reported,
      additionalActivity,
      note: note.trim().slice(0, 300) || null,
    });
  };

  return (
    <>
          <View style={styles.handle} />
          <Text style={styles.title}>{title ?? "Today's context"}</Text>
          <Text style={styles.intro}>{intro ?? "Add only what may affect today's training. Everything here is optional."}</Text>
          <View style={styles.content}>
            {children}
            {!loading ? <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Pain or discomfort</Text>
                <Text style={styles.sectionHint}>{pains.length ? `${pains.length} area${pains.length===1?"":"s"} reported` : "Nothing reported"}</Text>
              </View>
            </View>
            <View style={styles.choiceRow}>
              {PAIN_AREAS.map(area=>{
                const reports=pains.filter(pain=>pain.area===area.value),selected=reports.length>0;
                return <TouchableOpacity key={area.value} accessibilityRole="button" accessibilityLabel={`${selected?"Edit":"Report"} ${area.label} discomfort`} accessibilityState={{selected}} disabled={saving}
                  onPress={()=>openPain(area.value)} style={[styles.choiceChip,selected&&styles.choiceChipSelected]}>
                  <Text numberOfLines={1} style={[styles.choiceText,selected&&styles.choiceTextSelected]}>{area.label}{selected?" ✓":""}{reports.length>1?` · ${reports.length}`:""}</Text>
                </TouchableOpacity>;
              })}
            </View>

            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Additional activity</Text>
                <Text style={styles.sectionHint}>{activityEnabled ? "Included in today's plan" : "Nothing reported"}</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, activityEnabled && styles.toggleActive]}
                onPress={() => setActivityEnabled((value) => !value)}
              >
                <Text style={[styles.toggleText, activityEnabled && styles.toggleTextActive]}>{activityEnabled ? "Remove" : "Add"}</Text>
              </TouchableOpacity>
            </View>
            {activityEnabled ? (
              <View style={styles.fields}>
                <Text style={styles.label}>Activity</Text>
                <ChoiceRow options={ACTIVITY_TYPES} value={activityType} onChange={setActivityType} />
                <Text style={styles.label}>When</Text>
                <ChoiceRow options={ACTIVITY_TIMINGS} value={activityTiming} onChange={setActivityTiming} />
                <Text style={styles.label}>Effort</Text>
                <ChoiceRow options={ACTIVITY_EFFORTS} value={activityEffort} onChange={setActivityEffort} />
                <Text style={styles.label}>Duration</Text>
                <ChoiceRow options={ACTIVITY_DURATIONS} value={activityDuration} onChange={setActivityDuration} />
              </View>
            ) : null}

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Anything else?</Text>
            <NotebookTextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Poor sleep quality, getting sick, long flight, stressful day..."
              placeholderTextColor="#737991"
              maxLength={300}
              multiline
            />
            </> : null}
          </View>
          {validationError ? <Text accessibilityRole="alert" style={[styles.sectionHint,{color:colors.danger,paddingVertical:12}]}>{validationError}</Text> : null}
          {saveError ? <Text accessibilityRole="alert" style={[styles.sectionHint,{color:colors.danger,paddingVertical:12}]}>{saveError}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, (saving || loading) && styles.disabled]} onPress={handleSave} disabled={saving || loading}>
              <Text style={styles.primaryText}>{saving ? "Saving..." : saveLabel ?? "Save context"}</Text>
            </TouchableOpacity>
          </View>
          {painEditor?<PainAreaEditor key={`${painEditor.draft.area}:${painEditor.index}`} initial={painEditor.draft}
            reports={pains.flatMap((pain,index)=>pain.area===painEditor.draft.area?[{index,pain}]:[])} selectedIndex={painEditor.index}
            onChoose={index=>openPain(painEditor.draft.area,index)} onClose={()=>setPainEditor(null)}
            onDone={draft=>{setPains(previous=>painEditor.index<0?[...previous,draft]:previous.map((pain,index)=>index===painEditor.index?draft:pain));setPainEditor(null);setValidationError(null);}}
            onRemove={painEditor.index>=0?()=>{setPains(previous=>previous.filter((_,index)=>index!==painEditor.index));setPainEditor(null);}:undefined}/>:null}

    </>
  );
}

function PainAreaEditor({initial,reports,selectedIndex,onChoose,onClose,onDone,onRemove}:{
  initial:PainDraft&{area:PainArea};reports:{index:number;pain:PainDraft}[];selectedIndex:number;onChoose:(index:number)=>void;
  onClose:()=>void;onDone:(draft:PainDraft&{area:PainArea})=>void;onRemove?:()=>void;
}) {
  const {colors}=useNotebook();
  const styles=useNotebookStyles(createNotebookStyles);
  const [draft,setDraft]=useState(initial),[error,setError]=useState<string|null>(null);
  const area=PAIN_AREAS.find(item=>item.value===draft.area)!;
  return <NotebookModal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView pointerEvents="box-none" style={[styles.overlay,{justifyContent:"center",paddingHorizontal:20}]} behavior={Platform.OS==="ios"?"padding":"height"}>
      <TouchableWithoutFeedback onPress={onClose}><View style={StyleSheet.absoluteFill}/></TouchableWithoutFeedback>
      <AdaptiveModalCard contentSized style={[styles.sheet,{padding:20,borderRadius:16}]}>
        <View style={[styles.sectionHeader,{paddingTop:0,paddingBottom:16}]}><Text style={styles.title}>{area.label}</Text><TouchableOpacity accessibilityLabel="Close pain details" hitSlop={12} onPress={onClose}><Ionicons name="close" size={24} color={colors.ink}/></TouchableOpacity></View>
        <View style={styles.fields}>
          {reports.length>1?<><Text style={styles.label}>Reported areas</Text><ChoiceRow options={reports.map(({index,pain})=>({value:String(index),label:`${PAIN_SIDES.find(item=>item.value===pain.side)?.label??"Report"} · ${PAIN_SEVERITIES.find(item=>item.value===pain.severity)?.label??index+1}`}))} value={String(selectedIndex)} onChange={value=>onChoose(Number(value))}/></>:null}
          {area.sided?<><Text style={styles.label}>Side</Text><ChoiceRow options={PAIN_SIDES} value={draft.side} onChange={side=>setDraft({...draft,side})}/></>:null}
          <Text style={styles.label}>Severity</Text><ChoiceRow options={PAIN_SEVERITIES} value={draft.severity} onChange={severity=>setDraft({...draft,severity})}/>
          <Text style={styles.label}>When it bothers you</Text><ChoiceRow options={PAIN_TRIGGERS} value={draft.trigger} onChange={trigger=>setDraft({...draft,trigger})}/>
        </View>
        <View style={{paddingTop:16}}>
          <NotebookTextInput disableFullscreenUI accessibilityLabel={`${area.label} discomfort details`} style={styles.input} value={draft.note} onChangeText={note=>setDraft({...draft,note})} placeholder="Optional detail" maxLength={240} multiline/>
        </View>
        {error?<Text accessibilityRole="alert" style={[styles.sectionHint,{paddingVertical:8}]}>{error}</Text>:null}
        {onRemove?<TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${area.label.toLowerCase()} discomfort`} onPress={onRemove} style={{minHeight:44,alignSelf:"flex-start",flexDirection:"row",gap:8,alignItems:"center",paddingHorizontal:4,marginTop:16}}><Ionicons name="trash-outline" size={18} color={colors.danger}/><Text style={[styles.toggleText,{color:colors.danger}]}>Remove</Text></TouchableOpacity>:null}
        <View style={{height:1,backgroundColor:colors.rule,marginVertical:16}}/>
        <View style={[styles.actions,{borderTopWidth:0,paddingTop:0}]}>
          <TouchableOpacity style={[styles.secondaryButton,{flex:1,minHeight:48,borderRadius:8}]} onPress={onClose}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton,{flex:1,minHeight:48,borderRadius:8,borderWidth:1,borderColor:colors.primary}]} onPress={()=>{if(!draft.severity||!draft.trigger||area.sided&&!draft.side){setError("Choose side (if shown), severity and when it bothers you.");return;}onDone(draft);}}><Text style={styles.primaryText}>Done</Text></TouchableOpacity>
        </View>
      </AdaptiveModalCard>
    </KeyboardAvoidingView>
  </NotebookModal>;
}

const legacyStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "flex-end" },
  dismissArea: { flex: 1 },
  sheet: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: "#171727",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#313249",
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: { width: 42, height: 4, borderRadius: 999, backgroundColor: "#565a73", alignSelf: "center", marginBottom: 14 },
  title: { color: "#fff", fontSize: 21, fontWeight: "800" },
  intro: { color: "#aeb2c8", fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 12 },
  content: { paddingBottom: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: "#f4f5ff", fontSize: 15, fontWeight: "800" },
  sectionHint: { color: "#858ba5", fontSize: 12, marginTop: 2 },
  toggle: { alignItems:"center", justifyContent:"center", borderRadius: 999, borderWidth: 1, borderColor: "#454860", paddingHorizontal: 13, paddingVertical: 7 },
  toggleActive: { borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)" },
  toggleText: { textAlign:"center",textAlignVertical:"center",includeFontPadding:false,color: "#cfd3e8", fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: "#fbbf24" },
  fields: { gap: 8, paddingTop: 8 },
  label: { color: "#9ca3ba", fontSize: 12, fontWeight: "700", marginTop: 4 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choiceChip: { alignItems:"center", justifyContent:"center", borderRadius: 999, borderWidth: 1, borderColor: "#3c3f57", backgroundColor: "#202033", paddingHorizontal: 11, paddingVertical: 8 },
  choiceChipSelected: { borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.16)" },
  choiceText: { textAlign:"center",textAlignVertical:"center",includeFontPadding:false,color: "#bdc1d5", fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: "#fde68a" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#383b52", backgroundColor: "#11111e", color: "#fff", paddingHorizontal: 12, paddingVertical: 11, textAlignVertical: "top" },
  noteInput: { minHeight: 72, marginTop: 10 },
  divider: { height: 1, backgroundColor: "#2b2d41", marginVertical: 12 },
  actions: { flexDirection: "row", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#2b2d41" },
  secondaryButton: { flex: 1, alignItems: "center", justifyContent:"center", borderRadius: 12, borderWidth: 1, borderColor: "#454860", paddingVertical: 13 },
  primaryButton: { flex: 1.4, alignItems: "center", justifyContent:"center", borderRadius: 12, backgroundColor: "#f59e0b", paddingVertical: 13 },
  secondaryText: { textAlign:"center",textAlignVertical:"center",includeFontPadding:false,color: "#d7daea", fontWeight: "800" },
  primaryText: { textAlign:"center",textAlignVertical:"center",includeFontPadding:false,color: "#17120a", fontWeight: "900" },
  disabled: { opacity: 0.55 },
});

const createNotebookStyles = (colors: NotebookColors) => notebookSheet({
 ...legacyStyles,
 overlay: { ...legacyStyles.overlay, backgroundColor: colors.overlay },
 dismissArea: { ...legacyStyles.dismissArea,  },
 sheet: { ...legacyStyles.sheet, backgroundColor: colors.surface, borderColor: colors.rule, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
 handle: { ...legacyStyles.handle, backgroundColor: colors.rule },
 title: { ...legacyStyles.title, color: colors.ink },
 intro: { ...legacyStyles.intro, color: colors.muted },
 content: { ...legacyStyles.content,  },
 sectionHeader: { ...legacyStyles.sectionHeader,  },
 sectionCopy: { ...legacyStyles.sectionCopy,  },
 sectionTitle: { ...legacyStyles.sectionTitle, color: colors.ink },
 sectionHint: { ...legacyStyles.sectionHint, color: colors.muted },
 toggle: { ...legacyStyles.toggle, backgroundColor: colors.surface, borderColor: colors.border, minHeight: 44 },
 toggleActive: { ...legacyStyles.toggleActive, backgroundColor: colors.accentSoft, borderColor: colors.accent },
 toggleText: { ...legacyStyles.toggleText, color: colors.ink },
 toggleTextActive: { ...legacyStyles.toggleTextActive, color: colors.accent, fontSize: 14, fontWeight: "700" },
 fields: { ...legacyStyles.fields,  },
 label: { ...legacyStyles.label, color: colors.muted },
 choiceRow: { ...legacyStyles.choiceRow,  },
 choiceChip: { ...legacyStyles.choiceChip, backgroundColor: colors.surface, borderColor: colors.border, minHeight: 44 },
 choiceChipSelected: { ...legacyStyles.choiceChipSelected, backgroundColor: colors.accentSoft, borderColor: colors.accent },
 choiceText: { ...legacyStyles.choiceText, color: colors.ink },
 choiceTextSelected: { ...legacyStyles.choiceTextSelected, color: colors.accent, fontSize: 14, fontWeight: "600" },
 input: { ...legacyStyles.input, backgroundColor: colors.surface, color: colors.ink, borderColor: colors.border, borderRadius: 4 },
 noteInput: { ...legacyStyles.noteInput,  },
 divider: { ...legacyStyles.divider, backgroundColor: colors.rule },
 actions: { ...legacyStyles.actions, borderTopColor: colors.rule },
 secondaryButton: { ...legacyStyles.secondaryButton, backgroundColor: colors.surface, borderColor: colors.border, minHeight: 44 },
 primaryButton: { ...legacyStyles.primaryButton, backgroundColor: colors.primary, borderRadius: 8, minHeight: 48 },
 secondaryText: { ...legacyStyles.secondaryText, color: colors.ink },
 primaryText: { ...legacyStyles.primaryText, color: colors.onPrimary },
 disabled: { ...legacyStyles.disabled,  },
});
