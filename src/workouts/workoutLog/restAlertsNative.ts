import { NativeModules, Platform } from "react-native";

export type RestAlertsStatus = { notifications: boolean; exact: boolean };
type NativeRestAlerts = {
  setOwner(owner: string): Promise<void>;
  status(): Promise<RestAlertsStatus>;
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
