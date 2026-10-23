import type { Permission } from "react-native-health-connect";

export const healthReadPermissions: Permission[] = [
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "Weight" },
  { accessType: "read", recordType: "BodyFat" },
  { accessType: "read", recordType: "LeanBodyMass" },
];

type PermissionClient = {
  getGrantedPermissions: () => Promise<unknown[]>;
  requestPermission: (permissions: Permission[]) => Promise<unknown[]>;
};

function missingPermissions(granted: unknown[]): Permission[] {
  return healthReadPermissions.filter((needed) => !granted.some((item) =>
    item != null && typeof item === "object" &&
    "accessType" in item && item.accessType === needed.accessType &&
    "recordType" in item && item.recordType === needed.recordType
  ));
}

/** Called only by an explicit permissions action, never by Sync now. */
export async function manageHealthReadPermissions(
  client: PermissionClient,
  openSettings: () => Promise<boolean | null>,
): Promise<"granted" | "incomplete" | "settings_opened" | "unavailable" | "canceled"> {
  const missing = missingPermissions(await client.getGrantedPermissions());
  if (!missing.length) {
    const opened = await openSettings();
    return opened === null ? "canceled" : opened ? "settings_opened" : "unavailable";
  }
  await client.requestPermission(missing);
  // Cancellation or repeated denial must leave the user in Lastrep. Settings
  // requires another explicit tap, including when Android suppresses a prompt.
  return missingPermissions(await client.getGrantedPermissions()).length ? "incomplete" : "granted";
}
