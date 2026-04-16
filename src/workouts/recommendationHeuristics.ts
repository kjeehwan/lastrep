export type WorkoutLike = {
  exercises: {
    name: string;
    sets: { rpe?: string | number | null }[];
  }[];
};

export type WorkoutTemplate = {
  name: string;
  primaryGroup: string;
  exercises: string[];
};

export const DEFAULT_WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    name: "Upper Push",
    primaryGroup: "chest",
    exercises: ["Bench Press", "Incline Dumbbell Press", "Overhead Press"],
  },
  {
    name: "Upper Pull",
    primaryGroup: "back",
    exercises: ["Barbell Row", "Lat Pulldown", "Seated Cable Row"],
  },
  {
    name: "Lower",
    primaryGroup: "legs",
    exercises: ["Squat", "Romanian Deadlift", "Leg Press"],
  },
  {
    name: "Shoulders + Arms",
    primaryGroup: "shoulders",
    exercises: ["Overhead Press", "Lateral Raise", "Bicep Curl", "Tricep Pushdown"],
  },
];

export const goalToLabel = (goal: string): string => {
  const map: Record<string, string> = {
    buildMuscle: "Build Muscle",
    loseFat: "Lose Fat",
    getStronger: "Get Stronger",
    improveFitness: "Improve Fitness",
  };
  return map[goal] ?? "General";
};

export const isPhaseGoalAligned = (trainingPhase: string, goal: string): boolean =>
  (trainingPhase === "Hypertrophy" && goal === "buildMuscle") ||
  (trainingPhase === "Strength" && goal === "getStronger");

export const classifyExerciseGroup = (exerciseName: string): string => {
  const label = exerciseName.toLowerCase();
  if (/(squat|lunge|leg|rdl|deadlift)/.test(label)) return "legs";
  if (/(bench|chest|fly|push up|dip)/.test(label)) return "chest";
  if (/(row|pulldown|pull up|back|lat)/.test(label)) return "back";
  if (/(press|shoulder|lateral|rear delt|arnold)/.test(label)) return "shoulders";
  if (/(curl|tricep|bicep|skullcrusher|arm)/.test(label)) return "arms";
  if (/(plank|crunch|core|ab)/.test(label)) return "core";
  return "other";
};

export const getDominantGroup = (workout: WorkoutLike | null): string | null => {
  if (!workout) return null;
  const counter = new Map<string, number>();
  workout.exercises.forEach((exercise) => {
    const group = classifyExerciseGroup(exercise.name);
    counter.set(group, (counter.get(group) ?? 0) + 1);
  });
  let topGroup: string | null = null;
  let topCount = 0;
  counter.forEach((count, group) => {
    if (count > topCount) {
      topCount = count;
      topGroup = group;
    }
  });
  return topGroup;
};

export const getAverageRpe = (workout: WorkoutLike | null): number | null => {
  if (!workout) return null;
  const values: number[] = [];
  workout.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      const parsed = Number(String(set.rpe ?? "").trim());
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 10) values.push(parsed);
    });
  });
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const pickTemplate = (
  templates: WorkoutTemplate[],
  yesterdayGroup: string | null,
  seed: number
): WorkoutTemplate => {
  const filtered = templates.filter((template) => template.primaryGroup !== yesterdayGroup);
  const source = filtered.length ? filtered : templates;
  return source[Math.abs(seed) % source.length];
};

export const resolveRecommendationTargets = (
  trainingPhase: string,
  goal: string,
  dietPhase: string,
  baseIntensityPct: number,
  highFatigue: boolean
) => {
  let targetSets = trainingPhase === "Strength" ? 4 : 3;
  let targetReps = trainingPhase === "Strength" ? "5" : trainingPhase === "Power" ? "3" : "8";
  if (goal === "buildMuscle") {
    targetReps = "8";
  } else if (goal === "getStronger") {
    targetReps = "5";
    targetSets = 4;
  } else if (goal === "loseFat") {
    targetReps = "10";
  }

  let intensityPct = baseIntensityPct;
  if (dietPhase === "Cut") intensityPct -= 5;
  if (highFatigue) {
    intensityPct -= 5;
    targetSets = Math.max(2, targetSets - 1);
  }

  const tempo = trainingPhase === "Power" ? "2-0-X-0" : "3-0-X-0";
  return { targetSets, targetReps, intensityPct, tempo };
};
