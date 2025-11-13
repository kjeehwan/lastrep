import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth"; // Import Firebase Auth
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserData, saveUserData } from "../../../src/userData"; // Correct import path

// Goal options with emojis
const goals = [
  { key: "buildMuscle", label: "Build Muscle 💪" },
  { key: "loseFat", label: "Lose Fat 🔥" },
  { key: "getStronger", label: "Get Stronger 🦾" },
  { key: "improveFitness", label: "Improve Fitness 🏃‍♂️" },
];

const experiences = ["beginner", "intermediate", "advanced"];
const availabilities = ["2-3", "4-5", "6+"];

export default function ProfileIndex() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // onboarding
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("");
  const [availability, setAvailability] = useState("");
  const [nickname, setNickname] = useState("");

  // personal
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<"female" | "male" | "non-binary" | "">("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [height, setHeight] = useState<number>(180); // Default value for cm
  const [weight, setWeight] = useState<number>(80); // Default value for kg

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.log("No user authenticated, redirecting to sign-in.");
      return router.push("/auth/sign-in"); // Redirect if no user
    }

    console.log("Authenticated user UID:", user.uid); // Log authenticated UID

    const uid = user.uid;
    setUid(uid); // Store the authenticated user's UID

    // Fetch user data from Firestore
    (async () => {
      try {
        console.log("Fetching data for user:", uid); // Log uid for debugging
        const data = await getUserData(uid);  // Fetch user data
        if (data) {
          console.log("Fetched user data:", data); // Log user data
          setGoal(data.goal || "");
          setExperience(data.experience || "");
          setAvailability(data.availability || "");
          setNickname(data.nickname || "");
          setAge(data.age || 25);  // Default to 25 if not available
          setGender(data.gender || "");
          setUnits(data.units || "metric");
          setHeight(data.height || 180); // Default height if not provided
          setWeight(data.weight || 80);  // Default weight if not provided
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setLoading(false);
      }
    })();
  }, []);

  // Save user data to Firestore
  const save = async () => {
    if (!uid) return;  // If no UID, do nothing
    await saveUserData(uid, {
      goal,
      experience,
      availability,
      nickname,
      age,
      gender,
      units,
      height,
      weight,
    });
    router.push("/home"); // Redirect to home page after saving
  };

  // Helper function to format height for imperial units
  const formatHeightImperial = (inches: number) => {
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}′ ${remainingInches}″`;
  };

  const Option = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) return <Text>Loading...</Text>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Profile</Text>

        {/* Nickname */}
        <Text style={styles.sectionTitle}>Nickname</Text>
        <TextInput
          placeholder="Your nickname"
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
        />

        {/* Age */}
        <Text style={styles.sectionTitle}>Age: {age}</Text>
        <Slider
          value={age}
          onValueChange={(v: number) => setAge(Math.round(v))}
          minimumValue={12}
          maximumValue={80}
          step={1}
          minimumTrackTintColor="#7b61ff"
          maximumTrackTintColor="#555"
          thumbTintColor="#fff"
        />

        {/* Gender */}
        <Text style={styles.sectionTitle}>Gender</Text>
        <View style={styles.row}>
          {(["female", "male", "non-binary"] as const).map((g) => (
            <Option key={g} label={g.charAt(0).toUpperCase() + g.slice(1)} selected={gender === g} onPress={() => setGender(g)} />
          ))}
        </View>

        {/* Units */}
        <Text style={styles.sectionTitle}>Units</Text>
        <View style={styles.row}>
          <Option label="Metric (kg/cm)" selected={units === "metric"} onPress={() => { setUnits("metric"); setHeight(Math.round(height * 2.54)); setWeight(Math.round(weight / 2.205)); }} />
          <Option label="Imperial (lbs/ft)" selected={units === "imperial"} onPress={() => { setUnits("imperial"); setHeight(Math.round(height / 2.54)); setWeight(Math.round(weight * 2.205)); }} />
        </View>

        {/* Height */}
        <Text style={styles.sectionTitle}>
          Height ({units === "metric" ? "cm" : "ft"}):{" "}
          {units === "metric" ? `${Math.round(height)}` : formatHeightImperial(height)}
        </Text>
        <Slider
          value={height}
          onValueChange={(v: number) => setHeight(Math.round(v))}
          minimumValue={units === "metric" ? 140 : 55}
          maximumValue={units === "metric" ? 210 : 83}
          step={1}
          minimumTrackTintColor="#7b61ff"
          maximumTrackTintColor="#555"
          thumbTintColor="#fff"
        />

        {/* Weight */}
        <Text style={styles.sectionTitle}>Weight ({units === "metric" ? "kg" : "lbs"}): {Math.round(weight)}</Text>
        <Slider
          value={weight}
          onValueChange={(v: number) => setWeight(Math.round(v))}
          minimumValue={units === "metric" ? 40 : 90}
          maximumValue={units === "metric" ? 150 : 330}
          step={1}
          minimumTrackTintColor="#7b61ff"
          maximumTrackTintColor="#555"
          thumbTintColor="#fff"
        />

        {/* Goal */}
        <Text style={styles.sectionTitle}>Goal</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {goals.map((g) => (
            <TouchableOpacity
              key={g.key}
              onPress={() => setGoal(g.key)}
              style={[styles.goalOption, goal === g.key && styles.goalOptionSelected]}
            >
              <Text style={[styles.goalText, goal === g.key && styles.goalTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Experience</Text>
        <View style={styles.row}>
          {experiences.map((e) => (
            <Option key={e} label={e.charAt(0).toUpperCase() + e.slice(1)} selected={experience === e} onPress={() => setExperience(e)} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Availability</Text>
        <View style={styles.row}>
          {availabilities.map((a) => (
            <Option key={a} label={`${a} days/week`} selected={availability === a} onPress={() => setAvailability(a)} />
          ))}
        </View>

        {/* Save */}
        <TouchableOpacity style={styles.save} onPress={save}>
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a", padding: 20, paddingTop: 56 },
  scrollContent: { paddingBottom: 80 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 10 },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horizontalScroll: { flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 16 },
  goalOption: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  goalOptionSelected: { backgroundColor: "#fff", borderColor: "#7b61ff" },
  goalText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },
  goalTextActive: { color: "#4a90e2", fontWeight: "700", fontSize: 13.5 },
  option: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  optionSelected: { backgroundColor: "#fff", borderColor: "#7b61ff" },
  optionText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },
  optionTextActive: { color: "#4a90e2", fontWeight: "700", fontSize: 13.5 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderRadius: 12, color: "#fff", paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  save: { backgroundColor: "#7b61ff", borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 22 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
