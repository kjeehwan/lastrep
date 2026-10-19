import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LastrepLogo from "./LastrepLogo";
import { useNotebook, useNotebookStyles } from "../src/ui/notebook/Notebook";
import { useNotebookStatusBar } from "../src/ui/notebook/useNotebookStatusBar";
import { notebookFonts, type NotebookColors } from "../src/ui/notebook/tokens";
import { focusedInputScrollOffset } from "../src/ui/keyboardViewport";

type Props = { title: string; step: number; children: React.ReactNode; busy: boolean; skipDisabled: boolean; onBack: () => void; onSkip: () => void };
export default function OnboardingLayout({ title, step, children, busy, skipDisabled, onBack, onSkip }: Props) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0), frame = useRef<number | null>(null);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(() => Keyboard.metrics()?.screenY ?? null);
  const reveal = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const input = TextInput.State.currentlyFocusedInput(), scroll = scrollRef.current;
        if (!Keyboard.isVisible() || !input || !scroll) return;
        scroll.getNativeScrollRef()?.measureInWindow((_x, top, _w, viewportHeight) => {
          input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
            if (input !== TextInput.State.currentlyFocusedInput() || viewportHeight <= 0 || inputHeight <= 0) return;
            const next = focusedInputScrollOffset(offset.current, top, viewportHeight, inputTop, inputHeight);
            if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: false });
          });
        });
      });
    });
  }, []);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", event => { setKeyboardTop(event.endCoordinates.screenY); reveal(); });
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboardTop(null));
    return () => { shown.remove(); hidden.remove(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [reveal]);
  useEffect(() => { reveal(); }, [width, height, fontScale, reveal]);
  useNotebookStatusBar();
  return <View testID="onboarding-notebook" style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, maxHeight: Platform.OS === "android" && keyboardTop != null ? Math.min(height, keyboardTop) : undefined }]}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onLayout={reveal} onContentSizeChange={reveal} scrollEventThrottle={16} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} contentContainerStyle={[styles.content, { paddingBottom: Math.max(20, insets.bottom) + 24 }]}>
        <LastrepLogo variant="header" />
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} style={styles.navButton} onPress={onBack}><ArrowLeft size={20} strokeWidth={1.5} color={colors.ink} accessible={false} /><Text style={styles.navText}>Back</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={skipDisabled} accessibilityState={{ disabled: skipDisabled }} style={styles.navButton} onPress={onSkip}><Text style={[styles.navText, { color: colors.accent }]}>Skip</Text></Pressable>
        </View>
        <View accessible accessibilityLabel={`Step ${step} of 4`} style={styles.progress}>{[1, 2, 3, 4].map(value => <View key={value} style={[styles.track, value <= step && { backgroundColor: colors.ink }]} />)}</View>
        <View style={styles.intro}><Text style={styles.caption}>Getting started {"\u00b7"} {step} / 4</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text></View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
const createStyles = (colors: NotebookColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { width: "100%", maxWidth: 540, alignSelf: "center", paddingHorizontal: 20, paddingTop: 20, gap: 24 },
  nav: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.rule, paddingBottom: 12, marginTop: -12 },
  navButton: { minWidth: 64, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6 },
  navText: { fontFamily: notebookFonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink },
  progress: { flexDirection: "row", gap: 6 }, track: { flex: 1, height: 3, backgroundColor: colors.rule },
  intro: { gap: 10 }, caption: { fontFamily: notebookFonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  title: { fontFamily: notebookFonts.editorial, fontSize: 26, lineHeight: 32, color: colors.ink },
});
