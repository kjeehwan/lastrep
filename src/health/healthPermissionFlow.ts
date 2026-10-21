import type { Permission } from "react-native-health-connect";

const readPermissions: Permission[] = [
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "Weight" },
  { accessType: "read", recordType: "BodyFat" },
  { accessType: "read", recordType: "LeanBodyMass" },
];

type PermissionClient = {
  getGrantedPermissions: () => Promise<unknown[]>;
  requestPermission: (permissions: Permission[]) => Promise<unknown[]>;
};

function missingPermissions(granted: unknown[]): Permission[] {
  return readPermissions.filter((needed) => !granted.some((item) =>
    item != null && typeof item === "object" &&
    "accessType" in item && item.accessType === needed.accessType &&
    "recordType" in item && item.recordType === needed.recordType
  ));
}

/** Called only by an explicit permissions action, never by Sync now. */
export async function manageHealthReadPermissions(
  client: PermissionClient,
  openSettings: () => Promise<boolean>,
): Promise<"granted" | "incomplete" | "settings_opened" | "unavailable"> {
  const missing = missingPermissions(await client.getGrantedPermissions());
  if (!missing.length) return await openSettings() ? "settings_opened" : "unavailable";
  await client.requestPermission(missing);
  // Cancellation or repeated denial must leave the user in Lastrep. Settings
  // remains a separate explicit action, including when Android suppresses a prompt.
  return missingPermissions(await client.getGrantedPermissions()).length ? "incomplete" : "granted";
}
