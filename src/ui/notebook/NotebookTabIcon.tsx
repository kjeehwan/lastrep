import React from "react";
import Svg, { Path, Circle } from "react-native-svg";
import type { ColorValue } from "react-native";
export function NotebookTabIcon({ name, color }: { name: string; color: ColorValue }) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {name === "workout" ? <><Path d="M2 12h20" /><Path d="M7 5v14M17 5v14M4 9v6M20 9v6" strokeWidth={2.1} /></> : name === "home" ? <Path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10" /> : name === "nutrition" ? <Path d="M12 7C4 2 1 10 5 17c2 5 5 4 7 3 2 1 5 2 7-3 4-7 1-15-7-10ZM12 7c0-4 3-5 6-5" /> : name === "sleep/index" ? <Path d="M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z" /> : <><Circle cx={12} cy={7} r={4} /><Path d="M4 21c0-9 16-9 16 0Z" /></>}
  </Svg>;
}
