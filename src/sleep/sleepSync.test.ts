import { beforeEach, expect, it, vi } from "vitest";
import type { SleepEntry } from "./sleepSessionModel";
import { openHealthConnectAppPermissionsScreen, openHealthConnectSettingsScreen, syncSleepFromHealthConnect } from "./sleep";
const fake = vi.hoisted(() => ({
  consent: true, permitted: true, storage: new Map<string, string>(), entries: [] as SleepEntry[],
  read: vi.fn(), changes: vi.fn(), mutate: vi.fn(), sdk: vi.fn(),
  sendIntent: vi.fn(), applicationId: "com.kjeehwan.lastrep", platform: { OS: "android", Version: 34 },
  confirm: vi.fn(),
}));
vi.mock("../ui/appDialog", () => ({ confirmAppDialog: (...args: unknown[]) => fake.confirm(...args) }));
vi.mock("react-native", () => ({ Platform: fake.platform, Linking: { sendIntent: fake.sendIntent } }));
vi.mock("expo-application", () => ({ get applicationId() { return fake.applicationId; } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async (key: string) => fake.storage.get(key) ?? null, setItem: async (key: string, value: string) => { fake.storage.set(key, value); } } }));
vi.mock("../config/firebaseConfig", () => ({ db: {} }));
vi.mock("../health/healthSyncConsent", () => ({ hasHealthSyncConsent: async () => fake.consent }));
vi.mock("./sleepJournal", () => ({ mutateSleepJournal: (...args: unknown[]) => fake.mutate(...args) }));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...await importOriginal<typeof import("firebase/firestore")>(),
  collection: () => ({}), doc: () => ({ id: "device-a" }),
  getDoc: async () => ({ data: () => ({ sleepProfile: {} }) }),
}));
vi.mock("react-native-health-connect", () => ({
  getSdkStatus: () => fake.sdk(), initialize: async () => true,
  getGrantedPermissions: async () => fake.permitted ? [{ accessType: "read", recordType: "SleepSession" }] : [],
  getChanges: (...args: unknown[]) => fake.changes(...args), readRecords: (...args: unknown[]) => fake.read(...args),
}));

const now = new Date("2026-10-17T12:00Z");
const record = { startTime: "2026-10-16T23:00Z", endTime: "2026-10-17T07:00Z", metadata: { id: "record-a", dataOrigin: "tracker" } };
const changes = (overrides = {}) => ({ upsertionChanges: [], deletionChanges: [], nextChangesToken: "cursor", changesTokenExpired: false, hasMore: false, ...overrides });
beforeEach(() => {
  vi.clearAllMocks(); fake.storage.clear(); fake.entries = []; fake.consent = true; fake.permitted = true;
  fake.platform.Version = 34; fake.applicationId = "com.kjeehwan.lastrep"; fake.sendIntent.mockResolvedValue(undefined);
  fake.confirm.mockResolvedValue(true);
  fake.sdk.mockResolvedValue(3); fake.read.mockResolvedValue({ records: [record] }); fake.changes.mockResolvedValue(changes());
  fake.mutate.mockImplementation(async (_uid: string, change: (entries: SleepEntry[]) => SleepEntry[], options: { authorize: () => Promise<void> }) => {
    await options.authorize(); fake.entries = change(fake.entries); return fake.entries;
  });
});

it.each(["com.kjeehwan.lastrep", "com.kjeehwan.lastrep.dev"])("opens app permissions for the running package %s on Android 14+", async (packageName) => {
  fake.applicationId = packageName;
  expect(await openHealthConnectAppPermissionsScreen()).toBe(true);
  expect(fake.sendIntent).toHaveBeenCalledWith("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS", [
    { key: "android.intent.extra.PACKAGE_NAME", value: packageName },
  ]);
  expect(fake.confirm).not.toHaveBeenCalled();
});
it("waits for guidance confirmation before opening general settings", async () => {
  let confirm!: (value: boolean) => void;
  fake.confirm.mockImplementation(() => new Promise<boolean>((resolve) => { confirm = resolve; }));
  const opening = openHealthConnectSettingsScreen();
  await vi.waitFor(() => expect(fake.confirm).toHaveBeenCalled());
  expect(fake.sendIntent).not.toHaveBeenCalled();
  confirm(true);
  expect(await opening).toBe(true);
  expect(fake.sendIntent).toHaveBeenCalledExactlyOnceWith("android.health.connect.action.HEALTH_HOME_SETTINGS");
});
it("keeps canceled fallback guidance in Lastrep without another navigation", async () => {
  fake.sendIntent.mockRejectedValueOnce(new Error("SecurityException"));
  fake.confirm.mockResolvedValue(false);
  expect(await openHealthConnectAppPermissionsScreen()).toBeNull();
  expect(fake.sendIntent).toHaveBeenCalledTimes(1);
});
it("opens supported provider settings on Android 13 instead of inventing an app-permission action", async () => {
  fake.platform.Version = 33;
  expect(await openHealthConnectAppPermissionsScreen()).toBe(true);
  expect(fake.sendIntent).toHaveBeenCalledWith("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
});
it("reports an unavailable permission activity instead of claiming it opened", async () => {
  fake.sendIntent.mockRejectedValue(new Error("Activity not found"));
  expect(await openHealthConnectAppPermissionsScreen()).toBe(false);
});
it("falls back to Health Connect home when app-specific management is restricted", async () => {
  fake.sendIntent.mockRejectedValueOnce(new Error("SecurityException: requires GRANT_RUNTIME_PERMISSIONS"));
  expect(await openHealthConnectAppPermissionsScreen()).toBe(true);
  expect(fake.sendIntent).toHaveBeenNthCalledWith(2, "android.health.connect.action.HEALTH_HOME_SETTINGS");
});
it.each([
  [34, "android.health.connect.action.HEALTH_HOME_SETTINGS"],
  [36, "android.health.connect.action.HEALTH_HOME_SETTINGS"],
  [33, "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"],
])("opens independent general settings on API %s", async (api, action) => {
  fake.platform.Version = api;
  expect(await openHealthConnectSettingsScreen()).toBe(true);
  expect(fake.sendIntent).toHaveBeenCalledExactlyOnceWith(action);
});
it("does not need an application ID to open the supported settings fallback", async () => {
  fake.applicationId = "";
  expect(await openHealthConnectAppPermissionsScreen()).toBe(true);
  expect(fake.sendIntent).toHaveBeenCalledExactlyOnceWith("android.health.connect.action.HEALTH_HOME_SETTINGS");
});
it("reports a failed general-settings launch", async () => {
  fake.sendIntent.mockRejectedValue(new Error("Activity not available"));
  expect(await openHealthConnectSettingsScreen()).toBe(false);
});
it("does not read or write health records without app consent", async () => {
  fake.consent = false;
  expect((await syncSleepFromHealthConnect("alice", now)).status).toBe("permission_denied");
  expect(fake.sdk).not.toHaveBeenCalled(); expect(fake.read).not.toHaveBeenCalled(); expect(fake.mutate).not.toHaveBeenCalled();
});
it("does not import without the native Sleep permission", async () => {
  fake.permitted = false;
  expect((await syncSleepFromHealthConnect("alice", now)).status).toBe("permission_denied");
  expect(fake.read).not.toHaveBeenCalled(); expect(fake.mutate).not.toHaveBeenCalled();
});
it("reads every initial page before storing a cursor and device check time", async () => {
  fake.read.mockResolvedValueOnce({ records: [record], pageToken: "page-two" }).mockResolvedValueOnce({ records: [{ ...record, metadata: { ...record.metadata, id: "record-b" } }] });
  const result = await syncSleepFromHealthConnect("alice", now);
  expect(result.status).toBe("success"); expect(fake.read).toHaveBeenCalledTimes(2); expect(fake.entries).toHaveLength(2);
  expect(fake.storage.get("sleep-changes-v1:alice:device-a")).toBe("cursor");
  expect(fake.storage.get("sleep-last-check:alice")).toBe(now.toISOString());
});
it("uses changes pages on subsequent checks and handles provider deletions", async () => {
  await syncSleepFromHealthConnect("alice", now);
  fake.changes.mockResolvedValueOnce(changes({ deletionChanges: [{ recordId: "record-a" }], hasMore: true, nextChangesToken: "next-page" })).mockResolvedValueOnce(changes({ nextChangesToken: "done" }));
  fake.read.mockClear();
  await syncSleepFromHealthConnect("alice", now);
  expect(fake.read).not.toHaveBeenCalled(); expect(fake.entries[0].providerDeleted).toBe(true);
  expect(fake.storage.get("sleep-changes-v1:alice:device-a")).toBe("done");
});
it("restarts a complete read when the changes cursor expires, retaining exclusions", async () => {
  await syncSleepFromHealthConnect("alice", now); fake.entries[0].excluded = true;
  fake.changes.mockResolvedValueOnce(changes({ changesTokenExpired: true })).mockResolvedValueOnce(changes());
  fake.read.mockClear();
  await syncSleepFromHealthConnect("alice", now);
  expect(fake.read).toHaveBeenCalledTimes(1); expect(fake.entries[0].excluded).toBe(true); expect(fake.entries).toHaveLength(1);
});
it("rechecks consent after reading and does not commit a revoked import", async () => {
  fake.read.mockImplementationOnce(async () => { fake.consent = false; return { records: [record] }; });
  expect((await syncSleepFromHealthConnect("alice", now)).status).toBe("error");
  expect(fake.entries).toEqual([]); expect(fake.storage.has("sleep-last-check:alice")).toBe(false);
});
it("a successful empty check records check time but invents no sleep session", async () => {
  fake.read.mockResolvedValueOnce({ records: [] });
  expect((await syncSleepFromHealthConnect("alice", now)).status).toBe("no_data");
  expect(fake.entries).toEqual([]); expect(fake.storage.get("sleep-last-check:alice")).toBe(now.toISOString());
});
it("shares an in-flight import instead of duplicating reads", async () => {
  const one = syncSleepFromHealthConnect("alice", now), two = syncSleepFromHealthConnect("alice", now);
  expect(one).toBe(two); await one; expect(fake.read).toHaveBeenCalledTimes(1);
});
