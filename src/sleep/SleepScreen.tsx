import { NotebookTextInput } from "../ui/notebook/NotebookTextInput";
import React, { useCallback, useMemo, useState } from "react";
import { BackHandler, Linking, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, Redirect } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react-native";
import { doc, setDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../config/firebaseConfig";
import { useNotebook } from "../ui/notebook/Notebook";
import { NotebookHeader } from "../ui/notebook/NotebookHeader";
import { notebookFonts } from "../ui/notebook/tokens";
import { useNotebookStatusBar } from "../ui/notebook/useNotebookStatusBar";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { useSleepJournal } from "./useSleepJournal";
import { deriveSleepDays, isSupersededSleepTotal, removeSleepEntry, shiftSleepDate, sleepDateKey, sleepDurationText, sleepEntryAsleepHours, weeklySleepSummary, validateSleepHours, type SleepEntry } from "./sleepSessionModel";
import { mutateSleepJournal } from "./sleepJournal";
import { syncSleepFromHealthConnect } from "./sleep";
import { SleepSheet, SleepButton } from "./components/SleepSheet";
import { SleepEntryEditor, sleepDisplayDate } from "./components/SleepEntryEditor";
import { SleepCalendar } from "./components/SleepCalendar";
import { SleepHistoryChart } from "./components/SleepHistoryChart";

function SleepTargetEditor({ uid, target, onClose }: { uid: string; target: number; onClose: () => void }) {
  const { colors } = useNotebook();
  const { isOffline } = useOfflineStatus();
  const [draft, setDraft] = useState(String(target));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const text = { color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16 };
  const save = async () => {
    if (saving) return;
    try {
      const hours = Math.round(validateSleepHours(draft) * 10) / 10;
      if (hours <= 0) throw Error("Enter a target of at least 0.1 hours.");
      if (isOffline) throw Error("Reconnect to save your target. Your entry is kept.");
      setSaving(true); setError("");
      await setDoc(doc(db, "users", uid), { sleepSettings: { targetHours: hours } }, { merge: true }); onClose();
    } catch (err) { setError((err as Error).message || "Could not save. Try again."); }
    finally { setSaving(false); }
  };
  return <SleepSheet title="Sleep target" onClose={() => { if (!saving) onClose(); }} footer={<><SleepButton label={saving ? "Saving..." : "Save target"} primary disabled={saving} onPress={() => void save()} /><SleepButton label="Cancel" disabled={saving} onPress={onClose} /></>}>
    <Text style={text}>Daily target in hours</Text>
    <NotebookTextInput accessibilityLabel="Daily sleep target in hours" value={draft} onChangeText={setDraft} keyboardType="decimal-pad" selectTextOnFocus disableFullscreenUI placeholder="e.g. 7.5" placeholderTextColor={colors.muted} style={{ ...text, minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 6 }} />
    <Text style={{ ...text, color: colors.muted }}>Uses the same saved sleep target as Profile.</Text>
    {error ? <Text accessibilityRole="alert" style={{ ...text, color: colors.danger }}>{error}</Text> : null}
  </SleepSheet>;
}

function entryTimeLabel(entry: SleepEntry): string {
  if (entry.startMs == null || entry.endMs == null) return entry.kind === "legacy" ? "Older daily total / times unavailable" : "Duration only / times unavailable";
  const time = (ms: number, offset: number | null) => {
    const date = new Date(ms + (offset ?? -new Date(ms).getTimezoneOffset()) * 60_000);
    return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}, ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  };
  return `${time(entry.startMs, entry.startOffsetMinutes)} - ${time(entry.endMs, entry.endOffsetMinutes)}`;
}
export function SleepScreen() {
  const data = useSleepJournal();
  return <SleepJournalView key={data.account?.uid ?? "signed-out"} data={data} />;
}
function SleepJournalView({ data }: { data: ReturnType<typeof useSleepJournal> }) {
  useNotebookStatusBar();
  const { colors } = useNotebook();
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { isOffline } = useOfflineStatus();
  const { days, entries: counted } = useMemo(() => deriveSleepDays(data.entries, data.origin), [data.entries, data.origin]);
  const today = sleepDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = selectedDate ?? days[0]?.dateKey ?? today;
  const [chartDate, setChartDate] = useState<string | null>(null);
  const chartSelected = chartDate ?? selected;
  const [anchor, setAnchor] = useState<string | null>(null);
  const chartAnchor = anchor ?? (selected < shiftSleepDate(today, -13) ? selected : today);
  const [sheet, setSheet] = useState<"calendar" | "entry" | "target" | "setup" | "sync" | "detail" | "totalHelp" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null), [detailId, setDetailId] = useState<string | null>(null);
  const [excludeConfirm, setExcludeConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false), [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null), [entryError, setEntryError] = useState("");
  const row = days.find((day) => day.dateKey === selected);
  const sessions = counted.filter((entry) => entry.dateKey === selected && !isSupersededSleepTotal(entry, counted));
  const visibleSessions = sessions.filter((entry) => !entry.excluded && !entry.providerDeleted);
  const detail = counted.find((entry) => entry.id === detailId);
  const week = weeklySleepSummary(days, chartSelected, data.target);
  const connected = data.consent && data.permitted && data.availability === "available";
  const text = { fontFamily: notebookFonts.body, fontSize: 16, color: colors.ink };
  const muted = { ...text, color: colors.muted };
  const section = { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 24, gap: 16 };
  const title = { ...text, fontFamily: notebookFonts.editorial, fontSize: 24 };
  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setChartDate(null);
    setAnchor(date < shiftSleepDate(chartAnchor, -13) || date > chartAnchor ? date : chartAnchor);
  };
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { router.replace("/home"); return true; });
    return () => listener.remove();
  }, [router]));
  const goHealth = () => { setSheet(null); router.push({ pathname: "/profile", params: { openHealth: String(Date.now()) } }); };
  const performSync = async () => {
    if (!data.account || syncing || isOffline) return;
    setSheet(null); setSyncing(true); setFeedback(null);
    try {
      const result = await syncSleepFromHealthConnect(data.account.uid);
      if (result.status === "success") setFeedback("Sleep entries synced. Your journal is up to date.");
      else if (result.status === "no_data") setFeedback("Sleep checked. No new sleep entries were found.");
      else if (result.status === "permission_denied") setFeedback("Sleep access is not connected. Saved entries are unchanged.");
      else if (result.status === "error") setFeedback(result.message);
      else setFeedback("Health Connect needs setup. Saved entries are unchanged.");
      await data.refresh(); await data.refreshAccess();
    } catch { setFeedback("Could not sync sleep. Your saved entries are unchanged."); }
    finally { setSyncing(false); }
  };
  const sync = async () => {
    if (!data.account || syncing) return;
    try {
      const accepted = await AsyncStorage.getItem(`sleep-sync-confirmed-v1:${data.account.uid}`);
      if (accepted !== "true") setSheet("sync"); else void performSync();
    } catch { setFeedback("Could not check sync confirmation. Try again."); }
  };
  const removeEntry = async () => {
    if (!detail || !data.account || saving) return;
    setSaving(true); setEntryError("");
    try {
      if (isOffline) throw Error("Reconnect to update this entry. Saved data is unchanged.");
      const expected = data.entries.find((entry) => entry.id === detail.id);
      if (!expected) throw Error("This entry is no longer available.");
      await mutateSleepJournal(data.account.uid, (entries) => removeSleepEntry(entries, expected));
      await data.refresh(); setSheet(null); setExcludeConfirm(false);
    } catch (err) { setEntryError((err as Error).message || "Could not update. Try again."); }
    finally { setSaving(false); }
  };
  if (data.authLoaded && !data.account) return <Redirect href="/auth/sign-in" />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "left", "right"]}>
    <NotebookHeader title="Sleep" onBack={() => router.replace("/home")} />
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 28, width: "100%", maxWidth: 800, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous sleep date" onPress={() => chooseDate(shiftSleepDate(selected, -1))} style={{ width: 44, minHeight: 44, justifyContent: "center" }}><ChevronLeft size={20} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose sleep date" onPress={() => setSheet("calendar")} style={{ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}><Text style={{ ...text, textAlign: "center", flexShrink: 1 }}>{selected === today ? "Today / " : ""}{sleepDisplayDate(selected)}</Text><ChevronDown size={16} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next sleep date" disabled={selected >= today} onPress={() => chooseDate(shiftSleepDate(selected, 1))} style={{ width: 44, minHeight: 44, justifyContent: "center", alignItems: "flex-end", opacity: selected >= today ? 0.3 : 1 }}><ChevronRight size={20} color={colors.ink} /></Pressable>
      </View>
      {isOffline ? <Text style={muted}>You are offline. Saved sleep is still available; reconnect to sync or save changes.</Text> : null}
      {data.error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ ...text, color: colors.danger }}>{data.error}</Text><SleepButton label="Retry" onPress={() => void data.refresh()} /></View> : null}
      {feedback ? <Text accessibilityLiveRegion="polite" style={muted}>{feedback}</Text> : null}
      {data.entries.filter((entry) => entry.dateKey === "undated" && !entry.excluded).map((entry) => <View key={entry.id} style={{ gap: 8 }}><Text style={muted}>Older saved total: {sleepDurationText(entry.hours)}. Its diary date is unavailable. Choose the correct date above before assigning it.</Text><SleepButton label={`Assign to ${sleepDisplayDate(selected)}`} onPress={() => { setEditingId(entry.id); setSheet("entry"); }} /></View>)}
      <View style={{ gap: 12 }}>
        <Text accessibilityLabel={data.loading && !data.entries.length ? "Loading saved sleep" : sleepDurationText(row?.hours ?? null)} style={{ color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: row && fontScale < 1.5 ? 42 : 32 }}>{data.loading && !data.entries.length ? "Loading saved sleep..." : row ? <>{Math.floor(Math.round(row.hours * 60) / 60)}<Text style={muted}> h </Text>{String(Math.round(row.hours * 60) % 60).padStart(2, "0")}<Text style={muted}> min</Text></> : "Not recorded"}</Text>
        {row ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ ...muted, flexShrink: 1 }}>{row.mayIncludeAwakeTime ? "May include awake time" : "Time asleep"}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="About sleep totals" onPress={() => setSheet("totalHelp")} style={{ width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Info size={18} strokeWidth={1.5} color={colors.muted} /></Pressable>
        </View> : null}
        <Text style={muted}>{row ? (() => { const delta = Math.round((row.hours - data.target) * 60); return delta === 0 ? "Matches your target" : `${Math.abs(delta)} min ${delta < 0 ? "below" : "above"} your target`; })() : "Record sleep manually, or sync supported health data."}</Text>
        {row ? <View style={{ gap: 4 }}>
          <Text style={muted}>{row.mixed ? "Manual + Health Connect" : row.source === "health" ? "Health Connect" : "Manual entry"}{row.sessionCount ? ` / ${row.sessionCount} ${row.sessionCount === 1 ? "session" : "sessions"}` : " / Older daily total"}</Text>
          {row.recordedAtMs != null ? <Text style={muted}>{row.source === "health" && !row.mixed ? "Recorded" : "Saved"} {new Date(row.recordedAtMs).toLocaleString()}</Text> : null}
        </View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Edit sleep target" onPress={() => setSheet("target")} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}><Text style={{ ...text, color: colors.accent, textDecorationLine: "underline" }}>Your target / {sleepDurationText(data.target)}</Text></Pressable>
        <View style={{ alignSelf: "flex-start" }}><SleepButton align="left" label={row ? "Add sleep session" : "Record sleep"} primary={!row} disabled={data.loading && !data.entries.length} onPress={() => { setEditingId(null); setSheet("entry"); }} /></View>
      </View>
      {visibleSessions.length ? <View style={section}>
        <Text accessibilityRole="header" style={title}>Sleep entries</Text>
        {row?.needsReview ? <Text style={{ ...text, color: colors.warning }}>Some entries may describe the same sleep. Overlapping time counts once. Unknown-time totals need review before timed entries can be added.</Text> : null}
        {visibleSessions.map((entry, index) => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={`Review sleep entry: ${sleepDurationText(sleepEntryAsleepHours(entry) ?? entry.hours)}`} onPress={() => { setDetailId(entry.id); setExcludeConfirm(false); setEntryError(""); setSheet("detail"); }} style={{ gap: 6, paddingVertical: 12, borderBottomWidth: index < visibleSessions.length - 1 ? 1 : 0, borderBottomColor: colors.rule }}>
          <Text style={text}>{entryTimeLabel(entry)}</Text><Text style={{ ...text, fontFamily: notebookFonts.semibold }}>{sleepDurationText(sleepEntryAsleepHours(entry) ?? entry.hours)}{sleepEntryAsleepHours(entry) != null ? " asleep" : entry.startMs != null ? " session duration" : ""}</Text><Text style={muted}>{entry.source === "health" ? entry.origin?.includes("shealth") ? "Samsung Health" : "Health Connect" : "Manual entry"}{entry.excluded || entry.providerDeleted ? " / Excluded from totals" : entry.needsReview ? " / Needs review" : ""}</Text>
        </Pressable>)}
      </View> : null}
      <View style={section}>
        <Text accessibilityRole="header" style={title}>Daily sleep</Text>
        <SleepHistoryChart days={days} selected={chartSelected} anchor={chartAnchor} target={data.target} onSelect={setChartDate} />
        <View style={{ flexDirection: fontScale >= 1.5 ? "column" : "row", gap: 24 }}>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ ...text, fontFamily: notebookFonts.semibold }}>{sleepDurationText(week.average)}</Text><Text style={muted}>Average / {sleepDisplayDate(shiftSleepDate(chartSelected, -6))} - {sleepDisplayDate(chartSelected)}</Text></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ ...text, fontFamily: notebookFonts.semibold }}>{week.count} of 7</Text><Text style={muted}>Days recorded</Text></View>
        </View>
        <Text style={muted}>{week.count ? `${week.met} of ${week.count} recorded days met your target. ${7 - week.count} ${7 - week.count === 1 ? "day has" : "days have"} no entry.` : "Record sleep to start a weekly comparison."}</Text>
      </View>
      <View style={section}>
        <Text accessibilityRole="header" style={title}>Health sync</Text>
        <Text style={{ ...text, fontFamily: notebookFonts.semibold }}>{data.availability === "checking" ? "Checking health access..." : connected ? "Connected on this device" : data.availability === "unsupported" ? "Health sync is not supported on this device" : data.availability !== "available" ? "Health Connect needs setup" : data.consent ? "Sleep permission needed" : "Not connected on this device"}</Text>
        <Text style={muted}>{connected ? "Sleep records can be read with your consent and device permission." : "Saved account records remain available. You can also record sleep manually."}</Text>
        <Text style={muted}>Last checked on this device: {data.lastChecked ? new Date(data.lastChecked).toLocaleString() : "Not checked yet"}</Text>
        {connected ? <><SleepButton label={syncing ? "Syncing..." : "Sync sleep"} primary disabled={syncing || isOffline} onPress={() => void sync()} /><SleepButton label="Manage health access" onPress={goHealth} /></> : data.availability === "available" ? <SleepButton label={data.consent ? "Review health access" : "Connect health data"} onPress={goHealth} /> : data.availability !== "unsupported" && data.availability !== "checking" ? <SleepButton label="Set up Health Connect" onPress={() => setSheet("setup")} /> : null}
      </View>
    </ScrollView>
    {sheet === "totalHelp" ? <SleepSheet title="How sleep totals work" onClose={() => setSheet(null)} footer={<SleepButton label="Close" onPress={() => setSheet(null)} />}>
      <Text style={text}>Known awake time is excluded when complete sleep stages are available. Other entries use their recorded duration, which may include awake time.</Text>
    </SleepSheet> : null}
    {sheet === "calendar" ? <SleepSheet title="Sleep date" onClose={() => setSheet(null)}><SleepCalendar selected={selected} onSelect={(date) => { chooseDate(date); setSheet(null); }} /></SleepSheet> : null}
    {sheet === "entry" && data.account ? <SleepEntryEditor uid={data.account.uid} selected={selected} entry={data.entries.find((entry) => entry.id === editingId) ?? null} onClose={() => setSheet(null)} onSaved={(date) => { chooseDate(date); setSheet(null); void data.refresh(); }} /> : null}
    {sheet === "target" && data.account ? <SleepTargetEditor uid={data.account.uid} target={data.target} onClose={() => setSheet(null)} /> : null}
    {sheet === "sync" && data.account ? <SleepSheet title="Confirm account for sleep sync" onClose={() => setSheet(null)} footer={<><SleepButton label="Import sleep" primary onPress={() => { void AsyncStorage.setItem(`sleep-sync-confirmed-v1:${data.account!.uid}`, "true").then(performSync).catch(() => setFeedback("Could not save confirmation. Try again.")); }} /><SleepButton label="Cancel" onPress={() => setSheet(null)} /></>}><Text style={text}>Import this device Health Connect sleep into {data.account.label}?</Text><Text style={muted}>Existing manual entries and corrections are kept. Conflicting entries remain available for review.</Text></SleepSheet> : null}
    {sheet === "setup" ? <SleepSheet title="Set up Health Connect" onClose={() => setSheet(null)} footer={<><SleepButton label="Open Health Connect" primary onPress={() => { void (async () => {
      try { if (Platform.OS === "android" && Number(Platform.Version) >= 34) await Linking.sendIntent("android.health.connect.action.HEALTH_HOME_SETTINGS"); else await Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"); }
      catch { setFeedback("Open Health Connect in Android Settings, or install/update it through Google Play."); }
    })(); }} /><SleepButton label="Review Lastrep health access" onPress={goHealth} /><SleepButton label="Close" onPress={() => setSheet(null)} /></>}><Text style={text}>1. Open Health Connect in Android Settings. Install or update it if your supported device prompts you.</Text><Text style={text}>2. In your sleep-tracking app, enable sharing sleep records with Health Connect.</Text><Text style={text}>3. Return to Lastrep, open Profile, connect health sync and allow Sleep access.</Text><Text style={muted}>Availability depends on your device. Manual sleep entry does not require Health Connect.</Text></SleepSheet> : null}
    {sheet === "detail" && detail ? <SleepSheet title={excludeConfirm ? detail.source === "health" ? "Exclude sleep entry?" : "Delete sleep entry?" : detail.kind === "legacy" ? "Older daily total" : "Sleep session"} onClose={() => { if (saving) return; if (excludeConfirm) setExcludeConfirm(false); else setSheet(null); }} footer={excludeConfirm ? <><SleepButton label={saving ? "Saving..." : detail.source === "health" ? "Exclude from totals" : "Delete entry"} danger disabled={saving} onPress={() => void removeEntry()} /><SleepButton label="Cancel" disabled={saving} onPress={() => setExcludeConfirm(false)} /></> : <><SleepButton label={detail.source === "health" ? "Correct in Lastrep" : "Edit session"} primary onPress={() => { setEditingId(detail.id); setSheet("entry"); }} /><SleepButton label={detail.source === "health" ? "Exclude from totals" : "Delete entry"} danger onPress={() => setExcludeConfirm(true)} /><SleepButton label="Close" onPress={() => setSheet(null)} /></>}>
      <Text style={text}>{entryTimeLabel(detail)}</Text><Text style={{ ...text, fontFamily: notebookFonts.editorial, fontSize: 28 }}>{sleepDurationText(sleepEntryAsleepHours(detail) ?? detail.hours)}</Text>
      {sleepEntryAsleepHours(detail) != null ? <Text style={muted}>Session window: {sleepDurationText(detail.hours)}. Asleep from complete provider stages: {sleepDurationText(sleepEntryAsleepHours(detail))}.</Text> : detail.startMs != null ? <Text style={muted}>Session duration; complete asleep/awake stages are not available.</Text> : null}
      <Text style={muted}>{detail.source === "health" ? "Health Connect" : "Manual entry"}{detail.origin ? ` / ${detail.origin}` : ""}</Text>
      {detail.kind === "legacy" ? <Text style={muted}>This is an older sleep record saved as one daily total, without individual session times.</Text> : null}
      {detail.kind === "legacy" && detail.source === "health" && detail.excluded && counted.some((entry) => entry.dateKey === detail.dateKey && entry.kind === "session" && entry.source === "health" && !entry.excluded && !entry.providerDeleted) ? <Text style={muted}>Individual imported sessions now represent this sleep. This older total is kept for reference and excluded so the same sleep is not counted twice.</Text> : null}
      {detail.source === "health" ? <Text style={muted}>Corrections and exclusions affect Lastrep only. The original health-service record is unchanged. {detail.startOffsetMinutes == null ? "This provider adapter did not supply timezone offsets; times are displayed in this device timezone." : ""}</Text> : null}
      {detail.providerDeleted ? <Text style={muted}>Removed by the health provider. Retained here for reference, excluded from totals.</Text> : detail.needsReview ? <Text style={muted}>Only {sleepDurationText(detail.countedHours)} contributes to this daily total. Overlapping or unverified time is not added again.</Text> : null}
      {excludeConfirm ? <Text style={muted}>{detail.source === "health" ? "This hides the session from Lastrep and excludes it from totals. Sync will not add it back. The original Health Connect record is unchanged." : "This permanently deletes this entry from Lastrep and updates your sleep total. This cannot be undone."}</Text> : null}
      {entryError ? <Text accessibilityRole="alert" style={{ ...text, color: colors.danger }}>{entryError}</Text> : null}
    </SleepSheet> : null}
  </SafeAreaView>;
}
