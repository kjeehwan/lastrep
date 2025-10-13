import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: (Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: 'absolute',
              height: 70,
              paddingBottom: 10,
              paddingTop: 5,
            },
            android: {
              height: 70,
              paddingBottom: 10,
              paddingTop: 5,
            },
            default: {
              height: 70,
              paddingBottom: 10,
              paddingTop: 5,
            },
          }) as object),
          tabBarLabelStyle: {
            fontSize: 14,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Ionicons name="home" size={30} color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => <Ionicons name="paper-plane" size={30} color={color} />,
          }}
        />
        <Tabs.Screen
          name="weekly-summary"
          options={{
            title: 'Summary',
            tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={30} color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
