import { notebookTabBarHeight, usesNotebookDesign } from "../../src/ui/notebook/navigationGeometry";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useRef } from "react";
import { Text, TouchableOpacity, useWindowDimensions, type TouchableOpacityProps } from "react-native";
import { useColorScheme } from "../../hooks/use-color-scheme";
import { notebookDark, notebookPaper, notebookFonts } from "../../src/ui/notebook/tokens";
import { NotebookTabIcon } from "../../src/ui/notebook/NotebookTabIcon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../src/config/firebaseConfig";
import { useOfflineStatus } from "../../src/hooks/useOfflineStatus";
import { getProfileLeaveGuard } from "../../src/profile/leaveGuard";
import { autoSyncSleepFromHealthConnectIfEligible } from "../../src/sleep/sleep";
import { showAppDialog } from "../../src/ui/appDialog";
import { scheduleAfterInteractions } from "../../src/utils/scheduleAfterInteractions";

function createProfileTabLeaveListener(targetName: string) {
  return ({ navigation }: { navigation: { getState: () => { index: number; routes: { name: string }[] }; navigate: (name: string) => void } }) => ({
    tabPress: (event: { preventDefault: () => void }) => {
      const state = navigation.getState();
      const activeRoute = state.routes[state.index];
      if (activeRoute?.name !== "profile/index") return;
      const guard = getProfileLeaveGuard();
      if (guard.isSaving?.()) {
        event.preventDefault();
        return;
      }
      if (!guard.hasUnsavedChanges) return;
      event.preventDefault();
      showAppDialog({
        title: "Unsaved changes",
        message: "You have unsaved changes. Save before leaving?",
        buttonLayout: "vertical",
        buttons: [
          {
            text: "Save and leave",
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
            text: "Discard and leave",
            role: "destructive",
            onPress: () => {
              guard.discard?.();
              navigation.navigate(targetName);
            },
          },
          { text: "Keep editing", role: "cancel" },
        ],
      });
    },
  });
}

export default function TabsLayout() {
  const pathname = usePathname();
  const notebook = usesNotebookDesign(pathname);
  const paper = useColorScheme() === "dark" ? notebookDark : notebookPaper;
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12) + (notebook ? 8 : 0);
  const { isOffline } = useOfflineStatus();
  const inFlightRef = useRef(false);
  const syncTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || isOffline || inFlightRef.current) return;
      syncTaskRef.current?.cancel();
      const task = scheduleAfterInteractions(() => {
        inFlightRef.current = true;
        void autoSyncSleepFromHealthConnectIfEligible(user.uid, { minIntervalMinutes: 30 }).finally(
          () => {
            inFlightRef.current = false;
          }
        );
      });
      syncTaskRef.current = task;
    });
    return () => {
      syncTaskRef.current?.cancel();
      unsub();
    };
  }, [isOffline]);

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: false,
        freezeOnBlur: true,
        tabBarStyle: {
          backgroundColor: notebook ? paper.canvas : "#0d0d1a",
          borderTopColor: notebook ? paper.rule : "rgba(255,255,255,0.08)",
          height: notebook ? notebookTabBarHeight(insets.bottom, fontScale) : 60 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
        },
        tabBarActiveTintColor: notebook ? paper.ink : "#7b61ff",
        tabBarInactiveTintColor: notebook ? paper.muted : "#888",
        tabBarLabelStyle: notebook ? { fontFamily: notebookFonts.body, fontSize: 11 } : undefined,
        tabBarLabel: notebook && fontScale >= 1.5 ? ({ color }) => <Text style={{ fontFamily: notebookFonts.body, fontSize: 11, lineHeight: 14, textAlign: "center", color }}>{({ home: "Home", workout: "Work\nout", nutrition: "Nutri\ntion", "sleep/index": "Sleep", "profile/index": "Pro\nfile" } as Record<string, string>)[route.name]}</Text> : undefined,
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        // React Navigation permits nullable press handlers; TouchableOpacity does not.
        tabBarButton: (props) => <TouchableOpacity {...(props as TouchableOpacityProps)} activeOpacity={0.8} />,
        tabBarIcon: ({ color, size, focused }) => {
          if (notebook) return <NotebookTabIcon name={route.name} color={color} focused={focused} />;
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
      <Tabs.Screen name="index" options={{ href: null, tabBarStyle: { display: "none" } }} />
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
