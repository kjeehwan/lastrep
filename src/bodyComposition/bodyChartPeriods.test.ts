import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import type { BodyCompositionHistoryEntry } from "../contracts";
import { getBodyCompositionHistoryPoints, type BodyCompositionHistoryPoint } from "./bodyCompositionHistory";
import { BODY_CHART_VISIBLE_POINTS, bodyChartWindowLabel, bodyChartAxisLabel, bodyChartPeriodBounds, bodyChartPeriodLabel, bodyChartPeriodLayout, bodyChartPeriodPoints, type BodyChartPeriod } from "./bodyChartPeriods";
const ms = (date: string) => new Date(date + "T12:00:00").getTime();
const point = (date: string, value: number): BodyCompositionHistoryPoint => ({ key: `weight-${ms(date)}`, recordedAtMs: ms(date), value, source: "manual", originLabel: null });
const now = ms("2026-10-28");
const values = [point("2026-10-12", 80), point("2026-10-15", 82), point("2026-10-20", 90), point("2026-10-28", 84)];
describe("calendar body-composition charts", () => {
  it("keeps daily values and their edit identities without changing history", () => {
    const before = structuredClone(values);
    const daily = bodyChartPeriodPoints(values, "day", now);
    expect(daily.map(p => p.value)).toEqual([80, 82, 90, 84]);
    expect(daily.map(p => p.key)).toEqual(values.map(p => p.key));
    expect(daily.map(p => p.recordedAtMs)).toEqual(values.map(p => p.recordedAtMs));
    expect(values).toEqual(before);
  });
  it("averages recorded days, not missing days or multiple raw entries on a day", () => {
    const raw = [
      ["2026-10-12T08:00:00", 60], ["2026-10-12T18:00:00", 80], ["2026-10-15T08:00:00", 82],
    ].map(([date, weight]) => ({ recordedAt: Timestamp.fromDate(new Date(date as string)), source: "manual", originLabel: null, weightKg: weight as number, bodyFatPercent: null, leanBodyMassKg: null, skeletalMuscleMassKg: null, legacyMuscleMassKg: null }) as BodyCompositionHistoryEntry);
    const weekly = bodyChartPeriodPoints(getBodyCompositionHistoryPoints(raw, "weight"), "week", now);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toMatchObject({ value: 81, recordedDays: 2, toDate: false });
    expect(new Date(weekly[0].periodStartMs).getDay()).toBe(1);
    expect(new Date(weekly[0].periodEndMs).getDay()).toBe(0);
    expect(bodyChartAxisLabel(weekly[0], 0, weekly, "week")).toEqual(["10/18"]);
  });
  it("keeps sparse metric series independent and flags current partial periods", () => {
    const monthly = bodyChartPeriodPoints(values, "month", now);
    expect(monthly[0]).toMatchObject({ value: 84, recordedDays: 4, toDate: true });
    expect(bodyChartPeriodPoints(values, "year", now)[0].value).toBe(84);
    const weekly = bodyChartPeriodPoints(values, "week", now);
    expect(weekly.map(p => p.toDate)).toEqual([false, false, true]);
    expect(bodyChartPeriodPoints([], "year", now)).toEqual([]);
    expect(bodyChartPeriodPoints([point("2026-10-29", 0)], "day", now)).toEqual([]);
  });
  it("uses local calendar boundaries across months, years, leap days and DST", () => {
    const week = bodyChartPeriodBounds(ms("2026-01-01"), "week");
    expect(new Date(week.startMs).getFullYear()).toBe(2025);
    expect(new Date(week.startMs).getDate()).toBe(29);
    expect(new Date(week.endMs).getFullYear()).toBe(2026);
    expect(new Date(week.endMs).getDate()).toBe(4);
    expect(new Date(bodyChartPeriodBounds(ms("2024-02-03"), "month").endMs).getDate()).toBe(29);
    for (const date of ["2026-03-08", "2026-11-01"]) {
      const bounds = bodyChartPeriodBounds(ms(date), "day");
      expect(new Date(bounds.startMs).getHours()).toBe(0);
      expect(new Date(bounds.endMs).getHours()).toBe(23);
      const next = new Date(bounds.endMs + 1);
      expect(next.getHours()).toBe(0);
      expect(next.getDate()).toBe(new Date(ms(date)).getDate() + 1);
    }
    const p = bodyChartPeriodPoints([point("2026-01-01", 80)], "week", now)[0];
    expect(bodyChartPeriodLabel(p, "week")).toContain("2025");
    expect(bodyChartPeriodLabel(p, "week")).toContain("2026");
  });
  it("labels day/week month boundaries numerically without repeating the month", () => {
    const daily = bodyChartPeriodPoints([point("2026-10-12", 80), point("2026-10-15", 81), point("2026-11-01", 82)], "day", ms("2026-11-02"));
    expect(daily.map((p, i) => bodyChartAxisLabel(p, i, daily, "day"))).toEqual([["10/12"], ["15"], ["11/01"]]);
    const weekly = bodyChartPeriodPoints([point("2026-10-01", 80), point("2026-10-08", 81), point("2026-10-28", 82)], "week", now);
    expect(weekly.map((p, i) => bodyChartAxisLabel(p, i, weekly, "week"))).toEqual([["10/04"], ["11"], ["10/28"]]);
  });
  it("ends the current week's labels today while preserving the calendar bucket and average", () => {
    const daily = [point("2026-10-20", 90), point("2026-10-26", 80), point("2026-10-27", 82)];
    const weekly = bodyChartPeriodPoints(daily, "week", now);
    const latest = weekly.at(-1)!;
    expect(latest).toMatchObject({ value: 81, recordedDays: 2, toDate: true });
    expect(new Date(latest.periodStartMs).getDate()).toBe(26);
    expect(new Date(latest.periodEndMs).getDate()).toBe(1);
    expect(new Date(latest.displayEndMs).getDate()).toBe(28);
    expect(bodyChartAxisLabel(latest, 1, weekly, "week")).toEqual(["10/28"]);
    const label = bodyChartPeriodLabel(latest, "week");
    expect(label).toContain("26");
    expect(label).toContain("28");
    expect(label).not.toContain("Nov");
    expect(bodyChartWindowLabel(weekly[0], latest, "week")).not.toContain("Nov");
    const tomorrow = bodyChartPeriodPoints(daily, "week", ms("2026-10-29")).at(-1)!;
    expect(new Date(tomorrow.displayEndMs).getDate()).toBe(29);
    expect(tomorrow.key).toBe(latest.key);
    expect(tomorrow.value).toBe(81);
    const completed = bodyChartPeriodPoints(daily, "week", ms("2026-11-02")).at(-1)!;
    expect(completed.toDate).toBe(false);
    expect(new Date(completed.displayEndMs).getDay()).toBe(0);
    expect(bodyChartAxisLabel(completed, 0, [completed], "week")).toEqual(["11/01"]);
  });
  it("labels alternate calendar months, wraps the year and resets in a new year", () => {
    const monthly = bodyChartPeriodPoints(["2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-03-01"].map(d => point(d, 80)), "month", now);
    const labels = monthly.map((p, i) => bodyChartAxisLabel(p, i, monthly, "month"));
    expect(labels.map(label => label.length)).toEqual([2, 0, 1, 2, 1]);
    expect(labels[0][1]).toBe("2025");
    expect(labels[3][1]).toBe("2026");
  });
  it("uses a compact window range with correct year boundaries", () => {
    const weekly = bodyChartPeriodPoints([point("2026-10-01", 80), point("2026-10-28", 81)], "week", now);
    expect(bodyChartWindowLabel(weekly[0], weekly[1], "week")).not.toContain("Oct 4");
    const yearly = bodyChartPeriodPoints([point("2025-12-01", 80), point("2026-01-01", 81)], "year", now);
    expect(bodyChartWindowLabel(yearly[0], yearly[1], "year")).toBe("2025 \u2013 2026");
    expect(bodyChartWindowLabel(yearly[0], yearly[0], "year")).toBe("2025");
  });
  it.each(Object.keys(BODY_CHART_VISIBLE_POINTS) as BodyChartPeriod[])("fits the approved %s window and preserves scrollable history", period => {
    const count = BODY_CHART_VISIBLE_POINTS[period];
    for (const viewport of [280, 340, 700]) {
      const fit = bodyChartPeriodLayout(count, viewport, period);
      expect(fit.width).toBeCloseTo(viewport);
      expect(fit.positions[0]).toBeCloseTo(fit.padding);
      const long = bodyChartPeriodLayout(count + 20, viewport, period);
      expect(long.width).toBeGreaterThan(viewport);
      expect(long.positions.at(-1)! - long.positions.at(-count)!).toBeCloseTo(viewport - 2 * long.padding);
      const sparse = bodyChartPeriodLayout(2, viewport, period);
      expect(sparse.width).toBe(viewport);
      expect(sparse.positions.at(-1)).toBe(viewport - sparse.padding);
    }
    const large = bodyChartPeriodLayout(count, 340, period, 2);
    expect(large.width).toBeGreaterThan(340);
    expect(large.padding).toBe(64);
  });
});
