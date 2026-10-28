import type { BodyCompositionHistoryPoint } from "./bodyCompositionHistory";

export type BodyChartPeriod = "day" | "week" | "month" | "year";
export const BODY_CHART_VISIBLE_POINTS: Record<BodyChartPeriod, number> = { day: 7, week: 8, month: 10, year: 5 };
export type BodyChartPoint = BodyCompositionHistoryPoint & {
  periodStartMs: number;
  periodEndMs: number;
  displayEndMs: number;
  recordedDays: number;
  toDate: boolean;
};

/** Local calendar periods; never assume a day/week is a fixed number of milliseconds. */
export function bodyChartPeriodBounds(timestamp: number, period: BodyChartPeriod) {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (period === "month") start.setDate(1);
  if (period === "year") start.setMonth(0, 1);
  const next = new Date(start);
  if (period === "year") next.setFullYear(next.getFullYear() + 1);
  else if (period === "month") next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + (period === "week" ? 7 : 1));
  return { startMs: start.getTime(), endMs: next.getTime() - 1 };
}

/** Input is the existing latest-per-local-day series, so days have equal weight. */
export function bodyChartPeriodPoints(daily: BodyCompositionHistoryPoint[], period: BodyChartPeriod, nowMs = Date.now()): BodyChartPoint[] {
  const todayEnd = bodyChartPeriodBounds(nowMs, "day").endMs;
  const groups = new Map<number, BodyChartPoint & { sum: number }>();
  for (const point of daily) {
    if (point.recordedAtMs > todayEnd) continue;
    const { startMs, endMs } = bodyChartPeriodBounds(point.recordedAtMs, period);
    const current = groups.get(startMs);
    if (current) {
      current.sum += point.value;
      current.recordedDays++;
    } else {
      groups.set(startMs, { ...point, key: period === "day" ? point.key : `${point.key.split("-")[0]}-${period}-${startMs}`,
        periodStartMs: startMs, periodEndMs: endMs,
        displayEndMs: period === "week" ? Math.min(endMs, todayEnd) : endMs, recordedDays: 1, sum: point.value,
        toDate: period !== "day" && nowMs >= startMs && nowMs <= endMs });
    }
  }
  return [...groups.values()].sort((a, b) => a.periodStartMs - b.periodStartMs)
    .map(({ sum, ...point }) => ({ ...point, value: sum / point.recordedDays }));
}

const mmdd = (date: Date) => `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
export function bodyChartAxisLabel(point: BodyChartPoint, index: number, points: BodyChartPoint[], period: BodyChartPeriod): string[] {
  const timestamp = period === "week" ? point.displayEndMs : point.periodStartMs;
  const date = new Date(timestamp);
  const previous = index > 0 ? new Date(period === "week" ? points[index - 1].displayEndMs : points[index - 1].periodStartMs) : null;
  if (period === "year") return [String(date.getFullYear())];
  if (period === "month") {
    const firstInYear = !previous || date.getFullYear() !== previous.getFullYear();
    const month = date.toLocaleDateString(undefined, { month: "short" });
    if (firstInYear) return [month, String(date.getFullYear())];
    const first = points.find(p => new Date(p.periodStartMs).getFullYear() === date.getFullYear())!;
    return (date.getMonth() - new Date(first.periodStartMs).getMonth()) % 2 === 0 ? [month] : [];
  }
  if (period === "week" && point.toDate) return [mmdd(date)];
  return [!previous || date.getMonth() !== previous.getMonth() || date.getFullYear() !== previous.getFullYear() ? mmdd(date) : String(date.getDate())];
}

export function bodyChartPeriodLabel(point: BodyChartPoint, period: BodyChartPeriod) {
  const start = new Date(point.periodStartMs), end = new Date(period === "week" ? point.displayEndMs : point.periodEndMs);
  if (period === "day") return new Date(point.recordedAtMs).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (period === "year") return String(start.getFullYear());
  if (period === "month") return start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}\u2013${end.getDate()}, ${end.getFullYear()}`;
  }
  const from = start.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(start.getFullYear() !== end.getFullYear() ? { year: "numeric" as const } : {}) });
  return `${from} \u2013 ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

/** Fit the approved initial count; enlarged text increases spacing rather than shrinking labels. */
export function bodyChartPeriodLayout(count: number, viewport: number, period: BodyChartPeriod, scale = 1) {
  const padding = 32 * scale;
  const spacing = Math.max(1, (viewport - 64) / (BODY_CHART_VISIBLE_POINTS[period] - 1)) * scale;
  const width = Math.max(viewport, padding * 2 + Math.max(0, count - 1) * spacing);
  const start = width - padding - Math.max(0, count - 1) * spacing;
  return { width, padding, spacing, positions: Array.from({ length: count }, (_, i) => start + i * spacing) };
}

export function bodyChartWindowLabel(first: BodyChartPoint, last: BodyChartPoint, period: BodyChartPeriod) {
  if (first.key === last.key) return bodyChartPeriodLabel(first, period);
  const start = new Date(first.periodStartMs), end = new Date(period === "week" ? last.displayEndMs : last.periodEndMs);
  if (period === "year") return `${start.getFullYear()} \u2013 ${end.getFullYear()}`;
  const options: Intl.DateTimeFormatOptions = { month: "short", ...(period !== "month" ? { day: "numeric" } : {}) };
  const from = start.toLocaleDateString(undefined, { ...options, ...(start.getFullYear() !== end.getFullYear() ? { year: "numeric" } : {}) });
  return `${from} \u2013 ${end.toLocaleDateString(undefined, { ...options, year: "numeric" })}`;
}
