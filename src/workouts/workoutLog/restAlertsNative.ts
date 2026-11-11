import { NativeModules, Platform } from "react-native";

export type RestAlertsStatus = { notifications: boolean; exact: boolean; soundPolicy?: "media"; soundEnabled?: boolean; alertsEnabled?: boolean };
type NativeRestAlerts = {
  setOwner(owner: string): Promise<void>;
  status(): Promise<RestAlertsStatus>;
  setSoundEnabled?(owner: string, enabled: boolean): Promise<void>;
  setAlertsEnabled?(owner: string, enabled: boolean): Promise<void>;
  sync(owner: string, entries: string): Promise<void>;
  start(owner: string, id: string, deadline: number, name: string): Promise<void>;
  cancel(owner: string, id: string): Promise<void>;
  clear(owner: string): Promise<void>;
  finish(owner: string, id: string, deadline: number): Promise<boolean>;
  openExactSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
};
export const restAlertsNative: NativeRestAlerts | undefined = Platform.OS === "android" ? NativeModules.WorkoutRestAlerts : undefined;
export async function setRestAlertOwner(uid: string | null) { await restAlertsNative?.setOwner(uid ?? ""); }

// Preferences/permissions can change in Settings while a workout stays mounted.
const settingsListeners = new Set<() => void>();
export function notifyRestAlertSettingsChanged() { settingsListeners.forEach(listener => listener()); }
export function subscribeRestAlertSettings(listener: () => void) {
  settingsListeners.add(listener);
  return () => { settingsListeners.delete(listener); };
}
