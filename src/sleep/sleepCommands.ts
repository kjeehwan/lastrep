import { reconcileHealthSleep } from "./healthSleepImport";
import { commitManualSleep, removeSleepEntry, sleepEntrySignature, type SleepEntry } from "./sleepSessionModel";

export type SleepCommand =
  | { kind: "manual"; candidate: SleepEntry; expected?: SleepEntry | null; replacements?: SleepEntry[] }
  | { kind: "remove"; expected: SleepEntry }
  | { kind: "health"; incoming: SleepEntry[]; deletedIds: string[]; device: string; fullWindow?: { start: number; end: number } };

/** Commands declare ownership; the repository, rather than the UI, chooses the read scope. */
export function applySleepCommand(entries: SleepEntry[], command: SleepCommand): SleepEntry[] {
  if (command.kind === "remove") return removeSleepEntry(entries, command.expected);
  if (command.kind === "health") return reconcileHealthSleep(entries, command.incoming, command.deletedIds, command.device, command.fullWindow);
  if (command.expected) {
    const current = entries.find(row => row.id === command.expected!.id);
    if (!current || sleepEntrySignature(current) !== sleepEntrySignature(command.expected)) {
      throw Error("This entry changed on another device. Close it and reopen before editing.");
    }
  }
  const replacements = command.replacements ?? [];
  if (replacements.some(expected => {
    const current = entries.find(row => row.id === expected.id);
    return !current || sleepEntrySignature(current) !== sleepEntrySignature(expected);
  })) throw Error("An entry changed since your review. Go back and save again to review the latest data.");
  return commitManualSleep(entries, command.candidate, command.expected?.id ?? null, replacements.map(row => row.id));
}
