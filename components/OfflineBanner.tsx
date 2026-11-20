import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOfflineStatus } from "../src/hooks/useOfflineStatus";
import { notebookDialogTabHeight } from "../src/ui/notebook/navigationGeometry";

export default function OfflineBanner() {
  const { isOffline, ready } = useOfflineStatus();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const bottom = notebookDialogTabHeight(pathname, insets.bottom, fontScale) ?? insets.bottom;
  const [dismissed, setDismissed] = React.useState(false);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (isOffline || !dismissed) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setDismissed(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [dismissed, isOffline]);

  if (!ready || !isOffline || dismissed) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { bottom }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="You are offline. Dismiss message" onPress={() => setDismissed(true)} style={styles.banner}>
        <Text style={styles.title}>You are offline</Text>
        <Text style={styles.subtitle}>Some features may be limited until you reconnect.</Text>
      </Pressable>
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
