import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Switch, View } from "react-native";
import { Bell, BellRing, Volume2 } from "lucide-react-native";
import { auth } from "../config/firebaseConfig";
import { useNotebook } from "../ui/notebook/Notebook";
import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import { showAppAlert } from "../ui/appDialog";
import { notifyRestAlertSettingsChanged, restAlertsNative, type RestAlertsStatus } from "../workouts/workoutLog/restAlertsNative";
import { requestRestAlertPermissions } from "../workouts/workoutLog/useRestAlerts";
import { SettingsRow, SettingsSection, SettingsText } from "./SettingsNotebookControls";

/** Opening Settings must never sync an empty timer list. */
export function RestNotificationsSection({ uid }: { uid: string | null }) {
  const { colors } = useNotebook();
  const [status, setStatus] = useState<RestAlertsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ setting: "alerts" | "sound"; value: boolean } | null>(null);
  const saving = useRef(false);
  const alive = useRef(true);
  const current = useCallback(() => alive.current && !!uid && auth.currentUser?.uid === uid, [uid]);
  const refresh = useCallback(async () => {
    if (!current() || !restAlertsNative) return;
    try {
      await restAlertsNative.setOwner(uid!);
      if (!current()) return;
      const next = await restAlertsNative.status();
      if (current()) { setStatus(next); setError(null); }
    } catch { if (current()) setError("Couldn't load notification settings. Reopen Settings to try again."); }
  }, [current, uid]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(refresh);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => { alive.current = false; subscription.remove(); };
  }, [refresh]);
  const changeSetting = async (setting: "alerts" | "sound", enabled: boolean) => {
    const setter = setting === "alerts" ? restAlertsNative?.setAlertsEnabled : restAlertsNative?.setSoundEnabled;
    if (!current() || saving.current || !setter || setting === "sound" && status?.alertsEnabled === false) return;
    saving.current = true; setPending({ setting, value: enabled }); setError(null);
    try {
      await setter(uid!, enabled);
      const next = await restAlertsNative!.status();
      if (current()) { setStatus(next); notifyRestAlertSettingsChanged(); }
    } catch { if (current()) setError("Couldn't save the alert setting. Try again."); }
    finally { saving.current = false; if (current()) setPending(null); }
  };
  const openSettings = async () => {
    try { await restAlertsNative?.openNotificationSettings(); }
    catch { if (current()) setError("Couldn't open Android notification settings."); }
  };
  const request = async () => {
    try { await requestRestAlertPermissions(true); await refresh(); }
    catch { if (current()) setError("Couldn't enable rest timer alerts. Try again."); }
  };
  if (!restAlertsNative || !uid) return null;
  const alertsEnabled = pending?.setting === "alerts" ? pending.value : status?.alertsEnabled !== false;
  const soundEnabled = pending?.setting === "sound" ? pending.value : status?.soundEnabled !== false;
  const toggle = (setting: "alerts" | "sound", value: boolean, disabled = false) => <View style={{ minWidth: 64, minHeight: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : 1 }}><Switch
    accessibilityLabel={setting === "alerts" ? "Rest timer alerts" : "Rest timer sound"} value={value}
    disabled={disabled || !status || pending !== null} onValueChange={enabled => void changeSetting(setting, enabled)}
    trackColor={{ false: colors.border, true: colors.accent }} thumbColor={colors.surface}
    ios_backgroundColor={colors.border} style={{ transform: [{ scale: 1.2 }] }}
  /></View>;
  return <SettingsSection title="Notifications">
    {restAlertsNative.setAlertsEnabled ? <SettingsRow icon={<BellRing size={20} strokeWidth={1.5} color={colors.ink} />} label="Rest timer alerts"
      labelAccessory={<NotebookInfoButton label="About rest timer alerts" onPress={() => showAppAlert("Rest timer alerts", "Off keeps the countdown running without sound, vibration or notifications.")} />}
      control={toggle("alerts", alertsEnabled)} /> : null}
    <SettingsRow icon={<Volume2 size={20} strokeWidth={1.5} color={colors.ink} />} label="Rest timer sound"
      labelAccessory={<NotebookInfoButton label="About rest timer sound" onPress={() => showAppAlert("Rest timer sound", "Off mutes only the gong. Uses media volume through headphones or the speaker.")} />}
      control={restAlertsNative.setSoundEnabled ? toggle("sound", soundEnabled, !alertsEnabled) : undefined} />
    {status && alertsEnabled && !(status.notifications && status.exact) ? <SettingsRow icon={<BellRing size={20} strokeWidth={1.5} color={colors.ink} />} label="Allow rest timer alerts" onPress={() => void request()}><SettingsText>Allow notifications and Alarms &amp; reminders.</SettingsText></SettingsRow> : null}
    <SettingsRow icon={<Bell size={20} strokeWidth={1.5} color={colors.ink} />} label="Android notification settings" onPress={() => void openSettings()} />
    {error ? <SettingsText live>{error}</SettingsText> : null}
  </SettingsSection>;
}
