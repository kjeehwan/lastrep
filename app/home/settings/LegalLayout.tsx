import { Stack } from "expo-router";
import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext"; // ✅ useTheme instead of Colors

type Section = {
  title?: string;
  content: string;
};

type Props = {
  title: string;
  sections: Section[];
};

export default function LegalLayout({ title, sections }: Props) {
  const { theme } = useTheme(); // ✅ dynamic theme

  const handleOpenWebsite = () => {
    Linking.openURL("https://lastrep.app");
  };

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
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>

        {sections.map((s, i) => (
          <View key={i}>
            {s.title && (
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                {s.title}
              </Text>
            )}
            <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
              {s.content}
            </Text>
          </View>
        ))}

        {/* 🗓️ Last updated */}
        <Text style={[styles.lastUpdated, { color: theme.textSecondary }]}>
          Last updated: {new Date().toLocaleDateString()}
        </Text>

        {/* ⚖️ Branded footer */}
        <View
          style={[
            styles.footer,
            { borderColor: theme.border },
          ]}
        >
          <TouchableOpacity onPress={handleOpenWebsite} activeOpacity={0.7}>
            <Text style={[styles.footerLink, { color: theme.primary }]}>
              © {new Date().getFullYear()} LastRep
            </Text>
          </TouchableOpacity>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
  },
  lastUpdated: {
    fontSize: 13,
    marginTop: 24,
    textAlign: "center",
  },
  footer: {
    marginTop: 12,
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 13,
  },
  footerLink: {
    fontSize: 13,
    textDecorationLine: "underline",
    marginBottom: 2,
  },
});
