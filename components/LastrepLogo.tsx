import React, { useId } from "react";
import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg";
import wordmark from "../src/branding/wordmarkGeometry.json";

const LastrepLogo = ({ variant = "splash" }: { variant?: "splash" | "header" }) => {
  const isHeader = variant === "header";
  const bounds = wordmark.bounds;
  const inkWidth = bounds.width * wordmark.header.width / 260;
  const gradientId = `lastrep-${useId().replace(/:/g, "")}`;
  const appVariant = String((Constants.expoConfig?.extra as { appVariant?: unknown } | undefined)?.appVariant ?? "");
  const appName = (Constants.expoConfig?.name ?? "").toLowerCase();
  const androidPackage = (Constants.expoConfig?.android?.package ?? "").toLowerCase();
  const scheme = String(Constants.expoConfig?.scheme ?? "").toLowerCase();
  const linkingUri = String(Constants.linkingUri ?? "").toLowerCase();
  const isDevVariant =
    appVariant === "dev" ||
    appName.includes("dev") ||
    androidPackage.endsWith(".dev") ||
    scheme.includes("lastrep-dev") ||
    linkingUri.includes("lastrep-dev") ||
    linkingUri.includes("com.kjeehwan.lastrep.dev");
  const startColor = isDevVariant ? "#ffab3d" : "#4a90e2";
  const endColor = isDevVariant ? "#ff5c3d" : "#7b61ff";

  return (
    <View style={[styles.container, isHeader && styles.header]} accessible accessibilityRole="image" accessibilityLabel="Lastrep">
      <Svg height={isHeader ? wordmark.header.height : inkWidth * bounds.height / bounds.width}
        width={isHeader ? wordmark.header.width : inkWidth}
        viewBox={isHeader ? wordmark.header.viewBox : `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={startColor} />
            <Stop offset="100%" stopColor={endColor} />
          </LinearGradient>
        </Defs>

        <Path d={wordmark.path} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  header: {
    alignItems: "flex-start",
    marginBottom: 0,
    flexShrink: 1,
  },
});

export default LastrepLogo;
