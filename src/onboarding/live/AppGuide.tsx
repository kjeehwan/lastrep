import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { ChevronDown, ChevronRight, Info, X } from "lucide-react-native";
import { auth } from "../../config/firebaseConfig";
import { getProfileLeaveGuard } from "../../profile/leaveGuard";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { notebookDark, notebookPaper, notebookFonts } from "../../ui/notebook/tokens";
import { scheduleAfterInteractions } from "../../utils/scheduleAfterInteractions";
import { showAppAlert } from "../../ui/appDialog";
import { emptyGuide, guideReducer, guideTopics, guideTopicOnPath, type GuideState, type GuideTopic } from "./guideState";

type Guide = { state: GuideState; begin: () => void; start: (topic?: GuideTopic) => void; end: () => void; dismiss: (id: string) => void; event: (id: string) => void; choose: () => void };
const Context = createContext<Guide | null>(null);
export function AppGuideProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(guideReducer, undefined, emptyGuide);
  const [menu, setMenu] = useState(false);
  const initialChooserRequested = useRef(false);
  const router = useRouter(), pathname = usePathname();
  useEffect(() => onAuthStateChanged(auth, () => { initialChooserRequested.current = false; dispatch({ type: "end" }); setMenu(false); }), []);
  const owner = auth.currentUser?.uid ?? null;
  useEffect(() => { if (owner) dispatch({ type: "route", owner, path: pathname }); }, [owner, pathname]);
  useEffect(() => {
    if (!initialChooserRequested.current || !state.active || state.topic || state.owner !== owner || pathname !== "/home") return;
    const task = scheduleAfterInteractions(() => {
      if (!initialChooserRequested.current) return;
      initialChooserRequested.current = false; setMenu(true);
    });
    return () => task.cancel();
  }, [state.active, state.topic, state.owner, owner, pathname]);
  const begin = () => {
    if (!owner) return;
    initialChooserRequested.current = true;
    dispatch({ type: "begin", owner }); setMenu(false);
    router.replace("/(tabs)/home");
  };
  const end = useCallback(() => { initialChooserRequested.current = false; dispatch({ type: "end" }); setMenu(false); }, []);
  const start = (topic: GuideTopic = "home") => {
    if (!owner) return;
    if (pathname.includes("profile")) {
      const guard = getProfileLeaveGuard();
      if (guard.hasUnsavedChanges || guard.isSaving?.()) { setMenu(false); showAppAlert("Keep your Profile changes", "Save or discard your changes on Profile before switching guide topics."); return; }
    }
    initialChooserRequested.current = false;
    dispatch({ type: "start", owner, topic }); setMenu(false);
    const route = guideTopics.find(item => item.id === topic)!.route;
    router.replace(topic === "health" ? { pathname: route, params: { guideHealth: String(Date.now()), openHealth: undefined, openTraining: undefined } } : topic === "profile" ? { pathname: route, params: { guideProfile: String(Date.now()), openHealth: undefined, openTraining: undefined } } : route === "/(tabs)/workout/log" ? { pathname: route, params: { guideEntry: String(Date.now()) } } : route as Href);
  };
  // Callbacks are bound to this render's account. A late save cannot affect a new account's tips.
  const event = (id: string) => { if (owner) dispatch({ type: "event", owner, id }); };
  const dismiss = (id: string) => { if (owner) dispatch({ type: "dismiss", owner, id }); };
  const value = { state: state.owner === owner ? state : emptyGuide(), begin, start, end, event, dismiss, choose: () => setMenu(true) };
  return <Context.Provider value={value}>{children}{menu ? <GuideMenu onClose={() => setMenu(false)} onChoose={start} /> : null}</Context.Provider>;
}
export function useAppGuide() { return useContext(Context); }
function GuideMenu({ onClose, onChoose }: { onClose: () => void; onChoose: (topic: GuideTopic) => void }) {
  const colors = useAppTheme().colorScheme === "dark" ? notebookDark : notebookPaper;
  return <NotebookModal visible transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: colors.overlay }}><View style={{ maxHeight: "85%", backgroundColor: colors.surface, borderRadius: 8, maxWidth: 560, width: "100%", alignSelf: "center", padding: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}><Text style={{ flex: 1, color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 24 }}>Explore Lastrep</Text><Pressable onPress={onClose} accessibilityLabel="Close guide topics" style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><X color={colors.ink} size={22} /></Pressable></View>
    <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>Choose a topic. You can switch topics from the guide bar.</Text>
    <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
    {guideTopics.map((topic, index) => <Pressable key={topic.id} accessibilityRole="button" onPress={() => onChoose(topic.id)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 12, borderBottomWidth: index < guideTopics.length - 1 ? 1 : 0, borderColor: colors.rule }}><Text style={{ flex: 1, color: colors.ink, fontSize: 16, fontFamily: notebookFonts.body }}>{topic.title}</Text><ChevronRight size={18} color={colors.muted} /></Pressable>)}
    </ScrollView>
  </View></View></NotebookModal>;
}
/** In-flow annotation: belongs to the real screen/dialog and scrolls with its controls. */
export function AppGuideTip({ topic, id, title, children, inDialog = false }: { topic: GuideTopic | GuideTopic[]; id: string; title: string; children: ReactNode; inDialog?: boolean }) {
  const guide = useAppGuide();
  const pathname = usePathname();
  if (!guide?.state.topic || !(Array.isArray(topic) ? topic : [topic]).includes(guide.state.topic) || guide.state.dismissed.includes(id) || !guideTopicOnPath(guide.state.topic, pathname, id)) return null;
  return <TipBody id={id} title={title} guide={guide} inDialog={inDialog}>{children}</TipBody>;
}
function TipBody({ id, title, children, guide, inDialog }: { id: string; title: string; children: ReactNode; guide: Guide; inDialog: boolean }) {
  const colors = useAppTheme().colorScheme === "dark" ? notebookDark : notebookPaper;
  return <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 4, marginVertical: 12, elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text style={{ flex: 1, color: colors.ink, fontSize: 16, fontFamily: notebookFonts.body, fontWeight: "500" }}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss tip" onPress={() => guide.dismiss(id)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><X size={18} color={colors.muted} /></Pressable></View>
    <Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 14, lineHeight: 21 }}>{children}</Text>
    {id === "workout-complete" && !inDialog ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}><Pressable accessibilityRole="button" onPress={guide.choose} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.ink, fontFamily: notebookFonts.body, fontSize: 14 }}>Choose another topic</Text></Pressable><Pressable accessibilityRole="button" onPress={guide.end} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 14 }}>Finish guide</Text></Pressable></View> : null}
  </View>;
}

/** Kept outside page scrolling so topic navigation survives a dismissed tip. */
export function AppGuideNavigation() {
  const guide = useAppGuide();
  const colors = useAppTheme().colorScheme === "dark" ? notebookDark : notebookPaper;
  if (!guide?.state.active) return null;
  const selected = guideTopics.find(topic => topic.id === guide.state.topic);
  return <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.canvas }}>
    <View style={{ width: "100%", maxWidth: 760, alignSelf: "center", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.subtle, justifyContent: "space-between", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={selected ? `App guide: ${selected.title}. Choose a topic` : "App guide. Choose a topic"} onPress={guide.choose} style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingVertical: 8 }}>
        <Info size={18} color={colors.muted} style={{ flexShrink: 0 }} />
        <Text style={{ flexShrink: 1, fontFamily: notebookFonts.body, fontSize: 14, color: colors.ink }}>{selected?.title ?? "App guide"}</Text>
        <ChevronDown size={18} color={colors.muted} style={{ flexShrink: 0 }} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Finish guide" onPress={guide.end} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ fontFamily: notebookFonts.body, fontSize: 14, color: colors.muted }}>Finish</Text></Pressable>
    </View>
  </View>;
}
