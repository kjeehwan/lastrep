import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EntranceView from "./EntranceView";

type OnboardingLayoutProps = {
  title: string;
  children: React.ReactNode;
  showSkip?: boolean;
  onSkip?: () => void;
  onBack?: () => void;
};

export default function OnboardingLayout({
  title,
  children,
  showSkip = true,
  onSkip,
  onBack,
}: OnboardingLayoutProps) {
  return (
    <LinearGradient colors={["#4a90e2", "#7b61ff"]} style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <EntranceView
            from={{ opacity: 0, translateY: -5 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", delay: 120, duration: 300 }}
            style={styles.topActionSlot}
          >
            {onBack ? (
              <TouchableOpacity onPress={onBack} style={styles.actionButton}>
                <Text style={styles.actionText}>‹ Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.topActionPlaceholder} />
            )}
          </EntranceView>
          <EntranceView
            from={{ opacity: 0, translateY: -5 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", delay: 200, duration: 400 }}
            style={styles.topActionSlot}
          >
            {showSkip && onSkip ? (
              <TouchableOpacity onPress={onSkip} style={styles.actionButton}>
                <Text style={styles.actionText}>Skip ›</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.topActionPlaceholder} />
            )}
          </EntranceView>
        </View>

        <EntranceView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 600 }}
          style={styles.container}
        >
          <Text style={styles.header}>{title}</Text>
          <View style={styles.content}>{children}</View>
        </EntranceView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  topActionSlot: {
    width: 88,
    alignItems: "flex-start",
  },
  topActionPlaceholder: {
    width: 88,
    height: 34,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 34,
    justifyContent: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 50,
    textAlign: "center",
  },
  content: { flexGrow: 1 },
  actionButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 84,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontSize: 15, opacity: 0.95, fontWeight: "700" },
});
