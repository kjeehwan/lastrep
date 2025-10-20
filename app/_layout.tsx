import { Redirect, Stack, usePathname } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth, db } from "../firebaseConfig";

export default function RootLayout() {
  const pathname = usePathname();
  const [user, setUser] = useState(auth.currentUser);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const ref = doc(db, "users", currentUser.uid);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            const data = snap.data();
            setOnboarded(!!data.hasCompletedOnboarding);
          } else {
            setOnboarded(false);
          }
        } catch (err) {
          console.warn("Firestore read failed:", err);
          setOnboarded(false);
        }
      } else {
        setOnboarded(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 🧠 Readability & maintenance boost:
  const ALLOWED_AFTER_ONBOARDING = ["/home", "/workout"];

  // 🔍 Debug logs (optional)
  console.log("🔥 LAYOUT DEBUG", {
    loading,
    user: user?.uid || null,
    onboarded,
    pathname,
  });

  // 🔹 Default route redirect
  if (!pathname || pathname === "/" || pathname === "") {
    return <Redirect href="/launch" />;
  }

  // 🔹 Loading state (Firebase check)
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 🔹 Splash & Onboarding Routes
  if (pathname.startsWith("/launch") || pathname.startsWith("/onboarding")) {
    if (pathname.startsWith("/launch") && user && onboarded) {
      return <Redirect href="/home" />;
    }

    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="launch" />
        <Stack.Screen name="onboarding" />
      </Stack>
    );
  }

  // 🔹 Not signed in → Sign in
  if (!user && !pathname.startsWith("/auth")) {
    return <Redirect href="/auth/sign-in" />;
  }

  // 🔹 Signed in but not onboarded → Start onboarding
  if (user && onboarded === false && !pathname.startsWith("/onboarding")) {
    return <Redirect href="/onboarding/ready" />;
  }

  // 🔹 Signed in & onboarded → allow home, workout, etc.
  const isAllowedAfterOnboarding = ALLOWED_AFTER_ONBOARDING.some((path) =>
    pathname.startsWith(path)
  );

  if (user && onboarded === true && !isAllowedAfterOnboarding) {
    return <Redirect href="/home" />;
  }

  // 🔹 Default app stack
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="launch" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="home" />
      <Stack.Screen name="workout" /> {/* Automatically handles all nested workout routes */}
    </Stack>
  );
}
