// /app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage'; // For checking onboarding completion
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth'; // Firebase Authentication
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [isNewUser, setIsNewUser] = useState(false);  // Track whether the user is new
  const [loading, setLoading] = useState(true);  // To show a loading state while checking

  useEffect(() => {
    const checkUserStatus = async () => {
      // Check if user is signed in (via Firebase Authentication)
      const user = getAuth().currentUser;

      if (user) {
        // User is signed in, now check if onboarding is complete
        const onboardingComplete = await AsyncStorage.getItem('onboardingComplete');

        if (onboardingComplete === 'true') {
          // If onboarding is complete, navigate to Home screen
          router.push('/home');
        } else {
          // If onboarding is not complete, navigate to onboarding screens
          router.push('/onboarding/goal');
        }
      } else {
        // If no user is signed in, redirect to sign-up screen
        router.push('/auth/sign-up');
      }

      setLoading(false);  // Done loading, update state
    };

    checkUserStatus();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return null;  // Home screen is handled by the navigation
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
