import { programOccurrence, type ProgramRecord, type ProgramRun } from "./programFlow";
/** Explicit dates and marks replace inference from unrelated same-day workouts. */
export function programCalendarEntry(program: ProgramRecord, run: ProgramRun, target: string) {
  const explicit = Object.keys(run.marks).map(Number).find(ordinal => programOccurrence(program,run,ordinal).dateKey === target);
  if (explicit != null) return programOccurrence(program,run,explicit);
  const distance = Math.round((Date.parse(target) - Date.parse(run.anchorDateKey)) / 86400000);
  const ordinal = run.anchorOrdinal + distance;
  if (ordinal < run.anchorOrdinal || target < run.startedDateKey) return null;
  const occurrence = programOccurrence(program,run,ordinal);
  return occurrence.dateKey === target ? occurrence : null;
}
