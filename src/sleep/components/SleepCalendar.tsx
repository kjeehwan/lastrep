import React, { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { mondayCalendarMatrix } from "../../home/notebookPresentation";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { parseSleepDate, sleepDateKey } from "../sleepSessionModel";
export function SleepCalendar({ selected, onSelect }: { selected: string; onSelect: (date: string) => void }) {
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(0);
  const columnWidth = Math.max(44, Math.ceil(24 * fontScale), viewportWidth / 7);
  const rowHeight = Math.max(48, Math.ceil(24 * fontScale) + 16);
  const [month, setMonth] = useState(() => { const date = parseSleepDate(selected); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const today = sleepDateKey(new Date());
  const text = { color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16 };
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={{ width: 44, minHeight: 44, justifyContent: "center" }} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft color={colors.ink} size={20} /></Pressable>
      <Text style={{ ...text, flex: 1, textAlign: "center" }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={sleepDateKey(month).slice(0, 7) >= today.slice(0, 7)} style={{ width: 44, minHeight: 44, justifyContent: "center", alignItems: "flex-end" }} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight color={colors.ink} size={20} /></Pressable>
    </View>
    <ScrollView horizontal onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
      <View style={{ width: columnWidth * 7 }}>
        <View style={{ flexDirection: "row" }}>{["M", "T", "W", "T", "F", "S", "S"].map((label, i) => <Text key={i} style={{ ...text, color: colors.muted, width: columnWidth, textAlign: "center" }}>{label}</Text>)}</View>
        {mondayCalendarMatrix(month).map((week, index) => <View key={index} style={{ flexDirection: "row" }}>{week.map((day) => {
          const key = sleepDateKey(day), disabled = key > today;
          return <Pressable accessibilityRole="button" accessibilityLabel={key} accessibilityState={{ selected: key === selected, disabled }} key={key} disabled={disabled} onPress={() => onSelect(key)} style={{ width: columnWidth, minHeight: rowHeight, alignItems: "center", justifyContent: "center", backgroundColor: key === selected ? colors.primary : "transparent", borderRadius: 4, opacity: disabled ? 0.3 : 1 }}>
            <Text style={{ ...text, textAlign: "center", fontVariant: ["tabular-nums"], color: key === selected ? colors.onPrimary : day.getMonth() === month.getMonth() ? colors.ink : colors.muted }}>{day.getDate()}</Text>
          </Pressable>;
        })}</View>)}
      </View>
    </ScrollView>
  </View>;
}
