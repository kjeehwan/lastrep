import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import React, { useState } from "react";
import { Keyboard, Pressable, Text, View, useWindowDimensions } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { collection, doc } from "firebase/firestore";
import { db } from "../../config/firebaseConfig";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import { mutateSleepJournal } from "../sleepJournal";
import { commitManualSleep, emptySleepEntry, parseSleepDate, shiftSleepDate, sleepDateKey, sleepDurationText, sleepEntrySignature, sleepTimeMinutes, timedSleepEntry, validateSleepHours, SleepOverlapError, type SleepEntry } from "../sleepSessionModel";
import { SleepSheet, SleepButton } from "./SleepSheet";
import { SleepCalendar } from "./SleepCalendar";
import { SleepDial } from "./SleepDial";

export const sleepDisplayDate = (key: string) => parseSleepDate(key).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const timeText = (ms: number) => { const date = new Date(ms); return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; };
export function SleepEntryEditor({ uid, selected, entry: initialEntry, onClose, onSaved }: { uid: string; selected: string; entry: SleepEntry | null; onClose: () => void; onSaved: (date: string) => void }) {
  const [entry] = useState(initialEntry);
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  const { isOffline } = useOfflineStatus();
  const [mode, setMode] = useState<"times" | "duration">(entry && entry.startMs == null ? "duration" : "times");
  const [bedtime, setBedtime] = useState(entry?.startMs != null ? timeText(entry.startMs) : "");
  const [wakeTime, setWakeTime] = useState(entry?.endMs != null ? timeText(entry.endMs) : "");
  const [bedDate, setBedDate] = useState(entry?.startMs != null ? sleepDateKey(new Date(entry.startMs)) : shiftSleepDate(selected, -1));
  const [wakeDate, setWakeDate] = useState(entry?.endMs != null ? sleepDateKey(new Date(entry.endMs)) : selected);
  const [datesExplicit, setDatesExplicit] = useState(!!entry);
  const [duration, setDuration] = useState(entry ? String(entry.hours) : "");
  const [dateField, setDateField] = useState<"bed" | "wake" | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<SleepEntry[] | null>(null);
  const [candidateId] = useState(() => doc(collection(db, "_ids")).id);
  const text = { color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16 };
  const close = () => { if (saving) return; if (dateField) setDateField(null); else if (conflicts) setConflicts(null); else onClose(); };
  const changeTime = (field: "bedtime" | "wakeTime", value: string) => {
    if (field === "bedtime") setBedtime(value); else setWakeTime(value);
    if (!datesExplicit) {
      const start = sleepTimeMinutes(field === "bedtime" ? value : bedtime), end = sleepTimeMinutes(field === "wakeTime" ? value : wakeTime);
      setBedDate(shiftSleepDate(wakeDate, start != null && end != null && start < end ? 0 : -1));
    }
    setError("");
  };
  let preview: string, previewHours: number | null = null;
  try { previewHours = mode === "times" ? timedSleepEntry(bedDate, bedtime, wakeDate, wakeTime).hours : validateSleepHours(duration); preview = sleepDurationText(previewHours); }
  catch { preview = mode === "times" ? "Set bedtime and wake time to calculate duration." : "Use decimal hours, for example 7.5 for 7 h 30 min."; }
  const save = async (replace: SleepEntry[] = []) => {
    if (saving) return;
    if (isOffline) { setError("You're offline. Your entry is kept; reconnect before saving."); return; }
    let candidate: SleepEntry;
    try {
      const now = new Date();
      const interval = mode === "times" ? timedSleepEntry(bedDate, bedtime, wakeDate, wakeTime, now) : null;
      const date = interval?.dateKey ?? selected;
      if (date > sleepDateKey(now)) throw Error("Sleep date cannot be in the future.");
      candidate = { ...emptySleepEntry(candidateId, date, interval?.hours ?? validateSleepHours(duration), now), ...(interval ?? {}), kind: interval ? "session" : "duration" };
    } catch (err) { setError((err as Error).message); return; }
    setSaving(true); setError("");
    try {
      await mutateSleepJournal(uid, (entries) => {
        if (entry && entries.some((current) => current.id === entry.id && sleepEntrySignature(current) !== sleepEntrySignature(entry))) throw Error("This entry changed on another device. Close it and reopen before editing.");
        if (replace.some((old) => { const current = entries.find((row) => row.id === old.id); return !current || sleepEntrySignature(current) !== sleepEntrySignature(old); })) throw Error("An entry changed since your review. Go back and save again to review the latest data.");
        return commitManualSleep(entries, candidate, entry?.id ?? null, replace.map((row) => row.id));
      });
      Keyboard.dismiss(); onSaved(candidate.dateKey);
    } catch (err) {
      if (err instanceof SleepOverlapError) setConflicts(err.conflicts);
      else setError((err as Error).message || "Could not save. Your entry is kept. Try again.");
    } finally { setSaving(false); }
  };
  const footer = dateField ? <SleepButton label="Back to entry" onPress={() => setDateField(null)} /> : conflicts ? <><SleepButton label={saving ? "Saving..." : "Replace listed entries"} primary disabled={saving} onPress={() => void save(conflicts)} /><SleepButton label="Back to edit" disabled={saving} onPress={() => setConflicts(null)} /></> : <><SleepButton label={saving ? "Saving..." : "Save session"} primary disabled={saving} onPress={() => void save()} /><SleepButton label="Cancel" disabled={saving} onPress={onClose} /></>;
  return <SleepSheet title={dateField ? `${dateField === "bed" ? "Bedtime" : "Wake"} date` : conflicts ? "Review overlapping sleep" : entry ? "Edit sleep session" : "Record sleep"} onClose={close} footer={footer}>
    {dateField ? <SleepCalendar selected={dateField === "bed" ? bedDate : wakeDate} onSelect={(date) => { if (dateField === "bed") setBedDate(date); else setWakeDate(date); setDatesExplicit(true); setDateField(null); setError(""); }} /> : conflicts ? <>
      <Text style={text}>These entries may describe the same sleep. Replacing excludes only the entries listed below from Lastrep totals. The original health-service records are unchanged.</Text>
      {conflicts.map((row) => <View key={row.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.rule, paddingVertical: 12, gap: 4 }}><Text style={text}>{sleepDisplayDate(row.dateKey)} - {sleepDurationText(row.hours)}</Text><Text style={{ ...text, color: colors.muted }}>{row.source === "health" ? "Health Connect" : "Manual entry"}{row.startMs == null ? ", times unavailable" : `, ${timeText(row.startMs)} - ${timeText(row.endMs!)}`}</Text></View>)}
    </> : <>
      <Text style={{ ...text, color: colors.muted }}>Night ending {sleepDisplayDate(mode === "times" ? wakeDate : selected)}</Text>
      <View style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", gap: 8 }}>
        {(["times", "duration"] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }} onPress={() => {
          if (value === "duration" && mode === "times") { try { setDuration(String(timedSleepEntry(bedDate, bedtime, wakeDate, wakeTime).hours)); } catch { /* Preserve duration draft until both times are valid. */ } }
          setMode(value); setError("");
        }} style={{ flex: fontScale >= 1.5 ? undefined : 1, minHeight: 48, padding: 12, alignItems: "center", justifyContent: "center", backgroundColor: mode === value ? colors.primary : colors.surface, borderWidth: 1, borderColor: mode === value ? colors.primary : colors.border, borderRadius: 6 }}><Text style={{ ...text, color: mode === value ? colors.onPrimary : colors.ink, textAlign: "center" }}>{value === "times" ? "Sleep / wake times" : "Duration only"}</Text></Pressable>)}
      </View>
      {mode === "times" ? <>
        <SleepDial bedtime={bedtime} wakeTime={wakeTime} hours={previewHours} onChange={changeTime} />
        <View style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", gap: 20 }}>
          {(["bedtime", "wakeTime"] as const).map((field) => <View key={field} style={{ flex: 1, gap: 8 }}>
            <Text style={{ ...text, fontFamily: notebookFonts.semibold }}>{field === "bedtime" ? "Bedtime" : "Wake time"}</Text>
            <NotebookTextInput accessibilityLabel={`${field === "bedtime" ? "Bedtime" : "Wake time"} in 24-hour HH:MM format`} value={field === "bedtime" ? bedtime : wakeTime} onChangeText={(raw) => { const digits = raw.replace(/\D/g, "").slice(0, 4); changeTime(field, digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits); }} keyboardType="number-pad" selectTextOnFocus disableFullscreenUI placeholder={field === "bedtime" ? "23:00" : "07:00"} placeholderTextColor={colors.muted} style={{ ...text, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 12, minHeight: 48, backgroundColor: colors.surface }} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Change ${field === "bedtime" ? "bedtime" : "wake"} date`} onPress={() => { Keyboard.dismiss(); setDateField(field === "bedtime" ? "bed" : "wake"); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ ...text, color: colors.accent, flexShrink: 1 }}>{sleepDisplayDate(field === "bedtime" ? bedDate : wakeDate)}</Text><ChevronDown color={colors.accent} size={16} /></Pressable>
          </View>)}
        </View>
        <Text style={{ ...text, color: colors.muted }}>Drag B for bedtime or W for wake time, or type exact 24-hour times. Times use this device timezone. Calculated duration does not subtract time awake.</Text>
      </> : <View style={{ gap: 12 }}>
        <Text style={{ ...text, fontFamily: notebookFonts.semibold }}>Duration in hours</Text>
        <NotebookTextInput accessibilityLabel="Sleep duration in hours" value={duration} onChangeText={(value) => { setDuration(value); setError(""); }} keyboardType="decimal-pad" selectTextOnFocus disableFullscreenUI placeholder="e.g. 7.5" placeholderTextColor={colors.muted} style={{ ...text, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 12 }} />
        {entry && entry.startMs == null ? <Text style={{ ...text, color: colors.muted }}>This saved record has no bedtime or wake time. No times have been invented.</Text> : null}
      </View>}
      <Text accessibilityLiveRegion="polite" style={{ ...text, fontFamily: notebookFonts.semibold, fontSize: 20 }}>{preview}</Text>
      {entry?.source === "health" ? <Text style={{ ...text, color: colors.muted }}>Saving creates a manual correction in Lastrep. It does not edit Health Connect.</Text> : null}
    </>}
    {error ? <Text accessibilityRole="alert" style={{ ...text, color: colors.danger }}>{error}</Text> : null}
  </SleepSheet>;
}
