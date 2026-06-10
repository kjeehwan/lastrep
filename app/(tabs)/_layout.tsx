import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../src/config/firebaseConfig";
import { useOfflineStatus } from "../../src/hooks/useOfflineStatus";
import { getProfileLeaveGuard } from "../../src/profile/leaveGuard";
import { autoSyncSleepFromHealthConnectIfEligible } from "../../src/sleep/sleep";
import { showAppDialog } from "../../src/ui/appDialog";

function createProfileTabLeaveListener(targetName: string) {
  return ({ navigation }: { navigation: { getState: () => { index: number; routes: { name: string }[] }; navigate: (name: string) => void } }) => ({
    tabPress: (event: { preventDefault: () => void }) => {
      const state = navigation.getState();
      const activeRoute = state.routes[state.index];
      if (activeRoute?.name !== "profile/index") return;
      const guard = getProfileLeaveGuard();
      if (!guard.hasUnsavedChanges) return;
      event.preventDefault();
      showAppDialog({
        title: "Unsaved changes",
        message: "You have unsaved changes. Save before leaving?",
        buttons: [
          {
            text: "Save",
            role: "default",
            onPress: () => {
              void (async () => {
                const ok = await (guard.save?.() ?? Promise.resolve(false));
                if (ok) {
                  navigation.navigate(targetName);
                }
              })();
            },
          },
          {
            text: "Discard",
            role: "destructive",
            onPress: () => {
              guard.discard?.();
              navigation.navigate(targetName);
            },
          },
          { text: "Cancel", role: "cancel" },
        ],
      });
    },
  });
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const { isOffline } = useOfflineStatus();
  const inFlightRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || isOffline || inFlightRef.current) return;
      inFlightRef.current = true;
      void autoSyncSleepFromHealthConnectIfEligible(user.uid, { minIntervalMinutes: 30 }).finally(
        () => {
          inFlightRef.current = false;
        }
      );
    });
    return unsub;
  }, [isOffline]);

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
            nutrition: "restaurant-outline",
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
      <Tabs.Screen name="home" options={{ title: "Home" }} listeners={createProfileTabLeaveListener("home")} />
      <Tabs.Screen
        name="workout"
        options={{ title: "Workout" }}
        listeners={createProfileTabLeaveListener("workout")}
      />
      <Tabs.Screen name="nutrition" options={{ title: "Nutrition" }} listeners={createProfileTabLeaveListener("nutrition")} />
      <Tabs.Screen name="sleep/index" options={{ title: "Sleep" }} listeners={createProfileTabLeaveListener("sleep/index")} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="community/index" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ title: "Profile" }} />
    </Tabs>
  );
}
