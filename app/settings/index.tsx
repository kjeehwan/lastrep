import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../src/config/firebaseConfig";
import { getDateStringFromOffset } from "../../src/decisionGate";
import { getUserData } from "../../src/userData";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";

export default function SettingsIndex() {
  const router = useRouter();
  const [nickname, setNickname] = useState("You");
  const [email, setEmail] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [tzOffsetMinutes, setTzOffsetMinutes] = useState<number>(new Date().getTimezoneOffset());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRedirectTo("/auth/sign-in");
        return;
      }
      setUid(user.uid);
      setEmail(user.email || null);
      (async () => {
        try {
          const data = await getUserData(user.uid);
          if (data?.nickname) setNickname(data.nickname);
          if (typeof data?.entitlement?.isSubscribed === "boolean") {
            setIsSubscribed(data.entitlement.isSubscribed);
          }
          if (typeof data?.usage?.decisions?.tzOffsetMinutes === "number") {
            setTzOffsetMinutes(data.usage.decisions.tzOffsetMinutes);
          }
        } catch (e) {
          console.log("Failed to load nickname", e);
        }
      })();
    });
    return unsub;
  }, []);

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

  const setDevEntitlement = async (nextValue: boolean) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, "users", uid), { entitlement: { isSubscribed: nextValue } }, { merge: true });
      setIsSubscribed(nextValue);
    } catch (e) {
      console.log("Failed to update entitlement", e);
    }
  };

  const resetCooldown = async () => {
    if (!uid) return;
    try {
      await setDoc(
        doc(db, "users", uid),
        { usage: { decisions: { lastDecisionAt: null } } },
        { merge: true }
      );
    } catch (e) {
      console.log("Failed to reset cooldown", e);
    }
  };

  const resetDailyLimit = async () => {
    if (!uid) return;
    try {
      const today = getDateStringFromOffset(new Date(), tzOffsetMinutes);
      await setDoc(
        doc(db, "users", uid),
        { usage: { decisions: { dailyCount: 0, dailyDate: today } } },
        { merge: true }
      );
    } catch (e) {
      console.log("Failed to reset daily limit", e);
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
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dev</Text>
            <Text style={styles.subText}>Entitlement: {isSubscribed ? "Paid" : "Free"}</Text>
            <View style={styles.devRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setDevEntitlement(true)}>
                <Text style={styles.secondaryButtonText}>Set Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setDevEntitlement(false)}>
                <Text style={styles.secondaryButtonText}>Set Free</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetCooldown}>
              <Text style={styles.secondaryButtonText}>Reset cooldown</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetDailyLimit}>
              <Text style={styles.secondaryButtonText}>Reset daily limit</Text>
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
