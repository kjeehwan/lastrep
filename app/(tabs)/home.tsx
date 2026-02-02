import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../src/config/firebaseConfig";

// Phase 2A: Minimal Daily Decision hub (no analytics, no plan builder)
export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRedirectTo("/auth/sign-in");
        return;
      }
      setRedirectTo(null);
      setUserEmail(user.email || null);
    });
    return unsub;
  }, []);

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Daily Decision</Text>
          <Text style={styles.userName}>{userEmail ?? "Lifter"}</Text>
        </View>
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => router.push("/settings" as Href)} style={{ marginLeft: 12 }}>
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's decision</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Inputs + recommendation will live here.</Text>
            <TouchableOpacity style={styles.primaryButtonWide} onPress={() => { /* stubbed for Phase 2A */ }}>
              <Text style={styles.primaryText}>Get today's decision (stub)</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>Free: 3 total, 1/day. Paid: 3/day with cooldown (coming soon).</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Train</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Log a full session without templates or history browsing.</Text>
            <TouchableOpacity
              style={styles.primaryButtonWide}
              onPress={() => router.push("/(tabs)/workout/log" as Href)}
            >
              <Text style={styles.primaryText}>Start workout log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButtonWide} disabled>
              <Text style={styles.secondaryText}>Repeat recent workout (soon)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerLeft: {
    flexShrink: 1,
  },
  greeting: {
    color: "#ccc",
    fontSize: 18,
    fontWeight: "700",
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  cardText: { color: "#aaa", fontSize: 15 },
  helpText: { color: "#7f86a6", fontSize: 13, marginTop: 4 },
  primaryButtonWide: {
    backgroundColor: "#7b61ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButtonWide: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { color: "#9aa1c3", fontWeight: "700" },
});
