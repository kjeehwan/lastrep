// app/settings/index.tsx
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "firebase/auth";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUserData, saveUserData } from "../../src/userData";

const ACCENT = "#3dd598";
const MUTED = "#a5acc1";

type ToggleRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
};

type PressableRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valueLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
};

const ToggleRow = ({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: ToggleRowProps) => {
  return (
    <View style={[styles.row, disabled && styles.disabledRow]}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBadge}>
          <Ionicons name={icon} size={18} color={ACCENT} />
        </View>
        <View style={styles.rowTextBlock}>
          <Text style={styles.itemText}>{label}</Text>
          {description ? (
            <Text style={styles.subText}>{description}</Text>
          ) : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        thumbColor={disabled ? "#8c8c8c" : value ? ACCENT : "#f4f4f5"}
        trackColor={{
          false: disabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.15)",
          true: disabled ? "rgba(255,255,255,0.12)" : "rgba(61,213,152,0.35)",
        }}
      />
    </View>
  );
};

const PressableRow = ({
  icon,
  label,
  valueLabel,
  onPress,
  disabled,
}: PressableRowProps) => {
  return (
    <Pressable
      style={[styles.row, disabled && styles.disabledRow]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <View style={styles.rowLeft}>
        <View style={styles.iconBadge}>
          <Ionicons name={icon} size={18} color={ACCENT} />
        </View>
        <View style={styles.rowTextBlock}>
          <Text style={styles.itemText}>{label}</Text>
          {valueLabel ? <Text style={styles.subText}>{valueLabel}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={MUTED} />
    </Pressable>
  );
};

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "YO";
  return parts.map((p) => (p[0] || "").toUpperCase()).join("");
};

export default function SettingsIndex() {
  const router = useRouter();
  const auth = getAuth();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [nickname, setNickname] = React.useState("You");
  const [initials, setInitials] = React.useState("YO");
  const [notifications, setNotifications] = React.useState(true);
  const [privacy, setPrivacy] = React.useState(false);
  const [workoutReminders, setWorkoutReminders] = React.useState(true);
  const [weeklySummary, setWeeklySummary] = React.useState(true);
  const [deviceSync, setDeviceSync] = React.useState(true);
  const [loadedSettings, setLoadedSettings] = React.useState(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/auth/sign-in");
    } catch (e) {
      console.log("Sign out error", e);
    }
  };

  React.useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const fallbackName =
      user.displayName || user.email?.split("@")[0] || nickname || "You";
    setNickname(fallbackName);
    setInitials(initialsFromName(fallbackName));

    (async () => {
      try {
        const data = await getUserData(user.uid);
        if (data?.nickname) {
          setNickname(data.nickname);
          setInitials(initialsFromName(data.nickname));
        }
      } catch (e) {
        console.log("Error loading profile nickname", e);
      }
    })();
  }, []);

  React.useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    setUserId(user.uid);

    const fallbackName =
      user.displayName || user.email?.split("@")[0] || nickname || "You";
    setNickname(fallbackName);
    setInitials(initialsFromName(fallbackName));

    (async () => {
      try {
        const data = await getUserData(user.uid);
        if (data) {
          if (data.nickname) {
            setNickname(data.nickname);
            setInitials(initialsFromName(data.nickname));
          }
          if (typeof data.workoutReminders === "boolean") {
            setWorkoutReminders(data.workoutReminders);
          }
          if (typeof data.weeklySummary === "boolean") {
            setWeeklySummary(data.weeklySummary);
          }
          if (typeof data.notifications === "boolean") {
            setNotifications(data.notifications);
          }
          if (typeof data.privacy === "boolean") {
            setPrivacy(data.privacy);
          }
          if (typeof data.deviceSync === "boolean") {
            setDeviceSync(data.deviceSync);
          }
        }
      } catch (e) {
        console.log("Error loading profile settings", e);
      } finally {
        setLoadedSettings(true);
      }
    })();
  }, []);

  // Persist notification toggles after initial load
  React.useEffect(() => {
    if (!userId || !loadedSettings) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      saveUserData(userId, {
        workoutReminders,
        weeklySummary,
        notifications,
        privacy,
        deviceSync,
      });
    }, 400);
  }, [
    userId,
    loadedSettings,
    workoutReminders,
    weeklySummary,
    notifications,
    privacy,
    deviceSync,
  ]);

  const contactSupport = () => {
    Linking.openURL("mailto:kjeehwan@gmail.com?subject=Support%20request");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
        overScrollMode="always"
        contentInsetAdjustmentBehavior="automatic"
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Settings</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{nickname}</Text>
          <Text style={styles.profileMeta}>Pro member · 120-day streak</Text>
        </View>
        <Pressable onPress={() => router.push("/profile")}>
          <Text style={styles.linkText}>View</Text>
        </Pressable>
      </View>

      <SectionCard title="Activity & devices">
        <ToggleRow
          icon="watch-outline"
          label="Sync fitness data"
          description="Allow syncing from wearables and Health data (coming soon)"
          value={deviceSync}
          onValueChange={setDeviceSync}
          disabled
        />
        <PressableRow
          icon="link-outline"
          label="Connected device"
          valueLabel="Coming soon"
          disabled
        />
      </SectionCard>

      <SectionCard title="Notifications">
        <ToggleRow
          icon="notifications-outline"
          label="Workout reminders"
          description="Get a nudge before your planned sessions"
          value={workoutReminders}
          onValueChange={setWorkoutReminders}
        />
        <ToggleRow
          icon="trending-up-outline"
          label="Goal streak alerts"
          value={notifications}
          onValueChange={setNotifications}
        />
        <ToggleRow
          icon="calendar-outline"
          label="Weekly summary"
          description="Stats recap every Sunday evening"
          value={weeklySummary}
          onValueChange={setWeeklySummary}
        />
      </SectionCard>

      <SectionCard title="Privacy & security">
        <ToggleRow
      icon="shield-checkmark-outline"
      label="Private profile"
      description="Hide your profile and activity from others"
      value={privacy}
      onValueChange={setPrivacy}
    />
        <PressableRow
          icon="lock-closed-outline"
          label="Data & privacy controls"
          valueLabel="Coming soon"
          disabled
        />
      </SectionCard>

      <SectionCard title="Support">
        <PressableRow
          icon="chatbubbles-outline"
          label="Contact support"
          valueLabel="Get help fast"
          onPress={contactSupport}
        />
      </SectionCard>

      <View style={styles.buttonStack}>
        <TouchableOpacity style={[styles.primaryButton, styles.disabledButton]} disabled>
          <Text style={[styles.primaryButtonText, styles.disabledButtonText]}>
            Manage subscription (coming soon)
          </Text>
        </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
  },
  content: { padding: 20, paddingTop: 56, paddingBottom: 32 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 16 },
  profileCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(61,213,152,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  profileName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  profileMeta: { color: MUTED, marginTop: 2 },
  linkText: { color: ACCENT, fontWeight: "700" },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 12,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  rowTextBlock: { flex: 1 },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  subText: { color: MUTED, marginTop: 2, fontSize: 13 },
  buttonStack: { gap: 10, marginTop: 4 },
  primaryButton: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#04100c", fontWeight: "800", fontSize: 15 },
  disabledButton: { opacity: 0.6 },
  disabledButtonText: { color: "#0f1a15" },
  secondaryButton: {
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
