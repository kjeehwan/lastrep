import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../contexts/ThemeContext";

type Props = {
  size?: number;
  showText?: boolean;
};

export default function LastRepLogo({ size = 64, showText = true }: Props) {
  const { theme } = useTheme();

  const circleRadius = size / 2;
  const strokeWidth = size * 0.08;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Outer circle */}
        <Circle
          cx="50"
          cy="50"
          r="45"
          stroke={theme.primary}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Checkmark */}
        <Path
          d="M30 50 L45 65 L70 35"
          stroke={theme.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>

      {showText && (
        <Text
          style={[
            styles.text,
            {
              color: theme.textPrimary,
              fontSize: size * 0.5,
            },
          ]}
        >
          LastRep
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  text: {
    fontWeight: "700",
  },
});
