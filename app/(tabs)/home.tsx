import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../src/config/firebaseConfig"; // adjust path if needed

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) router.push("/auth/sign-in");
      else {
        setUser(user);
        try {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            if (data.nickname) setNickname(data.nickname);
          }
        } catch (e) {
          console.log("Error fetching nickname:", e);
        }
      }
    });
    return unsubscribe;
  }, []);

  if (!user) return null;

  // Navigate to Settings page
  const navigateToSettings = () => {
    router.push("/settings");  // Navigate to settings page
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Left side: Greeting */}
        <View style={styles.headerLeft}>
          <Text>
            <Text style={styles.greeting}>Welcome, </Text>
            <Text style={styles.userName}>
              {nickname ? nickname : user.email?.split("@")[0]}
            </Text>
          </Text>
        </View>

        {/* Right side: Icons */}
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => router.push("../profile" as Href)}>
            <Ionicons name="person-circle-outline" size={32} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={navigateToSettings}  // Navigate to settings when gear icon is pressed
            style={{ marginLeft: 14 }}
          >
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Today’s Workout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Workout</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Get started with your next session.</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/(tabs)/workout/custom" as Href)}
              >
                <Text style={styles.primaryText}>Set Up My Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push("/(tabs)/workout/ai" as Href)}
              >
                <Text style={styles.secondaryText}>AI Suggestion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats Summary Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.statsCard}>
            <Text style={styles.statsText}>Workouts Completed: 0</Text>
            <Text style={styles.statsText}>Total Sets: 0</Text>
            <Text style={styles.statsText}>Total Weight Lifted: 0 kg</Text>
          </View>
        </View>

        {/* Motivation / Quote */}
        <View style={styles.motivationCard}>
          <Text style={styles.quote}>
            “One more rep isn’t just a number — it’s a mindset.” 💪
          </Text>
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
    fontSize: 20,
    fontWeight: "600",
  },
  userName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
  },
  cardText: {
    color: "#aaa",
    fontSize: 15,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  primaryButton: {
    backgroundColor: "#7b61ff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flex: 1,
    alignItems: "center",
    marginRight: 8,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flex: 1,
    alignItems: "center",
    marginLeft: 8,
  },
  secondaryText: {
    color: "#7b61ff",
    fontWeight: "700",
  },
  statsCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
  },
  statsText: {
    color: "#ccc",
    fontSize: 15,
    marginBottom: 6,
  },
  motivationCard: {
    marginTop: 25,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
  },
  quote: {
    color: "#fff",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
  },
});
