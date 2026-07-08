import React from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";

type EntranceViewProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  from?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  transition?: Record<string, unknown>;
};

export default function EntranceView({
  children,
  style,
  from,
  animate,
  transition,
}: EntranceViewProps) {
  if (Platform.OS === "web") {
    return <View style={style}>{children}</View>;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MotiView } = require("moti") as typeof import("moti");

  return (
    <MotiView from={from} animate={animate} transition={transition} style={style}>
      {children}
    </MotiView>
  );
}
