import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import CommunityIndex from "./community/index"; // Same for community index
import Home from "./home"; // Make sure this path matches where your home component is
import ProfileIndex from "./profile/index"; // Ensure the correct import path
import WorkoutIndex from "./workout/index"; // Same for workout index

const Tab = createBottomTabNavigator();

export default function TabsLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0d0d1a",
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#7b61ff",
        tabBarInactiveTintColor: "#888",
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            home: "home-outline",
            "workout/index": "barbell-outline",
            "community/index": "people-outline",
            "profile/index": "person-outline",  // Profile route icon
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
      <Tab.Screen name="home" component={Home} options={{ title: "Home" }} />
      <Tab.Screen name="workout/index" component={WorkoutIndex} options={{ title: "Workout" }} />
      <Tab.Screen name="community/index" component={CommunityIndex} options={{ title: "Community" }} />
      <Tab.Screen name="profile/index" component={ProfileIndex} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
