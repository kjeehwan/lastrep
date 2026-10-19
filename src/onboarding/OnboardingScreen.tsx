import { Circle, CircleDot } from "lucide-react-native";
import Slider from "@react-native-community/slider";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, BackHandler, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { useNotebook, useNotebookStyles } from "../ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "../ui/notebook/tokens";
import { useOnboarding } from "./OnboardingProvider";
import { onboardingSteps, type Experience, type OnboardingStep } from "./onboardingState";
const titles = { experience: "Where are you starting?", availability: "Make room for training.", nickname: "What should we call you?", health: "Optional health sync" };
const options: { value: Experience; label: string }[] = [{ value: "beginner", label: "Beginner" }, { value: "intermediate", label: "Intermediate" }, { value: "advanced", label: "Advanced" }];
export function OnboardingScreen({ step }: { step: OnboardingStep }) {
  const { colors } = useNotebook(), styles = useNotebookStyles(createStyles);
  const state = useOnboarding(), router = useRouter();
  const [focused, setFocused] = useState(false);
  const index = onboardingSteps.indexOf(step);
  const back = useCallback(() => {
    if (state.busy) return;
    Keyboard.dismiss();
    router.replace(index === 0 ? "/auth/sign-in" : `/onboarding/${onboardingSteps[index - 1]}`);
  }, [state.busy, index, router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (Keyboard.isVisible()) return false;
      back(); return true;
    });
    return () => subscription.remove();
  }, [back]));
  const advance = async (skip = false) => {
    Keyboard.dismiss();
    const destination = await state.advance(step, skip);
    if (destination) router.replace(destination);
  };
  if (state.ready && !state.uid) return <Redirect href="/auth/sign-in" />;
  const disabled = state.busy || !state.ready;
  const action = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: state.busy }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.5 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  return <OnboardingLayout title={titles[step]} step={index + 1} busy={state.busy} skipDisabled={disabled} onBack={back} onSkip={() => { void advance(true); }}>
    {!state.ready ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading setup" /> : <>
      {step === "experience" ? <View accessibilityRole="radiogroup" accessibilityLabel="Training experience" style={styles.group}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: state.draft.experience === option.value, disabled }} disabled={disabled} onPress={() => state.change({ experience: option.value })} style={[styles.option, state.draft.experience === option.value && styles.selected]}><Text style={styles.optionText}>{option.label}</Text>{state.draft.experience === option.value ? <CircleDot size={20} strokeWidth={1.5} color={colors.ink} accessible={false} /> : <Circle size={20} strokeWidth={1.5} color={colors.ink} accessible={false} />}</Pressable>)}</View> : null}
      {step === "availability" ? <View style={styles.group}>
        <Text style={styles.supporting}>Choose a number of training days you can usually manage.</Text>
        <Text style={styles.label}>Training days per week</Text>
        <Text accessibilityLiveRegion="polite" style={styles.count}>{state.draft.availabilityDays} days / week</Text>
        <Slider accessibilityRole="adjustable" accessibilityLabel="Training days per week" accessibilityValue={{ min: 1, max: 7, now: state.draft.availabilityDays, text: `${state.draft.availabilityDays} days per week` }} style={styles.slider} value={state.draft.availabilityDays} minimumValue={1} maximumValue={7} step={1} minimumTrackTintColor={colors.ink} maximumTrackTintColor={colors.rule} thumbTintColor={colors.ink} disabled={disabled} onValueChange={(value: number) => state.change({ availabilityDays: Math.round(value) })} />
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.ticks}>{[1, 2, 3, 4, 5, 6, 7].map(day => <Text key={day} style={styles.supporting}>{day}</Text>)}</View>
        <Text style={styles.supporting}>You can change this later in Profile.</Text>
      </View> : null}
      {step === "nickname" ? <View style={styles.group}>
        <Text nativeID="onboarding-nickname-label" style={styles.label}>Nickname (optional)</Text>
        <TextInput accessibilityLabel="Nickname (optional)" accessibilityLabelledBy="onboarding-nickname-label" style={[styles.input, focused && { borderColor: colors.accent }]} placeholder="Your nickname" placeholderTextColor={colors.muted} selectionColor={colors.accent} value={state.draft.nickname} onChangeText={nickname => state.change({ nickname })} editable={!disabled} disableFullscreenUI autoComplete="nickname" textContentType="nickname" returnKeyType="done" onSubmitEditing={() => { void advance(); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        <Text style={styles.supporting}>You can add or change your nickname later in Profile.</Text>
      </View> : null}
      {step === "health" ? <View style={styles.group}>
        <Text style={styles.body}>On supported Android devices, Lastrep can read sleep, weight, body-fat and lean-body-mass records that you permit.</Text>
        <View style={styles.note}><Text style={styles.label}>Your choice, at any time.</Text><Text style={styles.body}>Imported summaries are stored in your Lastrep account for recovery, sleep and body-composition trends.</Text><Text style={styles.body}>Relevant summaries may support AI-assisted recommendations. A separate disclosure appears before sending context to OpenAI.</Text><Text style={styles.supporting}>Nothing is connected during setup. You can connect later in Profile, disconnect there, or revoke access in your health service.</Text></View>
      </View> : null}
    </>}
    {state.error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{state.error}</Text> : null}
    {!state.ready && state.error ? <Pressable accessibilityRole="button" onPress={state.retry} style={styles.button}><Text style={styles.buttonText}>Retry loading</Text></Pressable> : action(state.busy ? "Saving..." : step === "health" ? "Go to Home" : "Continue", () => { void advance(); })}
  </OnboardingLayout>;
}
const createStyles = (colors: NotebookColors) => StyleSheet.create({
  group: { gap: 12 }, body: { fontFamily: notebookFonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  supporting: { fontFamily: notebookFonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontFamily: notebookFonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink },
  count: { fontFamily: notebookFonts.semibold, fontSize: 20, lineHeight: 28, textAlign: "center", color: colors.ink },
  slider: { width: "100%", height: 48 }, ticks: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 },
  option: { minHeight: 60, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface },
  optionText: { fontFamily: notebookFonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink, flexShrink: 1 }, selected: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.subtle },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, fontFamily: notebookFonts.body, fontSize: 16, color: colors.ink },
  button: { minHeight: 48, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: notebookFonts.semibold, fontSize: 16, lineHeight: 22, color: colors.onPrimary, textAlign: "center" },
  note: { gap: 12, borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 16 },
  error: { fontFamily: notebookFonts.body, fontSize: 16, lineHeight: 22, color: colors.danger },
});
