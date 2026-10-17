import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { PanResponder, type GestureResponderEvent, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { sleepMinutesTime, sleepTimeMinutes } from "../sleepSessionModel";

const SIZE = 260, CENTER = 130, RADIUS = 86;
export function SleepDial({ bedtime, wakeTime, hours, onChange }: { bedtime: string; wakeTime: string; hours: number | null; onChange: (field: "bedtime" | "wakeTime", value: string) => void }) {
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  const dial = useRef<View>(null);
  const position = useRef({ x: 0, y: 0 });
  const latestChange = useRef(onChange);
  useEffect(() => { latestChange.current = onChange; }, [onChange]);
  const grant = useCallback((field: "bedtime" | "wakeTime", event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    dial.current?.measureInWindow((x, y) => {
      position.current = { x, y };
      const angle = Math.atan2(pageX - x - CENTER, -(pageY - y - CENTER));
      latestChange.current(field, sleepMinutesTime(Math.round(((angle * 720 / Math.PI + 1440) % 1440) / 5) * 5));
    });
  }, []);
  const move = useCallback((field: "bedtime" | "wakeTime", event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const angle = Math.atan2(pageX - position.current.x - CENTER, -(pageY - position.current.y - CENTER));
    latestChange.current(field, sleepMinutesTime(Math.round(((angle * 720 / Math.PI + 1440) % 1440) / 5) * 5));
  }, []);
  // PanResponder stores these handlers; it does not invoke them during render.
  /* eslint-disable react-hooks/refs */
  const responders = useMemo(() => Object.fromEntries((["bedtime", "wakeTime"] as const).map((field) => [field, PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => grant(field, event),
    onPanResponderMove: (event) => move(field, event),
  })])), [grant, move]);
  /* eslint-enable react-hooks/refs */
  const start = sleepTimeMinutes(bedtime), end = sleepTimeMinutes(wakeTime);
  const circumference = 2 * Math.PI * RADIUS;
  const minutes = start != null && end != null ? (end - start + 1440) % 1440 || (hours != null ? 1440 : 0) : null;
  return <View ref={dial} collapsable={false} style={{ width: SIZE, height: SIZE, alignSelf: "center" }}>
    <Svg width={SIZE} height={SIZE} viewBox="0 0 260 260" accessible={false}>
      <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={colors.rule} strokeWidth={12} fill="none" />
      {minutes != null ? <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={colors.accent} strokeWidth={12} fill="none" strokeDasharray={`${minutes / 1440 * circumference} ${circumference}`} transform={`rotate(${start! / 4 - 90} 130 130)`} /> : null}
      {Array.from({ length: 24 }, (_, hour) => { const angle = hour * Math.PI / 12; return <Line key={hour} x1={CENTER + Math.sin(angle) * 99} y1={CENTER - Math.cos(angle) * 99} x2={CENTER + Math.sin(angle) * 103} y2={CENTER - Math.cos(angle) * 103} stroke={colors.border} />; })}
      {[[130, 20, "00"], [242, 136, "06"], [130, 248, "12"], [18, 136, "18"]].map(([x, y, label]) => <SvgText key={label} x={x} y={y} textAnchor="middle" fontSize={14 * Math.min(1.5, fontScale)} fontFamily={notebookFonts.body} fill={colors.muted}>{label}</SvgText>)}
    </Svg>
    <View pointerEvents="none" style={{ position: "absolute", top: 104, left: 58, width: 144, alignItems: "center" }}><Text style={{ color: colors.ink, fontFamily: notebookFonts.semibold, fontSize: 16, textAlign: "center" }}>{hours == null ? "Set sleep times" : `${Math.floor(Math.round(hours * 60) / 60)} h ${Math.round(hours * 60) % 60} min`}</Text></View>
    {(["bedtime", "wakeTime"] as const).map((field) => {
      const value = sleepTimeMinutes(field === "bedtime" ? bedtime : wakeTime), angle = (value ?? (field === "bedtime" ? 1380 : 420)) * Math.PI / 720;
      return <View key={field} {...responders[field].panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={field === "bedtime" ? "Bedtime" : "Wake time"} accessibilityValue={{ min: 0, max: 1439, now: value ?? 0, text: value == null ? "Not set" : sleepMinutesTime(value) }} accessibilityActions={[{ name: "increment", label: "5 minutes later" }, { name: "decrement", label: "5 minutes earlier" }]} onAccessibilityAction={(event) => onChange(field, sleepMinutesTime((value ?? 0) + (event.nativeEvent.actionName === "increment" ? 5 : -5)))} style={{ position: "absolute", left: CENTER + Math.sin(angle) * RADIUS - 24, top: CENTER - Math.cos(angle) * RADIUS - 24, width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
        <View style={{ borderColor: colors.accent, borderWidth: 2, borderStyle: value == null ? "dashed" : "solid", backgroundColor: colors.surface, minWidth: 30, minHeight: 30, borderRadius: 18, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.ink, fontFamily: notebookFonts.semibold, fontSize: 14 }}>{field === "bedtime" ? "B" : "W"}</Text></View>
      </View>;
    })}
  </View>;
}
