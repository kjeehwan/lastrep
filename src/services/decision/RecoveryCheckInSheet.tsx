import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useNotebook } from "../../ui/notebook/Notebook";
import type { PlannedWorkoutSummary } from "../../types/decision";
import { TodayPlanContextModal } from "./TodayPlanContextModal";
import { emptyRecoveryRatings, loadRecoveryCheckIn, saveRecoveryCheckIn, type DailyRecoveryCheckIn } from "./recoveryCheckIn";

const noPlan: PlannedWorkoutSummary = { source: "none", title: null, exerciseNames: [] };

/** Home and Workout edit the same dated record. Nothing is written on Cancel. */
export function RecoveryCheckInSheet({ uid, plan = noPlan, onClose, onSaved, requiredForReview = false, embedded = false }: {
  embedded?: boolean;
  requiredForReview?: boolean;
  uid: string; plan?: PlannedWorkoutSummary; onClose: () => void;
  onSaved: (value: DailyRecoveryCheckIn) => void | Promise<void>;
}) {
  const { colors } = useNotebook();
  const [initial, setInitial] = useState<DailyRecoveryCheckIn | null>(null);
  const [ratings, setRatings] = useState(emptyRecoveryRatings);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadRecoveryCheckIn(uid).then(value => {
      if (!alive) return;
      setInitial(value); setRatings(value?.ratings ?? emptyRecoveryRatings()); setLoaded(true);
    }).catch(() => { if (alive) setError("Couldn't load your check-in. Try again."); });
    return () => { alive = false; };
  }, [uid, attempt]);
  return <TodayPlanContextModal embedded={embedded} loading={!loaded} visible context={initial?.context ?? null} plan={plan} saving={saving}
    title="Recovery check-in" saveLabel="Save check-in" saveError={error} onClose={onClose}
    intro={requiredForReview ? "Record today's soreness, fatigue and motivation before reviewing your workout. Add any pain or activity that may affect it." : undefined}
    onSave={context => {
      if (saving) return;
      if (requiredForReview && Object.values(ratings).some(value => value == null)) { setError("Record soreness, fatigue and motivation to review today's workout."); return; }
      const value: DailyRecoveryCheckIn = { dateKey: context.dateKey, ratings, context, painAnswered: true };
      setSaving(true); setError(null);
      void saveRecoveryCheckIn(uid, value).then(() => onSaved(value)).catch(() => {
        setError("Couldn't save your check-in. Your changes are still here. Try again.");
      }).finally(() => setSaving(false));
    }}>
    {!loaded ? error ? <TouchableOpacity accessibilityRole="button" onPress={()=>{setError(null);setAttempt(value=>value+1);}}><Text style={{color:colors.accent,paddingVertical:16}}>Try again</Text></TouchableOpacity> : <ActivityIndicator color={colors.ink}/> : (["soreness", "fatigue", "motivation"] as const).map(key => <View key={key} style={{ paddingVertical: 12, gap: 8 }}>
      <Text style={{ color: requiredForReview && error && ratings[key] == null ? colors.danger : colors.ink, fontSize: 16 }}>{key[0].toUpperCase() + key.slice(1)}{requiredForReview && ratings[key] == null ? " (required)" : ""} · {ratings[key] == null ? "Not recorded" : `${ratings[key]}/10`}</Text>
      <Slider accessibilityLabel={key} minimumValue={0} maximumValue={10} step={1} value={ratings[key] ?? 5} disabled={saving}
        minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.rule} thumbTintColor={colors.ink}
        onValueChange={value => setRatings(previous => ({ ...previous, [key]: value }))} />
    </View>)}
  </TodayPlanContextModal>;
}
