import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ modern SafeAreaView

type OnboardingLayoutProps = {
  title: string;
  children: React.ReactNode;
  showSkip?: boolean;
  onSkip?: () => void;
};

export default function OnboardingLayout({
  title,
  children,
  showSkip = true,
  onSkip,
}: OnboardingLayoutProps) {
  return (
    <LinearGradient colors={["#4a90e2", "#7b61ff"]} style={styles.gradient}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* ✅ Animated Skip Button */}
        {showSkip && onSkip && (
          <MotiView
            from={{ opacity: 0, translateY: -5 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", delay: 200, duration: 400 }}
            style={styles.skipWrapper}
          >
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </MotiView>
        )}

        {/* ✅ Animated Main Content */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 600 }}
          style={styles.container}
        >
          <Text style={styles.header}>{title}</Text>
          <View style={styles.content}>{children}</View>
        </MotiView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 50,
    textAlign: "center",
  },
  content: { flexGrow: 1 },
  skipWrapper: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
  },
  skipButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: { color: "#fff", fontSize: 16, opacity: 0.9, fontWeight: "600" },
});
