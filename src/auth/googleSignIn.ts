type GoogleResponse = { type: "cancelled"; data: null } | { type: "success"; data: { idToken: string | null } };
type GoogleClient = {
  hasPlayServices: () => Promise<unknown>;
  signOut: () => Promise<unknown>;
  signIn: () => Promise<GoogleResponse>;
  getTokens: () => Promise<{ idToken: string }>;
};

export async function requestGoogleIdToken(client: GoogleClient): Promise<string> {
  await client.hasPlayServices();
  // Explicit sign-in should allow account selection, including after Firebase sign-out.
  await client.signOut();
  const response = await client.signIn();
  // Cancellation must never fall through to tokens from a previous Google session.
  if (response.type === "cancelled") throw new Error("Google sign-in was canceled.");
  // Preserve the established token path after successful Google account selection.
  const { idToken } = await client.getTokens();
  if (!idToken) throw new Error("Google sign-in did not return an ID token.");
  return idToken;
}
