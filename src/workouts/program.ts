import { Timestamp } from "firebase/firestore";
import { toDateKey } from "./homeInsights";

export type ProgramDayType = "workout" | "rest";

export type ProgramDay = {
  dayNumber: number;
  type: ProgramDayType;
  title: string;
  routineId?: string | null;
  exercises?: string[];
};

export type WorkoutProgram = {
  isActive: boolean;
  startedAt: Timestamp | null;
  days: ProgramDay[];
  updatedAt?: Timestamp | null;
};

export type ProgramCalendarEntry = {
  dateKey: string;
  type: ProgramDayType;
  dayNumber: number;
  title: string;
};

const DAY_COUNT = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const baseTemplates: Omit<ProgramDay, "dayNumber">[] = [
  {
    type: "workout",
    title: "Push (Chest / Shoulders / Triceps)",
    exercises: [
      "Barbell Bench Press - 4 x 6-10",
      "Incline Dumbbell Press - 3 x 8-12",
      "Seated Shoulder Press - 3 x 8-12",
      "Cable Lateral Raise - 3 x 12-15",
      "Cable Triceps Pushdown - 3 x 10-15",
    ],
  },
  {
    type: "workout",
    title: "Pull (Back / Biceps)",
    exercises: [
      "Lat Pulldown - 4 x 8-12",
      "Chest-Supported Row - 3 x 8-12",
      "Single-Arm Cable Row - 3 x 10-12",
      "Face Pull - 3 x 12-15",
      "EZ Bar Curl - 3 x 10-12",
    ],
  },
  {
    type: "workout",
    title: "Legs (Quad / Glute / Hamstring)",
    exercises: [
      "Back Squat - 4 x 5-8",
      "Romanian Deadlift - 3 x 6-10",
      "Leg Press - 3 x 10-15",
      "Leg Curl - 3 x 10-15",
      "Calf Raise - 3 x 12-20",
    ],
  },
  {
    type: "workout",
    title: "Upper (Strength Focus)",
    exercises: [
      "Flat Barbell Bench Press - 4 x 4-6",
      "Weighted Pull-Up / Pulldown - 4 x 5-8",
      "Seated Dumbbell Press - 3 x 6-10",
      "Barbell Row - 3 x 6-10",
      "Cable Curl + Overhead Triceps Extension - 2 x 10-12 each",
    ],
  },
  {
    type: "workout",
    title: "Lower (Strength Focus)",
    exercises: [
      "Back Squat - 4 x 4-6",
      "Conventional Deadlift - 3 x 3-5",
      "Bulgarian Split Squat - 3 x 8-12",
      "Leg Curl - 3 x 10-15",
      "Standing Calf Raise - 3 x 12-20",
    ],
  },
  {
    type: "rest",
    title: "Rest / Recovery",
    exercises: ["Walk 20-30 min", "Light mobility 10-15 min", "Sleep + nutrition focus"],
  },
  {
    type: "rest",
    title: "Rest / Recovery",
    exercises: ["Walk 20-30 min", "Light mobility 10-15 min", "Sleep + nutrition focus"],
  },
];

export const buildSampleProgramDays = (
  availabilityDays: number,
  options?: { withTemplateTitles?: boolean; withTemplateExercises?: boolean }
): ProgramDay[] => {
  const workoutDays = Math.max(1, Math.min(7, Math.round(availabilityDays)));
  const withTemplateTitles = options?.withTemplateTitles ?? true;
  const withTemplateExercises = options?.withTemplateExercises ?? true;
  return Array.from({ length: DAY_COUNT }, (_, index) => {
    const dayNumber = index + 1;
    const template = baseTemplates[index];
    const type = dayNumber <= workoutDays ? "workout" : "rest";
    return {
      dayNumber,
      type,
      title: type === "workout"
        ? withTemplateTitles
          ? template.title
          : ""
        : "Rest / Recovery",
      exercises:
        type === "workout"
          ? withTemplateExercises
            ? template.exercises ?? []
            : []
          : template.exercises ?? [],
      routineId: null,
    };
  });
};

export const normalizeProgram = (raw: unknown): WorkoutProgram | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const rawDays = Array.isArray(candidate.days) ? candidate.days : [];
  if (rawDays.length !== DAY_COUNT) return null;
  const days: ProgramDay[] = rawDays
    .map((day) => {
      const row = day as Record<string, unknown>;
      const dayNumber =
        typeof row.dayNumber === "number" ? Math.max(1, Math.min(DAY_COUNT, Math.round(row.dayNumber))) : null;
      const type = row.type === "workout" || row.type === "rest" ? row.type : null;
      const titleRaw = typeof row.title === "string" ? row.title.trim() : "";
      if (dayNumber == null || type == null) return null;
      const title =
        titleRaw.length > 0
          ? titleRaw
          : type === "rest"
            ? "Rest / Recovery"
            : `Workout Day ${dayNumber}`;
      return {
        dayNumber,
        type,
        title,
        routineId: typeof row.routineId === "string" ? row.routineId : null,
        exercises: Array.isArray(row.exercises)
          ? row.exercises.filter((item): item is string => typeof item === "string")
          : [],
      };
    })
    .filter((day): day is ProgramDay => day != null)
    .sort((a, b) => a.dayNumber - b.dayNumber);

  if (days.length !== DAY_COUNT) return null;
  const startedAt = candidate.startedAt instanceof Timestamp ? candidate.startedAt : null;
  const updatedAt = candidate.updatedAt instanceof Timestamp ? candidate.updatedAt : null;
  const isActive = candidate.isActive !== false;
  return { isActive, startedAt, updatedAt, days };
};

export const buildProgramPayload = (
  days: ProgramDay[],
  options?: { isActive?: boolean; startedAt?: Timestamp | null }
): WorkoutProgram => ({
  days: days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      dayNumber: day.dayNumber,
      type: day.type,
      title: day.title,
      routineId: day.routineId ?? null,
      exercises: day.exercises ?? [],
    })),
  isActive: options?.isActive ?? true,
  startedAt: options?.startedAt ?? Timestamp.now(),
  updatedAt: Timestamp.now(),
});

export const buildProgramCalendarEntryForDate = (
  date: Date,
  program: WorkoutProgram,
  workoutCountByDate: Map<string, number>,
  today = new Date()
): ProgramCalendarEntry | null => {
  if (!program.isActive || !program.startedAt || !program.days.length) return null;

  const start = new Date(program.startedAt.toDate());
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() < start.getTime()) return null;

  const todayKey = toDateKey(today);
  const targetKey = toDateKey(target);
  const backlog: ProgramDay[] = [];
  let scheduleIndex = 0;
  let cursor = new Date(start);
  let currentEntry: ProgramCalendarEntry | null = null;

  while (cursor.getTime() <= target.getTime()) {
    const template = program.days[scheduleIndex % program.days.length];
    scheduleIndex += 1;
    const cursorKey = toDateKey(cursor);
    const isPastDate = cursorKey < todayKey;

    if (template.type === "rest") {
      currentEntry = {
        dateKey: cursorKey,
        type: "rest",
        dayNumber: template.dayNumber,
        title: template.title,
      };
      cursor = new Date(cursor.getTime() + ONE_DAY_MS);
      continue;
    }

    let assigned = template;
    if (backlog.length > 0) {
      assigned = backlog.shift()!;
      backlog.push(template);
    }

    currentEntry = {
      dateKey: cursorKey,
      type: "workout",
      dayNumber: assigned.dayNumber,
      title: assigned.title,
    };

    if (isPastDate) {
      const completed = (workoutCountByDate.get(cursorKey) ?? 0) > 0;
      if (!completed) {
        backlog.unshift(assigned);
      }
    }

    cursor = new Date(cursor.getTime() + ONE_DAY_MS);
  }

  if (!currentEntry || currentEntry.dateKey !== targetKey) return null;
  return currentEntry;
};

export const buildWorkoutCountByDateMap = (workoutDates: Date[]): Map<string, number> => {
  const map = new Map<string, number>();
  workoutDates.forEach((date) => {
    const key = toDateKey(date);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
};
