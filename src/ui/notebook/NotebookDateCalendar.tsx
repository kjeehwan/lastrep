import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { mondayCalendarMatrix } from "../../home/notebookPresentation";
import { useNotebook } from "./Notebook";
import { notebookFonts } from "./tokens";

const keyFor = (day: Date) => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

/** Inline calendar: selection is returned to the owning form, never saved here. */
export function NotebookDateCalendar({ selected, maximum, onSelect }: { selected: string; maximum: string; onSelect: (key: string) => void }) {
  const { colors } = useNotebook();
  const [month, setMonth] = useState(() => {
    const day = new Date(`${selected || maximum}T12:00:00`);
    return new Date(day.getFullYear(), day.getMonth(), 1);
  });
  const text = { color: colors.ink, fontFamily: notebookFonts.body, fontSize: 16 };
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const nextDisabled = keyFor(nextMonth) > maximum;
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><ChevronLeft size={20} color={colors.ink} /></Pressable>
      <Text style={[text, { flex: 1, textAlign: "center" }]}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={nextDisabled} accessibilityState={{ disabled: nextDisabled }} onPress={() => setMonth(nextMonth)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: nextDisabled ? 0.35 : 1 }}><ChevronRight size={20} color={colors.ink} /></Pressable>
    </View>
    <View>
      <View style={{ flexDirection: "row" }}>{["M", "T", "W", "T", "F", "S", "S"].map((label, index) => <Text key={index} style={[text, { flex: 1, textAlign: "center", color: colors.muted }]}>{label}</Text>)}</View>
      {mondayCalendarMatrix(month).map((week, index) => <View key={index} style={{ flexDirection: "row" }}>{week.map(day => {
        const key = keyFor(day), disabled = key > maximum;
        return <Pressable key={key} accessibilityRole="button" accessibilityLabel={key} disabled={disabled} accessibilityState={{ selected: key === selected, disabled }} onPress={() => onSelect(key)} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: key === selected ? colors.accentSoft : "transparent", opacity: disabled ? 0.3 : 1 }}><Text style={[text, { color: day.getMonth() === month.getMonth() ? colors.ink : colors.muted }]}>{day.getDate()}</Text></Pressable>;
      })}</View>)}
    </View>
    <Pressable accessibilityRole="button" onPress={() => onSelect(maximum)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={text}>Today</Text></Pressable>
  </View>;
}
