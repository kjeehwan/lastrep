import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useDailySteps } from "./useDailySteps";
import { isCurrentSteps } from "./dailyStepsModel";
import { useNotebook } from "../ui/notebook/Notebook";
import { notebookFonts } from "../ui/notebook/tokens";
import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import { showAppAlert } from "../ui/appDialog";
export function DailyMovement({ uid }: { uid: string | null }) {
  const state = useDailySteps(uid), { colors } = useNotebook(), router = useRouter();
  const s = state.snapshot;
  const current = s && isCurrentSteps(s);
  const date = !s || current ? "Today" : new Date(`${s.dateKey}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const saved = s?.steps != null;
  const status = state.status === "offline" ? "Offline" : state.status === "disconnected" ? "Sync not connected" : state.status === "permission" ? "Steps access not allowed" : state.status === "unavailable" ? "Health Connect unavailable" : state.status === "error" ? "Couldn't refresh steps" : state.status === "loading" ? "Checking steps access..." : !saved ? "No step records shared" : `Updated ${new Date(s.asOfMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  const text = { color: colors.muted, fontFamily: notebookFonts.body, fontSize: 14 };
  return <View style={{ paddingBottom: 16, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text style={{ color: colors.ink, fontFamily: notebookFonts.semibold, fontSize: 16 }}>Daily movement</Text><NotebookInfoButton label="About daily movement" onPress={() => showAppAlert("Daily movement", "Steps shared by your connected apps through Health Connect.")} /></View>
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingVertical: 6 }}><Text style={{ ...text, fontSize: 16 }}>Steps</Text><Text accessibilityLiveRegion="polite" style={{ color: saved ? colors.ink : colors.muted, fontFamily: saved ? notebookFonts.semibold : notebookFonts.body, fontWeight: "400", fontSize: saved ? 28 : 16, lineHeight: saved ? 37 : 21 }}>{saved ? s.steps!.toLocaleString() : state.status === "loading" ? "Loading..." : "Not available"}</Text></View>
    <Text style={{ ...text, fontSize: 13, marginTop: 8 }}>{date} / Health Connect / {status}{saved && state.status !== "ready" ? " / Saved value" : ""}</Text>
    {state.saveError ? <Text style={text}>Steps updated on this phone. Account sync will retry.</Text> : null}
    {state.status === "permission" || state.status === "disconnected" || state.status === "unavailable" ? <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: "/profile", params: { openHealth: `steps-${Date.now()}` } })} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}><Text style={{ color: colors.accent, fontFamily: notebookFonts.semibold, fontSize: 16 }}>{state.status === "unavailable" ? "Health sync settings" : "Connect steps"}</Text></TouchableOpacity> : state.status === "error" ? <TouchableOpacity accessibilityRole="button" onPress={() => void state.refresh(true)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.accent, fontFamily: notebookFonts.semibold, fontSize: 16 }}>Retry</Text></TouchableOpacity> : null}
  </View>;
}
