import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import OnboardingScreen from './OnboardingScreen';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [firstTime, setFirstTime] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const userData = await AsyncStorage.getItem('userInfo');
      if (userData) {
        router.replace('/(tabs)'); // go to Dashboard
      } else {
        setFirstTime(true); // show onboarding
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return firstTime ? <OnboardingScreen onFinish={() => router.replace('/(tabs)')} /> : null;
}
