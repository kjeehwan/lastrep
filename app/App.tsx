import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

export default function App() {
  return (
    <>
      <Stack>
        {/* The root stack will automatically handle navigation */}
        {/* (tabs) contains Dashboard, Explore, WeeklySummary */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="WorkoutBuilder" options={{ headerShown: true, title: 'Build Workout' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
