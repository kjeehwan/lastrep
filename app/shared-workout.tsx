import React, { useEffect } from "react";
import * as Linking from "expo-linking";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NotebookProvider, useNotebook } from "../src/ui/notebook/Notebook";
import { notebookFonts } from "../src/ui/notebook/tokens";
import { useSharing } from "../src/sharing/SharingProvider";
import { NotebookHeader } from "../src/ui/notebook/NotebookHeader";
import { useNotebookStatusBar } from "../src/ui/notebook/useNotebookStatusBar";
import { SettingsAction } from "../src/settings/SettingsNotebookControls";
function SharedWorkout() {
  useNotebookStatusBar();
  const { token } = useLocalSearchParams<{ token?: string }>(),
    { uid, openToken, resumeLinkAfterSignIn } = useSharing(),
    { colors } = useNotebook(),
    router = useRouter(),
    focused = useIsFocused();
  const validToken = typeof token === "string" && /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{32})$/.test(token);
  const leaveLink = () => {
    if (uid) router.replace("/home");
    else {
      if (validToken) resumeLinkAfterSignIn(token!);
      router.push("/auth/sign-in");
    }
  };
  useEffect(() => {
    if (focused && typeof token === "string" && /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{32})$/.test(token))
      openToken(token);
  }, [token, uid, focused, openToken]);
  useEffect(() => {
    if (!focused || typeof token !== "string" || !/^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{32})$/.test(token))
      return;
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const incoming = Linking.parse(url);
      if (
        (incoming.hostname === "shared-workout" ||
          incoming.path === "shared-workout" ||
          incoming.path === `w/${token}`) &&
        (incoming.queryParams?.token === token || incoming.path === `w/${token}`)
      )
        openToken(token);
    });
    return () => subscription.remove();
  }, [focused, token, openToken]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <NotebookHeader title="Shared workout" onBack={leaveLink} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 32 }}
      >
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 24 }}>
          <View style={{ gap: 12 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.ink,
                fontFamily: notebookFonts.editorial,
                fontSize: 28,
                lineHeight: 36,
              }}
            >
              {validToken ? "A workout shared with you" : "Link unavailable"}
            </Text>
          <Text
            style={{
              color: colors.muted,
              fontFamily: notebookFonts.body,
              fontSize: 16,
              lineHeight: 24,
            }}
          >
            {validToken
              ? "Review the plan, use it for a new workout or save it to My routines."
              : "This sharing link is unavailable. Ask the sender for a new link."}
          </Text>
          </View>
          <View style={{ gap: 12 }}>
            {validToken && (
              <SettingsAction
                label="Open shared workout"
                primary
                onPress={() => openToken(token!)}
              />
            )}
            <SettingsAction label={uid ? "Go to Home" : "Sign in to use this workout"} onPress={leaveLink} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
export default function SharedWorkoutRoute() {
  return (
    <NotebookProvider>
      <SharedWorkout />
    </NotebookProvider>
  );
}
