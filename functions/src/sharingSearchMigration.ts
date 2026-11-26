import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { sharingSearchKey } from "./workoutSharingContract";
import { sharingNamePrefixes } from "./sharingNameSearch";

/** Refresh only existing, opted-in entries; recheck state inside each transaction. */
export async function refreshSharingNameIndex(db: Firestore, apply = false) {
  const counts = { scanned: 0, changed: 0, skipped: 0 };
  let cursor: string | undefined;
  for (;;) {
    let query = db.collection("sharingDirectory").orderBy(FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const item of page.docs) {
      counts.scanned++;
      const changed = await db.runTransaction(async tx => {
        const [entry, settings, user] = await tx.getAll(item.ref, db.doc(`users/${item.id}/sharing/settings`), db.doc(`users/${item.id}`));
        if (!entry.exists || !user.exists || user.data()?.profilePhotoDeletionStartedAt || settings.data()?.enabled !== true || settings.data()?.username !== entry.data()?.username) return false;
        const nickname = typeof user.data()?.nickname === "string" && user.data()!.nickname.trim() ? user.data()!.nickname.trim().slice(0,40) : "Lastrep user";
        const fields = {nickname, nameKey: sharingSearchKey(nickname), namePrefixes: sharingNamePrefixes(nickname)};
        if (Object.entries(fields).every(([key,value]) => JSON.stringify(entry.data()?.[key]) === JSON.stringify(value))) return false;
        if (apply) tx.update(item.ref, fields);
        return true;
      });
      counts[changed ? "changed" : "skipped"]++;
    }
    cursor = page.docs[page.docs.length-1].id;
  }
  return counts;
}
