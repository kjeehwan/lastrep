import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = readFileSync("app/(tabs)/settings/index.tsx", "utf8");

it("shares appearance across navigation, notebook screens and dialogs without changing route keys", () => {
  const root = readFileSync("app/_layout.tsx", "utf8");
  expect(root).toContain('<AppThemeProvider><RootContent /></AppThemeProvider>');
  expect(root).not.toContain('key={colorScheme}');
  expect(readFileSync("src/ui/notebook/Notebook.tsx", "utf8")).toContain('useAppTheme().colorScheme');
  expect(readFileSync("app/(tabs)/_layout.tsx", "utf8")).toContain('from "../../hooks/use-color-scheme"');
  expect(source).toContain('accessibilityRole="radiogroup" accessibilityLabel="Appearance"');
  expect(source).toContain('appearance.setPreference(value)');
  expect(source).not.toContain('You can find this in Settings > Support.');
});

it("retains native billing authority, restore cancellation and explicit external handoffs", () => {
  expect(source).toContain('usePurchaseRestore(uid, devBillingBuild, { sourceScreen: "settings" })');
  expect(source).toContain('entitlement.state === "loading" || !accountLoaded');
  expect(source).toContain('devBillingBuild ?');
  expect(source).toContain('disabled={accountDisabled || restoring} onPress={() => void handleRestorePurchases()}');
  for (const value of ["MANAGE_SUBSCRIPTION_URL", "PRIVACY_POLICY_URL", "SUPPORT_EMAIL", 'sourceScreen: "settings", reasonCode: "manual_upgrade"']) expect(source).toContain(value);
  expect(source).not.toContain('Your Google Play subscription is active.');
  expect(source).not.toContain('expoConfig.version');
});

it("requires explicit confirmed account operations and preserves the existing deletion endpoint", () => {
  expect(source).toContain('title: "Sign out?"');
  expect(source).toContain('text: "Stay signed in", role: "cancel"');
  expect(source).toContain('text: "Keep account", role: "cancel"');
  expect(source).toContain('It does not automatically cancel a Google Play subscription.');
  expect(source).toContain('await callable({ confirmDelete: true })');
  expect(source).toContain('auth.currentUser?.uid !== uid || accountOperationRef.current');
  expect(source).toContain('if (accountDisabled || accountOperationRef.current) return;');
  expect(source).toContain('await clearProfilePhotoCache(uid).catch(() => undefined)');
  expect(source).toContain('if (!accountOperationRef.current) returnFromSettingsToHome(navigation)');
});

it("subscribes to account updates and scopes loaded identity to the authenticated account", () => {
  expect(source).toContain('return onSnapshot(doc(db, "users", uid)');
  expect(source).toContain('setAccount(null)');
  expect(source).toContain('account?.uid === uid && !!uid');
  expect(source).toContain('if (!isExpectedOfflineError(error))');
  expect(source).not.toContain('getUserData');
  expect(source).not.toContain('pathname: "/profile"');
});
