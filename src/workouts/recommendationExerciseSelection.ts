import type { ExerciseCatalogItem } from "./exerciseCatalog";

export type RecommendationSelectionInput = {
  focusId: string;
  primaryGroup: string;
  templateExercises: string[];
  exerciseCount: number;
  catalog: ExerciseCatalogItem[];
  completedExerciseNames: string[];
  recentlyTrainedExerciseNames: string[];
  trainingPhase: string;
  dietPhase: string;
  highFatigue: boolean;
};

export type RecommendationSelection = {
  exerciseNames: string[];
  addedRoles: string[];
};

type MovementSlot = "stableChestPress" | "tricepsAccessory" | "chestFly" | "horizontalPull" | "elbowFlexion" | "legCurl" | "legExtension" | "rearDelt";

const normalize = (value: string) => value.trim().toLowerCase();

const slotsForFocus = (focusId: string, primaryGroup: string): MovementSlot[] => {
  switch (focusId) {
    case "chest":
      return ["stableChestPress", "tricepsAccessory"];
    case "chest-triceps":
      return ["tricepsAccessory", "stableChestPress"];
    case "push":
      return ["chestFly", "stableChestPress"];
    case "pull":
      return ["horizontalPull", "elbowFlexion"];
    case "legs":
      return ["legCurl", "legExtension"];
    case "shoulders-arms":
      return ["rearDelt", "tricepsAccessory"];
    default:
      if (primaryGroup === "chest") return ["stableChestPress", "tricepsAccessory"];
      if (primaryGroup === "back") return ["horizontalPull", "elbowFlexion"];
      if (primaryGroup === "legs") return ["legCurl", "legExtension"];
      return ["rearDelt", "tricepsAccessory"];
  }
};

const roleLabel = (slot: MovementSlot) => {
  const labels: Record<MovementSlot, string> = {
    stableChestPress: "stable chest press",
    tricepsAccessory: "triceps accessory",
    chestFly: "chest fly",
    horizontalPull: "horizontal pull",
    elbowFlexion: "biceps accessory",
    legCurl: "hamstring curl",
    legExtension: "quad isolation",
    rearDelt: "rear-delt accessory",
  };
  return labels[slot];
};

const matchesSlot = (exercise: ExerciseCatalogItem, slot: MovementSlot) => {
  const name = normalize(exercise.name);
  const pattern = normalize(exercise.movementPattern);
  const muscles = [...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(normalize);
  const equipment = exercise.equipment.map(normalize);

  switch (slot) {
    case "stableChestPress":
      return exercise.group === "chest" && pattern === "horizontal push" && equipment.includes("machine");
    case "tricepsAccessory":
      return muscles.includes("triceps") && pattern === "elbow extension";
    case "chestFly":
      return exercise.group === "chest" && pattern === "horizontal adduction";
    case "horizontalPull":
      return exercise.group === "back" && pattern === "horizontal pull";
    case "elbowFlexion":
      return muscles.includes("biceps") && pattern === "elbow flexion";
    case "legCurl":
      return exercise.group === "legs" && pattern === "knee flexion";
    case "legExtension":
      return exercise.group === "legs" && pattern === "knee extension";
    case "rearDelt":
      return muscles.includes("rear delts") || name.includes("face pull");
  }
};

const scoreCandidate = (params: {
  exercise: ExerciseCatalogItem;
  completedCounts: Map<string, number>;
  recentlyTrained: Set<string>;
  trainingPhase: string;
  dietPhase: string;
  highFatigue: boolean;
}) => {
  const { exercise, completedCounts, recentlyTrained, trainingPhase, dietPhase, highFatigue } = params;
  const key = normalize(exercise.name);
  const equipment = exercise.equipment.map(normalize);
  const isStable = equipment.includes("machine") || equipment.includes("cable");
  const isCompound = ["horizontal push", "horizontal pull", "vertical pull", "squat", "hinge"].includes(
    normalize(exercise.movementPattern)
  );
  let score = Math.min(24, (completedCounts.get(key) ?? 0) * 8);

  if (recentlyTrained.has(key)) score -= 18;
  if (highFatigue) {
    if (isStable) score += 12;
    if (exercise.difficulty === "advanced") score -= 12;
  } else if (trainingPhase === "Strength" && isCompound) {
    score += 8;
  } else if (trainingPhase === "Hypertrophy" && isStable) {
    score += 5;
  }
  if (dietPhase === "Cut" && isStable) score += 4;
  return score;
};

export const selectRecommendedExercises = (input: RecommendationSelectionInput): RecommendationSelection => {
  const selected = input.templateExercises.slice(0, input.exerciseCount);
  const selectedNames = new Set(selected.map(normalize));
  const completedCounts = new Map<string, number>();
  input.completedExerciseNames.forEach((name) => {
    const key = normalize(name);
    completedCounts.set(key, (completedCounts.get(key) ?? 0) + 1);
  });
  const recentlyTrained = new Set(input.recentlyTrainedExerciseNames.map(normalize));
  const addedRoles: string[] = [];

  for (const slot of slotsForFocus(input.focusId, input.primaryGroup)) {
    if (selected.length >= input.exerciseCount) break;
    const candidate = input.catalog
      .filter((exercise) => !selectedNames.has(normalize(exercise.name)) && matchesSlot(exercise, slot))
      .map((exercise) => ({
        exercise,
        score: scoreCandidate({
          exercise,
          completedCounts,
          recentlyTrained,
          trainingPhase: input.trainingPhase,
          dietPhase: input.dietPhase,
          highFatigue: input.highFatigue,
        }),
      }))
      .sort((left, right) => right.score - left.score || left.exercise.name.localeCompare(right.exercise.name))[0];

    if (!candidate) continue;
    selected.push(candidate.exercise.name);
    selectedNames.add(normalize(candidate.exercise.name));
    addedRoles.push(roleLabel(slot));
  }

  return { exerciseNames: selected, addedRoles };
};
