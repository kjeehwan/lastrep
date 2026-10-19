import { useRef, useState } from "react";
import { Keyboard } from "react-native";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { authErrorMessage, type AuthMode } from "./authPresentation";

/** One lock covers both providers and remains held through session finalization. */
export function useAuthRequest(mode: AuthMode) {
  const lock = useRef(false);
  const [active, setActive] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isOffline } = useOfflineStatus();
  const run = async (provider: "email" | "google", action: () => Promise<void>, validation?: string | null) => {
    if (lock.current) return;
    if (validation) { setError(validation); return; }
    if (isOffline) { setError("You are offline. Reconnect and try again."); return; }
    lock.current = true;
    setActive(provider); setError(null); Keyboard.dismiss();
    try { await action(); }
    catch (failure) { setError(authErrorMessage(failure, mode, provider)); }
    finally { lock.current = false; setActive(null); }
  };
  return { active, error, setError, run };
}
