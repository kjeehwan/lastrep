import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ready" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="goal" />
      <Stack.Screen name="experience" />
      <Stack.Screen name="availability" />
      <Stack.Screen name="preview" />
    </Stack>
  );
}
