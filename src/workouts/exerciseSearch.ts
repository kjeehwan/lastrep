import type { ExerciseCatalogItem, ExerciseGroupKey } from "./exerciseCatalog";

// Search vocabulary only: never rename catalog entries or saved workout records.
const words: Record<string, string> = {
  db: "dumbbell", dumbbells: "dumbbell", bb: "barbell", barbells: "barbell",
  kb: "kettlebell", kettlebells: "kettlebell", cables: "cable",
  bands: "band", machines: "machine", presses: "press", curls: "curl",
  rows: "row", squats: "squat", deadlifts: "deadlift", lunges: "lunge",
  raises: "raise", dips: "dip", flyes: "fly", flies: "fly",
  ups: "up", downs: "down", extensions: "extension", crunches: "crunch",
  quads: "quad", quadriceps: "quad", delts: "delt", deltoids: "delt",
  abdominal: "abs", abdominals: "abs", ab: "abs", calves: "calf",
  pectorals: "chest", pecs: "chest", pec: "chest", lats: "lat",
  running: "run", jogging: "jog",
  hamstrings: "hamstring", biceps: "bicep", triceps: "tricep", glutes: "glute",
  shoulders: "shoulder", legs: "leg", swings: "swing",
};
const completeWords = new Set(Object.values(words));

export function normalizeExerciseSearch(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(push|pull|chin|sit)[ -]?ups?\b/g, "$1 up")
    .replace(/\bpull[ -]?downs?\b/g, "pull down")
    .replace(/\bskull[ -]?crushers?\b/g, "skull crusher")
    .replace(/\bbody only\b/g, "bodyweight")
    .replace(/\bresistance bands?\b/g, "band")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/)
    .map((word) => words[word] ?? word).join(" ");
}

export function indexExerciseSearch(catalog: ExerciseCatalogItem[]) {
  return catalog.map((item) => {
    const title = normalizeExerciseSearch(item.name);
    // The remote catalog generates aliases from individual title words. Those
    // are useful tokens, but must not count as exact whole-exercise aliases.
    const aliases = item.aliases.map(normalizeExerciseSearch).filter((alias) =>
      alias && !(title.split(" ").includes(alias) && alias !== title));
    const identity = [title, ...aliases].join(" ").split(" ");
    const primary = normalizeExerciseSearch([...item.primaryMuscles, ...item.equipment, item.group].join(" ")).split(" ");
    const secondary = normalizeExerciseSearch([...item.secondaryMuscles, item.movementPattern].join(" ")).split(" ");
    return { item, title, aliases, identity, primary, secondary };
  }).sort((a, b) => a.item.name.localeCompare(b.item.name));
}

export type ExerciseSearchIndex = ReturnType<typeof indexExerciseSearch>;

// Catalog body-part labels and generic "compound"/"isolation" metadata are
// not movement families. Identify named variations before using that metadata.
export function exerciseActivity(item: ExerciseCatalogItem): "mobility" | "cardio" | "plyometrics" | "resistance" {
  if (item.category === "stretching" || /\b(stretch|smr|foam roll)\b/.test(normalizeExerciseSearch(item.name))) return "mobility";
  if (item.category === "cardio" || item.group === "cardio") return "cardio";
  return item.category === "plyometrics" ? "plyometrics" : "resistance";
}

export function exerciseFamily(item: ExerciseCatalogItem): string | null {
  const name = normalizeExerciseSearch(item.name);
  const activity = exerciseActivity(item);
  if (activity === "mobility") return null; // Match the actual primary muscle, not a lift named in a stretch.
  if (activity === "cardio") {
    if (/\b(rowing|rower)\b/.test(name)) return "cardio rowing";
    if (/\b(bicycling|bicycle|cycling|bike|spin)\b/.test(name)) return "cycling";
    if (/\btreadmill\b/.test(name)) return "treadmill";
    if (/\b(run|jog)\b/.test(name)) return "running";
    if (/\belliptical\b/.test(name)) return "elliptical";
    if (/\bjump rope\b/.test(name)) return "jump rope";
    if (/\b(stair|stairs|stepmill)\b/.test(name)) return "stairs";
    if (/\bwalking\b/.test(name)) return "walking";
    return null;
  }
  const families: [string, RegExp][] = [
    ["deadlift", /\bdeadlift\b/], ["calf raise", /\bcalf (raise|press)\b/],
    ["leg press", /\bleg press\b/], ["leg curl", /\b(leg|hamstring) curl\b/],
    ["leg extension", /\bleg extension\b/], ["squat", /\bsquat\b/],
    ["wrist curl", /\bwrist\b.*\bcurl\b/],
    ["arm curl", /\b(bicep|hammer|preacher|concentration|zottman|reverse|incline|standing|seated|cable|dumbbell|barbell)\b.*\bcurl\b/],
    ["lunge", /\blunge\b/], ["hip thrust", /\b(hip thrust|glute bridge|butt lift)\b/],
    ["good morning", /\bgood mornings?\b/],
    ["triceps extension", /\b(skull crusher|french press)\b/],
    ["triceps extension", /\btricep\b.*\b(extension|press)\b/],
    ["triceps extension", /\b(lying|overhead)\b.*\btricep\b/],
    ["dip", /\bdips?\b/], ["face pull", /\bface pull\b/],
    ["pullover", /\bpullovers?\b/], ["shrug", /\bshrugs?\b/],
    ["hip adduction", /\b(hip|thigh) adduction\b/],
    ["hip abduction", /\b(hip|thigh) abduction\b/],
    ["internal rotation", /\binternal rotation\b/],
    ["external rotation", /\bexternal rotation\b/],
    ["step up", /\bstep ups?\b/],
    ["back extension", /\b(back extension|hyperextensions?)\b/],
    ["ab rollout", /\b(abs )?(rollouts?|roller)\b/],
    ["russian twist", /\brussian twists?\b/],
    ["wood chop", /\bwood ?chops?\b/],
    ["kettlebell swing", /\bkettlebell\b.*\bswing\b/],
    ["clean and jerk", /\bclean and jerk\b/],
    ["clean and press", /\bclean and press\b/],
    ["snatch", /\bsnatch\b/], ["clean", /\bcleans?\b/], ["jerk", /\bjerks?\b/],
    ["pull up", /\b(pull|chin) up\b/], ["pull down", /\bpull down\b/],
    ["upright row", /\bupright\b.*\brow\b/],
    ["lateral raise", /\blateral raise\b/], ["front raise", /\bfront\b.*\braise\b/],
    ["rear delt fly", /\b(rear delt\b.*\b(fly|raise)|reverse fly)\b/],
    ["push up", /\bpush up\b/], ["plank", /\bplank\b/],
    ["crunch", /\bcrunch\b/], ["sit up", /\bsit up\b/],
    ["jump", /\bjumps?\b/],
    ["chest press", /\b(bench|chest|floor) press\b/],
    ["shoulder press", /\b(overhead|military|shoulder|arnold) press\b/],
  ];
  const family = families.find(([, pattern]) => pattern.test(name))?.[0];
  if (family) return family;
  if (item.group === "core" && /\b(leg|knee|hip) raise\b/.test(name)) return "core leg raise";
  if (item.group !== "cardio" && /\brow\b/.test(name)) return "row";
  if (item.group === "chest" && /\bpress\b/.test(name)) return "chest press";
  if (item.group === "shoulders" && /\bpress\b/.test(name)) return "shoulder press";
  if (item.group === "chest" && /\b(fly|crossover)\b/.test(name)) return "chest fly";
  if (item.group === "arms" && /\bcurl\b/.test(name)) return "arm curl";
  if (item.group === "arms" && /\bpushdown\b/.test(name)) return "pushdown";
  if (item.group === "arms" && /\bextension\b/.test(name)) return "arm extension";
  return null;
}

/** Resolve saved/custom spellings without changing the saved exercise identity.
 * An uncatalogued name can suggest peers only when it names a known movement.
 * Empty metadata deliberately prevents guessing muscles, loads or instructions.
 */
export function resolveReplacementTarget(index: ExerciseSearchIndex, name: string): ExerciseCatalogItem | null {
  const title = normalizeExerciseSearch(name);
  const exact = index.find(entry => entry.title === title);
  if (exact) return exact.item;
  const aliases = index.filter(entry => entry.aliases.includes(title));
  if (aliases.length === 1) return aliases[0].item;
  const cardio = /\b(treadmill|cycling|bicycling|rower|rowing|elliptical|jump rope|recumbent bike|stair climber)\b/.test(title);
  const probe: ExerciseCatalogItem = {
    id: "replacement-name-only", name, aliases: [], primaryMuscles: [], secondaryMuscles: [],
    equipment: title.split(" ").filter(word => /^(barbell|dumbbell|kettlebell|cable|machine|band|bodyweight)$/.test(word)),
    movementPattern: "", difficulty: "intermediate", group: cardio ? "cardio" : "core", cues: [],
  };
  const family = exerciseFamily(probe);
  if (!family) return null;
  const peers = index.filter(entry => exerciseFamily(entry.item) === family && exerciseActivity(entry.item) === exerciseActivity(probe));
  if (!peers.length) return null;
  const groups = new Map<ExerciseGroupKey, number>();
  for (const { item } of peers) groups.set(item.group, (groups.get(item.group) ?? 0) + 1);
  probe.group = [...groups].sort((a, b) => b[1] - a[1])[0][0];
  return probe;
}

export function getExerciseSubstitutions(catalog: ExerciseCatalogItem[], target: ExerciseCatalogItem, limit = 24): ExerciseCatalogItem[] {
  const family = exerciseFamily(target);
  const titleWords = (item: ExerciseCatalogItem) => normalizeExerciseSearch(item.name).split(" ")
    .filter((word) => !/^(barbell|dumbbell|kettlebell|cable|machine|bodyweight|with|from|on|the|a|and|to|of)$/.test(word));
  const targetWords = titleWords(target);
  const activity = exerciseActivity(target);
  const movement = normalizeExerciseSearch(target.movementPattern);
  const specificPattern = !!movement && !/^(compound|isolation|general|strength|push|pull|static|cardio|stretching|plyometrics)$/.test(movement);
  const anchors = (item: ExerciseCatalogItem) => titleWords(item).filter((word) => word.length > 2 &&
    !/^(standing|seated|lying|kneeling|incline|decline|flat|bent|over|front|back|side|upper|lower|single|double|one|two|arm|leg|hand|grip|wide|narrow|close|alternate|alternating|chest|shoulder|bicep|tricep|calf|quad|hamstring|glute|abs|raise|press|left|right|version|exercise|movement|workout|training|only|weighted|weight)$/.test(word));
  const targetAnchors = anchors(target);
  const overlap = (a: string[], b: string[]) => a.some((value) => b.some((other) =>
    normalizeExerciseSearch(value) === normalizeExerciseSearch(other)));
  return catalog.filter((item) => normalizeExerciseSearch(item.name) !== normalizeExerciseSearch(target.name))
    .map((item) => {
      const sameFamily = !!family && exerciseFamily(item) === family;
      const sameActivity = exerciseActivity(item) === activity;
      const primaryOverlap = overlap(item.primaryMuscles, target.primaryMuscles);
      const patternMatch = specificPattern && normalizeExerciseSearch(item.movementPattern) === movement;
      const sharedAnchor = anchors(item).some((word) => targetAnchors.includes(word));
      // Every target goes through the same relevance gate. A category, equipment,
      // difficulty or secondary-muscle match alone never fills the default list.
      const related = sameActivity && (sameFamily ||
        (primaryOverlap && (patternMatch || sharedAnchor || activity === "mobility" || (activity === "cardio" && !!exerciseFamily(item)))));
      // Provider categories disagree for named variations, so category agreement
      // is only a fallback signal, not an advantage within the same family.
      let score = !sameFamily && item.group === target.group ? 5 : 0;
      if (patternMatch) score += 4;
      if (primaryOverlap) score += 4;
      if (overlap(item.secondaryMuscles, target.primaryMuscles)) score += 2;
      if (overlap(item.primaryMuscles, target.secondaryMuscles)) score += 2;
      if (overlap(item.equipment, target.equipment)) score += 3;
      if (item.difficulty === target.difficulty) score += 1;
      if (sameFamily) {
        const candidateWords = titleWords(item);
        score += targetWords.filter((word) => candidateWords.includes(word)).length * 4;
        score -= candidateWords.filter((word) => !targetWords.includes(word)).length * 0.5;
        // Added apparatus is a more specific setup. Prefer ordinary variations
        // unless that apparatus is already part of the exercise being replaced.
        score -= candidateWords.filter((word) => /^(band|chains?|axles?|boards?|logs?|weighted)$/.test(word) && !targetWords.includes(word)).length * 8;
      }
      return { item, sameFamily, related, score };
    })
    .filter(({ related }) => related)
    .sort((a, b) => Number(b.sameFamily) - Number(a.sameFamily) || b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit).map(({ item }) => item);
}

export function searchExerciseIndex(index: ExerciseSearchIndex, query: string): ExerciseCatalogItem[] {
  const needle = normalizeExerciseSearch(query);
  if (!needle) return index.map(({ item }) => item);
  const tokens = needle.split(" ");
  const vocabulary = new Set(index.flatMap((entry) => [...entry.identity, ...entry.primary, ...entry.secondary]));
  // Only the final word can be unfinished. No arbitrary substring/subsequence
  // hits (e.g. "lat" inside "lateral", or one word out of "incline press").
  const matches = (word: string, token: string, position: number) => word === token ||
    (position === tokens.length - 1 && token.length >= 2 && !completeWords.has(token) && !vocabulary.has(token) && word.startsWith(token));
  const contains = (bag: string[], token: string, position: number) => bag.some((word) => matches(word, token, position));
  return index.map((entry) => {
    const all = [...entry.identity, ...entry.primary, ...entry.secondary];
    if (!tokens.every((token, position) => contains(all, token, position))) return { item: entry.item, score: 0 };
    const titleWords = entry.title.split(" ");
    let tier = 200;
    if (entry.title === needle) tier = 1000;
    else if (entry.aliases.includes(needle)) tier = 900;
    else if (` ${entry.title} `.includes(` ${needle} `)) tier = 800;
    else if (tokens.every((token, position) => contains(titleWords, token, position))) tier = 700;
    else if (tokens.every((token, position) => contains(entry.identity, token, position))) tier = 600;
    else if (tokens.every((token, position) => contains([...entry.identity, ...entry.primary], token, position))) tier = 400;
    const exactTitleHits = tokens.filter((token) => titleWords.includes(token)).length;
    return { item: entry.item, score: tier + exactTitleHits * 5 + 1 / (1 + titleWords.length) };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map(({ item }) => item);
}

export function replacementSearchOptions(params: {
  index: ExerciseSearchIndex;
  query: string;
  group: ExerciseGroupKey | "all";
  targetName: string;
  targetGroup?: ExerciseGroupKey;
  suggestions: ExerciseCatalogItem[];
  limit?: number;
}): ExerciseCatalogItem[] {
  const { index, query, group, targetGroup } = params;
  const hasQuery = !!query.trim();
  if (!hasQuery && !targetGroup) return [];
  // "All" means the whole catalog for a search, including a different body part.
  // Empty-query All includes named variations even when catalog body parts differ.
  const effectiveGroup = !hasQuery && group === "all" ? targetGroup : group;
  const pool = index.filter(({ item }) => effectiveGroup === "all" || item.group === effectiveGroup);
  const searched = searchExerciseIndex(pool, query);
  const candidates = hasQuery ? searched : params.suggestions.filter((item) => group === "all" || item.group === group);
  const seen = new Set([params.targetName.trim().toLowerCase()]);
  return candidates.filter((item) => {
    if (normalizeExerciseSearch(item.name) === normalizeExerciseSearch(params.targetName)) return false;
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, params.limit ?? 24);
}
