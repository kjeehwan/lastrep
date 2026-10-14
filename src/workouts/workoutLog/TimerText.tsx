import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useIsFocused } from "expo-router";
import { useNow } from "../../hooks/useNow";
import { advanceRest, elapsedAt, type RestClock } from "./timerClock";

function clockLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function ElapsedTimerText({ seconds, startedAtMs }: { seconds: number; startedAtMs: number | null }) {
  const focused = useIsFocused();
  const now = useNow(1000, focused && startedAtMs !== null);
  return <>{clockLabel(elapsedAt({ elapsedSeconds: seconds, startedAtMs }, now))}</>;
}

export function RestTimerText({ clock, prefix, style }: { clock: RestClock; prefix: string; style?: StyleProp<TextStyle> }) {
  const focused = useIsFocused();
  const now = useNow(1000, focused && clock.running);
  return <Text style={style}>{prefix}{clockLabel(Math.min(clock.remainingSec, advanceRest(clock, now).remainingSec))}</Text>;
}
