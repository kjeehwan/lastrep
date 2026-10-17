import { startOfDay, type WorkoutSummary } from "../workouts/homeInsights";

/** Calendar-only layout; does not change the date grouping of recorded workouts. */
export function mondayCalendarMatrix(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - (first.getDay() + 6) % 7);
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => {
    const date = new Date(start);
    date.setDate(start.getDate() + week * 7 + day);
    return date;
  })).filter((week) => week.some((day) => day.getMonth() === month.getMonth()));
}

export function draftWorkoutSummary(plan: { exerciseNames: string[]; exercises?: { sets: unknown[] }[] } | null) {
  if (!plan) return "Choose a routine or build today's workout.";
  const exercises = plan.exercises?.length ?? plan.exerciseNames.length;
  const sets = plan.exercises?.reduce((total, exercise) => total + exercise.sets.length, 0);
  return `${exercises} exercise${exercises === 1 ? "" : "s"}${sets == null ? "" : ` / ${sets} planned sets`}`;
}

/** Match the existing homeInsights rolling windows rather than calendar weeks. */
export function recentWorkoutPeriods(workouts: WorkoutSummary[], now: Date) {
  const day = 86_400_000;
  const today = startOfDay(now).getTime();
  return [0, 7].map((offset) => ({
    label: offset === 0 ? "Last 7 days" : "Previous 7 days",
    workouts: workouts.filter(({ date }) => date.getTime() >= today - (offset + 6) * day && date.getTime() < today + (1 - offset) * day)
      .slice().sort((a, b) => b.date.getTime() - a.date.getTime()),
  }));
}

/** Chart histories contain zero placeholders; do not present those as measurements. */
export function recentDailyPeriods(points: { key: string; value: number }[], now: Date) {
  const byDate = new Map(points.map((point) => [point.key, point.value]));
  return [0, 7].map((offset) => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset - index, 12);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const value = byDate.get(key);
      return { key, date, value: typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null };
    });
    const values = days.flatMap(({ value }) => value == null ? [] : [value]);
    return { label: offset === 0 ? "Last 7 days" : "Previous 7 days", days,
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      recordedDays: values.length };
  });
}
