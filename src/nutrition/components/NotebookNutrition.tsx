import React, { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useNutritionColors } from "../notebookPalette";
import { macroLabelCenters, macroPercentages } from "../notebookPresentation";
import { notebookFonts } from "../../ui/notebook/tokens";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { PopupBackdrop } from "../../ui/PopupBackdrop";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import { mondayCalendarMatrix } from "../../home/notebookPresentation";
import { formatDateKey, parseDateKey } from "../meals";

export function IntakeBar({ title, consumed, target, unit, protein = false }: {
  title: string; consumed: number; target: number | null; unit: string; protein?: boolean;
}) {
  const colors = useNutritionColors();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const ratio = target && target > 0 ? Math.min(1, Math.max(0, consumed / target)) : 0;
  const large = fontScale >= 1.5;
  const labelWidth = 58 * fontScale;
  const overlap = width * (1 - ratio) < labelWidth * 1.4;
  const remaining = target == null ? "Set target in Profile" : `${Math.round(Math.abs(target - consumed))} ${unit} ${consumed > target ? "above target" : "remaining"}`;
  const text = { fontFamily: notebookFonts.body, fontSize: 16, color: colors.ink };
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: large ? "column" : "row", flexWrap: "wrap", alignItems: large ? "flex-start" : "baseline", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ ...text, fontFamily: notebookFonts.semibold }}>{title} <Text style={{ color: colors.muted, fontFamily: notebookFonts.body }}>({unit})</Text></Text>
      <Text style={{ ...text, color: colors.muted }}>{remaining}</Text>
    </View>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: 8, borderRadius: 2, backgroundColor: colors.rule, overflow: "hidden" }}>
      <View style={{ width: `${ratio * 100}%`, height: 8, backgroundColor: protein ? colors.protein : colors.ink }} />
    </View>
    <View style={{ minHeight: 24 * fontScale, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={[text, !large && !overlap && { position: "absolute", left: Math.max(0, width * ratio - labelWidth), width: labelWidth, textAlign: ratio === 0 ? "left" : "right" }]}>{Math.round(consumed)}</Text>
      {target != null ? <Text style={{ ...text, marginLeft: "auto", color: colors.muted }}>{Math.round(target)}</Text> : null}
    </View>
  </View>;
}

export function MacroComposition({ title, grams }: { title: string; grams: [number, number, number] }) {
  const colors = useNutritionColors();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const energy = grams.map((value, index) => value * (index === 2 ? 9 : 4));
  const total = energy.reduce((sum, value) => sum + value, 0);
  const fractions = energy.map((value) => total > 0 ? value / total : 0);
  const percentages = macroPercentages(energy);
  const names = ["P", "C", "F"];
  const tones = [colors.protein, colors.carbs, colors.fats];
  const labelWidth = 76 * fontScale;
  const large = fontScale >= 1.5 || width < labelWidth * 3;
  const centers = macroLabelCenters(total > 0 ? fractions : [1 / 3, 1 / 3, 1 / 3], width, labelWidth);
  return <View style={{ gap: 8 }}>
    <Text style={{ fontFamily: notebookFonts.body, fontSize: 15, color: colors.muted }}>{title}</Text>
    <View accessibilityLabel={`${title}: ${grams.map((value, index) => `${names[index]} ${Math.round(value)} grams, ${percentages[index]} percent`).join(", ")}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: large ? 44 : 28, flexDirection: "row", backgroundColor: colors.rule, overflow: "hidden", borderRadius: 2 }}>
      {fractions.map((fraction, index) => <View key={names[index]} style={{ width: `${fraction * 100}%`, alignItems: "center", justifyContent: "center", backgroundColor: tones[index] }}>
        {!large && fraction >= 0.15 && fraction * width >= 44 * fontScale ? <Text style={{ fontFamily: notebookFonts.semibold, fontSize: 14, color: colors.macroText }}>{percentages[index]}%</Text> : null}
      </View>)}
    </View>
    <View style={large ? { gap: 8 } : { height: 26 * fontScale }}>
      {grams.map((value, index) => <Text key={names[index]} style={{ fontFamily: notebookFonts.semibold, fontSize: 15, color: tones[index], ...(large ? {} : { position: "absolute", width: labelWidth, left: centers[index] - labelWidth / 2, textAlign: "center" }) }}>
        {names[index]} {Math.round(value)}g{large || fractions[index] < 0.15 || fractions[index] * width < 44 * fontScale ? ` (${percentages[index]}%)` : ""}
      </Text>)}
    </View>
  </View>;
}

export function DiaryCalendar({ selected, onSelect, onClose }: { selected: string; onSelect: (date: string) => void; onClose: () => void }) {
  const colors = useNutritionColors();
  const date = parseDateKey(selected) ?? new Date();
  const [month, setMonth] = useState(new Date(date.getFullYear(), date.getMonth(), 1));
  const weeks = mondayCalendarMatrix(month);
  const text = { fontFamily: notebookFonts.body, fontSize: 16, color: colors.ink };
  return <NotebookModal visible transparent animationType="fade" onRequestClose={onClose}>
    <PopupBackdrop onClose={onClose} style={{ flex: 1, padding: 20, justifyContent: "center", backgroundColor: colors.overlay }}>
      <AdaptiveModalCard contentSized style={{ width: "100%", maxWidth: 560, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 20, borderRadius: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ ...text, fontFamily: notebookFonts.editorial, fontSize: 22 }}>Diary date</Text>
          <Pressable accessibilityLabel="Close diary calendar" onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><X size={22} color={colors.ink} /></Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Pressable accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}><ChevronLeft color={colors.ink} size={20} /></Pressable>
          <Text style={{ ...text, flex: 1, textAlign: "center" }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
          <Pressable accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "flex-end" }}><ChevronRight color={colors.ink} size={20} /></Pressable>
        </View>
        <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, minWidth: 7 * 38 }}>
            <View style={{ flexDirection: "row" }}>{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <Text key={index} style={{ ...text, flex: 1, flexBasis: 0, textAlign: "center", color: colors.muted }}>{day}</Text>)}</View>
            {weeks.map((week, index) => <View key={index} style={{ flexDirection: "row" }}>{week.map((day) => {
              const key = formatDateKey(day);
              return <Pressable key={key} accessibilityLabel={key} accessibilityState={{ selected: key === selected }} onPress={() => { onSelect(key); onClose(); }} style={{ flex: 1, flexBasis: 0, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: key === selected ? colors.primary : "transparent", borderRadius: 4 }}>
                <Text style={{ ...text, color: key === selected ? colors.onPrimary : day.getMonth() === month.getMonth() ? colors.ink : colors.muted }}>{day.getDate()}</Text>
              </Pressable>;
            })}</View>)}
          </View>
        </ScrollView>
        <Pressable onPress={() => { onSelect(formatDateKey(new Date())); onClose(); }} style={{ minHeight: 48, justifyContent: "center", alignItems: "center", marginTop: 12 }}><Text style={text}>Today</Text></Pressable>
      </AdaptiveModalCard>
    </PopupBackdrop>
  </NotebookModal>;
}
