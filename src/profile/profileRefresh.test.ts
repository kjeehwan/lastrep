import { expect, it, vi } from "vitest";
import { runProfileRefresh, shouldRetryProfileLoad } from "./profileRefresh";

it("retries an unfinished load when the server document arrives after an early reconnect failure", () => {
  expect(shouldRetryProfileLoad(null, "alice", false, false)).toBe(true);
  expect(shouldRetryProfileLoad(null, "alice", false, true)).toBe(false);
});

it("does not reload an initialized account or overwrite an existing draft", () => {
  expect(shouldRetryProfileLoad("alice", "alice", false, false)).toBe(false);
  expect(shouldRetryProfileLoad("alice", "alice", true, false)).toBe(false);
  expect(shouldRetryProfileLoad(null, "alice", true, false)).toBe(false);
  expect(shouldRetryProfileLoad("bob", "alice", false, false)).toBe(true);
});

it("handles an offline rejection after a deferred refresh has already started", async () => {
  let rejectRead!: (error: unknown) => void;
  const read = new Promise<void>((_resolve, reject) => { rejectRead = reject; });
  const report = vi.fn();
  const refresh = runProfileRefresh(() => read, report);
  rejectRead({ code: "unavailable", message: "Failed to get document because the client is offline." });
  await expect(refresh).resolves.toBeUndefined();
  expect(report).not.toHaveBeenCalled();
});

it("reports unexpected failures without leaving an unhandled background rejection", async () => {
  const error = { code: "permission-denied" };
  const report = vi.fn();
  await expect(runProfileRefresh(async () => { throw error; }, report)).resolves.toBeUndefined();
  expect(report).toHaveBeenCalledExactlyOnceWith(error);
});

it("waits for a successful refresh without reporting an error", async () => {
  const task = vi.fn(async () => undefined);
  const report = vi.fn();
  await runProfileRefresh(task, report);
  expect(task).toHaveBeenCalledOnce();
  expect(report).not.toHaveBeenCalled();
});
