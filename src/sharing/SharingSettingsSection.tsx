import React, { useState } from "react";
import { Switch, View } from "react-native";
import { AtSign, UsersRound } from "lucide-react-native";
import { useNotebook } from "../ui/notebook/Notebook";
import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import { showAppAlert } from "../ui/appDialog";
import {
  SettingsSection,
  SettingsRow,
  SettingsText,
} from "../settings/SettingsNotebookControls";
import { useSharing } from "./SharingProvider";
export function SharingSettingsSection() {
  const sharing = useSharing();
  const { colors } = useNotebook();
  const [pendingToggle, setPendingToggle] = useState<{ uid: string | null; enabled: boolean } | null>(null);
  const pending = pendingToggle?.uid === sharing.uid ? pendingToggle : null;
  const changeEnabled = (enabled: boolean) => {
    if (pending || sharing.busy || sharing.settingsError) return;
    if (enabled && !sharing.settings.username) {
      void sharing.toggle();
      return;
    }
    // Keep the native switch at the requested position while the server saves.
    // Otherwise its controlled value briefly sends the thumb back to the old
    // position. Clearing this preview also restores the saved state on failure.
    const request = { uid: sharing.uid, enabled };
    setPendingToggle(request);
    void sharing.toggle().finally(() => {
      setPendingToggle(current => current === request ? null : current);
    });
  };
  return (
    <SettingsSection title="Sharing">
      <SettingsRow
        icon={<UsersRound size={20} strokeWidth={1.5} color={colors.ink} />}
        label="Sharing within Lastrep"
        labelAccessory={<NotebookInfoButton label="About sharing within Lastrep" onPress={() => showAppAlert("Sharing within Lastrep", "When on, people can find your nickname and @username and send you workouts.")} />}
        control={<View style={{ minWidth: 64, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Switch
          accessibilityLabel="Sharing within Lastrep"
          disabled={!!pending || sharing.busy || !!sharing.settingsError}
          value={pending?.enabled ?? sharing.settings.enabled}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.border}
          style={{ transform: [{ scale: 1.2 }] }}
          onValueChange={changeEnabled}
        /></View>}
      />
      <SettingsRow
        icon={<AtSign size={20} strokeWidth={1.5} color={colors.ink} />}
        label="Username"
        value={
          sharing.settings.username
            ? `@${sharing.settings.username}`
            : "Not set"
        }
        onPress={sharing.openUsername}
      />
      {!!sharing.hint && <SettingsText live>{sharing.hint}</SettingsText>}
      {!!sharing.settingsError && (
        <SettingsText live>{sharing.settingsError}</SettingsText>
      )}
    </SettingsSection>
  );
}
