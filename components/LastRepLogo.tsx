import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

const LastRepLogo = () => {
  return (
    <View style={styles.container}>
      <Svg height="80" width="260" viewBox="0 0 260 80">
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#4a90e2" />
            <Stop offset="100%" stopColor="#7b61ff" />
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
