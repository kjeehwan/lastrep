import { Stack } from "expo-router";

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,  // Prevents showing the header in tab screen
        }}
      />
      {/* Ensure settings routes are properly defined */}
      <Stack.Screen
        name="settings/index"
        options={{
          title: "Settings",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="settings/privacy"
        options={{
          title: "Privacy Policy",
        }}
      />
      <Stack.Screen
        name="settings/terms"
        options={{
          title: "Terms of Service",
        }}
      />
    </Stack>
  );
}
