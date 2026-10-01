import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExerciseCatalogItem, ExerciseGroupKey } from "./exerciseCatalog";

type FreeExerciseRecord = {
  id?: string;
  name?: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string | null;
  images?: string[];
};

const DB_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const CACHE_KEY = "free-exercise-db-catalog-v2";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

let inMemoryCatalog: ExerciseCatalogItem[] | null = null;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchGroupByMuscle = (muscles: string): ExerciseGroupKey | null => {
  if (/(chest|pectoral|pec)/.test(muscles)) return "chest";
  if (/(quad|hamstring|glute|calf|adductor|abductor|thigh|leg)/.test(muscles)) return "legs";
  if (/(shoulder|deltoid|rear delt|front delt|side delt)/.test(muscles)) return "shoulders";
  if (/(bicep|tricep|forearm|brachialis)/.test(muscles)) return "arms";
  if (/(abdominal|abdominals|abs|core|oblique)/.test(muscles)) return "core";
  if (/(lat|lats|trapezius|trap|rhomboid|middle back|upper back|lower back|back|erector spinae)/.test(muscles))
    return "back";
  return null;
};

const classifyGroup = (
  name: string,
  category: string,
  primaryMuscles: string[],
  secondaryMuscles: string[],
  movementPattern: string
): ExerciseGroupKey => {
  const cat = normalize(category);
  if (cat.includes("cardio")) return "cardio";

  const primaryBag = primaryMuscles.map(normalize).join(" ");
  const secondaryBag = secondaryMuscles.map(normalize).join(" ");

  const primaryMatch = matchGroupByMuscle(primaryBag);
  if (primaryMatch) return primaryMatch;

  const secondaryMatch = matchGroupByMuscle(secondaryBag);
  if (secondaryMatch) return secondaryMatch;

  const hintBag = normalize(`${name} ${movementPattern} ${category}`);
  if (/(treadmill|run|running|jog|bike|cycling|rower|elliptical|jump rope|burpee)/.test(hintBag)) return "cardio";
  if (/(overhead press|shoulder press|lateral raise|rear delt|face pull|arnold press)/.test(hintBag)) return "shoulders";
  if (/(row|pulldown|pull up|pullup|chin up|chinup)/.test(hintBag)) return "back";
  if (/(bench|chest press|push up|pushup|fly|dip)/.test(hintBag)) return "chest";
  if (/(squat|deadlift|rdl|lunge|leg press|calf raise|hip thrust|split squat)/.test(hintBag)) return "legs";
  if (/(bicep|tricep|hammer curl|preacher curl|skull crusher|pushdown|curl)/.test(hintBag)) return "arms";
  if (/(crunch|plank|sit up|situp|leg raise|hanging knee raise|ab wheel|russian twist)/.test(hintBag)) return "core";
  return "core";
};

const mapRecord = (record: FreeExerciseRecord): ExerciseCatalogItem | null => {
  const id = String(record?.id || "").trim();
  const name = String(record?.name || "").trim();
  if (!id || !name) return null;

  const primaryMuscles = Array.isArray(record?.primaryMuscles)
    ? record.primaryMuscles.filter(Boolean).map(String)
    : [];
  const secondaryMuscles = Array.isArray(record?.secondaryMuscles)
    ? record.secondaryMuscles.filter(Boolean).map(String)
    : [];
  const equipment = record?.equipment ? [String(record.equipment)] : [];
  const movementPattern = String(record?.mechanic || record?.force || record?.category || "general");
  const level = normalize(String(record?.level || "intermediate"));
  const difficulty: ExerciseCatalogItem["difficulty"] =
    level === "beginner" ? "beginner" : level === "expert" || level === "advanced" ? "advanced" : "intermediate";

  const cues = (Array.isArray(record?.instructions) ? record.instructions : [])
    .map((instruction) => String(instruction).trim())
    .filter(Boolean)
    .slice(0, 3);

  const aliases = [
    id.replace(/_/g, " "),
    id.replace(/_/g, "-"),
    ...name
      .split(" ")
      .map((part) => part.trim())
      .filter((part) => part.length > 1),
  ];

  const group = classifyGroup(
    name,
    String(record?.category || ""),
    primaryMuscles,
    secondaryMuscles,
    movementPattern
  );

  return {
    id,
    name,
    aliases: Array.from(new Set(aliases.map((alias) => alias.trim()).filter(Boolean))),
    primaryMuscles,
    secondaryMuscles,
    equipment,
    movementPattern,
    difficulty,
    group,
    cues,
    demoImages: [],
  };
};

const saveCache = async (records: FreeExerciseRecord[]) => {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        records,
      })
    );
  } catch {
    // no-op
  }
};

const loadCache = async (): Promise<ExerciseCatalogItem[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt?: number; records?: FreeExerciseRecord[] };
    if (!parsed?.fetchedAt || !Array.isArray(parsed.records)) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_MAX_AGE_MS) return null;
    return parsed.records.map(mapRecord).filter(Boolean) as ExerciseCatalogItem[];
  } catch {
    return null;
  }
};

export const loadFreeExerciseDbCatalog = async (): Promise<ExerciseCatalogItem[]> => {
  if (inMemoryCatalog) return inMemoryCatalog;

  const cached = await loadCache();
  if (cached?.length) {
    inMemoryCatalog = cached;
    return cached;
  }

  try {
    const response = await fetch(DB_URL);
    if (!response.ok) throw new Error(`free-exercise-db fetch failed: ${response.status}`);
    const records = (await response.json()) as FreeExerciseRecord[];
    const mapped = (Array.isArray(records) ? records : [])
      .map(mapRecord)
      .filter(Boolean) as ExerciseCatalogItem[];
    if (mapped.length) {
      inMemoryCatalog = mapped;
      await saveCache(records);
    }
    return mapped;
  } catch {
    return inMemoryCatalog ?? [];
  }
};
