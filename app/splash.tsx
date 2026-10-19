import { Redirect } from "expo-router";
// All entry paths use Firebase auth and the same account-scoped onboarding gate.
export default function SplashRoute() { return <Redirect href="/" />; }
