import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { ProfileAction, ProfileChoices, ProfileSheet } from "../../profile/ProfileNotebookControls";
import { useNotebook } from "../../ui/notebook/Notebook";
import { NotebookTextInput } from "../../ui/notebook/NotebookTextInput";
import { notebookFonts } from "../../ui/notebook/tokens";
import { RestTimerText } from "./TimerText";
import type { RestClock } from "./timerClock";

const presets = { "60s": 60, "90s": 90, "120s": 120 } as const;

/** Presentation only: the workout owns all duration, clock and dismissal state. */
export function RestTimerSheet({ name, clock, preference, custom, onCustomChange, onPreset, onCustomApply, onReset, onToggle, onClose, needsPermission, onEnableAlerts }: {
  name: string; clock: RestClock; preference: number; custom: string;
  onCustomChange: (value: string) => void; onPreset: (seconds: number) => void;
  onCustomApply: () => void; onReset: () => void; onToggle: () => void; onClose: () => void;
  needsPermission: boolean; onEnableAlerts: () => void;
}) {
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= 1.5;
  const text = { color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16 };
  const selected = Object.keys(presets).find(key => presets[key as keyof typeof presets] === preference) ?? "";
  return <ProfileSheet title="Rest timer" onClose={onClose} footer={
    // AdaptiveModalCard supplies 12 dp above the footer; match it below the rule.
    <View style={{ borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 12 }}>
      <View style={{ flexDirection: large ? "column" : "row", gap: 12 }}>
        <View style={{ flex: large ? undefined : 1 }}><ProfileAction label="Reset" onPress={onReset} /></View>
        <View style={{ flex: large ? undefined : 1 }}><ProfileAction primary label={clock.running ? "Pause" : "Start"} onPress={onToggle} /></View>
      </View>
    </View>
  }>
    <View style={{ gap: 16 }}>
      <Text style={[text, { fontFamily: notebookFonts.semibold, textAlign: "center", fontSize: 20 }]}>{name}</Text>
      <RestTimerText clock={clock} prefix="" padMinutes style={{ color: colors.ink, fontFamily: notebookFonts.body, fontSize: 48, fontVariant: ["tabular-nums"], textAlign: "center" }} />
    </View>
    <View style={{ gap: 16 }}>
      <ProfileChoices label="Rest duration" values={Object.keys(presets)} selected={selected} equalCells={!large} onChange={value => onPreset(presets[value as keyof typeof presets])} />
      <View style={{ flexDirection: large ? "column" : "row", alignItems: large ? "stretch" : "center", gap: 12 }}>
        <Text style={[text, { flex: large ? undefined : 1 }]}>Custom seconds</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <NotebookTextInput accessibilityLabel="Custom rest duration in seconds" selectTextOnFocus disableFullscreenUI keyboardType="numeric" value={custom} onChangeText={onCustomChange} onSubmitEditing={onCustomApply} returnKeyType="done" placeholder="Seconds" placeholderTextColor={colors.muted}
            style={{ width: 104 * Math.min(fontScale, 2), minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.surface, color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Set custom rest duration" onPress={onCustomApply} style={{ minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 }}><Text style={[text, { fontFamily: notebookFonts.semibold }]}>Set</Text></Pressable>
        </View>
      </View>
    </View>
    {needsPermission ? <ProfileAction label="Allow rest timer alerts" onPress={onEnableAlerts} /> : null}
  </ProfileSheet>;
}
