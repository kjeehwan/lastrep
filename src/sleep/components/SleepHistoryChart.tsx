import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { shiftSleepDate, sleepDurationText, type SleepDay } from "../sleepSessionModel";
import { sleepDisplayDate } from "./SleepEntryEditor";

export function SleepHistoryChart({ days, selected, anchor, target, onSelect }: { days: SleepDay[]; selected: string; anchor: string; target: number; onSelect: (key: string) => void }) {
  const { colors } = useNotebook();
  const { fontScale, width, height } = useWindowDimensions();
  const large = fontScale >= 1.5;
  const scroll = useRef<ScrollView>(null);
  const browsed = useRef(false);
  const [readyAnchor, setReadyAnchor] = useState<string | null>(null);
  const dates = Array.from({ length: 14 }, (_, index) => shiftSleepDate(anchor, index - 13));
  const cell = large ? 100 : 56, plot = large ? 200 : 144;
  const scale = Math.max(10, target + 1, ...days.filter((day) => dates.includes(day.dateKey)).map((day) => day.hours));
  const selectedDay = days.find((day) => day.dateKey === selected);
  const text = { color: colors.muted, fontFamily: notebookFonts.body, fontSize: 14 };
  const snap = useCallback(() => { if (!browsed.current) scroll.current?.scrollToEnd({ animated: false }); }, []);
  useEffect(() => { browsed.current = false; const frame = requestAnimationFrame(() => { scroll.current?.scrollToEnd({ animated: false }); setReadyAnchor(anchor); }); return () => cancelAnimationFrame(frame); }, [anchor]);
  useEffect(() => { const frame = requestAnimationFrame(snap); return () => cancelAnimationFrame(frame); }, [width, height, cell, snap]);
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Text style={text}>{sleepDisplayDate(selected)}</Text><Text style={{ ...text, color: colors.ink, fontFamily: notebookFonts.semibold }}>{sleepDurationText(selectedDay?.hours ?? null)}</Text></View>
    <Text style={text}>{selectedDay ? selectedDay.mayIncludeAwakeTime ? "May include awake time" : "Time asleep" : "No saved sleep for this date"}</Text>
    <Text style={text}>Dashed line: your {target} h target</Text>
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onScrollBeginDrag={() => { browsed.current = true; }} onContentSizeChange={snap} style={{ opacity: readyAnchor === anchor ? 1 : 0 }}>
      <View style={{ flexDirection: "row", width: cell * dates.length }}>
        <View pointerEvents="none" style={{ position: "absolute", top: plot * (1 - target / scale), width: "100%", borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.border }} />
        {dates.map((date, index) => {
          const day = days.find((value) => value.dateKey === date);
          return <Pressable key={date} accessibilityRole="button" accessibilityState={{ selected: date === selected }} accessibilityLabel={`${sleepDisplayDate(date)}: ${sleepDurationText(day?.hours ?? null)}`} onPress={() => onSelect(date)} style={{ width: cell, gap: 8, paddingHorizontal: 4, alignItems: "center", paddingBottom: 8 }}>
            <View style={{ height: plot, justifyContent: "flex-end", alignItems: "center" }}>
              {day ? <View style={{ width: large ? 32 : 20, height: Math.max(2, day.hours / scale * plot), backgroundColor: date === selected ? colors.accent : colors.border, borderRadius: 2 }} /> : <View style={{ width: large ? 32 : 20, height: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 2 }} />}
            </View>
            <Text style={{ ...text, textAlign: "center", color: date === selected ? colors.accent : colors.muted }}>{index === 0 || date.endsWith("-01") ? sleepDisplayDate(date).replace(/,?\s*\d{4}/, "") : Number(date.slice(-2))}</Text>
          </Pressable>;
        })}
      </View>
    </ScrollView>
    <Text style={text}>Tap a date to review it. Gaps mean no saved record.</Text>
  </View>;
}
