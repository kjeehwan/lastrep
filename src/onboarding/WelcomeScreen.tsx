import { useAppGuide } from "./live/AppGuide";
import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { X } from "lucide-react-native";
import HomeRoute from "../../app/(tabs)/home";
import { auth } from "../config/firebaseConfig";
import { NotebookProvider, useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import { NotebookModal } from "../ui/notebook/NotebookModal";
import { completeOnboardingIntroduction } from "./onboardingService";
import { GuideButton as Button, GuideCopy as Copy, guideWelcomeStyles } from "./live/GuideControls";

export default function WelcomeScreen() { return <NotebookProvider><WelcomeContent /></NotebookProvider>; }
function WelcomeContent() {
  const { colors } = useNotebook(), s = useNotebookStyles(guideWelcomeStyles), router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const guide = useAppGuide();
  const viewingHelp = replay === "1";
  const [uid, setUid] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const epoch = useRef(0), lock = useRef(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      epoch.current += 1; lock.current = false; setBusy(false); setError(""); setUid(user?.uid ?? null);
      if (!user) router.replace("/auth/sign-in");
    });
    return () => { epoch.current += 1; unsubscribe(); };
  }, [router]);
  const leave = async (showGuide: boolean) => {
    if (!uid || lock.current) return;
    const account = uid, generation = epoch.current;
    lock.current = true; setBusy(true); setError("");
    try {
      if (!viewingHelp) await completeOnboardingIntroduction(account);
      if (generation !== epoch.current || auth.currentUser?.uid !== account) return;
      if (showGuide) guide?.begin(); else { guide?.end(); router.replace("/(tabs)/home"); }
    } catch {
      if (generation === epoch.current) setError("Couldn't finish the introduction. Reconnect and try again.");
    } finally { if (generation === epoch.current) { lock.current = false; setBusy(false); } }
  };
  const leaveRef = useRef(leave);
  useEffect(() => { leaveRef.current = leave; });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { void leaveRef.current(false); return true; });
    return () => subscription.remove();
  }, []);
  return <View style={{ flex: 1 }}><View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1 }}><HomeRoute /></View><NotebookModal visible transparent animationType="fade" onRequestClose={() => { void leave(false); }} dismissOnBackdropPress={false}>
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.overlay, padding: 20 }}><ScrollView style={{ flexGrow: 0, maxHeight: "90%", width: "100%", maxWidth: 560, alignSelf: "center", borderRadius: 12, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>Welcome to Lastrep.</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={() => { void leave(false); }} style={{ width: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}><X size={22} color={colors.ink} /></Pressable></View>
      <Copy>Get to know your training notebook.</Copy><Copy muted>Choose what you want to learn. Reopen the guide in Settings → Support → App guide.</Copy>
      {error ? <Text accessibilityRole="alert" style={[s.body, { color: colors.danger }]}>{error}</Text> : null}
      <Button label={busy ? "Opening…" : "Show me"} primary disabled={!uid || busy} onPress={() => { void leave(true); }} /><Button label="Skip" disabled={!uid || busy} onPress={() => { void leave(false); }} />
    </ScrollView></View>
  </NotebookModal></View>;
}
