import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useIsFocused } from "expo-router";
import { useNow } from "../../hooks/useNow";
import { advanceRest, elapsedAt, type RestClock } from "./timerClock";

export function clockLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function ElapsedTimerText({ seconds, startedAtMs }: { seconds: number; startedAtMs: number | null }) {
  const focused = useIsFocused();
  const now = useNow(1000, focused && startedAtMs !== null);
  return <>{clockLabel(elapsedAt({ elapsedSeconds: seconds, startedAtMs }, now)).padStart(5, "0")}</>;
}

export function RestTimerText({ clock, prefix, style, padMinutes = false }: { clock: RestClock; prefix: string; style?: StyleProp<TextStyle>; padMinutes?: boolean }) {
  const focused = useIsFocused();
  const now = useNow(1000, focused && clock.running);
  const label = clockLabel(Math.min(clock.remainingSec, advanceRest(clock, now).remainingSec));
  return <Text style={style}>{prefix}{padMinutes ? label.padStart(5, "0") : label}</Text>;
}
