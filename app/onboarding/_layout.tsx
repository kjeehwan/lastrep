import { Stack, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect } from "react";
import { db } from "../../firebaseConfig"; // Adjust path if needed

export default function OnboardingLayout() {
  const router = useRouter();

  useEffect(() => {
    const checkUserData = async () => {
      const user = getAuth().currentUser;

      if (user) {
        const userRef = doc(db, "users", user.uid); // Get user's Firestore document reference
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();

          // Check if onboarding data is missing, redirect accordingly
          if (!data.goal) {
            router.replace("/onboarding/goal"); // Redirect to goal screen if missing
          } else if (!data.experience) {
            router.replace("/onboarding/experience"); // Redirect to experience screen if missing
          } else if (!data.trainingDays) {
            router.replace("/onboarding/availability"); // Redirect to availability screen if missing
          } else if (!data.hasCompletedOnboarding) {
            router.replace("/onboarding/preview"); // Redirect to preview screen if onboarding incomplete
          } else {
            router.replace("/home"); // If onboarding is complete, redirect to home
          }
        } else {
          router.replace("/onboarding/ready"); // If no Firestore document, start from ready screen
        }
      }
    };

    checkUserData(); // Perform user data check on load
  }, [router]);

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
