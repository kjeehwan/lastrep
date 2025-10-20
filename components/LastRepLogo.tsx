import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export default function LastRepLogo({ size = 64 }: { size?: number }) {
  const circleRadius = size / 2;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle
          cx="50"
          cy="50"
          r="45"
          stroke="#111"
          strokeWidth="8"
          fill="none"
        />
        <Path
          d="M30 50 L45 65 L70 35"
          stroke="#111"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Text style={styles.text}>LastRep</Text>
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
    fontSize: 32,
    fontWeight: "700",
    color: "#111",
  },
});
