import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  UserCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
import { AuthNotebookForm } from "../../src/auth/AuthNotebookForm";
import { requestGoogleIdToken } from "../../src/auth/googleSignIn";
import { useAuthRequest } from "../../src/auth/useAuthRequest";
import { validateAuthFields } from "../../src/auth/authPresentation";
import { NotebookProvider } from "../../src/ui/notebook/Notebook";
import { auth } from "../../src/config/firebaseConfig";
import { createOnboardingUser, resolveOnboardingDestination } from "../../src/onboarding/onboardingService";
import { buildDefaultUserDoc, getDecisionUsage, getUserData, saveUserData } from "../../src/userData";

export default function SignIn() { return <NotebookProvider><SignInContent /></NotebookProvider>; }
function SignInContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const request = useAuthRequest("sign-in");
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      scopes: ["profile", "email"],
      offlineAccess: true,
    });
  }, []);

  const handleSignIn = () => request.run("email", async () => {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    await finalizeSession(userCredential);
  }, validateAuthFields("sign-in", email, password));

  const finalizeSession = async (userCredential: UserCredential) => {
    const userToken = await userCredential.user.getIdToken();
    await AsyncStorage.setItem("userToken", userToken);

    const data = await getUserData(userCredential.user.uid);

    const tzOffsetMinutes = new Date().getTimezoneOffset();
    if (!data) {
      const destination = await createOnboardingUser(
        userCredential.user.uid,
        buildDefaultUserDoc({
          email: userCredential.user.email,
          name:
            userCredential.user.displayName ||
            userCredential.user.email?.split("@")[0] ||
            "New User",
        }, new Date(), tzOffsetMinutes)
      );
      await AsyncStorage.setItem("isSignedUp", "true");
      router.replace(destination);
      return;
    }

    if (data) {
      const normalized = getDecisionUsage(data, new Date(), tzOffsetMinutes);
      await saveUserData(userCredential.user.uid, {
        usage: { decisions: normalized },
      });
    }

    router.replace(await resolveOnboardingDestination(userCredential.user.uid, data));
  };

  const handleGooglePress = () => request.run("google", async () => {
    const idToken = await requestGoogleIdToken(GoogleSignin);
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    await finalizeSession(userCredential);
  });

  return <AuthNotebookForm mode="sign-in" email={email} password={password}
    onEmailChange={value => { setEmail(value); request.setError(null); }}
    onPasswordChange={value => { setPassword(value); request.setError(null); }}
    onSubmit={() => { void handleSignIn(); }} onGoogle={() => { void handleGooglePress(); }}
    onSwitch={() => router.push("/auth/sign-up")}
    active={request.active} error={request.error} />;
}
