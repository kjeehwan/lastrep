import { collection, doc, getDoc, getDocFromServer, getDocs, getDocsFromServer, runTransaction, Timestamp, type Firestore } from "firebase/firestore";
import { legacySleepEntries, readSleepEntry, sleepJournalProfileKey, sleepJournalRevision as revision } from "./sleepJournalRecords";
import { db } from "../config/firebaseConfig";
import { deriveSleepDays, sleepEntrySignature, type SleepEntry } from "./sleepSessionModel";
import { prepareSleepCommand } from "./sleepMutationScope";
import { sleepSummary, summarizeSleepDays } from "./sleepJournalSummary";
import { applySleepCommand, type SleepCommand } from "./sleepCommands";

const userRef = (uid: string, database: Firestore) => doc(database, "users", uid);
const entriesRef = (uid: string, database: Firestore) => collection(database, "users", uid, "sleepSessions");
export { legacySleepEntries, readSleepEntry } from "./sleepJournalRecords";

export async function getSleepJournal(uid: string, database: Firestore = db) {
  const root = await getDoc(userRef(uid, database));
  const records = await getDocs(entriesRef(uid, database));
  const entries = records.docs.map((row) => readSleepEntry(row.id, row.data()));
  return { entries: entries.length || revision(root.data()) ? entries : legacySleepEntries(root.data()), profile: root.data()?.sleepProfile, target: root.data()?.sleepSettings?.targetHours };
}

/** A root revision serializes session writes plus their derived compatibility summary. */
export async function mutateSleepJournal(uid: string, change: (entries: SleepEntry[]) => SleepEntry[], options: { syncedAt?: Date; origin?: string | null; authorize?: () => Promise<void> } = {}, database: Firestore = db) {
  return (await commitSleepMutation(uid, change, options, database)).entries;
}

export async function executeSleepCommand(uid: string, command: SleepCommand, options: { syncedAt?: Date; origin?: string | null; authorize?: () => Promise<void> } = {}, database: Firestore = db) {
  try {
    const result = await commitSleepMutation(uid, entries => applySleepCommand(entries, command), options, database, command);
    return { summary: result.summary, revision: result.revision, affectedDates: result.affectedDates, diagnostics: result.diagnostics };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "unavailable" || code === "deadline-exceeded") throw Object.assign(new Error("Could not save sleep. Reconnect and try again."), { code });
    throw error;
  }
}

async function commitSleepMutation(uid: string, change: (entries: SleepEntry[]) => SleepEntry[], options: { syncedAt?: Date; origin?: string | null; authorize?: () => Promise<void> }, database: Firestore, command?: SleepCommand) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await options.authorize?.();
    const root = command ? await getDocFromServer(userRef(uid, database)) : await getDoc(userRef(uid, database));
    const preferred = options.origin ?? root.data()?.sleepProfile?.originAppPackage ?? null;
    const prepared = command ? await prepareSleepCommand(uid, command, root.data(), preferred, database) : null;
    const stored = prepared?.stored ?? (await getDocsFromServer(entriesRef(uid, database))).docs.map(row => readSleepEntry(row.id, row.data()));
    const entries = stored.length || revision(root.data()) ? stored : legacySleepEntries(root.data());
    const next = prepared?.next ?? change(entries);
    const days = prepared?.days ?? deriveSleepDays(next, preferred).days;
    if (days.some((day) => day.hours > 24)) throw Error("The entries total more than 24 hours for one date. Review their dates and durations.");
    const byId = new Map(stored.map((entry) => [entry.id, entry]));
    const changed = next.filter((entry) => !byId.has(entry.id) || sleepEntrySignature(byId.get(entry.id)!) !== sleepEntrySignature(entry));
    const retainedIds = new Set(next.map((entry) => entry.id));
    const removed = stored.filter((entry) => !retainedIds.has(entry.id));
    if (removed.some((entry) => entry.source === "health")) throw Error("Imported sessions must be excluded, not deleted.");
    if (changed.length + removed.length > 450) throw Error("Too many sleep changes to save at once. Try a smaller import.");
    const summary = prepared?.summary ?? sleepSummary(summarizeSleepDays(days));
    await options.authorize?.();
    const committed = await runTransaction(database, async (transaction) => {
      const current = await transaction.get(userRef(uid, database));
      if (revision(current.data()) !== revision(root.data()) || command && sleepJournalProfileKey(current.data()) !== sleepJournalProfileKey(root.data())) return false;
      for (const entry of changed) transaction.set(doc(entriesRef(uid, database), entry.id), entry);
      for (const entry of removed) transaction.delete(doc(entriesRef(uid, database), entry.id));
      transaction.set(userRef(uid, database), { sleepProfile: {
        journalRevision: revision(current.data()) + 1,
        ...summary,
        // Older installed clients may still write the original fields. Keep the ledger-derived snapshot separate.
        journalSummary: summary,
        ...(options.syncedAt ? { lastSyncedAt: Timestamp.fromDate(options.syncedAt) } : {}),
        ...(options.origin !== undefined ? { originAppPackage: options.origin, originLabel: options.origin?.includes("shealth") ? "Samsung Health / Galaxy Watch" : options.origin ? "Health Connect" : null } : {}),
      } }, { merge: true });
      return true;
    });
    if (committed) return { entries: next, summary, diagnostics: prepared?.diagnostics, revision: revision(root.data()) + 1,
      affectedDates: [...new Set([...changed, ...removed, ...changed.flatMap(row => byId.has(row.id) ? [byId.get(row.id)!] : [])].map(row => row.dateKey))] };
  }
  throw Error("Sleep data changed on another device. Please try again.");
}
