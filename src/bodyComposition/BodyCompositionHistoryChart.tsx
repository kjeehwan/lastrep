import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import type { BodyCompositionHistoryEntry } from "../contracts";
import {
  getBodyCompositionHistoryPoints,
  hasLegacyMuscleMassHistory,
  type BodyCompositionMetric,
} from "./bodyCompositionHistory";

type WeightUnit = "kg" | "lbs";

type Props = {
  history: BodyCompositionHistoryEntry[];
  weightUnit: WeightUnit;
};

const METRICS: { key: BodyCompositionMetric; label: string }[] = [
  { key: "weight", label: "Weight" },
  { key: "bodyFat", label: "Body fat" },
  { key: "leanBodyMass", label: "Lean mass" },
  { key: "skeletalMuscleMass", label: "Skeletal muscle" },
];

const KG_TO_LBS = 2.20462;
const WIDTH = 340;
const HEIGHT = 164;
const PAD_X = 18;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;
const POINT_SPACING = 64;

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const formatAxisDate = (timestamp: number, previousTimestamp?: number) => {
  const date = new Date(timestamp);
  const previous = previousTimestamp == null ? null : new Date(previousTimestamp);
  const startsMonth =
    previous == null ||
    previous.getFullYear() !== date.getFullYear() ||
    previous.getMonth() !== date.getMonth();

  return startsMonth
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : String(date.getDate());
};

export const BodyCompositionHistoryChart = memo(function BodyCompositionHistoryChart({
  history,
  weightUnit,
}: Props) {
  const [metric, setMetric] = useState<BodyCompositionMetric>("weight");
  const points = useMemo(() => getBodyCompositionHistoryPoints(history, metric), [history, metric]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const chartScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setSelectedKey(points.at(-1)?.key ?? null);
  }, [points]);

  const selected = points.find((point) => point.key === selectedKey) ?? points.at(-1) ?? null;
  const isPercent = metric === "bodyFat";
  const displayValue = (value: number) => {
    const converted = isPercent || weightUnit === "kg" ? value : value * KG_TO_LBS;
    return `${Math.round(converted * 10) / 10}${isPercent ? "%" : ` ${weightUnit}`}`;
  };

  const { nodes, chartWidth } = useMemo(() => {
    if (points.length === 0) return { nodes: [], chartWidth: WIDTH };
    const values = points.map((point) => point.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const valuePadding = Math.max((rawMax - rawMin) * 0.2, isPercent ? 1 : 2);
    const min = Math.max(0, rawMin - valuePadding);
    const max = rawMax + valuePadding;
    const valueRange = Math.max(1, max - min);

    const nextNodes = points.map((point, index) => {
      const x = points.length === 1 ? WIDTH / 2 : PAD_X + index * POINT_SPACING;
      return {
        ...point,
        x,
        y: PAD_TOP + (1 - (point.value - min) / valueRange) * (HEIGHT - PAD_TOP - PAD_BOTTOM),
        index,
      };
    });

    return {
      nodes: nextNodes,
      chartWidth: Math.max(WIDTH, (nextNodes.at(-1)?.x ?? WIDTH / 2) + PAD_X),
    };
  }, [isPercent, points]);

  const polyline = nodes.map((node) => `${node.x},${node.y}`).join(" ");
  const legacyPresent = hasLegacyMuscleMassHistory(history);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Progress</Text>
      <View style={styles.metricRow}>
        {METRICS.map((option) => (
          <Pressable
            key={option.key}
            style={[styles.metricChip, metric === option.key && styles.metricChipActive]}
            onPress={() => setMetric(option.key)}
          >
            <Text style={[styles.metricChipText, metric === option.key && styles.metricChipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {selected ? (
        <View style={styles.selectedSummary}>
          <Text style={styles.selectedValue}>{displayValue(selected.value)}</Text>
          <Text style={styles.selectedMeta}>
            {formatDate(selected.recordedAtMs)} · {selected.source === "manual" ? "Manual" : selected.originLabel ?? "Health data"}
          </Text>
        </View>
      ) : null}

      {nodes.length ? (
        <View style={styles.chartWrap}>
          <ScrollView
            ref={chartScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartScrollContent}
            onContentSizeChange={() => chartScrollRef.current?.scrollToEnd({ animated: false })}
          >
            <View style={{ width: chartWidth }}>
              <Svg width={chartWidth} height={HEIGHT} style={styles.chart}>
                <Line
                  x1={PAD_X}
                  y1={HEIGHT - PAD_BOTTOM}
                  x2={chartWidth - PAD_X}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                />
                {nodes.length > 1 ? (
                  <Polyline
                    points={polyline}
                    fill="none"
                    stroke="rgba(96,165,250,0.65)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                ) : null}
                {nodes.map((node) => (
                  <React.Fragment key={node.key}>
                    <Circle
                      cx={node.x}
                      cy={node.y}
                      r={18}
                      fill="transparent"
                      onPress={() => setSelectedKey(node.key)}
                    />
                    <Circle
                      cx={node.x}
                      cy={node.y}
                      r={node.key === selected?.key ? 6 : 4}
                      fill={node.key === selected?.key ? "#fbbf24" : "#60a5fa"}
                      pointerEvents="none"
                    />
                  </React.Fragment>
                ))}
                {nodes.map((node, index) => (
                  <SvgText
                    key={`date-${node.key}`}
                    x={node.x}
                    y={HEIGHT - 8}
                    fill="#8f95af"
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {formatAxisDate(node.recordedAtMs, nodes[index - 1]?.recordedAtMs)}
                  </SvgText>
                ))}
              </Svg>
            </View>
          </ScrollView>
          <Text style={styles.hint}>Swipe to browse. Tap a point for its value and source.</Text>
        </View>
      ) : (
        <Text style={styles.emptyText}>No {METRICS.find((option) => option.key === metric)?.label.toLowerCase()} measurements yet.</Text>
      )}

      {legacyPresent ? (
        <Text style={styles.legacyNote}>
          Older synced muscle records remain unclassified because their original type cannot be verified.
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
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
  selectedSummary: { marginTop: 14 },
  selectedValue: { color: "#fff", fontSize: 26, fontWeight: "900" },
  selectedMeta: { color: "#9aa1c3", fontSize: 11, marginTop: 3 },
  chartWrap: { marginTop: 4 },
  chartScrollContent: { minWidth: "100%" },
  chart: { height: HEIGHT },
  hint: { color: "#7f859d", fontSize: 10, lineHeight: 14, marginTop: 12 },
  emptyText: { color: "#9aa1c3", fontSize: 12, lineHeight: 18, marginTop: 18 },
  legacyNote: { color: "#d8b86e", fontSize: 11, lineHeight: 16, marginTop: 12 },
});
