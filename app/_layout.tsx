// import { Redirect, Stack, usePathname } from "expo-router";
// import { onAuthStateChanged, User } from "firebase/auth";
// import { doc, getDoc } from "firebase/firestore";
// import React, { useEffect, useState } from "react";
// import { ActivityIndicator, View } from "react-native";
// import { ThemeProvider } from "../contexts/ThemeContext";
// import { auth, db } from "../firebaseConfig";

// export default function RootLayout() {
//   const [user, setUser] = useState<User | null>(auth.currentUser);
//   const [onboarded, setOnboarded] = useState<boolean | null>(null);
//   const [loading, setLoading] = useState(true);
//   const pathname = usePathname();

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
//       setUser(currentUser);
//       if (!currentUser) {
//         setOnboarded(null);
//         setLoading(false);
//         return;
//       }

//       try {
//         const snap = await getDoc(doc(db, "users", currentUser.uid));
//         setOnboarded(snap.exists() ? !!snap.data()?.hasCompletedOnboarding : false);
//       } catch {
//         setOnboarded(false);
//       } finally {
//         setLoading(false);
//       }
//     });
//     return unsubscribe;
//   }, []);

//   if (loading) {
//     return (
//       <ThemeProvider>
//         <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
//           <ActivityIndicator size="large" />
//         </View>
//       </ThemeProvider>
//     );
//   }

//   // 🚪 Not signed in → go to auth flow
//   if (!user && !pathname.startsWith("/auth")) {
//     return (
//       <ThemeProvider>
//         <Redirect href="/auth/sign-in" />
//       </ThemeProvider>
//     );
//   }

//   // 🧭 Signed in but not onboarded → onboarding screens
//   if (user && onboarded === false && !pathname.startsWith("/onboarding")) {
//     return (
//       <ThemeProvider>
//         <Redirect href="/onboarding/ready" />
//       </ThemeProvider>
//     );
//   }

//   return (
//     <ThemeProvider>
//       <Stack screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="launch" />
//         <Stack.Screen name="auth" />
//         <Stack.Screen name="onboarding" />
//         <Stack.Screen name="home" />
//         <Stack.Screen name="workout" />
//       </Stack>
//     </ThemeProvider>
//   );
// }

import { Redirect, Stack, usePathname } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ThemeProvider } from "../contexts/ThemeContext";
import { auth, db } from "../firebaseConfig";

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();

  // ✅ Auth listener (runs once)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setOnboarded(null);
        setChecking(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        setOnboarded(snap.exists() ? !!snap.data()?.hasCompletedOnboarding : false);
      } catch (err) {
        console.warn("⚠️ Firestore check failed:", err);
        setOnboarded(false);
      } finally {
        setChecking(false);
      }
    });

    return unsubscribe;
  }, []);

  // ⏳ Initial loading screen
  if (checking || user === undefined) {
    return (
      <ThemeProvider>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      </ThemeProvider>
    );
  }

  // 🚪 Not signed in → only allow /auth routes
  if (!user && !pathname.startsWith("/auth")) {
    return <Redirect href="/auth/sign-in" />;
  }

  // 🧭 Signed in but not onboarded → only allow onboarding
  if (user && onboarded === false && !pathname.startsWith("/onboarding")) {
    return <Redirect href="/onboarding/ready" />;
  }

  // 🏠 Signed in and onboarded → main app
  if (user && onboarded === true && pathname.startsWith("/auth")) {
    return <Redirect href="/home/(tabs)" />;
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="launch" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="home" />
        <Stack.Screen name="workout" />
      </Stack>
    </ThemeProvider>
  );
}



