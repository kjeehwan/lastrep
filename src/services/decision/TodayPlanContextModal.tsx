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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
            key={option.value}
            style={[styles.choiceChip, selected && styles.choiceChipSelected]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function TodayPlanContextModal({ visible, context, plan, saving, onClose, onSave }: Props) {
  const { fontsLoaded } = useNotebook();
  const Surface = fontsLoaded ? NotebookModal : Modal;
  const notebookStyles = useNotebookStyles(createNotebookStyles);
  const styles = fontsLoaded ? notebookStyles : legacyStyles;
  const insets = useSafeAreaInsets();
  const [painEnabled, setPainEnabled] = useState(Boolean(context?.pain));
  const [painArea, setPainArea] = useState<PainArea | null>(context?.pain?.area ?? null);
  const [painSide, setPainSide] = useState<PainSide | null>(context?.pain?.side === "not_applicable" ? null : context?.pain?.side ?? null);
  const [painSeverity, setPainSeverity] = useState<PainSeverity | null>(context?.pain?.severity ?? null);
  const [painTrigger, setPainTrigger] = useState<PainTrigger | null>(context?.pain?.trigger ?? null);
  const [painNote, setPainNote] = useState(context?.pain?.note ?? "");
  const [activityEnabled, setActivityEnabled] = useState(Boolean(context?.additionalActivity));
  const [activityType, setActivityType] = useState<ActivityType | null>(context?.additionalActivity?.type ?? null);
  const [activityTiming, setActivityTiming] = useState<ActivityTiming | null>(context?.additionalActivity?.timing ?? null);
  const [activityEffort, setActivityEffort] = useState<ActivityEffort | null>(context?.additionalActivity?.effort ?? null);
  const [activityDuration, setActivityDuration] = useState<ActivityDuration | null>(context?.additionalActivity?.duration ?? null);
  const [note, setNote] = useState(context?.note ?? "");

  const [validationError, setValidationError] = useState<string | null>(null);
  const selectedArea = PAIN_AREAS.find((item) => item.value === painArea);

  const handleSave = () => {
    if (painEnabled && (!painArea || !painSeverity || !painTrigger || selectedArea?.sided && !painSide)) {
      setValidationError("Choose the pain area, side (if shown), severity and movement trigger, or remove Pain or discomfort."); return;
    }
    if (activityEnabled && (!activityType || !activityTiming || !activityEffort || !activityDuration)) {
      setValidationError("Choose the activity, timing, effort and duration, or remove Additional activity."); return;
    }
    setValidationError(null);
    const pain = painEnabled && painArea && painSeverity && painTrigger
      ? {
          area: painArea,
          side: selectedArea?.sided ? painSide ?? "not_applicable" : "not_applicable" as const,
          severity: painSeverity,
          trigger: painTrigger,
          note: painNote.trim().slice(0, 240) || null,
          affectsPlannedWorkout: painAffectsWorkout(
            { area: painArea, severity: painSeverity, trigger: painTrigger },
            plan
          ),
        }
      : null;
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
      additionalActivity,
      note: note.trim().slice(0, 300) || null,
    });
  };

  return (
    <Surface visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.dismissArea} />
        </TouchableWithoutFeedback>
        <AdaptiveModalCard contentSized style={[styles.sheet, { paddingBottom: 20 + Math.max(insets.bottom, 8) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Today&apos;s context</Text>
          <Text style={styles.intro}>Add only what may affect today&apos;s training. Everything here is optional.</Text>
          <View style={styles.content}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Pain or discomfort</Text>
                <Text style={styles.sectionHint}>{painEnabled ? "Included in today's plan" : "Nothing reported"}</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, painEnabled && styles.toggleActive]}
                onPress={() => setPainEnabled((value) => !value)}
              >
                <Text style={[styles.toggleText, painEnabled && styles.toggleTextActive]}>{painEnabled ? "Remove" : "Add"}</Text>
              </TouchableOpacity>
            </View>
            {painEnabled ? (
              <View style={styles.fields}>
                <Text style={styles.label}>Area</Text>
                <ChoiceRow options={PAIN_AREAS} value={painArea} onChange={setPainArea} />
                {selectedArea?.sided ? (
                  <>
                    <Text style={styles.label}>Side</Text>
                    <ChoiceRow options={PAIN_SIDES} value={painSide} onChange={setPainSide} />
                  </>
                ) : null}
                <Text style={styles.label}>Severity</Text>
                <ChoiceRow options={PAIN_SEVERITIES} value={painSeverity} onChange={setPainSeverity} />
                <Text style={styles.label}>When it bothers you</Text>
                <ChoiceRow options={PAIN_TRIGGERS} value={painTrigger} onChange={setPainTrigger} />
                <NotebookTextInput
                  style={styles.input}
                  value={painNote}
                  onChangeText={setPainNote}
                  placeholder="Optional detail about the movement or sensation"
                  placeholderTextColor="#737991"
                  maxLength={240}
                  multiline
                />
              </View>
            ) : null}

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
          </View>
          {validationError ? <Text accessibilityRole="alert" style={styles.sectionHint}>{validationError}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? "Saving..." : "Save context"}</Text>
            </TouchableOpacity>
          </View>
        </AdaptiveModalCard>
      </KeyboardAvoidingView>
    </Surface>
  );
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
  toggle: { borderRadius: 999, borderWidth: 1, borderColor: "#454860", paddingHorizontal: 13, paddingVertical: 7 },
  toggleActive: { borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)" },
  toggleText: { color: "#cfd3e8", fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: "#fbbf24" },
  fields: { gap: 8, paddingTop: 8 },
  label: { color: "#9ca3ba", fontSize: 12, fontWeight: "700", marginTop: 4 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choiceChip: { borderRadius: 999, borderWidth: 1, borderColor: "#3c3f57", backgroundColor: "#202033", paddingHorizontal: 11, paddingVertical: 8 },
  choiceChipSelected: { borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.16)" },
  choiceText: { color: "#bdc1d5", fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: "#fde68a" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#383b52", backgroundColor: "#11111e", color: "#fff", paddingHorizontal: 12, paddingVertical: 11, textAlignVertical: "top" },
  noteInput: { minHeight: 72, marginTop: 10 },
  divider: { height: 1, backgroundColor: "#2b2d41", marginVertical: 12 },
  actions: { flexDirection: "row", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#2b2d41" },
  secondaryButton: { flex: 1, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#454860", paddingVertical: 13 },
  primaryButton: { flex: 1.4, alignItems: "center", borderRadius: 12, backgroundColor: "#f59e0b", paddingVertical: 13 },
  secondaryText: { color: "#d7daea", fontWeight: "800" },
  primaryText: { color: "#17120a", fontWeight: "900" },
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
 toggleTextActive: { ...legacyStyles.toggleTextActive, color: colors.accent },
 fields: { ...legacyStyles.fields,  },
 label: { ...legacyStyles.label, color: colors.muted },
 choiceRow: { ...legacyStyles.choiceRow,  },
 choiceChip: { ...legacyStyles.choiceChip, backgroundColor: colors.surface, borderColor: colors.border, minHeight: 44 },
 choiceChipSelected: { ...legacyStyles.choiceChipSelected, backgroundColor: colors.accentSoft, borderColor: colors.accent },
 choiceText: { ...legacyStyles.choiceText, color: colors.ink },
 choiceTextSelected: { ...legacyStyles.choiceTextSelected, color: colors.accent },
 input: { ...legacyStyles.input, backgroundColor: colors.surface, color: colors.ink, borderColor: colors.border, borderRadius: 4 },
 noteInput: { ...legacyStyles.noteInput,  },
 divider: { ...legacyStyles.divider, backgroundColor: colors.rule },
 actions: { ...legacyStyles.actions,  },
 secondaryButton: { ...legacyStyles.secondaryButton, backgroundColor: colors.surface, borderColor: colors.border, minHeight: 44 },
 primaryButton: { ...legacyStyles.primaryButton, backgroundColor: colors.primary, borderRadius: 8, minHeight: 48 },
 secondaryText: { ...legacyStyles.secondaryText, color: colors.ink },
 primaryText: { ...legacyStyles.primaryText, color: colors.onPrimary },
 disabled: { ...legacyStyles.disabled,  },
});
