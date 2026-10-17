import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("browses sleep history locally without changing the day being logged", () => {
  const source = readFileSync("src/sleep/SleepScreen.tsx", "utf8");
  expect(source).toContain("const chartSelected = chartDate ?? selected;");
  expect(source).toContain("weeklySleepSummary(days, chartSelected, data.target)");
  expect(source).toContain("sessions = counted.filter((entry) => entry.dateKey === selected && !isSupersededSleepTotal(entry, counted))");
  expect(source).toContain("selected={chartSelected} anchor={chartAnchor} target={data.target} onSelect={setChartDate}");
  expect(source).toContain("setSelectedDate(date);\n    setChartDate(null);");
  expect(source).not.toContain("maintainVisibleContentPosition");
  expect(source).not.toContain("scrollTo(");
  expect(source).not.toContain("requestAnimationFrame");
  expect(source).not.toContain("graphInView");
});

it("separates summary metadata rows and draws entry rules only between entries", () => {
  const source = readFileSync("src/sleep/SleepScreen.tsx", "utf8");
  expect(source).toContain('visibleSessions.map((entry, index)');
  expect(source).toContain('borderBottomWidth: index < visibleSessions.length - 1 ? 1 : 0');
  expect(source).toContain('{row.recordedAtMs != null ? <Text style={muted}>');
  expect(source).not.toContain('` / ${row.source === "health"');
});

it("hides excluded sessions without offering a restore list on the Sleep screen", () => {
  const source = readFileSync("src/sleep/SleepScreen.tsx", "utf8");
  expect(source).toContain("visibleSessions = sessions.filter((entry) => !entry.excluded && !entry.providerDeleted)");
  expect(source).toContain("{visibleSessions.length ?");
  expect(source).not.toContain("View excluded entries");
  expect(source).not.toContain("Restore entry");
  expect(source).not.toContain("showExcluded");
  expect(source).toContain("This permanently deletes this entry");
});
