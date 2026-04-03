import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0d0d1a",
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 60 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#7b61ff",
        tabBarInactiveTintColor: "#888",
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            home: "home-outline",
            "nutrition/index": "restaurant-outline",
            workout: "barbell-outline",
            "sleep/index": "moon-outline",
            "profile/index": "person-outline",
          };
          return (
            <Ionicons
              name={icons[route.name] || "ellipse-outline"}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="workout" options={{ title: "Workout" }} />
      <Tabs.Screen name="nutrition/index" options={{ title: "Nutrition" }} />
      <Tabs.Screen name="sleep/index" options={{ title: "Sleep" }} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="community/index" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ title: "Profile" }} />
    </Tabs>
  );
}
