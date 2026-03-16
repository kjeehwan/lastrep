import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, type Href } from "expo-router";
import { getAuth } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  useEffect(() => {
    const checkUserStatus = async () => {
      const user = getAuth().currentUser;

      if (user) {
        const onboardingComplete = await AsyncStorage.getItem("onboardingComplete");

        if (onboardingComplete === "true") {
          setRedirectTo("/(tabs)/home");
        } else {
          setRedirectTo("/onboarding/goal");
        }
      } else {
        setRedirectTo("/auth/sign-up");
      }

      setLoading(false);
    };

    void checkUserStatus();
  }, []);

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
