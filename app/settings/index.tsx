// app/settings/index.tsx
import { useRouter } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import React from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

export default function SettingsIndex() {
  const router = useRouter();
  const auth = getAuth();
  const [notifications, setNotifications] = React.useState(true);
  const [privacy, setPrivacy] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/auth/sign-in");
    } catch (e) {
      console.log("Sign out error", e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.itemText}>Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.itemText}>Private Profile</Text>
          <Switch value={privacy} onValueChange={setPrivacy} />
        </View>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a", padding: 20, paddingTop: 56 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 18, marginBottom: 16 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  itemText: { color: "#cfcfe6" },
  signOut: { backgroundColor: "#ff5c5c", borderRadius: 12, alignItems: "center", paddingVertical: 14 },
  signOutText: { color: "#fff", fontWeight: "800" },
});
