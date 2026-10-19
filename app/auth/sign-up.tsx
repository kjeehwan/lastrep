import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  UserCredential,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  signInWithCredential,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
import { AuthNotebookForm } from "../../src/auth/AuthNotebookForm";
import { requestGoogleIdToken } from "../../src/auth/googleSignIn";
import { useAuthRequest } from "../../src/auth/useAuthRequest";
import { validateAuthFields } from "../../src/auth/authPresentation";
import { NotebookProvider } from "../../src/ui/notebook/Notebook";
import { auth } from "../../src/config/firebaseConfig";
import { buildDefaultUserDoc, getDecisionUsage, getUserData, saveUserData } from "../../src/userData";

export default function SignUp() { return <NotebookProvider><SignUpContent /></NotebookProvider>; }
function SignUpContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const request = useAuthRequest("sign-up");
  const router = useRouter();
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      scopes: ["profile", "email"],
      offlineAccess: true,
    });
  }, []);

  const handleSignUp = () => request.run("email", async () => {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await finalizeRegistration(userCredential, true);
  }, validateAuthFields("sign-up", email, password));

  const finalizeRegistration = async (userCredential: UserCredential, isNewUser: boolean) => {
    const userToken = await userCredential.user.getIdToken(); // Get the Firebase ID token
    await AsyncStorage.setItem("userToken", userToken); // Save the user token

    const tzOffsetMinutes = new Date().getTimezoneOffset();
    if (isNewUser) {
      await saveUserData(
        userCredential.user.uid,
        buildDefaultUserDoc({
          email: userCredential.user.email,
          name:
            userCredential.user.displayName ||
            userCredential.user.email?.split("@")[0] ||
            "New User",
          goal: "Build muscle",
        }, new Date(), tzOffsetMinutes)
      );
      await AsyncStorage.setItem("isSignedUp", "true");
      router.push("/onboarding/goal"); // Redirect to onboarding after successful sign-up
    } else {
      const data = await getUserData(userCredential.user.uid);
      if (data) {
        const normalized = getDecisionUsage(data, new Date(), tzOffsetMinutes);
        await saveUserData(userCredential.user.uid, {
          usage: { decisions: normalized },
        });
      }
      router.replace("/(tabs)/home");
    }
  };

  const handleGooglePress = () => request.run("google", async () => {
    const idToken = await requestGoogleIdToken(GoogleSignin);
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const additionalInfo = getAdditionalUserInfo(userCredential);
    await finalizeRegistration(userCredential, additionalInfo?.isNewUser ?? false);
  });

  return <AuthNotebookForm mode="sign-up" email={email} password={password}
    onEmailChange={value => { setEmail(value); request.setError(null); }}
    onPasswordChange={value => { setPassword(value); request.setError(null); }}
    onSubmit={() => { void handleSignUp(); }} onGoogle={() => { void handleGooglePress(); }}
    onSwitch={() => router.push("/auth/sign-in")}
    active={request.active} error={request.error} />;
}
