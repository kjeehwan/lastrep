import React, { useEffect } from "react";
import * as Linking from "expo-linking";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NotebookProvider, useNotebook } from "../src/ui/notebook/Notebook";
import { notebookFonts } from "../src/ui/notebook/tokens";
import { useSharing } from "../src/sharing/SharingProvider";
function SharedWorkout() {
  const { token } = useLocalSearchParams<{ token?: string }>(),
    { uid, openToken, resumeLinkAfterSignIn } = useSharing(),
    { colors } = useNotebook(),
    router = useRouter(),
    focused = useIsFocused();
  const validToken = typeof token === "string" && /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{32})$/.test(token);
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
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          justifyContent: "center",
          padding: 24,
          gap: 16,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: colors.ink,
            fontFamily: notebookFonts.semibold,
            fontSize: 24,
          }}
        >
          Shared workout
        </Text>
        {!validToken && (
          <Text
            style={{
              color: colors.ink,
              fontFamily: notebookFonts.body,
              fontSize: 16,
            }}
          >
            This sharing link is unavailable. Ask the sender for a new link.
          </Text>
        )}
        {validToken && (
          <Pressable
            accessibilityRole="button"
            onPress={() => openToken(token!)}
            style={{
              minHeight: 48,
              padding: 14,
              borderRadius: 8,
              backgroundColor: colors.primary,
            }}
          >
            <Text
              style={{
                fontFamily: notebookFonts.semibold,
                fontSize: 16,
                color: colors.onPrimary,
                textAlign: "center",
              }}
            >
              Open shared workout
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: "center" }}
          onPress={() => {
            if (uid) router.replace("/home");
            else {
              if (token) resumeLinkAfterSignIn(token);
              router.push("/auth/sign-in");
            }
          }}
        >
          <Text
            style={{
              color: colors.ink,
              fontFamily: notebookFonts.body,
              fontSize: 16,
            }}
          >
            {uid ? "Go to Home" : "Sign in to use this workout"}
          </Text>
        </Pressable>
      </View>
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
