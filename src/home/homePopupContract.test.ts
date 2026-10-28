import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps popup content outside the backdrop's press target", () => {
  const backdrop = readFileSync("src/ui/PopupBackdrop.tsx", "utf8");
  expect(backdrop).toMatch(/<Pressable[^>]+onPress=\{onClose\}\s*\/>\s*\{children\}/);
  expect(backdrop).not.toContain("TouchableWithoutFeedback");
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  expect(home).not.toContain("TouchableWithoutFeedback");
  expect(home).toContain('contentContainerStyle={{ alignItems: "center", gap: 14 }}');
  expect(home).toContain('alignSelf: "center" }, entitlement.state');
  expect(home).toContain("<PhaseEditor");
});

it("opens trends locally without rerendering Home or fetching account data", () => {
  const source = readFileSync("app/(tabs)/home.tsx", "utf8");
  const [home, trends] = source.split("const HomeTrendOverlay =");
  expect(home).not.toContain("setActiveDashboardMetric");
  expect(home).toContain("trendsRef.current?.open(row.key)");
  expect(trends).toContain("React.useImperativeHandle");
  expect(trends).toContain("onShow={() => setContentReady(true)}");
  expect(trends).not.toContain("getDocs(");
});

it("puts graphs before comparisons and gives contribution days full-size targets", () => {
  const source = readFileSync("app/(tabs)/home.tsx", "utf8");
  const trends = source.split("const HomeTrendOverlay =")[1];
  expect(trends.indexOf("styles.heatmapWrap")).toBeLessThan(trends.indexOf("<HomeWorkoutComparison"));
  expect(trends.indexOf("<BarChart")).toBeLessThan(trends.indexOf("<HomeDailyComparison"));
  expect(source).toContain("const HEATMAP_CELL_SIZE = 44");
  expect(source).toContain('["M", "T", "W", "T", "F", "S", "S"]');
  expect(source).toContain('key={activeDashboardMetric}');
  expect(source).not.toContain('key={`${activeDashboardMetric}:${hideRestDaysInVolume}');
  expect(source).toContain("m.weekIndex * HEATMAP_WEEK_WIDTH");
  const phaseStyle = source.split("phasePickerOption: {")[1].split("},")[0];
  expect(phaseStyle).not.toContain("marginTop");
  expect(phaseStyle).toContain("borderRadius: 0");
});

it("keeps filtered charts mounted and anchors their lists without a delayed scroll", () => {
  const chart = readFileSync("src/components/charts/TrendCharts.tsx", "utf8");
  expect(chart).toContain("<FlatList");
  expect(chart).toContain("data={newestFirst}");
  expect(chart).toMatch(/data=\{newestFirst\}\s+inverted\s+horizontal/);
  expect(chart).not.toContain("scrollToEnd");
  expect(chart).not.toContain("setTimeout");
});
