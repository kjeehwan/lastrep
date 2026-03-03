import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function PaywallScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upgrade to Premium</Text>
      <Text style={styles.body}>
        Premium unlocks more daily decisions and faster iteration with cooldown-managed access.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 16,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
  body: {
    color: "#cfcfe6",
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    marginTop: 8,
    backgroundColor: "#7b61ff",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
