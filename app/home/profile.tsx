import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";
import { Colors } from "../../styles/colors";

export default function Profile() {
  const auth = getAuth();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [loading, setLoading] = useState(false);

  const cmToInches = (cm: number) => cm / 2.54;
  const inchesToCm = (inch: number) => inch * 2.54;
  const kgToLb = (kg: number) => kg * 2.20462;
  const lbToKg = (lb: number) => lb / 2.20462;

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setDisplayName(data.displayName || "");
          setAge(data.profile?.age?.toString() || "");
          setGender(data.profile?.gender || "");
          setHeight(data.profile?.height?.toString() || "");
          setWeight(data.profile?.weight?.toString() || "");
          setUnits(data.profile?.units || "metric");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      }
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        profile: {
          gender,
          age: age ? parseInt(age) : null,
          height: height ? parseFloat(height) : null,
          weight: weight ? parseFloat(weight) : null,
          units,
        },
      });
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // Derived units for display
  const heightLabel = units === "metric" ? "cm" : "in";
  const weightLabel = units === "metric" ? "kg" : "lb";

  const heightPlaceholder = units === "metric" ? "Enter height in cm" : "Enter height in inches";
  const weightPlaceholder = units === "metric" ? "Enter weight in kg" : "Enter weight in lb";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.label}>Nickname</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Enter nickname"
      />

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={styles.input}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
        placeholder="Enter age"
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.row}>
        {["Male", "Female", "Other"].map((g) => (
          <TouchableOpacity
            key={g}
            style={[
              styles.option,
              gender === g && {
                borderColor: Colors.primary,
                backgroundColor: "#E8F9FD",
              },
            ]}
            onPress={() => setGender(g)}
          >
            <Text
              style={[
                styles.optionText,
                gender === g && { color: Colors.primary, fontWeight: "700" },
              ]}
            >
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Units now directly below Gender */}
      <Text style={styles.label}>Units</Text>
      <View style={styles.row}>
        {["metric", "imperial"].map((u) => (
          <TouchableOpacity
            key={u}
            style={[
              styles.option,
              units === u && {
                borderColor: Colors.primary,
                backgroundColor: "#E8F9FD",
              },
            ]}
            onPress={() => {
              if (units !== u) {
                // Convert existing numbers if possible
                const h = parseFloat(height);
                const w = parseFloat(weight);

                if (!isNaN(h) && !isNaN(w)) {
                  if (u === "imperial" && units === "metric") {
                    setHeight((cmToInches(h)).toFixed(1));
                    setWeight((kgToLb(w)).toFixed(1));
                  } else if (u === "metric" && units === "imperial") {
                    setHeight((inchesToCm(h)).toFixed(1));
                    setWeight((lbToKg(w)).toFixed(1));
                  }
                }
                setUnits(u as "metric" | "imperial");
              }
            }}
          >
            <Text
              style={[
                styles.optionText,
                units === u && { color: Colors.primary, fontWeight: "700" },
              ]}
            >
              {u === "metric" ? "Metric (kg/cm)" : "Imperial (lb/in)"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Height ({heightLabel})</Text>
      <TextInput
        style={styles.input}
        value={height}
        onChangeText={setHeight}
        keyboardType="numeric"
        placeholder={heightPlaceholder}
      />

      <Text style={styles.label}>Weight ({weightLabel})</Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
        placeholder={weightPlaceholder}
      />

      <TouchableOpacity
        style={[styles.saveButton, loading && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginHorizontal: 4,
  },
  optionText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: "700",
  },
});
