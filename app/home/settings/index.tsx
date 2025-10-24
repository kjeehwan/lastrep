import { Stack, useRouter } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import {
  Bell,
  FileText,
  LogOut,
  Monitor,
  Moon,
  Shield,
  Sun,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
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

  // 🔹 Load saved preferences
  useEffect(() => {
    (async () => {
      const savedNotifications = await getSetting("notifications", false);
      setNotificationsEnabled(savedNotifications);
    })();
  }, []);

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await saveSetting("notifications", newValue);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Root layout will redirect automatically
    } catch {
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  // ✅ Memoized styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: 20,
          backgroundColor: theme.background,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: "700",
          color: theme.textSecondary,
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
          borderColor: theme.border,
          backgroundColor: theme.surface,
          marginBottom: 10,
          shadowColor: theme.textPrimary,
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 2,
          elevation: 1,
        },
        left: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        optionText: {
          fontSize: 15,
          color: theme.textPrimary,
        },
        modeButton: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          borderWidth: 1,
        },
        signOutText: {
          color: "#EF4444", // fixed red for clarity
          fontWeight: "600",
        },
      }),
    [theme]
  );

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
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ⚙️ General Section */}
        <Text style={styles.sectionTitle}>General</Text>

        {/* Notifications */}
        <View style={styles.row}>
          <View style={styles.left}>
            <Bell size={20} color={theme.textPrimary} />
            <Text style={styles.optionText}>Notifications</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={toggleNotifications} />
        </View>

        {/* Theme Mode */}
        <View style={styles.row}>
          <View style={styles.left}>
            {themeMode === "dark" ? (
              <Moon size={20} color={theme.textPrimary} />
            ) : themeMode === "light" ? (
              <Sun size={20} color={theme.textPrimary} />
            ) : (
              <Monitor size={20} color={theme.textPrimary} />
            )}
            <Text style={styles.optionText}>Theme</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["light", "dark", "system"] as const).map((mode) => {
              const isActive = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={[
                    styles.modeButton,
                    {
                      borderColor: isActive ? theme.primary : theme.border,
                      backgroundColor: isActive
                        ? theme.primary
                        : theme.surface,
                      elevation: isActive ? 2 : 0,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      color: isActive ? theme.onPrimary : theme.textSecondary,
                      fontWeight: isActive ? "700" : "500",
                      textTransform: "capitalize",
                      fontSize: 13,
                    }}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 🚪 Sign Out */}
        <TouchableOpacity
          style={styles.row}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <View style={styles.left}>
            <LogOut size={20} color="#EF4444" />
            <Text style={[styles.optionText, styles.signOutText]}>Sign Out</Text>
          </View>
        </TouchableOpacity>

        {/* 🔒 Legal & Privacy */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
          Legal & Privacy
        </Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push("/home/settings/privacy")}
          activeOpacity={0.7}
        >
          <View style={styles.left}>
            <Shield size={20} color={theme.textPrimary} />
            <Text style={styles.optionText}>Privacy Policy</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push("/home/settings/terms")}
          activeOpacity={0.7}
        >
          <View style={styles.left}>
            <FileText size={20} color={theme.textPrimary} />
            <Text style={styles.optionText}>Terms of Service</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
