import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { ColorValue } from "react-native";

/** Approved Home utility drawings, shared with the browser notebook baseline. */
export function NotebookUtilityIcon({ name, color, size = 22 }: { name: "calendar" | "settings" | "help"; color: ColorValue; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {name === "calendar" ? <><Rect x={4} y={5} width={16} height={16} rx={1} /><Path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></> : name === "settings" ? <><Path d="M4 6h5M13 6h7M4 12h10M18 12h2M4 18h2M10 18h10" /><Circle cx={11} cy={6} r={2} /><Circle cx={16} cy={12} r={2} /><Circle cx={8} cy={18} r={2} /></> : <><Circle cx={12} cy={12} r={9} /><Path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01" /></>}
  </Svg>;
}
