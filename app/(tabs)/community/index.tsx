// app/community/index.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function CommunityIndex() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>Coming soon: feed, posts, and PR highlights.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a", padding: 20, paddingTop: 56 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 18 },
  muted: { color: "#cfcfe6" },
});
