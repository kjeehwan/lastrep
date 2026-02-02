import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth } from "../../../src/config/firebaseConfig";
import { getUserData, saveUserData } from "../../../src/userData";

const goals = [
  { key: "buildMuscle", label: "Build Muscle" },
  { key: "loseFat", label: "Lose Fat" },
  { key: "getStronger", label: "Get Stronger" },
  { key: "improveFitness", label: "Improve Fitness" },
];

// Phase 2A: keep only nickname + goal for prompts; remove body metrics
export default function ProfileIndex() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("");
  const [nickname, setNickname] = useState("");
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRedirectTo("/auth/sign-in");
        return;
      }
      setUid(user.uid);
      try {
        const data = await getUserData(user.uid);
        if (data?.goal) setGoal(data.goal);
        if (data?.nickname) setNickname(data.nickname);
      } catch (e) {
        console.log("Error fetching user data", e);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const save = async () => {
    if (!uid) return;
    await saveUserData(uid, { goal, nickname }, true);
    router.push("/home" as Href);
  };

  if (redirectTo) return <Redirect href={redirectTo} />;
  if (loading) return <Text style={{ color: "#fff", padding: 20 }}>Loading...</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.sectionTitle}>Nickname</Text>
      <TextInput
        placeholder="Your nickname"
        placeholderTextColor="#7a7a8c"
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
      />

      <Text style={styles.sectionTitle}>Goal</Text>
      <View style={styles.row}>
        {goals.map((g) => (
          <TouchableOpacity
            key={g.key}
            onPress={() => setGoal(g.key)}
            style={[styles.chip, goal === g.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, goal === g.key && styles.chipTextActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.save} onPress={save}>
        <Text style={styles.saveText}>Save Changes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a", padding: 20, paddingTop: 56 },
  scrollContent: { paddingBottom: 80, gap: 10 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 10 },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  chipActive: { backgroundColor: "#fff", borderColor: "#7b61ff" },
  chipText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },
  chipTextActive: { color: "#4a90e2", fontWeight: "700", fontSize: 13.5 },
  save: { backgroundColor: "#7b61ff", borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 22 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
