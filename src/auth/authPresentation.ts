export type AuthMode = "sign-in" | "sign-up";

export function validateAuthFields(mode: AuthMode, email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Please enter a valid email address.";
  if (!password) return "Please enter your password.";
  if (mode === "sign-up" && password.length < 6) return "Use a password with at least 6 characters.";
  return null;
}

export function authErrorMessage(error: unknown, mode: AuthMode, provider: "email" | "google"): string {
  const details = error as { code?: unknown; message?: unknown } | null;
  const code = typeof details?.code === "string" ? details.code.toLowerCase() : "";
  const message = typeof details?.message === "string" ? details.message.toLowerCase() : "";
  const text = `${code} ${message}`;
  if (/network-request-failed|network_error/.test(text)) return "Couldn't connect. Check your connection and try again.";
  if (provider === "google") {
    if (/cancelled|canceled|sign_in_cancelled|gettokens requires a user to be signed in/.test(text)) return `Google ${mode} was canceled.`;
    if (code === "10" || details?.code === 10 || text.includes("developer_error")) return "Google sign-in is not configured for this app. Please use email sign-in.";
    return "Couldn't connect with Google. Please try again.";
  }
  if (text.includes("invalid-email")) return "Please enter a valid email address.";
  if (text.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again.";
  if (mode === "sign-up") {
    if (text.includes("email-already-in-use")) return "This email is already registered. Try signing in instead.";
    if (text.includes("weak-password")) return "Use a stronger password (at least 6 characters).";
    return "Sign-up failed. Please check your details and try again.";
  }
  if (/invalid-credential|user-not-found|wrong-password/.test(text)) return "Email or password is incorrect.";
  return "Sign-in failed. Please try again.";
}
