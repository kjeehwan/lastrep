import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../src/config/firebaseConfig";
import { getUserData } from "../../src/userData";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";

export default function SettingsIndex() {
  const router = useRouter();
  const [nickname, setNickname] = useState("You");
  const [email, setEmail] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRedirectTo("/auth/sign-in");
        return;
      }
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
});
