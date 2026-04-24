import AsyncStorage from "@react-native-async-storage/async-storage";

export const ADD_EXERCISE_SELECTION_KEY = "workout-add-exercise-selection-v1";
const ADD_EXERCISE_SELECTION_KEY_PREFIX = "workout-add-exercise-selection-v1";

type PendingExerciseSelection = {
  name: string;
  createdAt: number;
};

const getScopedSelectionKey = (uid?: string | null) =>
  uid ? `${ADD_EXERCISE_SELECTION_KEY_PREFIX}:${uid}` : ADD_EXERCISE_SELECTION_KEY;

export const setPendingExerciseSelection = async (name: string, uid?: string | null) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const payload: PendingExerciseSelection = {
    name: trimmed,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(getScopedSelectionKey(uid), JSON.stringify(payload));
};

export const popPendingExerciseSelection = async (uid?: string | null): Promise<string | null> => {
  const scopedKey = getScopedSelectionKey(uid);
  let raw = await AsyncStorage.getItem(scopedKey);
  let removeKey = scopedKey;

  // Backward compatibility with pre-scoped bridge key.
  if (!raw) {
    raw = await AsyncStorage.getItem(ADD_EXERCISE_SELECTION_KEY);
    removeKey = ADD_EXERCISE_SELECTION_KEY;
  }

  if (!raw) return null;
  await AsyncStorage.removeItem(removeKey);
  try {
    const parsed = JSON.parse(raw) as PendingExerciseSelection;
    const name = String(parsed?.name ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
};
