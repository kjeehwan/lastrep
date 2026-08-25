import AsyncStorage from "@react-native-async-storage/async-storage";

export const ADD_EXERCISE_SELECTION_KEY = "workout-add-exercise-selection-v1";
const ADD_EXERCISE_SELECTION_KEY_PREFIX = "workout-add-exercise-selection-v1";

type PendingExerciseSelection = {
  names: string[];
  createdAt: number;
};

const getScopedSelectionKey = (uid?: string | null) =>
  uid ? `${ADD_EXERCISE_SELECTION_KEY_PREFIX}:${uid}` : ADD_EXERCISE_SELECTION_KEY;

export const setPendingExerciseSelection = async (names: string[], uid?: string | null) => {
  const normalized = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean).map((name) => name.toLowerCase()))
  ).map((name) => names.find((candidate) => candidate.trim().toLowerCase() === name)?.trim() ?? name);
  if (!normalized.length) return;
  const payload: PendingExerciseSelection = {
    names: normalized,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(getScopedSelectionKey(uid), JSON.stringify(payload));
};

export const popPendingExerciseSelection = async (uid?: string | null): Promise<string[]> => {
  const scopedKey = getScopedSelectionKey(uid);
  let raw = await AsyncStorage.getItem(scopedKey);
  let removeKey = scopedKey;

  // Backward compatibility with pre-scoped bridge key.
  if (!raw) {
    raw = await AsyncStorage.getItem(ADD_EXERCISE_SELECTION_KEY);
    removeKey = ADD_EXERCISE_SELECTION_KEY;
  }

  if (!raw) return [];
  await AsyncStorage.removeItem(removeKey);
  try {
    const parsed = JSON.parse(raw) as PendingExerciseSelection & { name?: unknown };
    const names = Array.isArray(parsed?.names)
      ? parsed.names.map((name) => String(name).trim()).filter(Boolean)
      : [String(parsed?.name ?? "").trim()].filter(Boolean);
    return Array.from(new Set(names.map((name) => name.toLowerCase())))
      .map((name) => names.find((candidate) => candidate.toLowerCase() === name) ?? name);
  } catch {
    return [];
  }
};
