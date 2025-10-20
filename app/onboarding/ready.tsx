import { useRouter } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import OnboardingLayout from "../../components/OnboardingLayout";
import { Colors } from "../../styles/colors";

export default function Ready() {
  const router = useRouter();

  return (
    <OnboardingLayout
      title="Ready for the"
      subtitle=""
      onNext={() => router.push("/onboarding/welcome")}
      nextLabel="Let's go"
    >
      <View style={styles.centerContent}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/lastrep-logo.png")} // update path if different
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>LastRep</Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  logoText: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.primary,
  },
});
