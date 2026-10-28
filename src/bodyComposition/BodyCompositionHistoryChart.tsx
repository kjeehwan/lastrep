import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useNotebook, useNotebookStyles, notebookSheet } from "../ui/notebook/Notebook";
import type { NotebookColors } from "../ui/notebook/tokens";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import type { BodyCompositionHistoryEntry } from "../contracts";
import { getBodyCompositionHistoryPoints, hasLegacyMuscleMassHistory, type BodyCompositionMetric, type BodyCompositionHistoryPoint } from "./bodyCompositionHistory";
import { bodyChartAxisLabel, bodyChartWindowLabel, bodyChartPeriodLabel, bodyChartPeriodLayout, bodyChartPeriodPoints, type BodyChartPeriod } from "./bodyChartPeriods";
import { bodyChartPointLabels } from "./bodyChartPointLabels";
import { measurementText } from "./measurementEditing";

type WeightUnit = "kg" | "lbs";
type Props = {
  history: BodyCompositionHistoryEntry[];
  weightUnit: WeightUnit;
  nowMs?: number;
  standalone?: boolean;
  initialMetric?: BodyCompositionMetric;
  initialRecordedAtMs?: number;
  onSelectionChange?: (point: BodyCompositionHistoryPoint | null) => void;
};
const METRICS: { key: BodyCompositionMetric; label: string }[] = [
  { key: "weight", label: "Weight" }, { key: "bodyFat", label: "Body fat" },
  { key: "leanBodyMass", label: "Lean mass" }, { key: "skeletalMuscleMass", label: "Skeletal muscle" },
];
const PERIODS: { key: BodyChartPeriod; label: string }[] = [
  { key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }, { key: "year", label: "Year" },
];
const AVERAGE_LABEL = { week: "Weekly average", month: "Monthly average", year: "Yearly average" };
const KG_TO_LBS = 2.20462;
const WIDTH = 340;
const HEIGHT = 212;
const PAD_TOP = 64;
const PAD_BOTTOM = 46;

export const BodyCompositionHistoryChart = memo(function BodyCompositionHistoryChart({ history, weightUnit, nowMs = Date.now(), standalone = false, initialMetric = "weight", initialRecordedAtMs, onSelectionChange }: Props) {
  const { colors, fontsLoaded } = useNotebook();
  const notebookStyles = useNotebookStyles(createNotebookStyles);
  const styles = fontsLoaded ? notebookStyles : legacyStyles;
  const { fontScale } = useWindowDimensions();
  const graphScale = fontsLoaded ? Math.min(2, Math.max(1, fontScale)) : 1;
  const [viewportWidth, setViewportWidth] = useState(WIDTH);
  const [scrollX, setScrollX] = useState(0);
  const [metric, setMetric] = useState<BodyCompositionMetric>(initialMetric);
  const [period, setPeriod] = useState<BodyChartPeriod>("day");
  const daily = useMemo(() => getBodyCompositionHistoryPoints(history, metric), [history, metric]);
  const asOfDayMs = new Date(nowMs).setHours(0, 0, 0, 0);
  const points = useMemo(() => bodyChartPeriodPoints(daily, period, asOfDayMs), [daily, period, asOfDayMs]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const chartScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    setSelectedKey(points.find(point => period === "day" && point.recordedAtMs === initialRecordedAtMs)?.key ?? points.at(-1)?.key ?? null);
  }, [points, initialRecordedAtMs, period]);
  const selected = points.find(point => point.key === selectedKey) ?? points.at(-1) ?? null;
  // An average is not a stored measurement. Add/edit must never target a bucket's representative record.
  useEffect(() => { onSelectionChange?.(period === "day" ? selected : null); }, [selected, period, onSelectionChange]);
  const isPercent = metric === "bodyFat";
  const displayValue = (value: number) => {
    if (metric === "weight") return `${measurementText(value, "weightKg", weightUnit)} ${weightUnit}`;
    const converted = isPercent || weightUnit === "kg" ? value : value * KG_TO_LBS;
    return `${Math.round(converted * 10) / 10}${isPercent ? "%" : ` ${weightUnit}`}`;
  };
  const layout = useMemo(() => bodyChartPeriodLayout(points.length, viewportWidth, period, graphScale), [points.length, viewportWidth, period, graphScale]);
  const nodes = useMemo(() => {
    if (!points.length) return [];
    const values = points.map(point => point.value);
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.2, isPercent ? 1 : 2);
    const min = Math.max(0, rawMin - padding), range = Math.max(1, rawMax + padding - min);
    return points.map((point, index) => ({ ...point, x: layout.positions[index], y: (PAD_TOP + (1 - (point.value - min) / range) * (HEIGHT - PAD_TOP - PAD_BOTTOM)) * graphScale }));
  }, [points, layout, graphScale, isPercent]);
  const maxScroll = Math.max(0, layout.width - viewportWidth);
  const scrollTo = (x: number, animated = true) => {
    const bounded = Math.min(maxScroll, Math.max(0, x));
    setScrollX(bounded);
    chartScrollRef.current?.scrollTo({ x: bounded, animated });
  };
  const moveSelection = (delta: number) => {
    const index = Math.max(0, Math.min(nodes.length - 1, nodes.findIndex(node => node.key === selected?.key) + delta));
    if (!nodes[index]) return;
    setSelectedKey(nodes[index].key);
    scrollTo(nodes[index].x - viewportWidth / 2);
  };
  const visibleNodes = nodes.filter(node => node.x >= scrollX + layout.padding - 0.5 && node.x <= scrollX + viewportWidth - layout.padding + 0.5);
  const visibleKeys = new Set(visibleNodes.map(node => node.key));
  const allPointLabels = useMemo(() => bodyChartPointLabels(nodes.map(node => {
    const converted = isPercent || weightUnit === "kg" ? node.value : node.value * KG_TO_LBS;
    return { ...node, label: String(Math.round(converted * 10) / 10) };
  }), graphScale), [nodes, isPercent, weightUnit, graphScale]);
  const labelTopSpace = Math.max(0, 14 * graphScale - Math.min(14 * graphScale, ...allPointLabels.map(label => label.y)));
  const pointLabels = allPointLabels.filter(label => visibleKeys.has(label.key));
  const chartHeight = HEIGHT * graphScale + labelTopSpace;
  const first = visibleNodes[0] ?? nodes[0], last = visibleNodes.at(-1) ?? nodes.at(-1);
  const periodWindow = first ? bodyChartWindowLabel(first, last!, period) : "No recorded measurements";
  const sourceLabel = selected?.source === "manual" ? "Manual"
    : selected?.originLabel === "Samsung Health / Galaxy Watch" ? "Samsung Health"
    : selected?.originLabel ?? "Health data";
  return <View style={!standalone && styles.wrap}>
    {!standalone ? <Text style={styles.heading}>Progress</Text> : null}
    <View style={styles.metricRow}>{METRICS.map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: metric === option.key }} style={[styles.metricChip, metric === option.key && styles.metricChipActive]} onPress={() => setMetric(option.key)}><Text style={[styles.metricChipText, metric === option.key && styles.metricChipTextActive]}>{option.label}</Text></Pressable>)}</View>
    <View style={styles.periodRow}>{PERIODS.map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={`${option.label} chart`} accessibilityState={{ selected: period === option.key }} style={[styles.periodChip, fontScale >= 1.5 && { flex: 0, width: "48%" }]} onPress={() => setPeriod(option.key)}><Text style={[styles.periodCaption, period === option.key && styles.periodCaptionActive]}>{option.label}</Text></Pressable>)}</View>
    {selected ? <>
      <View style={styles.periodNavigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Earlier measurements" accessibilityState={{ disabled: scrollX <= 1 }} disabled={scrollX <= 1} onPress={() => scrollTo(scrollX - viewportWidth)} style={[styles.pageButton, scrollX <= 1 && { opacity: 0.35 }]}><ChevronLeft size={20} color={colors.muted} /></Pressable>
        <Text style={styles.periodWindow}>{periodWindow}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Later measurements" accessibilityState={{ disabled: scrollX >= maxScroll - 1 }} disabled={scrollX >= maxScroll - 1} onPress={() => scrollTo(scrollX + viewportWidth)} style={[styles.pageButton, scrollX >= maxScroll - 1 && { opacity: 0.35 }]}><ChevronRight size={20} color={colors.muted} /></Pressable>
      </View>
      <View style={styles.selectedSummary}>
        {period !== "day" ? <Text style={styles.selectedMeta}>{AVERAGE_LABEL[period]}{selected.toDate ? " \u00b7 To date" : ""}</Text> : null}
        <Text style={styles.selectedValue}>{displayValue(selected.value)}</Text>
        <Text style={styles.selectedMeta}>{bodyChartPeriodLabel(selected, period)}{period === "day" ? ` \u00b7 ${sourceLabel}` : ""}</Text>
        {period !== "day" ? <Text style={styles.selectedMeta}>{selected.recordedDays} recorded {selected.recordedDays === 1 ? "day" : "days"}{" \u00b7 Missing days excluded"}</Text> : null}
      </View>
      <View style={styles.chartWrap}>
        <ScrollView key={`${metric}-${period}`} ref={chartScrollRef} horizontal onLayout={event => setViewportWidth(event.nativeEvent.layout.width)} showsHorizontalScrollIndicator={false} scrollEventThrottle={32} onScroll={event => setScrollX(event.nativeEvent.contentOffset.x)} contentContainerStyle={styles.chartScrollContent} onContentSizeChange={() => {
          const index = points.findIndex(point => period === "day" && point.recordedAtMs === initialRecordedAtMs);
          scrollTo(index >= 0 ? nodes[index].x - viewportWidth / 2 : maxScroll, false);
        }}>
          <Pressable style={{ width: layout.width, height: chartHeight }} accessibilityRole="adjustable" accessibilityLabel={`${METRICS.find(option => option.key === metric)?.label} ${period} chart`} accessibilityValue={{ text: `${bodyChartPeriodLabel(selected, period)}, ${period === "day" ? "" : "average "}${displayValue(selected.value)}` }} accessibilityActions={[{ name: "increment", label: "Next point" }, { name: "decrement", label: "Previous point" }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === "increment") moveSelection(1); else if (event.nativeEvent.actionName === "decrement") moveSelection(-1); }} onPress={event => {
            const x = event.nativeEvent.locationX;
            const nearest = (visibleNodes.length ? visibleNodes : nodes).reduce((best, node) => Math.abs(node.x - x) < Math.abs(best.x - x) ? node : best);
            setSelectedKey(nearest.key);
          }}>
            <Svg pointerEvents="none" accessible={false} width={layout.width} height={chartHeight}>
              <Line x1={layout.padding} y1={chartHeight - PAD_BOTTOM * graphScale} x2={layout.width - layout.padding} y2={chartHeight - PAD_BOTTOM * graphScale} stroke={colors.rule} strokeWidth={1} />
              {nodes.length > 1 ? <Polyline points={nodes.map(node => `${node.x},${node.y + labelTopSpace}`).join(" ")} fill="none" stroke={colors.muted} strokeWidth={2} strokeDasharray="4 4" /> : null}
              {pointLabels.map(label => <SvgText key={`value-${label.key}`} x={label.x} y={label.y + labelTopSpace} fill={label.key === selected.key ? colors.accent : colors.muted} fontFamily={fontsLoaded ? "NotebookSans" : undefined} fontSize={12 * graphScale} fontWeight="600" textAnchor="middle">{label.label}</SvgText>)}
              {visibleNodes.map(node => <Circle key={node.key} cx={node.x} cy={node.y + labelTopSpace} r={(node.key === selected.key ? 6 : 4) * graphScale} fill={node.key === selected.key ? colors.accent : colors.ink} />)}
              {nodes.flatMap((node, index) => !visibleKeys.has(node.key) ? [] : bodyChartAxisLabel(node, index, nodes, period).map((line, row) => <SvgText key={`${node.key}-${row}`} x={node.x} y={chartHeight - (row ? 6 : 24) * graphScale} fill={colors.muted} fontFamily={fontsLoaded ? "NotebookSans" : undefined} fontSize={13 * graphScale} fontWeight="600" textAnchor="middle">{line}</SvgText>))}
            </Svg>
          </Pressable>
        </ScrollView>
        <Text style={styles.hint}>Swipe to browse. Tap a point for its {period === "day" ? "value and source" : "average"}.</Text>
      </View>
    </> : <Text style={styles.emptyText}>No {METRICS.find(option => option.key === metric)?.label.toLowerCase()} measurements yet.</Text>}
    {hasLegacyMuscleMassHistory(history) ? <Text style={styles.legacyNote}>Older synced muscle records remain unclassified because their original type cannot be verified.</Text> : null}
  </View>;
});

const legacyStyles = StyleSheet.create({
  wrap: { marginTop: 18, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 16 },
  heading: { color: "#fff", fontSize: 15, fontWeight: "800", marginBottom: 10 },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  metricChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  metricChipActive: { borderColor: "#60a5fa", backgroundColor: "rgba(96,165,250,0.16)" },
  metricChipText: { color: "#9aa1c3", fontSize: 11, fontWeight: "700" },
  metricChipTextActive: { color: "#fff" },
  periodRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  periodChip: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 8 },
  periodCaption: { color: "#9aa1c3", fontSize: 13 },
  periodCaptionActive: { color: "#fbbf24", fontSize: 13, fontWeight: "600" },
  periodNavigation: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  periodWindow: { flex: 1, color: "#9aa1c3", fontSize: 12, textAlign: "center" },
  pageButton: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  selectedSummary: { marginTop: 12 },
  selectedValue: { color: "#fff", fontSize: 26, fontWeight: "900" },
  selectedMeta: { color: "#9aa1c3", fontSize: 11, marginTop: 3 },
  chartWrap: { marginTop: 4 },
  chartScrollContent: { minWidth: "100%" },
  chart: { height: HEIGHT },
  hint: { color: "#7f859d", fontSize: 10, lineHeight: 14, marginTop: 12 },
  emptyText: { color: "#9aa1c3", fontSize: 12, lineHeight: 18, marginTop: 18 },
  legacyNote: { color: "#d8b86e", fontSize: 11, lineHeight: 16, marginTop: 12 },
});

const createNotebookStyles = (colors: NotebookColors) => notebookSheet({
  ...legacyStyles,
  wrap: { ...legacyStyles.wrap, borderTopColor: colors.rule },
  heading: { color: colors.ink, fontSize: 20, fontWeight: "600" },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metricChip: { minHeight: 44, paddingHorizontal: 4, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  metricChipActive: { borderBottomColor: colors.accent },
  metricChipText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  metricChipTextActive: { color: colors.ink },
  periodCaption: { color: colors.muted, fontSize: 13 },
  periodCaptionActive: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  periodWindow: { flex: 1, color: colors.muted, fontSize: 13, textAlign: "center" },
  selectedValue: { color: colors.ink, fontSize: 28, fontWeight: "600" },
  selectedMeta: { color: colors.muted, fontSize: 14, marginTop: 4 },
  hint: { color: colors.muted, fontSize: 13, marginTop: 12 },
  emptyText: { color: colors.muted, fontSize: 14, marginTop: 16 },
  legacyNote: { color: colors.muted, fontSize: 13, marginTop: 12 },
});
