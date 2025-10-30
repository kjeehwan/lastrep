import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import LastRepLogo from "../../src/components/LastRepLogo"; // Import LastRepLogo component
import OnboardingLayout from "../../src/components/OnboardingLayout";
import { useTheme } from "../../src/contexts/ThemeContext";

export default function Ready() {
  const router = useRouter();
  const { theme } = useTheme(); // ✅ dynamic theme

  // Get screen width and height to dynamically adjust logo size
  const { width, height } = Dimensions.get("window");

  // Calculate logo size based on screen dimensions
  const logoSize = Math.min(width, height) * 0.25; // Logo will be 25% of the smaller dimension

  // Dynamically calculate the max size cap based on screen height (so the logo fits well)
  const maxLogoSize = height * 0.3; // Cap the logo size to 30% of the screen height

  // Final logo size is the smaller of the calculated size or maxLogoSize
  const finalLogoSize = Math.min(logoSize, maxLogoSize);

  // Dynamic styles update when theme changes
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center", // Vertically center content
          alignItems: "center",     // Horizontally center content
          backgroundColor: theme.background, // Adjust background color based on theme
          paddingHorizontal: 20,    // Add some padding around the content
        },
        title: {
          fontSize: 28, // Adjusted to be slightly smaller
          fontWeight: "700",
          color: theme.primary,
          marginBottom: 20, // Add margin to space out title from logo
          textAlign: "center", // Center text horizontally
        },
        logoContainer: {
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 40, // Ensure there is space between the logo and the next button
        },
        button: {
          backgroundColor: theme.primary,
          paddingVertical: 15,
          paddingHorizontal: 30,
          borderRadius: 30, // Rounded button for a modern look
          alignItems: "center",
          justifyContent: "center",
          width: "80%",
        },
        buttonText: {
          color: theme.onPrimary, // Light text on a dark background
          fontSize: 18,
          fontWeight: "600",
        },
      }),
    [theme, width, height]
  );

  return (
    <OnboardingLayout
      title="" // Remove title since we want to customize it in the center
      subtitle=""
      onNext={() => router.push("/onboarding/welcome")}
      nextLabel="Let's go" // The "Let's go" button already exists in OnboardingLayout
    >
      <View style={styles.container}>
        <Text style={styles.title}>Ready for the</Text>
        <View style={styles.logoContainer}>
          {/* Use the responsive logo with dynamic size */}
          <LastRepLogo size={finalLogoSize || 100} /> {/* Ensure the logo fits the screen properly */}
        </View>
      </View>
    </OnboardingLayout>
  );
}
