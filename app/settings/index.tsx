import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MANAGE_SUBSCRIPTION_URL } from "../../src/config/billingConfig";
import { auth } from "../../src/config/firebaseConfig";
import { useEntitlement } from "../../src/hooks/useEntitlement";
import { getUserData } from "../../src/userData";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";
const FUNCTIONS_REGION = "asia-northeast3";

export default function SettingsIndex() {
  const router = useRouter();
  const [nickname, setNickname] = useState("You");
  const [email, setEmail] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [manageFallbackText, setManageFallbackText] = useState<string | null>(null);
  const entitlement = useEntitlement(authReady, uid);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (!user) {
        setUid(null);
        setEmail(null);
        setRedirectTo("/auth/sign-in");
        return;
      }
      setUid(user.uid);
      setRedirectTo(null);
      setEmail(user.email || null);
      (async () => {
        try {
          const data = await getUserData(user.uid);
          if (data?.nickname) setNickname(data.nickname);
        } catch (e) {
          console.log("Failed to load nickname", e);
        }
      })();
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (entitlement.state !== "active") {
      setManageFallbackText(null);
    }
  }, [entitlement.state]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/auth/sign-in");
    } catch (e) {
      console.log("Sign out error", e);
    }
  };

  const contactSupport = () => {
    Linking.openURL("mailto:kjeehwan@gmail.com?subject=Support%20request");
  };

  const handleManageSubscription = async () => {
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

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} style={styles.container} bounces>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.row}>
            <Ionicons name="person-circle-outline" size={28} color={ACCENT} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemText}>{nickname}</Text>
              {email ? <Text style={styles.subText}>{email}</Text> : null}
            </View>
            <Pressable onPress={() => router.push("/profile" as Href)}>
              <Text style={styles.linkText}>Edit</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Pressable style={styles.row} onPress={contactSupport}>
            <Ionicons name="bug-outline" size={22} color={ACCENT} />
            <Text style={[styles.itemText, { marginLeft: 10 }]}>Report a problem</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          {entitlement.state === "loading" ? (
            <Text style={styles.subText}>Checking subscription status...</Text>
          ) : entitlement.state === "active" ? (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleManageSubscription}>
                <Text style={styles.secondaryButtonText}>Manage subscription</Text>
              </TouchableOpacity>
              <Text style={styles.subText}>
                Opens Google Play. To cancel, tap Lastrep in the subscription list.
              </Text>
            </>
          ) : (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/paywall" as Href)}>
              <Text style={styles.secondaryButtonText}>Upgrade to Premium</Text>
            </TouchableOpacity>
          )}
          {manageFallbackText ? <Text style={styles.subText}>{manageFallbackText}</Text> : null}
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dev</Text>
            <Text style={styles.subText}>
              Entitlement: {entitlement.state === "active" ? "Paid" : "Free"}
            </Text>
            <View style={styles.devRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setDevEntitlement(true)}>
                <Text style={styles.secondaryButtonText}>Set Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setDevEntitlement(false)}>
                <Text style={styles.secondaryButtonText}>Set Free</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetDailyLimit}>
              <Text style={styles.secondaryButtonText}>Reset daily limit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetCooldown}>
              <Text style={styles.secondaryButtonText}>Reset cooldown</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push("/settings/revenuecat-dev" as Href)}
            >
              <Text style={styles.secondaryButtonText}>RevenueCat debug</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d1a" },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: { padding: 20, paddingTop: 56, paddingBottom: 32, gap: 14 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 4 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
    gap: 6,
  },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 6, letterSpacing: 0.2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  itemText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  subText: { color: MUTED, fontSize: 13 },
  linkText: { color: ACCENT, fontWeight: "700" },
  secondaryButton: {
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  devRow: { flexDirection: "row", gap: 12 },
});
