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
import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebaseConfig";

export default function Profile() {
  const auth = getAuth();
  const user = auth.currentUser;
  const { theme } = useTheme(); // ✅ theme context
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");

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

  const markEdited = () => setSaved(false);

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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error updating profile:", err);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const heightLabel = units === "metric" ? "cm" : "in";
  const weightLabel = units === "metric" ? "kg" : "lb";
  const heightPlaceholder =
    units === "metric" ? "Enter height in cm" : "Enter height in inches";
  const weightPlaceholder =
    units === "metric" ? "Enter weight in kg" : "Enter weight in lb";

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, padding: 24 },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.textPrimary,
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      color: theme.textPrimary,
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
      borderColor: theme.border,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      marginHorizontal: 4,
      backgroundColor: theme.surface,
    },
    optionActive: {
      borderColor: theme.primary,
      backgroundColor: theme.highlight,
    },
    optionText: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    optionTextActive: {
      color: theme.primary,
      fontWeight: "700",
    },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 10,
    },
    saveButtonSaved: {
      backgroundColor: theme.success,
    },
    saveButtonText: {
      color: theme.buttonText,
      fontSize: 16,
      fontWeight: "700",
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.label}>Nickname</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          markEdited();
        }}
        placeholder="Enter nickname"
        placeholderTextColor={theme.placeholder}
      />

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={styles.input}
        value={age}
        onChangeText={(text) => {
          setAge(text);
          markEdited();
        }}
        keyboardType="numeric"
        placeholder="Enter age"
        placeholderTextColor={theme.placeholder}
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.row}>
        {["Male", "Female", "Other"].map((g) => (
          <TouchableOpacity
            key={g}
            style={[
              styles.option,
              gender === g && styles.optionActive,
            ]}
            onPress={() => {
              setGender(g);
              markEdited();
            }}
          >
            <Text
              style={[
                styles.optionText,
                gender === g && styles.optionTextActive,
              ]}
            >
              {g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Units</Text>
      <View style={styles.row}>
        {["metric", "imperial"].map((u) => (
          <TouchableOpacity
            key={u}
            style={[
              styles.option,
              units === u && styles.optionActive,
            ]}
            onPress={() => {
              if (units !== u) {
                const h = parseFloat(height);
                const w = parseFloat(weight);
                if (!isNaN(h) && !isNaN(w)) {
                  if (u === "imperial" && units === "metric") {
                    setHeight(cmToInches(h).toFixed(1));
                    setWeight(kgToLb(w).toFixed(1));
                  } else if (u === "metric" && units === "imperial") {
                    setHeight(inchesToCm(h).toFixed(1));
                    setWeight(lbToKg(w).toFixed(1));
                  }
                }
                setUnits(u as "metric" | "imperial");
                markEdited();
              }
            }}
          >
            <Text
              style={[
                styles.optionText,
                units === u && styles.optionTextActive,
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
        onChangeText={(text) => {
          setHeight(text);
          markEdited();
        }}
        keyboardType="numeric"
        placeholder={heightPlaceholder}
        placeholderTextColor={theme.placeholder}
      />

      <Text style={styles.label}>Weight ({weightLabel})</Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={(text) => {
          setWeight(text);
          markEdited();
        }}
        keyboardType="numeric"
        placeholder={weightPlaceholder}
        placeholderTextColor={theme.placeholder}
      />

      <TouchableOpacity
        style={[
          styles.saveButton,
          saved && !loading && styles.saveButtonSaved,
          loading && { opacity: 0.7 },
        ]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading
            ? "Saving..."
            : saved
            ? "Changes Saved!"
            : "Save Changes"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
