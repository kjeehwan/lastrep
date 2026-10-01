export type ExerciseGroupKey =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "cardio";

export type ExerciseCatalogItem = {
  id: string;
  name: string;
  aliases: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  movementPattern: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  group: ExerciseGroupKey;
  cues: string[];
  demoImages?: number[];
};

const demoByGroup: Record<ExerciseGroupKey, number[]> = {
  chest: [require("../../assets/dumbbell.png"), require("../../assets/gym-station.png")],
  back: [require("../../assets/expander.png"), require("../../assets/gym-station.png")],
  legs: [require("../../assets/kettlebell.png"), require("../../assets/balance-ball.png")],
  shoulders: [require("../../assets/dumbbell.png"), require("../../assets/expander.png")],
  arms: [require("../../assets/dumbbell.png"), require("../../assets/bag.png")],
  core: [require("../../assets/balance-ball.png"), require("../../assets/sportwoman.png")],
  cardio: [require("../../assets/treadmill.png"), require("../../assets/elliptical.png")],
};

export const EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  {
    id: "bench-press",
    name: "Bench Press",
    aliases: ["flat bench", "barbell bench"],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps", "front delts"],
    equipment: ["barbell", "bench"],
    movementPattern: "horizontal push",
    difficulty: "intermediate",
    group: "chest",
    cues: ["Plant feet and brace.", "Lower to mid chest.", "Press with controlled path."],
  },
  {
    id: "incline-dumbbell-press",
    name: "Incline Dumbbell Press",
    aliases: ["incline db press"],
    primaryMuscles: ["upper chest"],
    secondaryMuscles: ["triceps", "front delts"],
    equipment: ["dumbbell", "bench"],
    movementPattern: "incline push",
    difficulty: "intermediate",
    group: "chest",
    cues: ["Set 30-45 degree incline.", "Keep wrists stacked.", "Press up and in."],
  },
  {
    id: "chest-fly",
    name: "Chest Fly",
    aliases: ["pec fly", "dumbbell fly"],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front delts"],
    equipment: ["dumbbell", "cable"],
    movementPattern: "horizontal adduction",
    difficulty: "intermediate",
    group: "chest",
    cues: ["Soft elbow bend.", "Stretch under control.", "Squeeze at top."],
  },
  {
    id: "push-ups",
    name: "Push Ups",
    aliases: ["pushup", "press up"],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps", "core"],
    equipment: ["bodyweight"],
    movementPattern: "horizontal push",
    difficulty: "beginner",
    group: "chest",
    cues: ["Maintain straight line.", "Lower chest to floor.", "Press through palms."],
  },
  {
    id: "barbell-row",
    name: "Barbell Row",
    aliases: ["bent over row", "bb row"],
    primaryMuscles: ["lats", "mid back"],
    secondaryMuscles: ["biceps", "rear delts"],
    equipment: ["barbell"],
    movementPattern: "horizontal pull",
    difficulty: "intermediate",
    group: "back",
    cues: ["Hinge and brace.", "Pull to lower ribs.", "Pause and control down."],
  },
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    aliases: ["pulldown"],
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "mid back"],
    equipment: ["cable"],
    movementPattern: "vertical pull",
    difficulty: "beginner",
    group: "back",
    cues: ["Lean back slightly.", "Drive elbows down.", "Avoid shrugging."],
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    aliases: ["cable row"],
    primaryMuscles: ["mid back"],
    secondaryMuscles: ["lats", "biceps"],
    equipment: ["cable"],
    movementPattern: "horizontal pull",
    difficulty: "beginner",
    group: "back",
    cues: ["Tall torso.", "Pull to navel.", "Control return."],
  },
  {
    id: "pull-ups",
    name: "Pull Ups",
    aliases: ["chin over bar", "pullup"],
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "core"],
    equipment: ["bodyweight", "bar"],
    movementPattern: "vertical pull",
    difficulty: "advanced",
    group: "back",
    cues: ["Start from dead hang.", "Drive elbows down.", "Avoid kipping."],
  },
  {
    id: "deadlift",
    name: "Deadlift",
    aliases: ["conventional deadlift"],
    primaryMuscles: ["posterior chain"],
    secondaryMuscles: ["glutes", "hamstrings", "back"],
    equipment: ["barbell"],
    movementPattern: "hinge",
    difficulty: "advanced",
    group: "back",
    cues: ["Brace before pull.", "Bar close to body.", "Stand tall without overextending."],
  },
  {
    id: "squat",
    name: "Squat",
    aliases: ["back squat"],
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["core", "adductors"],
    equipment: ["barbell"],
    movementPattern: "squat",
    difficulty: "intermediate",
    group: "legs",
    cues: ["Brace and sit down.", "Track knees over toes.", "Drive through whole foot."],
  },
  {
    id: "front-squat",
    name: "Front Squat",
    aliases: ["fsq"],
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes", "core"],
    equipment: ["barbell"],
    movementPattern: "squat",
    difficulty: "advanced",
    group: "legs",
    cues: ["Elbows high.", "Stay upright.", "Push floor away."],
  },
  {
    id: "leg-press",
    name: "Leg Press",
    aliases: ["sled press"],
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes", "hamstrings"],
    equipment: ["machine"],
    movementPattern: "squat",
    difficulty: "beginner",
    group: "legs",
    cues: ["Set feet shoulder width.", "Control depth.", "Do not lock knees hard."],
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    aliases: ["rdl"],
    primaryMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: ["lower back"],
    equipment: ["barbell", "dumbbell"],
    movementPattern: "hinge",
    difficulty: "intermediate",
    group: "legs",
    cues: ["Soft knees.", "Hinge hips back.", "Keep bar close."],
  },
  {
    id: "lunges",
    name: "Lunges",
    aliases: ["walking lunge"],
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    equipment: ["bodyweight", "dumbbell"],
    movementPattern: "single-leg squat",
    difficulty: "beginner",
    group: "legs",
    cues: ["Long step.", "Drop straight down.", "Push through front foot."],
  },
  {
    id: "leg-extension",
    name: "Leg Extension",
    aliases: ["quad extension"],
    primaryMuscles: ["quads"],
    secondaryMuscles: [],
    equipment: ["machine"],
    movementPattern: "knee extension",
    difficulty: "beginner",
    group: "legs",
    cues: ["Control each rep.", "Pause at top.", "Avoid swinging."],
  },
  {
    id: "leg-curl",
    name: "Leg Curl",
    aliases: ["hamstring curl"],
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: ["calves"],
    equipment: ["machine"],
    movementPattern: "knee flexion",
    difficulty: "beginner",
    group: "legs",
    cues: ["Keep hips down.", "Curl smoothly.", "Control lowering phase."],
  },
  {
    id: "overhead-press",
    name: "Overhead Press",
    aliases: ["ohp", "military press"],
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["triceps", "upper chest"],
    equipment: ["barbell", "dumbbell"],
    movementPattern: "vertical push",
    difficulty: "intermediate",
    group: "shoulders",
    cues: ["Brace and squeeze glutes.", "Press in straight path.", "Head through at top."],
  },
  {
    id: "lateral-raise",
    name: "Lateral Raise",
    aliases: ["side raise"],
    primaryMuscles: ["side delts"],
    secondaryMuscles: ["traps"],
    equipment: ["dumbbell", "cable"],
    movementPattern: "abduction",
    difficulty: "beginner",
    group: "shoulders",
    cues: ["Lead with elbows.", "Raise to shoulder height.", "Control down slowly."],
  },
  {
    id: "rear-delt-fly",
    name: "Rear Delt Fly",
    aliases: ["reverse fly"],
    primaryMuscles: ["rear delts"],
    secondaryMuscles: ["upper back"],
    equipment: ["dumbbell", "machine", "cable"],
    movementPattern: "horizontal abduction",
    difficulty: "beginner",
    group: "shoulders",
    cues: ["Hinge torso.", "Open arms wide.", "Avoid shrugging."],
  },
  {
    id: "arnold-press",
    name: "Arnold Press",
    aliases: ["db arnold press"],
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["triceps", "upper chest"],
    equipment: ["dumbbell"],
    movementPattern: "vertical push",
    difficulty: "intermediate",
    group: "shoulders",
    cues: ["Rotate through press.", "Keep core tight.", "Control rotation down."],
  },
  {
    id: "bicep-curl",
    name: "Bicep Curl",
    aliases: ["db curl", "barbell curl"],
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
    equipment: ["dumbbell", "barbell", "cable"],
    movementPattern: "elbow flexion",
    difficulty: "beginner",
    group: "arms",
    cues: ["Pin elbows.", "Curl smoothly.", "Lower under control."],
  },
  {
    id: "hammer-curl",
    name: "Hammer Curl",
    aliases: ["neutral curl"],
    primaryMuscles: ["brachialis", "biceps"],
    secondaryMuscles: ["forearms"],
    equipment: ["dumbbell", "cable"],
    movementPattern: "elbow flexion",
    difficulty: "beginner",
    group: "arms",
    cues: ["Neutral grip.", "No torso swing.", "Control tempo."],
  },
  {
    id: "tricep-pushdown",
    name: "Tricep Pushdown",
    aliases: ["triceps pressdown", "pushdown"],
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    equipment: ["cable"],
    movementPattern: "elbow extension",
    difficulty: "beginner",
    group: "arms",
    cues: ["Keep elbows tucked.", "Extend fully.", "Avoid shoulder swing."],
  },
  {
    id: "skullcrusher",
    name: "Skullcrusher",
    aliases: ["lying triceps extension"],
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    equipment: ["barbell", "dumbbell"],
    movementPattern: "elbow extension",
    difficulty: "intermediate",
    group: "arms",
    cues: ["Keep upper arm steady.", "Lower near forehead.", "Press back up."],
  },
  {
    id: "dips",
    name: "Dips",
    aliases: ["parallel bar dips"],
    primaryMuscles: ["triceps", "chest"],
    secondaryMuscles: ["front delts"],
    equipment: ["bodyweight", "dip station"],
    movementPattern: "vertical push",
    difficulty: "advanced",
    group: "arms",
    cues: ["Shoulders down.", "Lean as needed.", "Control depth."],
  },
  {
    id: "plank",
    name: "Plank",
    aliases: ["front plank"],
    primaryMuscles: ["core"],
    secondaryMuscles: ["shoulders", "glutes"],
    equipment: ["bodyweight"],
    movementPattern: "isometric",
    difficulty: "beginner",
    group: "core",
    cues: ["Neutral spine.", "Brace abs.", "Breathe steadily."],
  },
  {
    id: "crunches",
    name: "Crunches",
    aliases: ["ab crunch"],
    primaryMuscles: ["abs"],
    secondaryMuscles: [],
    equipment: ["bodyweight"],
    movementPattern: "spinal flexion",
    difficulty: "beginner",
    group: "core",
    cues: ["Lift upper back.", "Keep neck neutral.", "Control tempo."],
  },
  {
    id: "hanging-leg-raise",
    name: "Hanging Leg Raise",
    aliases: ["leg raises"],
    primaryMuscles: ["abs", "hip flexors"],
    secondaryMuscles: ["grip"],
    equipment: ["bar"],
    movementPattern: "hip flexion",
    difficulty: "intermediate",
    group: "core",
    cues: ["Avoid swinging.", "Raise with control.", "Lower slowly."],
  },
  {
    id: "russian-twist",
    name: "Russian Twist",
    aliases: ["twists"],
    primaryMuscles: ["obliques"],
    secondaryMuscles: ["abs"],
    equipment: ["bodyweight", "plate", "dumbbell"],
    movementPattern: "rotation",
    difficulty: "beginner",
    group: "core",
    cues: ["Tall chest.", "Rotate torso.", "Control both sides."],
  },
  {
    id: "treadmill",
    name: "Treadmill",
    aliases: ["run", "jog"],
    primaryMuscles: ["cardio"],
    secondaryMuscles: ["legs"],
    equipment: ["machine"],
    movementPattern: "cardio",
    difficulty: "beginner",
    group: "cardio",
    cues: ["Maintain posture.", "Set sustainable pace.", "Breathe rhythmically."],
  },
  {
    id: "cycling",
    name: "Cycling",
    aliases: ["bike", "spin"],
    primaryMuscles: ["cardio", "quads"],
    secondaryMuscles: ["glutes"],
    equipment: ["machine", "bike"],
    movementPattern: "cardio",
    difficulty: "beginner",
    group: "cardio",
    cues: ["Set seat height.", "Drive through full pedal stroke.", "Keep cadence steady."],
  },
  {
    id: "rowing",
    name: "Rowing",
    aliases: ["erg", "row machine"],
    primaryMuscles: ["cardio", "back"],
    secondaryMuscles: ["legs", "core"],
    equipment: ["machine"],
    movementPattern: "cardio",
    difficulty: "beginner",
    group: "cardio",
    cues: ["Leg drive first.", "Finish with pull.", "Return in sequence."],
  },
  {
    id: "jump-rope",
    name: "Jump Rope",
    aliases: ["skipping"],
    primaryMuscles: ["cardio", "calves"],
    secondaryMuscles: ["shoulders"],
    equipment: ["rope"],
    movementPattern: "cardio",
    difficulty: "beginner",
    group: "cardio",
    cues: ["Small jumps.", "Rotate from wrists.", "Stay relaxed."],
  },
  {
    id: "hip-thrust",
    name: "Hip Thrust",
    aliases: ["barbell hip thrust"],
    primaryMuscles: ["glutes"],
    secondaryMuscles: ["hamstrings"],
    equipment: ["barbell", "bench"],
    movementPattern: "hip extension",
    difficulty: "intermediate",
    group: "legs",
    cues: ["Chin tucked.", "Drive through heels.", "Pause at lockout."],
  },
  {
    id: "bulgarian-split-squat",
    name: "Bulgarian Split Squat",
    aliases: ["split squat", "bss"],
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["core"],
    equipment: ["bodyweight", "dumbbell", "bench"],
    movementPattern: "single-leg squat",
    difficulty: "intermediate",
    group: "legs",
    cues: ["Long enough stance.", "Descend straight down.", "Drive through front foot."],
  },
  {
    id: "cable-fly",
    name: "Cable Fly",
    aliases: ["cable chest fly"],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front delts"],
    equipment: ["cable"],
    movementPattern: "horizontal adduction",
    difficulty: "beginner",
    group: "chest",
    cues: ["Set pulleys.", "Soft elbows.", "Squeeze chest through arc."],
  },
  {
    id: "face-pull",
    name: "Face Pull",
    aliases: ["rope face pull"],
    primaryMuscles: ["rear delts", "upper back"],
    secondaryMuscles: ["rotator cuff"],
    equipment: ["cable"],
    movementPattern: "horizontal pull",
    difficulty: "beginner",
    group: "shoulders",
    cues: ["Pull to eye level.", "Spread rope apart.", "Keep ribcage stacked."],
  },
  {
    id: "machine-chest-press",
    name: "Machine Chest Press",
    aliases: ["chest press machine"],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps", "front delts"],
    equipment: ["machine"],
    movementPattern: "horizontal push",
    difficulty: "beginner",
    group: "chest",
    cues: ["Seat at chest level.", "Press without shrugging.", "Control eccentric."],
  },
  {
    id: "machine-shoulder-press",
    name: "Machine Shoulder Press",
    aliases: ["shoulder press machine"],
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["triceps"],
    equipment: ["machine"],
    movementPattern: "vertical push",
    difficulty: "beginner",
    group: "shoulders",
    cues: ["Set handles near chin.", "Press up and slightly back.", "Control return."],
  },
];

const catalogWithDemos = EXERCISE_CATALOG.map((item) => ({
  ...item,
  demoImages: item.demoImages && item.demoImages.length ? item.demoImages : demoByGroup[item.group],
}));

export const EXERCISE_GROUPS = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "legs", label: "Legs" },
  { key: "shoulders", label: "Shoulders" },
  { key: "arms", label: "Arms" },
  { key: "core", label: "Core" },
  { key: "cardio", label: "Cardio" },
] as const;

const normalize = (value: string) => value.trim().toLowerCase();

export const getCatalogExerciseByName = (name: string): ExerciseCatalogItem | null => {
  const needle = normalize(name);
  if (!needle) return null;
  return (
    catalogWithDemos.find(
      (exercise) =>
        normalize(exercise.name) === needle ||
        exercise.aliases.some((alias) => normalize(alias) === needle)
    ) ?? null
  );
};

export const getExercisesByGroup = (group: ExerciseGroupKey): ExerciseCatalogItem[] =>
  catalogWithDemos.filter((exercise) => exercise.group === group);

export const searchCatalogExercises = (params: {
  query: string;
  group?: ExerciseGroupKey | "all";
  includeNames?: string[];
}): ExerciseCatalogItem[] => {
  const needle = normalize(params.query);
  const includeSet = new Set((params.includeNames ?? []).map((value) => normalize(value)));
  let base =
    params.group && params.group !== "all"
      ? getExercisesByGroup(params.group)
      : catalogWithDemos;
  if (includeSet.size > 0) {
    const included = catalogWithDemos.filter((exercise) => includeSet.has(normalize(exercise.name)));
    base = [...included, ...base];
  }
  const deduped = Array.from(new Map(base.map((item) => [item.id, item])).values());
  if (!needle) return deduped;
  return deduped.filter((exercise) => {
    const haystack = [
      exercise.name,
      ...exercise.aliases,
      ...exercise.primaryMuscles,
      ...exercise.secondaryMuscles,
      ...exercise.equipment,
      exercise.movementPattern,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
};

export const getSubstitutionSuggestions = (
  exerciseName: string,
  limit = 8
): ExerciseCatalogItem[] => {
  const target = getCatalogExerciseByName(exerciseName);
  if (!target) return [];
  const score = (candidate: ExerciseCatalogItem) => {
    let value = 0;
    if (candidate.group === target.group) value += 5;
    if (candidate.movementPattern === target.movementPattern) value += 4;
    const primaryOverlap = candidate.primaryMuscles.some((m) =>
      target.primaryMuscles.includes(m)
    );
    if (primaryOverlap) value += 4;
    const equipmentOverlap = candidate.equipment.some((item) =>
      target.equipment.includes(item)
    );
    if (equipmentOverlap) value += 3;
    if (candidate.difficulty === target.difficulty) value += 1;
    return value;
  };
  return catalogWithDemos
    .filter((candidate) => candidate.id !== target.id)
    .map((candidate) => ({ candidate, score: score(candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, limit)
    .map((entry) => entry.candidate);
};

