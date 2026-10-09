import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

type UseWorkoutDraftPersistenceOptions<TDraft> = {
  draft: TDraft;
  storageKey: string | null;
  canPersist?: () => boolean;
  onSaved?: () => void;
  serialize?: (draft: TDraft) => string;
  delayMs?: number;
};

/** Debounced local draft persistence, shared independently from screen UI state. */
export function useWorkoutDraftPersistence<TDraft>({
  draft,
  storageKey,
  canPersist,
  onSaved,
  serialize = JSON.stringify,
  delayMs = 400,
}: UseWorkoutDraftPersistenceOptions<TDraft>) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!storageKey) return;

    saveTimerRef.current = setTimeout(() => {
      if (canPersist && !canPersist()) return;
      AsyncStorage.setItem(storageKey, serialize(draft))
        .then(onSaved)
        .catch((error) => console.log("Failed to save workout draft", error));
    }, delayMs);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [canPersist, delayMs, draft, onSaved, serialize, storageKey]);
}
