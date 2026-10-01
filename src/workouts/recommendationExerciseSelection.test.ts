import { describe, expect, it } from "vitest";
import type { ExerciseCatalogItem } from "./exerciseCatalog";
import { selectRecommendedExercises } from "./recommendationExerciseSelection";

const catalog: ExerciseCatalogItem[] = [
  {
    id: "bench-press",
    name: "Bench Press",
    aliases: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    equipment: ["barbell", "bench"],
    movementPattern: "horizontal push",
    difficulty: "intermediate",
    group: "chest",
    cues: [],
  },
  {
    id: "incline-dumbbell-press",
    name: "Incline Dumbbell Press",
    aliases: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    equipment: ["dumbbell", "bench"],
    movementPattern: "incline push",
    difficulty: "intermediate",
    group: "chest",
    cues: [],
  },
  {
    id: "cable-fly",
    name: "Cable Fly",
    aliases: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
    equipment: ["cable"],
    movementPattern: "horizontal adduction",
    difficulty: "beginner",
    group: "chest",
    cues: [],
  },
  {
    id: "machine-chest-press",
    name: "Machine Chest Press",
    aliases: [],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    equipment: ["machine"],
    movementPattern: "horizontal push",
    difficulty: "beginner",
    group: "chest",
    cues: [],
  },
  {
    id: "tricep-pushdown",
    name: "Tricep Pushdown",
    aliases: [],
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    equipment: ["cable"],
    movementPattern: "elbow extension",
    difficulty: "beginner",
    group: "arms",
    cues: [],
  },
  {
    id: "skullcrusher",
    name: "Skullcrusher",
    aliases: [],
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    equipment: ["barbell"],
    movementPattern: "elbow extension",
    difficulty: "intermediate",
    group: "arms",
    cues: [],
  },
];

describe("selectRecommendedExercises", () => {
  it("uses balanced chest movement slots instead of alphabetical catalog fillers", () => {
    const result = selectRecommendedExercises({
      focusId: "chest",
      primaryGroup: "chest",
      templateExercises: ["Bench Press", "Incline Dumbbell Press", "Cable Fly"],
      exerciseCount: 5,
      catalog,
      completedExerciseNames: ["Bench Press", "Machine Chest Press"],
      recentlyTrainedExerciseNames: [],
      trainingPhase: "Hypertrophy",
      dietPhase: "Bulk",
      highFatigue: false,
    });

    expect(result.exerciseNames).toEqual([
      "Bench Press",
      "Incline Dumbbell Press",
      "Cable Fly",
      "Machine Chest Press",
      "Tricep Pushdown",
    ]);
    expect(result.addedRoles).toEqual(["stable chest press", "triceps accessory"]);
  });

  it("prefers stable accessories when fatigue is high", () => {
    const result = selectRecommendedExercises({
      focusId: "chest",
      primaryGroup: "chest",
      templateExercises: ["Bench Press", "Incline Dumbbell Press", "Cable Fly"],
      exerciseCount: 4,
      catalog,
      completedExerciseNames: [],
      recentlyTrainedExerciseNames: [],
      trainingPhase: "Hypertrophy",
      dietPhase: "Maintain",
      highFatigue: true,
    });

    expect(result.exerciseNames.at(-1)).toBe("Machine Chest Press");
  });
});
