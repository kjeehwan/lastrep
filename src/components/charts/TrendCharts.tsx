import { useNotebook, useNotebookStyles, notebookSheet } from "../../ui/notebook/Notebook";
import type { NotebookColors } from "../../ui/notebook/tokens";
import React, { memo, useMemo, useState } from "react";
import { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { barViewportRange } from "./barViewport";

export type ChartPoint = {
  key: string;
  label: string;
  value: number;
};

export const CHART_COLORS = {
  bar: "#7b61ff",
  barMuted: "rgba(123,97,255,0.35)",
  selected: "#60a5fa",
  line: "#4ade80",
  avg: "#fbbf24",
  text: "#d9ddf1",
  muted: "#9aa1c3",
  grid: "rgba(255,255,255,0.12)",
} as const;

export const CHART_RANGE_OPTIONS = [7, 14, 30] as const;
export type ChartRange = (typeof CHART_RANGE_OPTIONS)[number];

type RangeSelectorProps = {
  value: ChartRange;
  onChange: (next: ChartRange) => void;
};

export const ChartRangeSelector = memo(function ChartRangeSelector({
  value,
  onChange,
}: RangeSelectorProps) {
  const { styles } = useChartAppearance();
  return (
    <View style={styles.rangeRow}>
      {CHART_RANGE_OPTIONS.map((option) => (
        <Pressable
          key={option}
          style={[styles.rangeChip, value === option && styles.rangeChipActive]}
          onPress={() => onChange(option)}
        >
          <Text style={[styles.rangeChipText, value === option && styles.rangeChipTextActive]}>
            {option}D
          </Text>
        </Pressable>
      ))}
    </View>
  );
});

type EmptyStateProps = {
  loading?: boolean;
  text?: string;
};

export function ChartEmptyState({ loading = false, text = "No data yet." }: EmptyStateProps) {
  const { styles } = useChartAppearance();
  return <Text style={styles.emptyText}>{loading ? "Loading..." : text}</Text>;
}

type BarChartProps = {
  points: ChartPoint[];
  unit?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  average?: number | null;
  averageInRightLane?: boolean;
  averageLabelText?: string;
};

export const BarChart = memo(function BarChart({
  points,
  unit,
  selectedKey,
  onSelect,
  average = null,
  averageInRightLane = false,
  averageLabelText,
}: BarChartProps) {
  const { styles, palette } = useChartAppearance();
  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const shouldScroll = points.length > 8;
  const newestFirst = useMemo(() => points.slice().reverse(), [points]);
  const max = useMemo(() => Math.max(1, ...points.map((point) => point.value, 0)), [points]);
  const dynamicVisibleMax = useMemo(() => {
    if (!shouldScroll || viewportWidth <= 0 || points.length === 0) return max;
    const { start: startIndex, end: endIndex } = barViewportRange(points.length, scrollX, viewportWidth);
    let localMax = 1;
    for (let i = startIndex; i < endIndex; i += 1) {
      localMax = Math.max(localMax, points[i]?.value ?? 0);
    }
    return localMax;
  }, [max, shouldScroll, viewportWidth, scrollX, points]);
  const scaledMax = useMemo(
    () => Math.max(1, (shouldScroll ? dynamicVisibleMax : max) * 1.15),
    [max, dynamicVisibleMax, shouldScroll]
  );
  const avgPct =
    average != null && Number.isFinite(average) ? Math.max(0, Math.min(1, average / scaledMax)) : null;
  const barTrackHeight = 116;
  const topLabelReserve = 22;
  const bottomLabelReserve = 20;
  const chartHeight = barTrackHeight + topLabelReserve + bottomLabelReserve;
  const avgLaneWidth = averageInRightLane ? 42 : 0;
  const avgLabel =
    averageLabelText ?? `Avg ${Math.round(average ?? 0)}${unit ? ` ${unit}` : ""}`;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(event.nativeEvent.contentOffset.x);
  };

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.barChartWrap}>
      <View style={styles.plotArea}>
        {avgPct != null ? (
          <View
            style={[
              styles.avgLine,
              {
                bottom: bottomLabelReserve + avgPct * barTrackHeight,
                right: avgLaneWidth,
              },
            ]}
          />
        ) : null}
        <View style={styles.barStageRow}>
          <View style={styles.barStageBars}>
            {shouldScroll ? (
              <FlatList
                data={newestFirst}
                inverted
                horizontal
                keyExtractor={(point) => point.key}
                getItemLayout={(_data, index) => ({ length: 46, offset: index * 52, index })}
                ItemSeparatorComponent={BarSeparator}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={5}
                removeClippedSubviews={false}
                style={{ height: chartHeight }}
                onLayout={handleViewportLayout}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item: point }) => {
                    const selected = selectedKey != null && selectedKey === point.key;
                    const rawHeight = (point.value / scaledMax) * barTrackHeight;
                    const barHeight = Math.max(8, Math.min(barTrackHeight, Number.isFinite(rawHeight) ? rawHeight : 8));
                    return (
                      <Pressable style={[styles.barCellScroll, { height: chartHeight }]} onPress={() => onSelect?.(point.key)}>
                        <Text style={styles.valueText}>
                          {Math.round(point.value)}
                        </Text>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: barHeight,
                              backgroundColor: selected
                                ? palette.selected
                                : onSelect
                                ? palette.bar
                                : palette.barMuted,
                            },
                          ]}
                        />
                        <Text style={[styles.xLabel, selected && styles.xLabelSelected]}>{point.label}</Text>
                      </Pressable>
                    );
                  }}
              />
            ) : (
              <View style={[styles.barRow, { height: chartHeight }]}>
                {points.map((point) => {
                  const selected = selectedKey != null && selectedKey === point.key;
                  const rawHeight = (point.value / scaledMax) * barTrackHeight;
                  const barHeight = Math.max(8, Math.min(barTrackHeight, Number.isFinite(rawHeight) ? rawHeight : 8));
                  return (
                    <Pressable key={point.key} style={styles.barCell} onPress={() => onSelect?.(point.key)}>
                      <Text style={styles.valueText}>
                        {Math.round(point.value)}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: selected
                              ? palette.selected
                              : onSelect
                              ? palette.bar
                              : palette.barMuted,
                          },
                        ]}
                      />
                      <Text style={[styles.xLabel, selected && styles.xLabelSelected]}>{point.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          {avgPct != null && averageInRightLane ? (
            <View style={[styles.avgLane, { width: avgLaneWidth }]}>
              <View
                style={[
                  styles.avgLaneLabelWrap,
                  { bottom: bottomLabelReserve + avgPct * barTrackHeight - 6 },
                ]}
              >
                <Text style={styles.avgLabel}>{avgLabel}</Text>
              </View>
            </View>
          ) : null}
        </View>
        {avgPct != null && !averageInRightLane ? (
          <Text style={styles.avgLabel}>{avgLabel}</Text>
        ) : null}
      </View>
    </View>
  );
});

function BarSeparator() { return <View style={{ width: 6 }} />; }

type LineChartProps = {
  points: ChartPoint[];
  average?: number | null;
  unit?: string;
};

export const LineChart = memo(function LineChart({ points, average = null, unit }: LineChartProps) {
  const { styles, palette } = useChartAppearance();
  const width = 320;
  const height = 150;
  const padX = 12;
  const padTop = 12;
  const padBottom = 26;
  const drawWidth = width - padX * 2;
  const drawHeight = height - padTop - padBottom;
  const max = Math.max(1, ...points.map((point) => point.value));
  const min = Math.min(0, ...points.map((point) => point.value));
  const range = Math.max(1, max - min);

  const nodes = points.map((point, index) => {
    const x = padX + (points.length <= 1 ? drawWidth / 2 : (index / (points.length - 1)) * drawWidth);
    const y = padTop + (1 - (point.value - min) / range) * drawHeight;
    return { ...point, x, y };
  });

  const polylinePoints = nodes.map((node) => `${node.x},${node.y}`).join(" ");
  const avgY =
    average != null && Number.isFinite(average)
      ? padTop + (1 - (average - min) / range) * drawHeight
      : null;

  return (
    <View>
      <Svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={styles.lineSvg}>
        <Line
          x1={padX}
          y1={height - padBottom}
          x2={width - padX}
          y2={height - padBottom}
          stroke={palette.grid}
          strokeWidth={1}
        />
        {avgY != null ? (
          <Line
            x1={padX}
            y1={avgY}
            x2={width - padX}
            y2={avgY}
            stroke={palette.avg}
            strokeDasharray="3 3"
            strokeWidth={1.5}
          />
        ) : null}
        <Polyline points={polylinePoints} fill="none" stroke={palette.line} strokeWidth={2.5} />
        {nodes.map((node) => (
          <Circle key={node.key} cx={node.x} cy={node.y} r={3} fill={palette.line} />
        ))}
      </Svg>
      {avgY != null ? (
        <Text style={styles.avgLabel}>
          Avg {Math.round(average ?? 0)}
          {unit ? ` ${unit}` : ""}
        </Text>
      ) : null}
      <View style={styles.labelsRow}>
        {points.map((point) => (
          <Text key={point.key} style={styles.xLabel}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
});

const legacyStyles = StyleSheet.create({
  rangeRow: { flexDirection: "row", gap: 8 },
  rangeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  rangeChipActive: { borderColor: CHART_COLORS.bar, backgroundColor: "rgba(123,97,255,0.26)" },
  rangeChipText: { color: CHART_COLORS.muted, fontSize: 12, fontWeight: "700" },
  rangeChipTextActive: { color: "#fff" },
  emptyText: { color: CHART_COLORS.muted, fontSize: 12, lineHeight: 16 },
  barChartWrap: { minHeight: 180, justifyContent: "flex-end", marginTop: 8 },
  plotArea: { position: "relative", height: 160, justifyContent: "flex-end" },
  barStageRow: { flexDirection: "row", alignItems: "stretch" },
  barStageBars: { flex: 1, overflow: "hidden" },
  avgLane: { position: "relative", alignSelf: "stretch" },
  avgLaneLabelWrap: { position: "absolute", right: 0, height: 12, justifyContent: "center" },
  avgLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderTopColor: CHART_COLORS.avg,
    borderStyle: "dashed",
    zIndex: 1,
  },
  avgLabel: { color: CHART_COLORS.avg, fontSize: 11, fontWeight: "700", marginBottom: 4 },
  barRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barCellScroll: { width: 46, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  barCell: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  bar: { width: "90%", borderRadius: 8, minHeight: 8 },
  valueText: { color: CHART_COLORS.text, fontSize: 10, fontWeight: "700" },
  xLabel: { color: CHART_COLORS.muted, fontSize: 10, fontWeight: "600", textAlign: "center" },
  xLabelSelected: { color: "#fff" },
  lineSvg: { height: 170, width: "100%" },
  labelsRow: { flexDirection: "row", justifyContent: "space-between", gap: 4, marginTop: 4 },
});

function useChartAppearance() {
  const { colors, fontsLoaded } = useNotebook();
  const notebookStyles = useNotebookStyles(createNotebookStyles);
  const palette = useMemo(() => fontsLoaded ? { bar: colors.ink, barMuted: colors.muted, selected: colors.accent, line: colors.ink, avg: colors.accent, text: colors.ink, muted: colors.muted, grid: colors.rule } : CHART_COLORS, [colors, fontsLoaded]);
  return { styles: fontsLoaded ? notebookStyles : legacyStyles, palette };
}
const createNotebookStyles = (colors: NotebookColors) => notebookSheet({
  ...legacyStyles,
  rangeChip: { ...legacyStyles.rangeChip, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 4, minHeight: 44, justifyContent: "center" },
  rangeChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  rangeChipText: { color: colors.muted, fontSize: 14, fontWeight: "600" }, rangeChipTextActive: { color: colors.ink },
  emptyText: { color: colors.muted, fontSize: 14 }, avgLine: { ...legacyStyles.avgLine, borderTopColor: colors.accent },
  avgLabel: { color: colors.accent, fontSize: 13, fontWeight: "600" }, valueText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  xLabel: { color: colors.muted, fontSize: 13, textAlign: "center" }, xLabelSelected: { color: colors.ink }, bar: { ...legacyStyles.bar, borderRadius: 2 },
});
