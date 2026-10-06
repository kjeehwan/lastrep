import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { ExerciseProgressInsights } from "../exerciseProgressInsights";

type Props = {
  insights: ExerciseProgressInsights;
};

const WIDTH = 320;
const HEIGHT = 104;
const PAD_X = 12;
const PAD_Y = 12;

const formatKg = (value: number) => `${Math.round(value * 10) / 10} kg`;

export const ExerciseProgressSummary = memo(function ExerciseProgressSummary({ insights }: Props) {
  if (!insights.latest || !insights.best) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Complete weighted working sets to unlock strength progress.</Text>
      </View>
    );
  }

  const chartSessions = insights.sessions.slice(-8);
  const values = chartSessions.map((session) => session.estimatedOneRepMaxKg);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max((maxValue - minValue) * 0.2, 2);
  const min = Math.max(0, minValue - padding);
  const max = maxValue + padding;
  const range = Math.max(1, max - min);
  const nodes = chartSessions.map((session, index) => ({
    ...session,
    x:
      chartSessions.length === 1
        ? WIDTH / 2
        : PAD_X + (index / (chartSessions.length - 1)) * (WIDTH - PAD_X * 2),
    y: PAD_Y + (1 - (session.estimatedOneRepMaxKg - min) / range) * (HEIGHT - PAD_Y * 2),
  }));
  const polyline = nodes.map((node) => `${node.x},${node.y}`).join(" ");
  const change = insights.changeFromPreviousPct;

  return (
    <View style={styles.wrap}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Text style={styles.label}>Latest strength</Text>
          <Text style={styles.value}>{formatKg(insights.latest.estimatedOneRepMaxKg)}</Text>
          <Text style={styles.caption}>estimated 1RM</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.label}>Best strength</Text>
          <Text style={styles.value}>{formatKg(insights.best.estimatedOneRepMaxKg)}</Text>
          <Text style={styles.caption}>
            {insights.best.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>
        </View>
      </View>
      <View style={styles.latestRow}>
        <Text style={styles.latestText}>
          Latest top set: {formatKg(insights.latest.bestWeightKg)} × {insights.latest.bestSetReps}
          {insights.latest.bestSetRpe ? ` @ RPE ${insights.latest.bestSetRpe}` : ""}
        </Text>
        {change != null ? (
          <Text style={[styles.changeText, change > 0 ? styles.changeUp : change < 0 ? styles.changeDown : null]}>
            {change > 0 ? "+" : ""}{change}% vs prior
          </Text>
        ) : null}
      </View>
      <Text style={styles.chartTitle}>Estimated strength by session</Text>
      <Svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={styles.chart}>
        <Line
          x1={PAD_X}
          y1={HEIGHT - PAD_Y}
          x2={WIDTH - PAD_X}
          y2={HEIGHT - PAD_Y}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
        {nodes.length > 1 ? (
          <Polyline points={polyline} fill="none" stroke="#60a5fa" strokeWidth={2.5} />
        ) : null}
        {nodes.map((node) => (
          <Circle
            key={node.key}
            cx={node.x}
            cy={node.y}
            r={node.isStrengthPr ? 5 : 3.5}
            fill={node.isStrengthPr ? "#fbbf24" : "#60a5fa"}
          />
        ))}
      </Svg>
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>
          {chartSessions[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Text>
        {chartSessions.length > 1 ? (
          <Text style={styles.dateText}>
            {chartSessions.at(-1)!.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>
        ) : null}
      </View>
      <Text style={styles.methodText}>Strength uses estimated 1RM so sets with different rep counts can be compared.</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 14 },
  emptyWrap: { paddingVertical: 12 },
  emptyText: { color: "#9aa1c3", fontSize: 12, lineHeight: 17 },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCell: { flex: 1, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", padding: 10 },
  label: { color: "#9aa1c3", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  value: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 4 },
  caption: { color: "#838aa5", fontSize: 10, marginTop: 2 },
  latestRow: { marginTop: 10, gap: 3 },
  latestText: { color: "#d9ddf1", fontSize: 12, fontWeight: "700" },
  changeText: { color: "#9aa1c3", fontSize: 11, fontWeight: "700" },
  changeUp: { color: "#4ade80" },
  changeDown: { color: "#fca5a5" },
  chartTitle: { color: "#b7bdd6", fontSize: 11, fontWeight: "700", marginTop: 13 },
  chart: { height: HEIGHT, width: "100%", marginTop: 2 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -3 },
  dateText: { color: "#7f859d", fontSize: 9, fontWeight: "600" },
  methodText: { color: "#737991", fontSize: 10, lineHeight: 14, marginTop: 9 },
});
