import { doc, FieldPath, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../config/firebaseConfig";
import { dateMealLabels, normalizeMealLabels, type MealLabels } from "./mealOrganization";

export function useMealLabels(uid: string | null, dateKey?: string) {
  const [state, setState] = useState<{ uid: string; labels: MealLabels } | null>(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState<{ key: string; names: unknown } | null>(null);
  const [dayError, setDayError] = useState(false);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snapshot) => {
      setError(false);
      setState({ uid, labels: normalizeMealLabels(snapshot.data()?.mealLabels) });
    }, () => setError(true));
  }, [uid]);
  useEffect(() => {
    if (!uid || !dateKey) return;
    return onSnapshot(doc(db, "users", uid, "nutritionDays", dateKey), (snapshot) => {
      setDay({ key: `${uid}:${dateKey}`, names: snapshot.data()?.mealNames });
      setDayError(false);
    }, () => setDayError(true));
  }, [uid, dateKey]);
  const defaults = state?.uid === uid ? state.labels : normalizeMealLabels(null);
  const dayReady = !dateKey || day?.key === `${uid}:${dateKey}`;
  return {
    labels: dateKey ? dateMealLabels(defaults, dayReady ? day?.names : null) : defaults,
    defaults,
    ready: state?.uid === uid && !error && dayReady && (!dateKey || !dayError),
    async saveName(section: string, name: string, useAsDefault = false) {
      if (!uid || !dateKey || state?.uid !== uid || error || !dayReady || dayError) throw new Error("Meal names are not available. Try again.");
      const clean = name.trim();
      if (!clean || clean.length > 24) throw new Error("Enter a name of 1-24 characters.");
      const dayRef = doc(db, "users", uid, "nutritionDays", dateKey);
      const payload = { mealNames: { [section]: clean }, updatedAt: serverTimestamp() };
      if (useAsDefault) {
        const batch = writeBatch(db);
        batch.set(dayRef, payload, { merge: true });
        batch.update(doc(db, "users", uid), new FieldPath("mealLabels", "names", section), clean);
        await batch.commit();
      } else await setDoc(dayRef, payload, { merge: true });
    },
    async saveLabels(labels: MealLabels) {
      if (!uid || state?.uid !== uid || error) throw new Error("Meal preferences are not available. Try again.");
      // Replace the entire field so Reset really removes old custom names.
      await updateDoc(doc(db, "users", uid), { mealLabels: labels });
    },
  };
}
