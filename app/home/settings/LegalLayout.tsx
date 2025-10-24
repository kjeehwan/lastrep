import { Stack } from "expo-router";
import React, { useMemo } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

type Section = {
  title?: string;
  content: string;
};

type Props = {
  title: string;
  sections: Section[];
};

export default function LegalLayout({ title, sections }: Props) {
  const { theme } = useTheme();

  const handleOpenWebsite = () => {
    Linking.openURL("https://lastrep.app");
  };

  // ✅ memoized styles for smoother theme switching
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 16,
          backgroundColor: theme.background,
        },
        title: {
          fontSize: 22,
          fontWeight: "700",
          color: theme.textPrimary,
          marginBottom: 16,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: "600",
          color: theme.textPrimary,
          marginTop: 20,
          marginBottom: 8,
        },
        paragraph: {
          fontSize: 15,
          lineHeight: 22,
          color: theme.textSecondary,
        },
        lastUpdated: {
          fontSize: 13,
          color: theme.textSecondary,
          marginTop: 24,
          textAlign: "center",
        },
        footer: {
          marginTop: 12,
          alignItems: "center",
          borderTopWidth: 1,
          borderColor: theme.border,
          paddingTop: 12,
        },
        footerText: {
          fontSize: 13,
          color: theme.textSecondary,
        },
        footerLink: {
          fontSize: 13,
          color: theme.primary,
          textDecorationLine: "underline",
          marginBottom: 2,
        },
      }),
    [theme]
  );

  return (
    <>
      {/* 🧭 Header */}
      <Stack.Screen
        options={{
          title,
          headerTitleStyle: {
            color: theme.textPrimary,
            fontWeight: "700",
            fontSize: 20,
          },
          headerStyle: { backgroundColor: theme.surface },
        }}
      />

      {/* 📄 Content */}
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          {sections.map((s, i) => (
            <View key={i}>
              {s.title && <Text style={styles.sectionTitle}>{s.title}</Text>}
              <Text style={styles.paragraph}>{s.content}</Text>
            </View>
          ))}

          <Text style={styles.lastUpdated}>
            Last updated: {new Date().toLocaleDateString()}
          </Text>

          <View style={styles.footer}>
            <TouchableOpacity onPress={handleOpenWebsite} activeOpacity={0.7}>
              <Text style={styles.footerLink}>
                © {new Date().getFullYear()} LastRep
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerText}>All rights reserved.</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
