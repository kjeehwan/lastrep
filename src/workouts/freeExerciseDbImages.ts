import AsyncStorage from "@react-native-async-storage/async-storage";

type FreeExerciseRecord = {
  id?: string;
  name?: string;
  images?: string[];
};

type MappedEntry = {
  id: string;
  name: string;
  normalized: string;
  tokens: string[];
  imageUrls: string[];
};

const DB_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const CACHE_KEY = "free-exercise-db-v1";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

// Manual disambiguation for known ambiguous labels in fitness datasets.
// Keys and values are normalized.
const NAME_OVERRIDES: Record<string, string[]> = {
  "barbell row": ["barbell row", "bent over barbell row"],
};

let inMemoryEntries: MappedEntry[] | null = null;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTokens = (value: string) => normalize(value).split(" ").filter(Boolean);

const hydrateEntries = (records: FreeExerciseRecord[]): MappedEntry[] =>
  records
    .map((record) => {
      const id = String(record?.id || "").trim();
      const name = String(record?.name || "").trim();
      const images = Array.isArray(record?.images) ? record.images : [];
      const imageUrls = images
        .filter((path) => typeof path === "string" && path.length > 0)
        .map((path) => `${IMAGE_BASE_URL}${path}`);
      if (!id || !name || !imageUrls.length) return null;
      return {
        id,
        name,
        normalized: normalize(name),
        tokens: toTokens(name),
        imageUrls,
      } as MappedEntry;
    })
    .filter(Boolean) as MappedEntry[];

const loadCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt?: number; records?: FreeExerciseRecord[] };
    if (!parsed?.fetchedAt || !Array.isArray(parsed.records)) return null;
    const isFresh = Date.now() - parsed.fetchedAt < CACHE_MAX_AGE_MS;
    if (!isFresh) return null;
    return hydrateEntries(parsed.records);
  } catch {
    return null;
  }
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

const fetchEntries = async (): Promise<MappedEntry[]> => {
  if (inMemoryEntries) return inMemoryEntries;

  const cached = await loadCache();
  if (cached && cached.length) {
    inMemoryEntries = cached;
    return cached;
  }

  try {
    const response = await fetch(DB_URL);
    if (!response.ok) throw new Error(`free-exercise-db fetch failed: ${response.status}`);
    const records = (await response.json()) as FreeExerciseRecord[];
    const entries = hydrateEntries(Array.isArray(records) ? records : []);
    if (entries.length) {
      inMemoryEntries = entries;
      await saveCache(records);
    }
    return entries;
  } catch {
    return inMemoryEntries ?? [];
  }
};

const scoreMatch = (query: string, entry: MappedEntry) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return -1;
  if (entry.normalized === normalizedQuery) return 1000;

  const queryTokens = toTokens(normalizedQuery);
  if (!queryTokens.length) return -1;

  let score = 0;
  queryTokens.forEach((token) => {
    if (entry.tokens.includes(token)) score += 4;
    else if (entry.normalized.includes(token)) score += 1;
  });

  // minor bias for shorter names when token scores tie
  score -= Math.max(0, entry.tokens.length - queryTokens.length) * 0.15;
  return score;
};

const resolveImagesForName = (name: string, entries: MappedEntry[]) => {
  const normalized = normalize(name);
  if (!normalized) return [];

  const overrideCandidates = NAME_OVERRIDES[normalized];
  if (overrideCandidates?.length) {
    const normalizedCandidates = overrideCandidates.map(normalize);
    const overridden =
      entries.find((entry) => normalizedCandidates.includes(entry.normalized)) ||
      entries.find((entry) =>
        normalizedCandidates.some((candidate) => entry.normalized.includes(candidate))
      );
    if (overridden) return overridden.imageUrls;
  }

  const exact = entries.find((entry) => entry.normalized === normalized);
  if (exact) return exact.imageUrls;

  const queryTokens = toTokens(name);
  const strictCandidates = entries.filter((entry) =>
    queryTokens.every((token) => entry.tokens.includes(token))
  );
  if (strictCandidates.length) {
    strictCandidates.sort((a, b) => {
      const extraA = a.tokens.length - queryTokens.length;
      const extraB = b.tokens.length - queryTokens.length;
      return extraA - extraB || a.name.localeCompare(b.name);
    });
    return strictCandidates[0].imageUrls;
  }

  let winner: MappedEntry | null = null;
  let winnerScore = -1;
  entries.forEach((entry) => {
    const score = scoreMatch(name, entry);
    if (score > winnerScore) {
      winner = entry;
      winnerScore = score;
    }
  });

  // Require at least token overlap before accepting fuzzy match.
  if (!winner || winnerScore < 5) return [];
  return winner.imageUrls;
};

export const resolveFreeExerciseDbImagesForNames = async (names: string[]) => {
  const entries = await fetchEntries();
  const map: Record<string, string[]> = {};
  names.forEach((name) => {
    const key = normalize(name);
    if (!key) return;
    map[key] = resolveImagesForName(name, entries);
  });
  return map;
};
