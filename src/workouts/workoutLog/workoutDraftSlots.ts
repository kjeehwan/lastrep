/** Account-scoped parked drafts. A path switch saves its source before replacing the editor. */
import { normalizeProgramLink, type ProgramRecord } from "../programFlow";
export type DraftSlots = Record<string, Record<string, unknown>>;
/** Publish the current draft and parked drafts together, never as two partial lists. */
export async function loadWorkoutDraftCache(storage: {multiGet:(keys:string[])=>Promise<readonly (readonly [string,string|null])[]>}, currentKey:string, parkedKey:string) {
  const entries=await storage.multiGet([currentKey,parkedKey]);
  const values=new Map(entries);
  return {raw:values.get(currentKey)??null,slots:readDraftSlots(values.get(parkedKey)??null)};
}
export function workoutDraftContext(draft: Record<string, unknown>, programs: ProgramRecord[]) {
  if(draft.routineBuilderMode)return "Routine draft";
  const link=normalizeProgramLink(draft.programLink);
  if(!link)return "Separate workout";
  const program=programs.find(item=>item.id===link.programId);
  return `${program?.name || "Saved program"} · Day ${link.dayNumber}${program && program.runId!==link.runId ? " · Previous run" : ""}`;
}
export const programDraftSlot=(runId:string,ordinal:number)=>`program:${runId}:${ordinal}`;
export const serializeDraftSlot=(draft:Record<string,unknown>,savedAt=Date.now())=>JSON.stringify({...draft,draftSavedAt:savedAt});
/** Resume unfinished sessions on today's date without changing their sets or program occurrence. */
export function refreshResumedWorkoutDate(draft: Record<string, unknown>, today: string) {
  const date = draft.sessionDateText;
  if (draft.routineBuilderMode || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= today) return draft;
  return { ...draft, sessionDateText: today };
}
export function readDraftSlots(raw: string | null): DraftSlots {
  if (!raw) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Saved workout drafts couldn't be read. They have been preserved.");
  if(Object.values(value).some(draft=>!draft||typeof draft!=="object"||Array.isArray(draft)||!Array.isArray((draft as Record<string,unknown>).exercises)))throw new Error("A saved workout draft couldn't be read. All drafts have been preserved.");
  return value;
}
export function switchDraftSlot(slots: DraftSlots, source: Record<string, unknown>, destination: string, seed: Record<string, unknown>) {
  const sourceSlot = typeof source.workoutSlot === "string" ? source.workoutSlot : "single";
  const next = { ...slots };
  if ((Array.isArray(source.exercises) && source.exercises.length) || source.routineBuilderMode) next[sourceSlot] = source;
  return { slots: next, draft: next[destination] ?? { ...seed, workoutSlot: destination } };
}
