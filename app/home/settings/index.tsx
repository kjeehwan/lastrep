import { Stack, useRouter } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import { Bell, FileText, LogOut, Moon, Shield, Sun } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { getSetting, saveSetting } from "../../../lib/storage";

export default function SettingsScreen() {
  const router = useRouter();
  const auth = getAuth();
  const { themeMode, setThemeMode, theme } = useTheme();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // 🔹 Load saved toggle + theme
  useEffect(() => {
    (async () => {
      const savedNotifications = await getSetting("notifications", false);
      setNotificationsEnabled(savedNotifications);
    })();
  }, []);

  // 🔹 Persist notifications toggle
  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await saveSetting("notifications", newValue);
  };

  // 🔹 Sign-out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // RootLayout handles redirect automatically
    } catch (err) {
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Settings",
          headerTitleStyle: {
            color: theme.textPrimary,
            fontWeight: "700",
            fontSize: 20,
          },
          headerStyle: { backgroundColor: theme.surface },
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* ⚙️ General */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          General
        </Text>

        {/* Notifications */}
        <View
          style={[
            styles.row,
            { backgroundColor: theme.surface, borderColor: "#E5E7EB" },
          ]}
        >
          <View style={styles.left}>
            <Bell size={20} color={theme.textPrimary} />
            <Text style={[styles.optionText, { color: theme.textPrimary }]}>
              Notifications
            </Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={toggleNotifications} />
        </View>

        {/* Theme Mode */}
        <View
          style={[
            styles.row,
            { backgroundColor: theme.surface, borderColor: "#E5E7EB" },
          ]}
        >
          <View style={styles.left}>
            {themeMode === "dark" ? (
              <Moon size={20} color={theme.textPrimary} />
            ) : themeMode === "light" ? (
              <Sun size={20} color={theme.textPrimary} />
            ) : (
              <Sun size={20} color={theme.textSecondary} />
            )}
            <Text style={[styles.optionText, { color: theme.textPrimary }]}>
              Theme
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {["light", "dark", "system"].map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setThemeMode(mode as "light" | "dark" | "system")}
                style={[
                  styles.modeButton,
                  { borderColor: theme.textSecondary }, // add this line
                  themeMode === mode && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color:
                      themeMode === mode ? theme.surface : theme.textSecondary,
                    fontSize: 13,
                    fontWeight: themeMode === mode ? "700" : "500",
                    textTransform: "capitalize",
                  }}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[
            styles.row,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <View style={styles.left}>
            <LogOut size={20} color={theme.textPrimary} />
            <Text style={[styles.optionText, { color: "red" }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>

        {/* 🔒 Legal & Privacy */}
        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 28, color: theme.textSecondary },
          ]}
        >
          Legal & Privacy
        </Text>

        <TouchableOpacity
          style={[
            styles.row,
            { backgroundColor: theme.surface, borderColor: "#E5E7EB" },
          ]}
          onPress={() => router.push("/home/settings/privacy")}
          activeOpacity={0.7}
        >
          <View style={styles.left}>
            <Shield size={20} color={theme.textPrimary} />
            <Text style={[styles.optionText, { color: theme.textPrimary }]}>
              Privacy Policy
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.row,
            { backgroundColor: theme.surface, borderColor: "#E5E7EB" },
          ]}
          onPress={() => router.push("/home/settings/terms")}
          activeOpacity={0.7}
        >
          <View style={styles.left}>
            <FileText size={20} color={theme.textPrimary} />
            <Text style={[styles.optionText, { color: theme.textPrimary }]}>
              Terms of Service
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionText: { fontSize: 15 },
  modeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
});
