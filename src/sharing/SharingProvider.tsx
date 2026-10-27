import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import { Inbox } from "lucide-react-native";
import { usePathname } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { NotebookProvider, useNotebook } from "../ui/notebook/Notebook";
import { notebookFonts } from "../ui/notebook/tokens";
import { SharingDialogs } from "./SharingDialogs";
import { scheduleAfterInteractions } from "../utils/scheduleAfterInteractions";
import {
  sharingCall,
  sharingError,
  type SharedWorkoutPlan,
  type SharingSettings,
} from "./sharingService";

const initial: SharingSettings = {
  enabled: false,
  username: "",
  unreadCount: 0,
  requestCount: 0,
};
type SharingContextValue = {
  uid: string | null;
  settings: SharingSettings;
  settingsError: string;
  open: (plan?: SharedWorkoutPlan) => void;
  openUsername: () => void;
  openToken: (token: string) => void;
  resumeLinkAfterSignIn: (token: string) => void;
  toggle: () => Promise<void>;
  busy: boolean;
  hint: string;
};
const SharingContext = createContext<SharingContextValue | null>(null);
export function useSharing() {
  const value = useContext(SharingContext);
  if (!value) throw Error("SharingProvider is missing");
  return value;
}
export function SharingProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null),
    [settings, setSettings] = useState(initial),
    [settingsError, setSettingsError] = useState("");
  const [screen, setScreen] = useState<
      "center" | "send" | "username" | "link" | null
    >(null),
    [plan, setPlan] = useState<SharedWorkoutPlan | null>(null),
    [token, setToken] = useState("");
  const [busy, setBusy] = useState(false),
    [hint, setHint] = useState("");
  const [dialogRevision, setDialogRevision] = useState(0);
  const currentUid = useRef<string | null>(null);
  const pendingLink = useRef<string | null>(null),
    pathname = usePathname();
  const openToken = useCallback((next: string) => {
    setDialogRevision((v) => v + 1);
    setToken(next);
    setScreen("link");
  }, []);
  useEffect(() => {
    if (!uid || pathname !== "/home" || !pendingLink.current) return;
    const pending = pendingLink.current;
    const task = scheduleAfterInteractions(() => {
      pendingLink.current = null;
      setDialogRevision((v) => v + 1);
      setToken(pending);
      setScreen("link");
    });
    return () => task.cancel();
  }, [uid, pathname]);
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        const next = user?.uid ?? null,
          changed = currentUid.current !== next;
        currentUid.current = next;
        setUid(next);
        if (changed) {
          setSettings(initial);
          setScreen(null);
          setPlan(null);
          setToken("");
          setHint("");
          setSettingsError("");
        }
      }),
    [],
  );
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "users", uid, "sharing", "settings"),
      (snap) => {
        if (currentUid.current !== uid) return;
        const data = snap.data();
        setSettings({
          enabled: data?.enabled === true,
          username: data?.username || "",
          unreadCount: Number(data?.unreadCount) || 0,
          requestCount: Number(data?.requestCount) || 0,
        });
        setSettingsError("");
      },
      () => {
        if (currentUid.current === uid)
          setSettingsError("Couldn't load sharing preferences.");
      },
    );
  }, [uid]);
  useEffect(() => {
    if (uid)
      void sharingCall("cleanup", { expectedUid: uid }).catch(() => undefined);
  }, [uid]);
  const toggle = async () => {
    if (!uid || busy) return;
    if (!settings.enabled && !settings.username) {
      setHint("Choose a username before turning sharing on.");
      return;
    }
    setBusy(true);
    setHint("");
    const owner = uid;
    try {
      const next = await sharingCall<SharingSettings>("enabled", {
        enabled: !settings.enabled,
        expectedUid: owner,
      });
      if (currentUid.current === owner) setSettings(next);
    } catch (e) {
      if (currentUid.current === owner) setHint(sharingError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SharingContext.Provider
      value={{
        uid,
        settings,
        settingsError,
        busy,
        hint,
        toggle,
        resumeLinkAfterSignIn: (next) => {
          pendingLink.current = next;
        },
        open: (next) => {
          setDialogRevision((v) => v + 1);
          setPlan(next ?? null);
          setScreen(next ? "send" : "center");
        },
        openUsername: () => {
          setDialogRevision((v) => v + 1);
          setScreen("username");
        },
        openToken,
      }}
    >
      {children}
      {screen && (
        <NotebookProvider>
          <SharingDialogs
            key={`${uid}:${screen}:${dialogRevision}`}
            uid={uid}
            screen={screen}
            initialPlan={plan}
            token={token}
            username={settings.username}
            enabled={settings.enabled}
            unreadCount={settings.unreadCount}
            requestCount={settings.requestCount}
            onSignInRequested={() => {
              pendingLink.current = token;
            }}
            onUsernameSaved={(value) => {
              setSettings((s) => ({ ...s, username: value }));
              setHint("");
              setScreen(null);
            }}
            onClose={() => setScreen(null)}
          />
        </NotebookProvider>
      )}
    </SharingContext.Provider>
  );
}
export function SharingInboxButton() {
  const { colors } = useNotebook(),
    sharing = useSharing(),
    count = sharing.settings.unreadCount + sharing.settings.requestCount;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Workout sharing${count > 0 ? `, ${count} new` : ""}`}
      onPress={() => sharing.open()}
      style={{
        minWidth: 44,
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Inbox color={colors.ink} size={22} strokeWidth={1.5} />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: colors.primary,
          }}
        >
          <Text
            style={{
              color: colors.onPrimary,
              fontFamily: notebookFonts.semibold,
              fontSize: 12,
            }}
          >
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
