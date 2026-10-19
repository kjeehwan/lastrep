import { Stack } from "expo-router";
import { NotebookProvider } from "../../src/ui/notebook/Notebook";
import { OnboardingProvider } from "../../src/onboarding/OnboardingProvider";

export default function OnboardingLayout() {
  return <NotebookProvider><OnboardingProvider><Stack screenOptions={{ headerShown: false, gestureEnabled: false }} /></OnboardingProvider></NotebookProvider>;
}
