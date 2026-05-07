import React from "react";
import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

const LastRepLogo = () => {
  const appVariant = String((Constants.expoConfig?.extra as { appVariant?: unknown } | undefined)?.appVariant ?? "");
  const appName = (Constants.expoConfig?.name ?? "").toLowerCase();
  const androidPackage = (Constants.expoConfig?.android?.package ?? "").toLowerCase();
  const scheme = String(Constants.expoConfig?.scheme ?? "").toLowerCase();
  const linkingUri = String(Constants.linkingUri ?? "").toLowerCase();
  const isDevVariant =
    __DEV__ ||
    appVariant === "dev" ||
    appName.includes("dev") ||
    androidPackage.endsWith(".dev") ||
    scheme.includes("lastrep-dev") ||
    linkingUri.includes("lastrep-dev") ||
    linkingUri.includes("com.kjeehwan.lastrep.dev");
  const startColor = isDevVariant ? "#ef4444" : "#4a90e2";
  const endColor = isDevVariant ? "#f97316" : "#7b61ff";

  return (
    <View style={styles.container}>
      <Svg height="80" width="260" viewBox="0 0 260 80">
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={startColor} />
            <Stop offset="100%" stopColor={endColor} />
          </LinearGradient>
        </Defs>

        <SvgText
          x="50%"
          y="55%"
          textAnchor="middle"
          fontSize="48"
          fontWeight="bold"
          fill="url(#grad)"
          fontFamily="sans-serif"
        >
          lastrep
        </SvgText>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 20, // reduced space below logo
  },
});

export default LastRepLogo;
