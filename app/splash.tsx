import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import LastRepLogo from "../components/LastRepLogo"; // Your animated logo component

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkUserState = async () => {
      try {
        const userToken = await AsyncStorage.getItem("userToken"); // Check for saved user session
        if (userToken) {
          router.replace("/home"); // If signed in, go to /home
        } else {
          const isSignedUp = await AsyncStorage.getItem("isSignedUp"); // Check if the user signed up before
          if (isSignedUp) {
            router.replace("/auth/sign-in"); // If signed out previously, go to sign-in
          } else {
            router.replace("/auth/sign-up"); // If new user, go to sign-up
          }
        }
      } catch (error) {
        console.error("Error checking user state:", error);
      }
    };

    // Show the logo animation and then check the user state
    setTimeout(() => {
      checkUserState(); // Check user state after logo animation
    }, 2200); // Adjust the delay to match the animation duration
  }, []);

  return (
    <View style={styles.container}>
      <LastRepLogo /> {/* Your animated logo */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a", // Dark background for splash screen
    justifyContent: "center",
    alignItems: "center",
  },
});
