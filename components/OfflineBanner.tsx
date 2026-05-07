import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOfflineStatus } from "../src/hooks/useOfflineStatus";

export default function OfflineBanner() {
  const { isOffline, ready } = useOfflineStatus();
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!isOffline) {
      setDismissed(false);
    }
  }, [isOffline]);

  if (!ready || !isOffline || dismissed) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
        <Pressable onPress={() => setDismissed(true)} style={styles.banner}>
          <Text style={styles.title}>You are offline</Text>
          <Text style={styles.subtitle}>Some features may be limited until you reconnect.</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    zIndex: 1000,
  },
  safeArea: {
    alignItems: "stretch",
  },
  banner: {
    backgroundColor: "rgba(163, 53, 53, 0.96)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    marginTop: 2,
  },
});
