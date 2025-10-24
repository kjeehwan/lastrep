import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Colors } from "../styles/colors";

type OnboardingLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  showNext?: boolean;
};

export default function OnboardingLayout({
  title,
  subtitle,
  children,
  onNext,
  nextLabel = "Next",
  showNext = true,
}: OnboardingLayoutProps) {
  // ✅ Safe theme fallback — use ThemeContext if available, else fallback to static Colors
  let activeTheme = Colors;
  try {
    const { theme } = useTheme();
    if (theme) activeTheme = theme;
  } catch {
    // outside ThemeProvider (e.g., onboarding)
    activeTheme = Colors;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: activeTheme.background },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: activeTheme.textPrimary }]}>
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, { color: activeTheme.textSecondary }]}
            >
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.content}>{children}</View>
      </ScrollView>

      {showNext && (
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: activeTheme.primary, shadowColor: activeTheme.primary },
          ]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.nextButtonText,
              { color: activeTheme.surface },
            ]}
          >
            {nextLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 3,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
