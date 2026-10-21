import { expect, it, vi } from "vitest";
import { manageHealthReadPermissions } from "./healthPermissionFlow";

const sleep = { accessType: "read", recordType: "SleepSession" };
const body = ["Weight", "BodyFat", "LeanBodyMass"].map((recordType) => ({ accessType: "read", recordType }));

it("requests just missing reads when sleep access is already granted", async () => {
  const client = {
    getGrantedPermissions: vi.fn().mockResolvedValueOnce([sleep]).mockResolvedValueOnce([sleep, ...body]),
    requestPermission: vi.fn().mockResolvedValue([sleep, ...body]),
  };
  const settings = vi.fn();
  expect(await manageHealthReadPermissions(client, settings)).toBe("granted");
  expect(client.requestPermission).toHaveBeenCalledWith(body);
  expect(settings).not.toHaveBeenCalled();
});

it("does not mistake unrelated or write-only grants for the requested reads", async () => {
  const client = {
    getGrantedPermissions: vi.fn().mockResolvedValue([{ accessType: "write", recordType: "Weight" }, null, { recordType: "Steps" }]),
    requestPermission: vi.fn().mockResolvedValue([]),
  };
  expect(await manageHealthReadPermissions(client, vi.fn())).toBe("incomplete");
  expect(client.requestPermission).toHaveBeenCalledWith([sleep, ...body]);
});

it.each([{ granted: [] }, { granted: [sleep] }])("leaves declined or canceled requests in Lastrep with grants $granted", async ({ granted }) => {
  const client = {
    getGrantedPermissions: vi.fn().mockResolvedValue(granted),
    requestPermission: vi.fn().mockResolvedValue(granted),
  };
  const settings = vi.fn();
  expect(await manageHealthReadPermissions(client, settings)).toBe("incomplete");
  expect(settings).not.toHaveBeenCalled();
});

it("checks actual grants again after the chooser returns", async () => {
  const client = {
    getGrantedPermissions: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([sleep]),
    requestPermission: vi.fn().mockResolvedValue([sleep, ...body]),
  };
  expect(await manageHealthReadPermissions(client, vi.fn())).toBe("incomplete");
  expect(client.getGrantedPermissions).toHaveBeenCalledTimes(2);
});

it.each([[true, "settings_opened"], [false, "unavailable"], [null, "canceled"]] as const)("reviews existing access through settings (%s)", async (opened, result) => {
  const client = {
    getGrantedPermissions: vi.fn().mockResolvedValue([sleep, ...body]),
    requestPermission: vi.fn(),
  };
  const settings = vi.fn().mockResolvedValue(opened);
  expect(await manageHealthReadPermissions(client, settings)).toBe(result);
  expect(client.requestPermission).not.toHaveBeenCalled();
  expect(settings).toHaveBeenCalledTimes(1);
});

it("surfaces a request failure without automatically opening settings", async () => {
  const client = {
    getGrantedPermissions: vi.fn().mockResolvedValue([]),
    requestPermission: vi.fn().mockRejectedValue(new Error("Chooser unavailable")),
  };
  const settings = vi.fn();
  await expect(manageHealthReadPermissions(client, settings)).rejects.toThrow("Chooser unavailable");
  expect(settings).not.toHaveBeenCalled();
});
