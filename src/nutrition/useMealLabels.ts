import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../config/firebaseConfig";
import { normalizeMealLabels, type MealLabels } from "./mealOrganization";

export function useMealLabels(uid: string | null) {
  const [state, setState] = useState<{ uid: string; labels: MealLabels } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snapshot) => {
      setError(false);
      setState({ uid, labels: normalizeMealLabels(snapshot.data()?.mealLabels) });
    }, () => setError(true));
  }, [uid]);
  return {
    labels: state?.uid === uid ? state.labels : normalizeMealLabels(null),
    ready: state?.uid === uid && !error,
    async saveLabels(labels: MealLabels) {
      if (!uid || state?.uid !== uid || error) throw new Error("Meal preferences are not available. Try again.");
      // Replace the entire field so Reset really removes old custom names.
      await updateDoc(doc(db, "users", uid), { mealLabels: labels });
    },
  };
}
