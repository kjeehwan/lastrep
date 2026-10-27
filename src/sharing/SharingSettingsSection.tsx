import React from "react";
import { Switch } from "react-native";
import {
  SettingsSection,
  SettingsRow,
  SettingsText,
} from "../settings/SettingsNotebookControls";
import { useSharing } from "./SharingProvider";
export function SharingSettingsSection() {
  const sharing = useSharing();
  return (
    <SettingsSection title="Sharing">
      <SettingsRow icon={null} label="Sharing within Lastrep">
        <Switch
          accessibilityLabel="Sharing within Lastrep"
          disabled={sharing.busy || !!sharing.settingsError}
          value={sharing.settings.enabled}
          onValueChange={() => void sharing.toggle()}
        />
      </SettingsRow>
      <SettingsText>
        When on, people can find your nickname and @username and send you
        workouts.
      </SettingsText>
      <SettingsRow
        icon={null}
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
