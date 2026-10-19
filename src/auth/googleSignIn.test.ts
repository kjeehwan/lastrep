import { expect, it, vi } from "vitest";
import { requestGoogleIdToken } from "./googleSignIn";

it("stops cancellation before requesting cached Google tokens", async () => {
  const client = { hasPlayServices: vi.fn(async () => true), signOut: vi.fn(async () => null), signIn: vi.fn(async () => ({ type: "cancelled" as const, data: null })), getTokens: vi.fn(async () => ({ idToken: "previous-session-fixture" })) };
  await expect(requestGoogleIdToken(client)).rejects.toThrow("was canceled");
  expect(client.getTokens).not.toHaveBeenCalled();
});
it("preserves the pre-migration getTokens path after a successful account selection", async () => {
  let token: string | null = "selected-session-fixture";
  const client = { hasPlayServices: async () => true, signOut: async () => null, signIn: async () => ({ type: "success" as const, data: { idToken: token } }), getTokens: vi.fn(async () => ({ idToken: "fallback-fixture" })) };
  await expect(requestGoogleIdToken(client)).resolves.toBe("fallback-fixture");
  expect(client.getTokens).toHaveBeenCalledOnce();
  token = null;
  await expect(requestGoogleIdToken(client)).resolves.toBe("fallback-fixture");
  expect(client.getTokens).toHaveBeenCalledTimes(2);
});
it("propagates unavailable Play Services and rejects an empty token", async () => {
  const signIn = vi.fn(async () => ({ type: "success" as const, data: { idToken: null } }));
  const client = { hasPlayServices: async (): Promise<void> => { throw Error("unavailable"); }, signOut: async () => null, signIn, getTokens: async () => ({ idToken: "" }) };
  await expect(requestGoogleIdToken(client)).rejects.toThrow("unavailable");
  expect(signIn).not.toHaveBeenCalled();
  client.hasPlayServices = async () => {};
  await expect(requestGoogleIdToken(client)).rejects.toThrow("did not return");
});

it("clears the previous Google selection before opening a new sign-in", async () => {
  const steps: string[] = [];
  const client = {
    hasPlayServices: async () => { steps.push("services"); },
    signOut: async () => { steps.push("clear-selection"); },
    signIn: async () => { steps.push("chooser"); return { type: "success" as const, data: { idToken: null } }; },
    getTokens: async () => { steps.push("tokens"); return { idToken: "chosen-account-fixture" }; },
  };
  await expect(requestGoogleIdToken(client)).resolves.toBe("chosen-account-fixture");
  expect(steps).toEqual(["services", "clear-selection", "chooser", "tokens"]);
  client.signOut = async () => { throw Error("could not clear selection"); };
  steps.length = 0;
  await expect(requestGoogleIdToken(client)).rejects.toThrow("could not clear selection");
  expect(steps).toEqual(["services"]);
});
