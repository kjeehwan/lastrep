import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

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
  const { theme } = useTheme();

  // ✅ Memoized styles to update instantly on theme change
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 60,
          paddingBottom: 32,
          justifyContent: "space-between",
          backgroundColor: theme.background,
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
          color: theme.textPrimary,
        },
        subtitle: {
          fontSize: 16,
          textAlign: "center",
          lineHeight: 22,
          color: theme.textSecondary,
        },
        content: {
          flex: 1,
          alignItems: "center",
          justifyContent: "flex-start",
        },
        nextButton: {
          backgroundColor: theme.primary,
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: "center",
          shadowColor: theme.primary,
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 5,
          elevation: 3,
        },
        nextButtonText: {
          fontSize: 16,
          fontWeight: "700",
          color: theme.onPrimary,
        },
      }),
    [theme]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.content}>{children}</View>
      </ScrollView>

      {showNext && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>{nextLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
