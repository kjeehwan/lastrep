import { describe, expect, it } from "vitest";
import { authErrorMessage, validateAuthFields } from "./authPresentation";

describe("authentication form feedback", () => {
  it("validates fields without rejecting short passwords on existing accounts", () => {
    expect(validateAuthFields("sign-in", "bad", "example")).toBe("Please enter a valid email address.");
    expect(validateAuthFields("sign-up", "demo@example.test", "")).toBe("Please enter your password.");
    expect(validateAuthFields("sign-up", "demo@example.test", "short")).toContain("6 characters");
    expect(validateAuthFields("sign-in", " demo+one@example.test ", "short")).toBeNull();
    expect(validateAuthFields("sign-up", "demo@example.test", "example123")).toBeNull();
  });
  it("explains existing-account, credential, throttling and network failures", () => {
    expect(authErrorMessage({ code: "auth/email-already-in-use" }, "sign-up", "email")).toContain("already registered");
    for (const code of ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"]) expect(authErrorMessage({ code }, "sign-in", "email")).toBe("Email or password is incorrect.");
    expect(authErrorMessage({ code: "auth/too-many-requests" }, "sign-in", "email")).toContain("Too many attempts");
    expect(authErrorMessage({ code: "auth/network-request-failed" }, "sign-in", "email")).toContain("Check your connection");
  });
  it("recognizes Google cancellation and does not expose raw provider details", () => {
    for (const message of ["SIGN_IN_CANCELLED", "user canceled", "getTokens requires a user to be signed in"]) expect(authErrorMessage({ message }, "sign-in", "google")).toBe("Google sign-in was canceled.");
    expect(authErrorMessage({ message: "Internal provider diagnostic with sensitive values" }, "sign-up", "google")).toBe("Couldn't connect with Google. Please try again.");
    expect(authErrorMessage(null, "sign-up", "email")).toContain("Sign-up failed");
  });
  it("explains Google build configuration errors without displaying provider diagnostics", () => {
    for (const error of [{ code: "10" }, { code: 10 }, { message: "DEVELOPER_ERROR: provider diagnostic" }]) expect(authErrorMessage(error, "sign-in", "google")).toBe("Google sign-in is not configured for this app. Please use email sign-in.");
  });
});
