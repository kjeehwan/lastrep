import { SharingSettingsSection } from "../../../src/sharing/SharingSettingsSection";
import { UserRound, Mail, FileText, CreditCard, Crown, RotateCcw, LogOut, Trash2, Palette, Sun, Moon, Monitor, Check, X, CalendarDays, TimerReset, Bug, ShieldCheck } from "lucide-react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { doc, onSnapshot } from "firebase/firestore";
import { NotebookProvider, useNotebook } from "../../../src/ui/notebook/Notebook";
import { NotebookModal } from "../../../src/ui/notebook/NotebookModal";
import { AdaptiveModalCard } from "../../../src/ui/AdaptiveModalCard";
import { PopupBackdrop } from "../../../src/ui/PopupBackdrop";
import { NotebookHeader } from "../../../src/ui/notebook/NotebookHeader";
import { useNotebookStatusBar } from "../../../src/ui/notebook/useNotebookStatusBar";
import { notebookFonts } from "../../../src/ui/notebook/tokens";
import { SettingsSection, SettingsRow, SettingsText, SettingsVersionIcon } from "../../../src/settings/SettingsNotebookControls";
import { formatInstalledVersion, settingsAccessLabel } from "../../../src/settings/settingsPresentation";
import { useOfflineStatus } from "../../../src/hooks/useOfflineStatus";
import { isExpectedOfflineError } from "../../../src/utils/networkErrors";
import { Href, Redirect, useFocusEffect, useNavigation, useRouter } from "expo-router";
import type { NavigationProp } from "@react-navigation/native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useAppTheme } from "../../../src/theme/AppThemeProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUidPrefix, logAnalyticsEvent } from "../../../src/analytics/analytics";
import { MANAGE_SUBSCRIPTION_URL } from "../../../src/config/billingConfig";
import { auth, db } from "../../../src/config/firebaseConfig";
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from "../../../src/config/legalConfig";
import { useEntitlement } from "../../../src/hooks/useEntitlement";
import { showAppDialog } from "../../../src/ui/appDialog";
import { clearProfilePhotoCache } from "../../../src/profile/profilePhotos";
import { clearDailySteps } from "../../../src/health/dailySteps";
import { clearHealthSyncConsent } from "../../../src/health/healthSyncConsent";
import { isDevBillingBuild } from "../../../src/billing/revenuecat";
import { usePurchaseRestore } from "../../../src/billing/usePurchaseRestore";
import { returnFromSettingsToHome } from "../../../src/navigation/settingsNavigation";

const FUNCTIONS_REGION = "asia-northeast3";

export default function SettingsIndex() {
  return <NotebookProvider><SettingsContent /></NotebookProvider>;
}
function SettingsContent() {
  useNotebookStatusBar();
  const { colors } = useNotebook();
  const appearance = useAppTheme();
  const [showAppearance, setShowAppearance] = useState(false);
  const { isOffline, ready: networkReady } = useOfflineStatus();
  const nativeMetadata = requireOptionalNativeModule<{ nativeApplicationVersion?: string; nativeBuildVersion?: string }>("ExpoApplication");
  const installedVersion = formatInstalledVersion(nativeMetadata?.nativeApplicationVersion, nativeMetadata?.nativeBuildVersion);
  const [account, setAccount] = useState<{ uid: string; nickname: string } | null>(null);
  const [accountLoadFailed, setAccountLoadFailed] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const accountOperationRef = useRef(false);
  const router = useRouter();
  const navigation = useNavigation<NavigationProp<{ home: undefined }>>();
  const [email, setEmail] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [manageFallbackText, setManageFallbackText] = useState<string | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const entitlement = useEntitlement(authReady, uid);
  const devBillingBuild = __DEV__ || isDevBillingBuild();
  const { restore: handleRestorePurchases, restoring, feedback: restoreFeedback } = usePurchaseRestore(uid, devBillingBuild, { sourceScreen: "settings" });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      setAccount(null);
      setAccountLoadFailed(false);
      if (!user) {
        setUid(null);
        setEmail(null);
        setRedirectTo("/auth/sign-in");
        return;
      }
      setUid(user.uid);
      setRedirectTo(null);
      setEmail(user.email || null);

    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snapshot) => {
      const data = snapshot.data();
      if (!data) { setAccountLoadFailed(true); return; }
      setAccount({ uid, nickname: typeof data.nickname === "string" && data.nickname.trim() ? data.nickname.trim() : "Your account" });
      setAccountLoadFailed(false);
    }, (error) => {
      setAccountLoadFailed(true);
      if (!isExpectedOfflineError(error)) console.log("Could not load Settings account", error);
    });
  }, [uid]);

  const accountLoaded = account?.uid === uid && !!uid;
  const nickname = accountLoaded ? account!.nickname : accountLoadFailed ? "Profile not loaded" : "Loading account...";
  const accessLabel = settingsAccessLabel(accountLoaded, entitlement.state);
  const busy = deletingAccount || signingOut;
  const accountDisabled = busy || !uid || !networkReady || isOffline;

  const handleSignOut = () => {
    if (accountDisabled || accountOperationRef.current) return;
    showAppDialog({
      title: "Sign out?",
      message: "You can sign back in to access your saved account data.",
      buttonLayout: "vertical",
      buttons: [
        { text: "Sign out", onPress: () => {
          if (auth.currentUser?.uid !== uid || accountOperationRef.current) return;
          accountOperationRef.current = true;
          setSigningOut(true); setSessionFeedback(null);
          void (async () => {
            try {
              await signOut(auth);
              if (uid) await clearProfilePhotoCache(uid).catch(() => undefined);
              router.replace("/auth/sign-in");
            } catch (error) {
              console.log("Sign out error", error);
              setSessionFeedback("Could not sign out. Please try again.");
            } finally { accountOperationRef.current = false; setSigningOut(false); }
          })();
        } },
        { text: "Stay signed in", role: "cancel" },
      ],
    });
  };

  const contactSupport = async () => {
    const subject = encodeURIComponent("Lastrep support request");
    const body = encodeURIComponent(`Describe what happened:\n\nApp version: ${installedVersion}`);
    try { await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`); }
    catch { showAppDialog({ title: "Contact support", message: `Email ${SUPPORT_EMAIL}. Include the app version from Settings > Support and a description of the problem.`, buttons: [{ text: "OK", role: "cancel" }] }); }
  };

  const openPrivacyPolicy = async () => {
    try {
      const canOpen = await Linking.canOpenURL(PRIVACY_POLICY_URL);
      if (!canOpen) throw new Error("cannot_open_url");
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      showAppDialog({
        title: "Couldn't open privacy policy",
        message: "Please try again when you have an internet connection.",
        buttons: [{ text: "OK", role: "cancel" }],
      });
    }
  };

  const handleGoBack = useCallback(() => {
    if (!accountOperationRef.current) returnFromSettingsToHome(navigation);
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleGoBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleGoBack]));

  const handleManageSubscription = async () => {
    void logAnalyticsEvent("manage_subscription_tapped", {
      source_screen: "settings",
      entitlement_state: entitlement.state,
      uid_prefix: getUidPrefix(uid),
    });

    try {
      const canOpen = await Linking.canOpenURL(MANAGE_SUBSCRIPTION_URL);
      if (!canOpen) {
        throw new Error("cannot_open_url");
      }
      await Linking.openURL(MANAGE_SUBSCRIPTION_URL);
      setManageFallbackText(null);
    } catch {
      setManageFallbackText(
        "Opens Google Play. To cancel, tap Lastrep in the subscription list."
      );
    }
  };

  const setDevEntitlement = async (nextValue: boolean) => {
    try {
      const callable = httpsCallable<{ isSubscribed: boolean }, { ok: boolean }>(
        getFunctions(undefined, FUNCTIONS_REGION),
        "setDevEntitlementOverride"
      );
      await callable({ isSubscribed: nextValue });
    } catch (e) {
      console.log("Failed to update entitlement", e);
    }
  };

  const resetDailyLimit = async () => {
    try {
      const callable = httpsCallable<Record<string, never>, { ok: boolean }>(
        getFunctions(undefined, FUNCTIONS_REGION),
        "resetDailyLimit"
      );
      await callable({});
    } catch (e) {
      console.log("Failed to reset daily limit", e);
    }
  };

  const resetCooldown = async () => {
    try {
      const callable = httpsCallable<Record<string, never>, { ok: boolean }>(
        getFunctions(undefined, FUNCTIONS_REGION),
        "resetCooldown"
      );
      await callable({});
    } catch (e) {
      console.log("Failed to reset cooldown", e);
    }
  };

  const handleDeleteAccount = () => {
    if (accountDisabled || accountOperationRef.current) return;
    showAppDialog({
      title: "Delete account?",
      message: "This permanently deletes your Lastrep account and associated app data. It does not automatically cancel a Google Play subscription. Manage subscriptions in Google Play separately.",
      buttonLayout: "vertical",
      buttons: [
        { text: "Keep account", role: "cancel" },
        {
          text: "Delete account",
          role: "destructive",
          onPress: async () => {
            if (auth.currentUser?.uid !== uid || accountOperationRef.current) return;
            accountOperationRef.current = true;
            setDeleteFeedback(null);
            setDeletingAccount(true);
            try {
              const callable = httpsCallable<{ confirmDelete: true }, { ok: boolean }>(
                getFunctions(undefined, FUNCTIONS_REGION),
                "deleteMyAccount"
              );
              await callable({ confirmDelete: true });
              if (uid) await clearProfilePhotoCache(uid).catch(() => undefined);
              if (uid) await Promise.all([clearDailySteps(uid), clearHealthSyncConsent(uid)]).catch(() => undefined);
              setDeleteFeedback("Account deleted.");
              router.replace("/auth/sign-in");
            } catch (e) {
              console.log("Failed to delete account", e);
              setDeleteFeedback("Could not delete account. Please try again.");
            } finally {
              accountOperationRef.current = false;
              setDeletingAccount(false);
            }
          },
        },
      ],
    });
  };

  if (redirectTo) return <Redirect href={redirectTo} />;

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "left", "right"]}>
    <NotebookHeader title="Settings" onBack={handleGoBack} />
    <ScrollView pointerEvents={busy ? "none" : "auto"} contentContainerStyle={{ width: "100%", maxWidth: 800, alignSelf: "center", padding: 20, paddingBottom: 56, gap: 28 }}>
      {isOffline ? <SettingsText live>Offline. Store and account operations need a connection. Saved details remain visible.</SettingsText> : null}
      <SettingsSection first title="Account">
        <SettingsRow strong icon={<UserRound size={20} strokeWidth={1.5} color={colors.ink} />} label={nickname}>
          <View style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ fontFamily: notebookFonts.semibold, fontSize: 13, color: colors.ink }}>{accessLabel}</Text></View>
          {email ? <SettingsText>{email}</SettingsText> : null}
          {!accountLoaded && accountLoadFailed ? <SettingsText live>Saved profile details are unavailable. They will update when the connection returns.</SettingsText> : null}
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Appearance">
        <SettingsRow icon={<Palette size={20} strokeWidth={1.5} color={colors.ink} />} label="Appearance" value={appearance.preference[0].toUpperCase() + appearance.preference.slice(1)} disabled={appearance.saving || busy} onPress={() => setShowAppearance(true)} />
        {!showAppearance && appearance.feedback ? <SettingsText live>{appearance.feedback}</SettingsText> : null}
      </SettingsSection>
      <SharingSettingsSection />
      <SettingsSection title="Support">
        <SettingsRow icon={<Mail size={20} strokeWidth={1.5} color={colors.ink} />} label="Report a problem" onPress={() => void contactSupport()} />
        <SettingsRow icon={<SettingsVersionIcon />} label="App version" value={installedVersion} />
      </SettingsSection>
      <SettingsSection title="Legal">
        <SettingsRow icon={<FileText size={20} strokeWidth={1.5} color={colors.ink} />} label="Privacy policy" onPress={() => void openPrivacyPolicy()} />
      </SettingsSection>
      <SettingsSection title="Subscription">
        {entitlement.state === "loading" || !accountLoaded ? <SettingsRow icon={<CreditCard size={20} strokeWidth={1.5} color={colors.ink} />} label="Subscription status"><SettingsText>Checking subscription status...</SettingsText></SettingsRow> : devBillingBuild ? <SettingsRow icon={<CreditCard size={20} strokeWidth={1.5} color={colors.ink} />} label="Billing unavailable">
          <SettingsText>Use the Play-installed app to test subscriptions.</SettingsText>
          {entitlement.state === "active" ? <SettingsText>Premium access does not necessarily mean you have a paid Google Play subscription.</SettingsText> : null}
        </SettingsRow> : <>
          <SettingsRow icon={<Crown size={20} strokeWidth={1.5} color={colors.ink} />} label="Access" value={accessLabel}>
            <SettingsText>{entitlement.state === "active" ? "Premium access does not necessarily mean you have a paid Google Play subscription. Manage subscriptions in Google Play." : "View Premium options or restore an existing subscription."}</SettingsText>
          </SettingsRow>
          {entitlement.state === "active" ? <>
            <SettingsRow icon={<CreditCard size={20} strokeWidth={1.5} color={colors.ink} />} label="Manage subscription" disabled={accountDisabled || restoring} onPress={() => void handleManageSubscription()}>
              <SettingsText>Opens Google Play. To cancel, tap Lastrep in the subscription list.</SettingsText>
            </SettingsRow>
          </> : <SettingsRow icon={<Crown size={20} strokeWidth={1.5} color={colors.ink} />} label="Upgrade to Premium" disabled={accountDisabled || restoring} onPress={() => router.push({ pathname: "/paywall", params: { sourceScreen: "settings", reasonCode: "manual_upgrade" } })} />}
          {manageFallbackText ? <SettingsText live>{manageFallbackText}</SettingsText> : null}
          <SettingsRow icon={<RotateCcw size={20} strokeWidth={1.5} color={colors.ink} />} label={restoring ? "Checking purchases..." : "Restore purchases"} disabled={accountDisabled || restoring} onPress={() => void handleRestorePurchases()} />
        </>}
        {restoreFeedback ? <SettingsText live>{restoreFeedback}</SettingsText> : null}
      </SettingsSection>
      <SettingsSection title="Session">
        <SettingsRow icon={<LogOut size={20} strokeWidth={1.5} color={colors.ink} />} label={signingOut ? "Signing out..." : "Sign out"} disabled={accountDisabled || restoring} onPress={handleSignOut} />
        {sessionFeedback ? <SettingsText live>{sessionFeedback}</SettingsText> : null}
      </SettingsSection>
      <SettingsSection title="Delete account">
        <SettingsRow icon={<Trash2 size={20} strokeWidth={1.5} color={colors.danger} />} label={deletingAccount ? "Deleting account..." : "Delete account"} destructive disabled={accountDisabled || restoring} onPress={handleDeleteAccount}>
          <SettingsText>Permanently deletes your account and associated Lastrep data.</SettingsText>
        </SettingsRow>
        {deleteFeedback ? <SettingsText live>{deleteFeedback}</SettingsText> : null}
      </SettingsSection>
      {__DEV__ ? <SettingsSection title="Development tools">
        <SettingsRow icon={<ShieldCheck size={20} strokeWidth={1.5} color={colors.ink} />} label="Access" value={accessLabel} />
        <SettingsRow icon={<Crown size={20} strokeWidth={1.5} color={colors.ink} />} label="Set Premium" disabled={accountDisabled} onPress={() => void setDevEntitlement(true)} />
        <SettingsRow icon={<UserRound size={20} strokeWidth={1.5} color={colors.ink} />} label="Set Free" disabled={accountDisabled} onPress={() => void setDevEntitlement(false)} />
        <SettingsRow icon={<CalendarDays size={20} strokeWidth={1.5} color={colors.ink} />} label="Reset daily limit" disabled={accountDisabled} onPress={() => void resetDailyLimit()} />
        <SettingsRow icon={<TimerReset size={20} strokeWidth={1.5} color={colors.ink} />} label="Reset cooldown" disabled={accountDisabled} onPress={() => void resetCooldown()} />
        <SettingsRow icon={<Bug size={20} strokeWidth={1.5} color={colors.ink} />} label="RevenueCat debug" disabled={busy} onPress={() => router.push("/settings/revenuecat-dev" as Href)} />
      </SettingsSection> : null}
    </ScrollView>
    <NotebookModal visible={showAppearance} transparent animationType="fade" onRequestClose={() => setShowAppearance(false)}>
      <PopupBackdrop onClose={() => setShowAppearance(false)} style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: colors.overlay }}>
        <AdaptiveModalCard contentSized style={{ width: "100%", maxWidth: 560, padding: 20, gap: 16, backgroundColor: colors.surface, borderRadius: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text accessibilityRole="header" style={{ flex: 1, color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 24 }}>Appearance</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close appearance" onPress={() => setShowAppearance(false)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><X size={20} strokeWidth={1.5} color={colors.muted} /></Pressable>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Appearance">
            {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]] as const).map(([value, label, Icon]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: appearance.preference === value, disabled: appearance.saving }} disabled={appearance.saving} onPress={() => void appearance.setPreference(value)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 12, opacity: appearance.saving ? 0.5 : 1 }}>
              <View style={{ width: 24, alignItems: "center" }}><Icon size={20} strokeWidth={1.5} color={colors.ink} /></View>
              <Text style={{ flex: 1, color: colors.ink, fontFamily: appearance.preference === value ? notebookFonts.semibold : notebookFonts.body, fontSize: 18 }}>{label}</Text>
              <View style={{ width: 44, alignItems: "center" }}>{appearance.preference === value ? <Check size={20} strokeWidth={1.5} color={colors.accent} /> : null}</View>
            </Pressable>)}
          </View>
          {appearance.feedback ? <SettingsText live>{appearance.feedback}</SettingsText> : null}
        </AdaptiveModalCard>
      </PopupBackdrop>
    </NotebookModal>
  </SafeAreaView>;
}
