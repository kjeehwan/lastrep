import AsyncStorage from "@react-native-async-storage/async-storage";

export const ADD_EXERCISE_SELECTION_KEY = "workout-add-exercise-selection-v1";

type PendingExerciseSelection = {
  name: string;
  createdAt: number;
};

export const setPendingExerciseSelection = async (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const payload: PendingExerciseSelection = {
    name: trimmed,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(ADD_EXERCISE_SELECTION_KEY, JSON.stringify(payload));
};

export const popPendingExerciseSelection = async (): Promise<string | null> => {
  const raw = await AsyncStorage.getItem(ADD_EXERCISE_SELECTION_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(ADD_EXERCISE_SELECTION_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingExerciseSelection;
    const name = String(parsed?.name ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
};
