import { describe, expect, it } from "vitest";
import type { ExerciseCatalogItem, ExerciseGroupKey } from "./exerciseCatalog";
import { getExerciseSubstitutions, indexExerciseSearch, replacementSearchOptions, searchExerciseIndex } from "./exerciseSearch";

function exercise(name: string, group: ExerciseGroupKey, options: Partial<ExerciseCatalogItem> = {}): ExerciseCatalogItem {
  return { id: name, name, group, aliases: [], primaryMuscles: [], secondaryMuscles: [],
    equipment: [], movementPattern: "", difficulty: "intermediate", cues: [], ...options };
}
const bench = exercise("Bench Press", "chest", { aliases: ["flat bench", "barbell bench"], equipment: ["barbell", "bench"], secondaryMuscles: ["triceps"] });
const incline = exercise("Incline Dumbbell Press", "chest", { aliases: ["incline db press"], equipment: ["dumbbell", "bench"] });
const overhead = exercise("Overhead Press", "shoulders", { aliases: ["ohp", "military press"], equipment: ["barbell"] });
const catalog = [bench, incline, overhead,
  exercise("Dumbbell Bench Press", "chest", { aliases: ["Dumbbell", "Bench", "Press"], equipment: ["dumbbell", "bench"] }),
  exercise("Decline Dumbbell Bench Press", "chest", { equipment: ["dumbbell", "bench"] }),
  exercise("Barbell Row", "back", { aliases: ["bent over row", "bb row"], primaryMuscles: ["lats"], equipment: ["barbell"] }),
  exercise("Seated Cable Row", "back", { aliases: ["cable row"], equipment: ["cable"] }),
  exercise("Lat Pulldown", "back", { primaryMuscles: ["lats"], equipment: ["cable"] }),
  exercise("Lateral Raise", "shoulders", { equipment: ["dumbbell"] }),
  exercise("Pull Ups", "back", { aliases: ["pullup"], equipment: ["bodyweight"] }),
  exercise("Push Ups", "chest", { aliases: ["pushup"], equipment: ["bodyweight"] }),
  exercise("Chin-Up", "back", { equipment: ["body only"] }),
  exercise("Romanian Deadlift", "legs", { aliases: ["rdl"], primaryMuscles: ["hamstrings"] }),
  exercise("Squat", "legs", { aliases: ["back squat"], primaryMuscles: ["quads", "glutes"] }),
  exercise("Front Squat", "legs", { primaryMuscles: ["quadriceps"] }),
  exercise("Leg Curl", "legs", { primaryMuscles: ["hamstrings"] }),
  exercise("Leg Extension", "legs", { equipment: ["machine"] }),
  exercise("Standing Calf Raises", "legs"),
  exercise("Hip Thrust", "legs", { primaryMuscles: ["glutes"] }),
  exercise("Bicep Curl", "arms", { aliases: ["db curl"], primaryMuscles: ["biceps"] }),
  exercise("Hammer Curls", "arms", { equipment: ["dumbbell"] }),
  exercise("Skullcrusher", "arms"),
  exercise("Chest Fly", "chest", { aliases: ["pec fly"] }),
  exercise("Cable Fly", "chest", { equipment: ["cable"] }),
  exercise("Crunches", "core", { aliases: ["ab crunch"], primaryMuscles: ["abdominals"] }),
  exercise("Plank", "core", { primaryMuscles: ["core"], secondaryMuscles: ["chest"] }),
  exercise("Treadmill", "cardio", { aliases: ["run", "jog"] }),
  exercise("Cycling", "cardio", { aliases: ["bike", "spin"] }),
  exercise("Air Bike", "core"),
  exercise("Rowing", "cardio", { aliases: ["erg", "row machine"] }),
  exercise("Jump Rope", "cardio"),
  exercise("One-Arm Kettlebell Swings", "legs", { equipment: ["kettlebells"] }),
  exercise("Band Good Morning", "legs", { equipment: ["bands"] }),
];
const index = indexExerciseSearch(catalog);
const names = (query: string) => searchExerciseIndex(index, query).map((item) => item.name);

describe("exercise search relevance shared by Add and Replace", () => {
  it.each([
    ["bench press", "Bench Press"], ["incline dumbbell press", "Incline Dumbbell Press"],
    ["dumbbell bench press", "Dumbbell Bench Press"], ["db bench", "Dumbbell Bench Press"],
    ["bb row", "Barbell Row"], ["cable row", "Seated Cable Row"],
    ["lat pulldown", "Lat Pulldown"], ["lateral raise", "Lateral Raise"],
    ["pull up", "Pull Ups"], ["pull-up", "Pull Ups"], ["pullup", "Pull Ups"],
    ["pushup", "Push Ups"], ["chin up", "Chin-Up"], ["rdl", "Romanian Deadlift"],
    ["OHP", "Overhead Press"], ["front squat", "Front Squat"], ["leg curl", "Leg Curl"],
    ["leg extensions", "Leg Extension"], ["calf raise", "Standing Calf Raises"],
    ["hip thrust", "Hip Thrust"], ["db curl", "Bicep Curl"], ["hammer curl", "Hammer Curls"],
    ["skull crusher", "Skullcrusher"], ["pec fly", "Chest Fly"], ["cable fly", "Cable Fly"],
    ["ab crunch", "Crunches"], ["run", "Treadmill"], ["bike", "Cycling"],
    ["rowing", "Rowing"], ["jump rope", "Jump Rope"],
    ["kettlebell swing", "One-Arm Kettlebell Swings"], ["resistance band", "Band Good Morning"],
    ["bench pr", "Bench Press"], ["  BENCH---PRESS  ", "Bench Press"],
  ])("%s puts %s first", (query, first) => {
    expect(names(query)[0]).toBe(first);
  });
  it.each(["zzzxxyy", "incline banana press", "protein powder", "존재하지않음", "бла"])("%s does not fall back to unrelated entries", (query) => {
    expect(names(query)).toEqual([]);
  });
  it("requires every query word, including equipment and reordered words", () => {
    expect(names("press incline dumbbell")).toEqual([incline.name]);
    expect(names("dumbbell bench")).not.toContain(bench.name);
    expect(names("incline press")).not.toContain(overhead.name);
  });
  it("does not treat a complete muscle name as the start of a different word", () => {
    expect(names("lat")).toContain("Lat Pulldown");
    expect(names("lat")).not.toContain("Lateral Raise");
    expect(names("lats")).toEqual(names("lat"));
    expect(searchExerciseIndex(index.filter(({ item }) => item.group === "shoulders"), "lat")).toEqual([]);
  });
  it("ranks primary muscles above secondary-only matches and preserves bodyweight equipment lookup", () => {
    expect(names("chest").indexOf(bench.name)).toBeLessThan(names("chest").indexOf("Plank"));
    expect(names("bodyweight")).toEqual(expect.arrayContaining(["Push Ups", "Pull Ups", "Chin-Up"]));
    expect(names("hamstrings")).toContain("Leg Curl");
    expect(names("quads")).toContain("Front Squat");
  });
  it("does not promote provider aliases consisting of a single title word", () => {
    expect(names("bench")[0]).toBe(bench.name); // the genuine flat-bench alias/title, not an imported token alias
    expect(names("bench press")[0]).toBe(bench.name);
  });
  it("preserves a prefiltered favorites/recent/group pool and alphabetic browsing", () => {
    const subset = index.filter(({ item }) => item === incline);
    expect(searchExerciseIndex(subset, "press")).toEqual([incline]);
    expect(searchExerciseIndex(subset, "row")).toEqual([]);
    expect(names(" ")).toEqual(catalog.map((item) => item.name).sort((a, b) => a.localeCompare(b)));
  });
});

describe("replacement search boundaries", () => {
  const options = (query: string, group: ExerciseGroupKey | "all" = "all") => replacementSearchOptions({
    index, query, group, targetName: bench.name, targetGroup: bench.group, suggestions: [incline, incline, bench],
  });
  it("uses relevance when typed, without prepending unrelated suggestions", () => {
    expect(options("cable row").map((item) => item.name)).toEqual(["Seated Cable Row"]);
    expect(options("zzzxxyy")).toEqual([]);
  });
  it("allows an explicit search in All to reach a different body part", () => {
    expect(options("ohp")).toEqual([overhead]);
    expect(options("ohp", "chest")).toEqual([]);
    expect(options("ohp", "shoulders")).toEqual([overhead]);
  });
  it("keeps empty-query suggestions within the selected/default group, unique, without the target", () => {
    const result = options("");
    expect(result[0]).toBe(incline);
    expect(result.every((item) => item.group === "chest" && item !== bench)).toBe(true);
    expect(new Set(result.map((item) => item.name)).size).toBe(result.length);
    expect(options("", "shoulders").every((item) => item.group === "shoulders")).toBe(true);
  });
  it("excludes the target even from exact-name results", () => {
    expect(options("bench press")).not.toContain(bench);
  });
  it("does not invent automatic alternatives for a custom name but supports searching", () => {
    const custom = { index, group: "all" as const, targetName: "My exercise", suggestions: [] };
    expect(replacementSearchOptions({ ...custom, query: "" })).toEqual([]);
    expect(replacementSearchOptions({ ...custom, query: "ohp" })).toEqual([overhead]);
  });
});

describe("empty-query replacement suggestions", () => {
  const target = exercise("Barbell Deadlift", "back", { primaryMuscles: ["lower back"], secondaryMuscles: ["hamstrings", "glutes"], equipment: ["barbell"], movementPattern: "compound" });
  const variations = [
    exercise("Deficit Deadlift", "back", { primaryMuscles: ["lower back"], equipment: ["barbell"], movementPattern: "compound" }),
    exercise("Romanian Deadlift", "legs", { primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["lower back"], equipment: ["barbell", "dumbbell"], movementPattern: "hinge" }),
    exercise("Romanian Deadlift from Deficit", "legs", { primaryMuscles: ["hamstrings"], secondaryMuscles: ["lower back"], equipment: ["barbell"], movementPattern: "compound" }),
    exercise("Stiff-Legged Barbell Deadlift", "legs", { primaryMuscles: ["hamstrings"], secondaryMuscles: ["lower back"], equipment: ["barbell"], movementPattern: "compound" }),
    exercise("Stiff-Legged Dumbbell Deadlift", "legs", { primaryMuscles: ["hamstrings"], secondaryMuscles: ["lower back"], equipment: ["dumbbell"], movementPattern: "compound" }),
  ];
  // These have strong metadata overlap, but are different named movements.
  const otherMovements = ["Rack Pulls", "Seated Good Mornings", "Bent Over One-Arm Long Bar Row"].map((name) => exercise(name, "back", {
    primaryMuscles: ["lower back"], secondaryMuscles: ["hamstrings"], equipment: ["barbell"], movementPattern: "compound",
  }));
  const pool = [target, ...otherMovements, ...variations];
  it("ranks all named deadlift variations before rows/good mornings regardless of body-part labels", () => {
    const result = getExerciseSubstitutions(pool, target);
    expect(result.slice(0, variations.length)).toEqual(expect.arrayContaining(variations));
    expect(result).not.toContain(target);
  });
  it("keeps cross-category variations in empty-query All while respecting explicit filters", () => {
    const searchIndex = indexExerciseSearch(pool);
    const params = { index: searchIndex, query: "", targetName: target.name, targetGroup: target.group, suggestions: getExerciseSubstitutions(pool, target) };
    expect(replacementSearchOptions({ ...params, group: "all" }).slice(0, variations.length)).toEqual(expect.arrayContaining(variations));
    expect(replacementSearchOptions({ ...params, group: "back" }).every((item) => item.group === "back")).toBe(true);
    expect(replacementSearchOptions({ ...params, group: "legs" }).every((item) => item.group === "legs")).toBe(true);
  });
  it("ranks the whole pool before limiting, so metadata-heavy rows cannot hide variations", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ ...otherMovements[2], id: `row-${i}`, name: `Barbell Row ${i}` }));
    expect(getExerciseSubstitutions([...rows, ...variations], target, 5)).toEqual(expect.arrayContaining(variations));
  });
  it("prefers ordinary variations before added bands/chains unless already in the target", () => {
    const chain = { ...variations[0], id: "chain", name: "Deadlift with Chains" };
    expect(getExerciseSubstitutions([chain, variations[1]], target)[0]).toBe(variations[1]);
    const chainDeficit = { ...chain, id: "chain-deficit", name: "Deficit Deadlift with Chains" };
    expect(getExerciseSubstitutions([chainDeficit, variations[1]], chain)[0]).toBe(chainDeficit);
  });
  it("applies the family preference to other movements and separates cardio rowing", () => {
    const inclinePress = { ...incline, group: "shoulders" as const }; // inconsistent provider category
    expect(getExerciseSubstitutions([overhead, inclinePress], bench)).toEqual([]); // a shared "press" word cannot imply the same family
    const row = exercise("Barbell Row", "back", { primaryMuscles: ["lats"], equipment: ["barbell"], movementPattern: "compound" });
    const cableRow = exercise("Seated Cable Row", "back", { equipment: ["cable"] });
    const pull = exercise("Lat Pulldown", "back", { primaryMuscles: ["lats"], equipment: ["barbell"], movementPattern: "compound" });
    const cardio = exercise("Rowing", "cardio", { equipment: ["barbell"] });
    expect(getExerciseSubstitutions([pull, cableRow, cardio], row)).toEqual([cableRow]);
    expect(getExerciseSubstitutions([overhead, incline], bench)[0]).toBe(incline);
  });
});

describe("replacement relevance across the exercise catalog", () => {
  it.each([
    ["Bench Press", "Dumbbell Bench Press", "chest"],
    ["Incline Dumbbell Press", "Machine Chest Press", "chest"],
    ["Chest Fly", "Cable Crossover", "chest"],
    ["Push Ups", "Incline Push-Up", "chest"],
    ["Pull Ups", "Chin-Up", "back"],
    ["Barbell Row", "Seated Cable Row", "back"],
    ["Lat Pulldown", "Wide-Grip Lat Pulldown", "back"],
    ["Squat", "Front Squat", "legs"],
    ["Lunges", "Barbell Walking Lunge", "legs"],
    ["Leg Curl", "Seated Hamstring Curl", "legs"],
    ["Leg Extension", "Single-Leg Leg Extension", "legs"],
    ["Leg Press", "Narrow Stance Leg Press", "legs"],
    ["Calf Raise", "Standing Calf Raises", "legs"],
    ["Hip Thrust", "Barbell Glute Bridge", "legs"],
    ["Good Morning", "Seated Good Mornings", "back"],
    ["Overhead Press", "Arnold Dumbbell Press", "shoulders"],
    ["Lateral Raise", "Cable Seated Lateral Raise", "shoulders"],
    ["Rear Delt Fly", "Seated Bent Over Rear Delt Raise", "shoulders"],
    ["Face Pull", "Standing Face Pull", "shoulders"],
    ["Bicep Curl", "Incline Dumbbell Curl", "arms"],
    ["Skullcrusher", "Lying Triceps Extension", "arms"],
    ["Tricep Pushdown", "Reverse Grip Triceps Pushdown", "arms"],
    ["Dips", "Bench Dips", "arms"],
    ["Plank", "Side Plank", "core"],
    ["Crunches", "Reverse Crunch", "core"],
    ["Hanging Leg Raise", "Flat Bench Lying Leg Raise", "core"],
    ["Russian Twist", "Cable Russian Twists", "core"],
    ["Ab Roller", "Barbell Ab Rollout", "core"],
    ["Treadmill", "Walking, Treadmill", "cardio"],
    ["Cycling", "Recumbent Bike", "cardio"],
    ["Rowing", "Rowing, Stationary", "cardio"],
    ["Jump Rope", "Weighted Jump Rope", "cardio"],
  ] as const)("%s keeps %s ahead of unrelated same-category metadata", (targetName, relatedName, group) => {
    const target = exercise(targetName, group, { primaryMuscles: ["sample muscle"], equipment: ["barbell"], movementPattern: "compound" });
    const related = exercise(relatedName, group);
    const unrelated = exercise("Unrelated movement", group, { primaryMuscles: target.primaryMuscles, equipment: target.equipment, movementPattern: "compound" });
    expect(getExerciseSubstitutions([unrelated, related, target], target)).toEqual([related]);
  });
  it("does not fill an unknown movement's default list based only on category, muscles or equipment", () => {
    const target = exercise("My specialist movement", "arms", { primaryMuscles: ["biceps"], equipment: ["barbell"], movementPattern: "compound" });
    const unrelated = exercise("Another unrelated movement", "arms", { primaryMuscles: target.primaryMuscles, equipment: target.equipment, movementPattern: "compound" });
    expect(getExerciseSubstitutions([target, unrelated], target)).toEqual([]);
    expect(replacementSearchOptions({ index: indexExerciseSearch([target, unrelated]), query: "", group: "all", targetName: target.name, targetGroup: target.group, suggestions: [] })).toEqual([]);
  });
  it("uses a specific movement pattern with primary-muscle overlap for an unrecognized name", () => {
    const target = exercise("My specialist movement", "back", { primaryMuscles: ["lats"], movementPattern: "horizontal pull" });
    const related = exercise("Cable back movement", "back", { primaryMuscles: ["lats"], movementPattern: "horizontal pull" });
    const unrelated = exercise("Different action", "back", { primaryMuscles: ["lats"], movementPattern: "vertical pull" });
    expect(getExerciseSubstitutions([target, unrelated, related], target)).toEqual([related]);
  });
  it("keeps stretching, resistance, plyometrics and cardio apart even with misleading titles", () => {
    const target = exercise("Squat", "legs", { primaryMuscles: ["quadriceps"], category: "strength" });
    const stretch = exercise("Squat Stretch", "legs", { primaryMuscles: target.primaryMuscles, category: "stretching" });
    const jump = exercise("Jump Squat", "legs", { primaryMuscles: target.primaryMuscles, category: "plyometrics" });
    const alternative = exercise("Front Squat", "legs", { category: "strength" });
    expect(getExerciseSubstitutions([stretch, jump, alternative], target)).toEqual([alternative]);
    const bike = exercise("Cycling", "cardio", { primaryMuscles: ["abdominals"], category: "cardio" });
    const airBike = exercise("Air Bike", "core", { primaryMuscles: bike.primaryMuscles, category: "strength" });
    expect(getExerciseSubstitutions([airBike], bike)).toEqual([]);
  });
  it("uses the primary muscle for mobility alternatives without including a strength exercise", () => {
    const target = exercise("Hamstring Stretch", "legs", { primaryMuscles: ["hamstrings"], category: "stretching" });
    const related = exercise("Seated Floor Hamstring Stretch", "legs", { primaryMuscles: ["hamstrings"], category: "stretching" });
    const lift = exercise("Romanian Deadlift", "legs", { primaryMuscles: ["hamstrings"], category: "strength" });
    expect(getExerciseSubstitutions([lift, related], target)).toEqual([related]);
  });
  it("does not offer the same named movement again through spelling/plural variants", () => {
    const target = exercise("Push Ups", "chest");
    const duplicate = exercise("Pushups", "chest");
    const variation = exercise("Incline Push-Up", "chest");
    expect(getExerciseSubstitutions([duplicate, variation], target)).toEqual([variation]);
    expect(replacementSearchOptions({ index: indexExerciseSearch([target, duplicate, variation]), query: "pushup", group: "all", targetName: target.name, targetGroup: target.group, suggestions: [] })).toEqual([variation]);
  });
});
