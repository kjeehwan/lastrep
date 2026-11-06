/** Program identity and calendar operations. Names never determine membership. */
export type ProgramDay = { type: "workout" | "rest" | "unassigned"; routineId: string | null; title: string };
export type ProgramRecord = { id: string; name: string; days: ProgramDay[]; status: "draft" | "saved"; runId: string | null; updatedAt: number; deleting?: boolean };
export type ProgramMark = { status?: "completed" | "skipped"; dateKey?: string; day?: ProgramDay; dayNumber?:number; workoutId?: string; completionDateVersion?: 1 };
export type ProgramRun = { id: string; programId: string; startedDateKey: string; anchorDateKey: string; anchorOrdinal: number; cursor: number; marks: Record<string, ProgramMark>; endedDateKey?: string | null; revision?: number };
export type ProgramLink = { programId: string; runId: string; ordinal: number; dayNumber: number; scheduledDateKey: string; routineId: string; title: string };
export type ProgramOccurrence = ProgramDay & { ordinal: number; dayNumber: number; dateKey: string; status: "pending" | "completed" | "skipped"; workoutId?: string };
export const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
export function addProgramDays(key: string, amount: number) { const [y,m,d]=key.split("-").map(Number); return dateKey(new Date(y,m-1,d+amount,12)); }
export const programDateLabel = (key: string) => { const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d,12).toLocaleDateString(undefined,{month:"short",day:"numeric"}); };
export const emptyProgramDays = (length=7): ProgramDay[] => Array.from({length:Math.max(1,Math.min(14,length))},()=>({type:"unassigned",routineId:null,title:"Unassigned"}));
export function normalizeProgramRecord(id: string, raw: any): ProgramRecord | null {
 if(!raw||!Array.isArray(raw.days)||raw.days.length<1||raw.days.length>14)return null;
 return {id,name:typeof raw.name==="string"?raw.name.slice(0,100):"",status:raw.status==="saved"?"saved":"draft",runId:typeof raw.runId==="string"?raw.runId:null,updatedAt:typeof raw.updatedAt==="number"?raw.updatedAt:0,...(raw.deleting?{deleting:true}:{}),days:raw.days.map((d:any)=>({type:d?.type==="rest"?"rest":d?.type==="workout"&&typeof d.routineId==="string"?"workout":"unassigned",routineId:typeof d?.routineId==="string"?d.routineId:null,title:typeof d?.title==="string"?d.title:"Unassigned"}))};
}
export function programSetupError(program: Pick<ProgramRecord,"name"|"days">) {
 if(!program.name.trim())return "Name your program.";
 if(!program.days.length||program.days.some(d=>d.type==="unassigned"||d.type==="workout"&&!d.routineId))return "Assign a routine or choose Rest for each day.";
 if(!program.days.some(d=>d.type==="workout"))return "Include at least one workout day.";
 return null;
}
export function newProgramRun(program: ProgramRecord,id:string,today=dateKey()):ProgramRun {return{id,programId:program.id,startedDateKey:today,anchorDateKey:today,anchorOrdinal:0,cursor:0,marks:{},endedDateKey:null};}
export function programOccurrence(program: ProgramRecord,run:ProgramRun,ordinal:number):ProgramOccurrence {
 const mark=run.marks[String(ordinal)]??{};const day=mark.day??program.days[ordinal%program.days.length];
 return {...day,ordinal,dayNumber:mark.dayNumber??ordinal%program.days.length+1,dateKey:mark.dateKey??addProgramDays(run.anchorDateKey,ordinal-run.anchorOrdinal),status:mark.status??"pending",...(mark.workoutId?{workoutId:mark.workoutId}:{})};
}
/** Rest days elapse; an unfinished workout never advances merely because time passed. */
export function currentProgramOrdinal(program:ProgramRecord,run:ProgramRun,today=dateKey()) {
 let cursor=run.cursor;
 for(let i=0;i<program.days.length*3;i++){const day=programOccurrence(program,run,cursor);if(day.status!=="pending"||day.type==="rest"&&day.dateKey<today)cursor++;else break;}
 return cursor;
}
export function programDayLink(program:ProgramRecord,run:ProgramRun,ordinal:number):ProgramLink|null {
 const day=programOccurrence(program,run,ordinal);return day.type!=="workout"||!day.routineId||day.status!=="pending"?null:{programId:program.id,runId:run.id,ordinal,dayNumber:day.dayNumber,scheduledDateKey:day.dateKey,routineId:day.routineId,title:day.title};
}
export function normalizeProgramLink(raw:any):ProgramLink|null {
 return raw&&typeof raw.programId==="string"&&typeof raw.runId==="string"&&Number.isSafeInteger(raw.ordinal)&&raw.ordinal>=0&&typeof raw.routineId==="string"&&typeof raw.scheduledDateKey==="string"?{programId:raw.programId,runId:raw.runId,ordinal:raw.ordinal,dayNumber:Number(raw.dayNumber)||1,routineId:raw.routineId,scheduledDateKey:raw.scheduledDateKey,title:typeof raw.title==="string"?raw.title:"Workout"}:null;
}
export function resumeProgramRun(program:ProgramRecord,run:ProgramRun,today=dateKey()):ProgramRun {
 const cursor=currentProgramOrdinal(program,run,today),marks={...run.marks};
 // Freeze historical occurrence dates before changing the future calendar anchor.
 Object.entries(marks).forEach(([key,mark])=>{if(Number(key)<cursor||mark.status)marks[key]={...mark,dateKey:programOccurrence(program,run,Number(key)).dateKey};});
 return {...run,cursor,anchorOrdinal:cursor,anchorDateKey:today,marks};
}
export function completeProgramOccurrence(program:ProgramRecord,run:ProgramRun,link:ProgramLink,workoutId:string,today=dateKey(),completedDate=today):ProgramRun {
 if(link.programId!==program.id||link.runId!==run.id)throw new Error("Program day does not match this run.");
 const previous=run.marks[String(link.ordinal)];
 if(previous?.status==="completed")return run;
 const marks={...run.marks,[String(link.ordinal)]:{...previous,status:"completed" as const,completionDateVersion:1 as const,dateKey:link.scheduledDateKey,dayNumber:link.dayNumber,day:{type:"workout" as const,routineId:link.routineId,title:link.title},workoutId}};
 return completedProgramCalendar(program,{...run,marks},{[String(link.ordinal)]:completedDate},today);
}
export type ProgramScheduleAction = "skip"|"shift"|"move"|"swap";
export function changeProgramSchedule(program:ProgramRecord,run:ProgramRun,ordinal:number,action:ProgramScheduleAction,target?:number,today=dateKey()):ProgramRun {
 const from=programOccurrence(program,run,ordinal);if(from.status!=="pending")throw new Error("Completed or skipped days keep their history.");
 if(action==="shift"){
  if(ordinal!==currentProgramOrdinal(program,run,today))throw new Error("Shift the first pending day so unfinished workouts are preserved.");
  return resumeProgramRun(program,{...run,cursor:ordinal},addProgramDays(today,1));
 }
 const marks={...run.marks};
 if(action==="skip")marks[String(ordinal)]={...marks[String(ordinal)],status:"skipped",dateKey:from.dateKey,day:{type:from.type,routineId:from.routineId,title:from.title}};
 else {
  if(target==null||target===ordinal)throw new Error("Choose another day.");
  const to=programOccurrence(program,run,target);if(to.status!=="pending"||action==="move"&&to.type!=="rest")throw new Error("Choose an available destination.");
  marks[String(ordinal)]={...marks[String(ordinal)],day:{type:to.type,routineId:to.routineId,title:to.title},dateKey:from.dateKey};
  marks[String(target)]={...marks[String(target)],day:{type:from.type,routineId:from.routineId,title:from.title},dateKey:to.dateKey};
 }
 const next={...run,marks};return {...next,cursor:currentProgramOrdinal(program,next,today)};
}
export function sortPrograms(programs:ProgramRecord[],activeId:string|null){return [...programs].sort((a,b)=>(a.id===activeId?0:a.status==="draft"?1:2)-(b.id===activeId?0:b.status==="draft"?1:2)||a.name.localeCompare(b.name));}


/** Dates supplied here must come from workouts with matching program/run/ordinal links. */
function applyProgramCompletionDates(program: ProgramRecord, run: ProgramRun, dates: Record<string, string>): ProgramRun {
  const marks = { ...run.marks };
  const completed = Object.keys(dates).map(Number).filter(ordinal =>
    Number.isSafeInteger(ordinal) && ordinal >= 0 && marks[String(ordinal)]?.status === "completed" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dates[String(ordinal)])
  ).sort((a, b) => a - b);
  for (const ordinal of completed) marks[String(ordinal)] = { ...marks[String(ordinal)], dateKey: dates[String(ordinal)] };
  const latest = completed.at(-1);
  if (latest == null) return run;
  const actual = dates[String(latest)], scheduled = programOccurrence(program, run, latest).dateKey;
  const lastMarkedCompletion = Math.max(...Object.keys(run.marks).filter(key => run.marks[key].status === "completed").map(Number));
  // Resume/shift establishes a newer calendar anchor: never undo that choice.
  if (latest !== lastMarkedCompletion || latest < run.anchorOrdinal || actual <= scheduled) return { ...run, marks };
  // Finishing a future day out of order must not move an earlier unfinished workout.
  for (let ordinal = run.cursor; ordinal < latest; ordinal++) {
    const day = programOccurrence(program, run, ordinal);
    if (day.type === "workout" && day.status === "pending") return { ...run, marks };
  }
  const offset = Math.round((Date.parse(actual) - Date.parse(scheduled)) / 86400000);
  for (let ordinal = Math.max(0, latest - program.days.length * 2); ordinal < latest; ordinal++) {
    if (!marks[String(ordinal)]) {
      const day = programOccurrence(program, run, ordinal);
      marks[String(ordinal)] = { dateKey: day.dateKey, dayNumber: day.dayNumber,
        day: { type: day.type, routineId: day.routineId, title: day.title } };
    }
  }
  for (const [key, mark] of Object.entries(marks)) {
    if (mark.status) marks[key] = { ...mark, dateKey: mark.dateKey ?? programOccurrence(program, run, Number(key)).dateKey };
    else if (Number(key) > latest && mark.dateKey) marks[key] = { ...mark, dateKey: addProgramDays(mark.dateKey, offset) };
  }
  const next = { ...run, marks, anchorOrdinal: latest, anchorDateKey: actual, cursor: Math.min(run.cursor, latest + 1) };
  // Re-evaluate elapsed rest days using the corrected calendar, not the old cursor.
  return next;
}

export function completedProgramCalendar(program: ProgramRecord, run: ProgramRun, dates: Record<string, string>, today: string) {
  const next = applyProgramCompletionDates(program, run, dates);
  return { ...next, cursor: currentProgramOrdinal(program, next, today) };
}
