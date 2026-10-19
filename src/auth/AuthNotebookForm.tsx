import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LastrepLogo from "../../components/LastrepLogo";
import { useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import { useNotebookStatusBar } from "../ui/notebook/useNotebookStatusBar";
import { notebookFonts, type NotebookColors } from "../ui/notebook/tokens";
import type { AuthMode } from "./authPresentation";
import { focusedInputScrollOffset } from "../ui/keyboardViewport";
import { Eye, EyeOff } from "lucide-react-native";

type Props = {
  mode: AuthMode; email: string; password: string;
  onEmailChange: (value: string) => void; onPasswordChange: (value: string) => void;
  onSubmit: () => void; onGoogle: () => void; onSwitch: () => void;
  active: "email" | "google" | null; error: string | null;
};

export function AuthNotebookForm({ mode, email, password, onEmailChange, onPasswordChange, onSubmit, onGoogle, onSwitch, active, error }: Props) {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const frame = useRef<number | null>(null);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(() => Keyboard.metrics()?.screenY ?? null);
  const revealFocus = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const input = TextInput.State.currentlyFocusedInput();
        const scroll = scrollRef.current;
        const viewport = scroll?.getNativeScrollRef();
        if (!Keyboard.isVisible() || !input || (input !== emailInput.current && input !== passwordInput.current) || !scroll || !viewport) return;
        viewport.measureInWindow((_x, top, _width, viewportHeight) => {
          input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
            if (input !== TextInput.State.currentlyFocusedInput() || viewportHeight <= 0 || inputHeight <= 0) return;
            const next = focusedInputScrollOffset(offset.current, top, viewportHeight, inputTop, inputHeight);
            if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: false });
          });
        });
      });
    });
  }, []);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", event => { setKeyboardTop(event.endCoordinates.screenY); revealFocus(); });
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboardTop(null));
    return () => { shown.remove(); hidden.remove(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [revealFocus]);
  useEffect(() => { revealFocus(); }, [width, height, fontScale, revealFocus]);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const signUp = mode === "sign-up";
  const busy = active !== null;
  useNotebookStatusBar();
  const action = (label: string, onPress: () => void, primary = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onPress} style={[styles.button, primary && styles.primary, busy && styles.disabled]}><Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text></Pressable>;
  return <View testID="auth-notebook-form" style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, maxHeight: Platform.OS === "android" && keyboardTop != null ? Math.min(height, keyboardTop) : undefined }]}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onLayout={revealFocus} onContentSizeChange={revealFocus} scrollEventThrottle={16} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}>
        <LastrepLogo variant="header" />
        <View style={styles.intro}><Text accessibilityRole="header" style={styles.title}>{signUp ? "Start your notebook." : "Welcome back."}</Text><Text style={styles.supporting}>{signUp ? "A place for your training, nutrition and recovery." : "Pick up where you left off."}</Text></View>
        <View style={styles.form}>
          <View style={styles.field}><Text style={styles.label} nativeID="auth-email-label">Email</Text><TextInput ref={emailInput} accessibilityLabel="Email" accessibilityLabelledBy="auth-email-label" style={[styles.input, focused === "email" && styles.focused]} placeholder="you@example.com" placeholderTextColor={colors.muted} value={email} onChangeText={onEmailChange} editable={!busy} disableFullscreenUI autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" selectionColor={colors.accent} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} onFocus={() => { setFocused("email"); revealFocus(); }} onBlur={() => setFocused(null)} /></View>
          <View style={styles.field}><Text style={styles.label} nativeID="auth-password-label">Password</Text><View style={styles.passwordRow}><TextInput ref={passwordInput} accessibilityLabel="Password" accessibilityLabelledBy="auth-password-label" style={[styles.input, styles.passwordInput, focused === "password" && styles.focused]} value={password} onChangeText={onPasswordChange} editable={!busy} disableFullscreenUI secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={signUp ? "new-password" : "current-password"} textContentType={signUp ? "newPassword" : "password"} selectionColor={colors.accent} returnKeyType="done" onSubmitEditing={onSubmit} onFocus={() => { setFocused("password"); revealFocus(); }} onBlur={() => setFocused(null)} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setShowPassword(value => !value)} style={styles.visibility}>{showPassword ? <EyeOff size={22} strokeWidth={1.5} color={colors.ink} accessible={false} /> : <Eye size={22} strokeWidth={1.5} color={colors.ink} accessible={false} />}</Pressable></View>{signUp ? <Text style={styles.supporting}>At least 6 characters.</Text> : null}</View>
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          {action(active === "email" ? signUp ? "Signing up..." : "Signing in..." : signUp ? "Sign up" : "Sign in", onSubmit, true)}
        </View>
        <View style={styles.divider}><View style={styles.rule} /><Text style={styles.supporting}>or</Text><View style={styles.rule} /></View>
        {action(active === "google" ? "Connecting..." : "Continue with Google", onGoogle)}
        <View style={styles.footer}><Text style={[styles.supporting, styles.centered]}>{signUp ? "Already have an account?" : "Don't have an account?"}</Text>{action(signUp ? "Sign in" : "Sign up", onSwitch)}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const createStyles = (colors: NotebookColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { width: "100%", maxWidth: 540, alignSelf: "center", paddingHorizontal: 20, paddingTop: 28, gap: 24 },
  intro: { gap: 10 }, title: { fontFamily: notebookFonts.editorial, fontSize: 26, lineHeight: 32, color: colors.ink },
  supporting: { fontFamily: notebookFonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  form: { gap: 12 }, field: { gap: 8 }, label: { fontFamily: notebookFonts.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, fontFamily: notebookFonts.body, fontSize: 16, color: colors.ink },
  focused: { borderColor: colors.accent }, passwordRow: { position: "relative" },
  passwordInput: { paddingRight: 60 },
  visibility: { position: "absolute", right: 1, top: 0, bottom: 0, width: 48, minHeight: 48, justifyContent: "center", alignItems: "center" },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center" },
  primary: { borderColor: colors.primary, backgroundColor: colors.primary }, buttonText: { fontFamily: notebookFonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink, textAlign: "center" },
  primaryText: { color: colors.onPrimary }, disabled: { opacity: 0.5 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 }, rule: { flex: 1, height: 1, backgroundColor: colors.rule },
  footer: { gap: 8 }, centered: { textAlign: "center" }, error: { fontFamily: notebookFonts.body, fontSize: 16, lineHeight: 22, color: colors.danger, borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 12 },
});
