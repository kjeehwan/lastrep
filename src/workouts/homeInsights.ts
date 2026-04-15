type WorkoutSet = {
  weightKg: number | null;
  reps: string;
};

type WorkoutExercise = {
  name: string;
  sets: WorkoutSet[];
};

export type WorkoutSummary = {
  id: string;
  title: string;
  date: Date;
  trainingPhase: string | null;
  exercises: WorkoutExercise[];
};

export type DayWorkoutSummary = {
  dateKey: string;
  workoutCount: number;
  totalSets: number;
  totalVolumeKg: number;
};

export type WeeklyWorkoutMetrics = {
  workoutsThisWeek: number;
  workoutsLastWeek: number;
  setsThisWeek: number;
  setsLastWeek: number;
  avgVolumeThisWeek: number;
  avgVolumeLastWeek: number;
  improvingByVolume: boolean;
  improvingBySets: boolean;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

export const fromDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const clampPositive = (value: number): number => (value > 0 ? value : 0);

const parseReps = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return null;
    return Math.round((min + max) / 2);
  }
  const scalar = Number(trimmed);
  if (!Number.isFinite(scalar) || scalar <= 0) return null;
  return Math.round(scalar);
};

export const getWorkoutSetCount = (workout: WorkoutSummary): number =>
  workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

export const getWorkoutVolumeKg = (workout: WorkoutSummary): number =>
  workout.exercises.reduce((workoutSum, exercise) => {
    return (
      workoutSum +
      exercise.sets.reduce((exerciseSum, set) => {
        const reps = parseReps(set.reps);
        if (set.weightKg == null || reps == null) return exerciseSum;
        return exerciseSum + clampPositive(set.weightKg) * reps;
      }, 0)
    );
  }, 0);

export const buildDaySummaries = (workouts: WorkoutSummary[]): DayWorkoutSummary[] => {
  const byDate = new Map<string, DayWorkoutSummary>();
  workouts.forEach((workout) => {
    const dateKey = toDateKey(workout.date);
    const current = byDate.get(dateKey) ?? {
      dateKey,
      workoutCount: 0,
      totalSets: 0,
      totalVolumeKg: 0,
    };
    current.workoutCount += 1;
    current.totalSets += getWorkoutSetCount(workout);
    current.totalVolumeKg += getWorkoutVolumeKg(workout);
    byDate.set(dateKey, current);
  });

  return Array.from(byDate.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

export const getDaySummaryMap = (workouts: WorkoutSummary[]): Map<string, DayWorkoutSummary> => {
  const map = new Map<string, DayWorkoutSummary>();
  buildDaySummaries(workouts).forEach((summary) => {
    map.set(summary.dateKey, summary);
  });
  return map;
};

const getWindowRange = (windowStartDaysAgo: number, windowEndDaysAgo: number, now = new Date()) => {
  const todayStart = startOfDay(now).getTime();
  const startMs = todayStart - windowStartDaysAgo * ONE_DAY_MS;
  const endMs = todayStart - windowEndDaysAgo * ONE_DAY_MS + (ONE_DAY_MS - 1);
  return { startMs, endMs };
};

const filterInRange = (
  workouts: WorkoutSummary[],
  windowStartDaysAgo: number,
  windowEndDaysAgo: number,
  now = new Date()
) => {
  const { startMs, endMs } = getWindowRange(windowStartDaysAgo, windowEndDaysAgo, now);
  return workouts.filter((workout) => {
    const ts = workout.date.getTime();
    return ts >= startMs && ts <= endMs;
  });
};

export const computeWeeklyWorkoutMetrics = (
  workouts: WorkoutSummary[],
  now = new Date()
): WeeklyWorkoutMetrics => {
  const thisWeek = filterInRange(workouts, 6, 0, now);
  const lastWeek = filterInRange(workouts, 13, 7, now);

  const workoutsThisWeek = thisWeek.length;
  const workoutsLastWeek = lastWeek.length;
  const setsThisWeek = thisWeek.reduce((sum, workout) => sum + getWorkoutSetCount(workout), 0);
  const setsLastWeek = lastWeek.reduce((sum, workout) => sum + getWorkoutSetCount(workout), 0);
  const volumeThisWeek = thisWeek.reduce((sum, workout) => sum + getWorkoutVolumeKg(workout), 0);
  const volumeLastWeek = lastWeek.reduce((sum, workout) => sum + getWorkoutVolumeKg(workout), 0);
  const avgVolumeThisWeek = workoutsThisWeek > 0 ? volumeThisWeek / workoutsThisWeek : 0;
  const avgVolumeLastWeek = workoutsLastWeek > 0 ? volumeLastWeek / workoutsLastWeek : 0;

  return {
    workoutsThisWeek,
    workoutsLastWeek,
    setsThisWeek,
    setsLastWeek,
    avgVolumeThisWeek,
    avgVolumeLastWeek,
    improvingByVolume:
      workoutsThisWeek > 0 && (workoutsLastWeek === 0 || avgVolumeThisWeek > avgVolumeLastWeek),
    improvingBySets: workoutsThisWeek > 0 && (workoutsLastWeek === 0 || setsThisWeek > setsLastWeek),
  };
};

export const getCalendarMatrix = (monthDate: Date): Date[][] => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const offset = start.getDay(); // Sunday-first calendar
  const cursor = new Date(start);
  cursor.setDate(start.getDate() - offset);

  const weeks: Date[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const row: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
};
