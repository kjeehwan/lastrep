import { describe,it,expect } from "vitest";
import { programContinueOrdinal,programDayDisplayStatus,completedProgramCalendar,emptyProgramDays,newProgramRun,programOccurrence,currentProgramOrdinal,resumeProgramRun,completeProgramOccurrence,programDayLink,changeProgramSchedule,sortPrograms,type ProgramRecord } from "./programFlow";
const program:ProgramRecord={id:"program",name:"Seven days",status:"saved",runId:"run",updatedAt:0,days:emptyProgramDays().map((d,i)=>i===2||i===6?{...d,type:"rest",title:"Rest"}:{type:"workout",title:"Same name",routineId:`routine-${i}`})};
describe("explicit program occurrence identity",()=>{
 it("dates late completions by the saved workout and keeps the following rest day",()=>{
  let run=newProgramRun(program,"run","2026-11-04");
  run=completeProgramOccurrence(program,run,programDayLink(program,run,0)!,"chest","2026-11-05");
  run=completeProgramOccurrence(program,run,programDayLink(program,run,1)!,"legs","2026-11-06");
  expect(currentProgramOrdinal(program,run,"2026-11-07")).toBe(2);
  expect([0,1,2,3].map(i=>programOccurrence(program,run,i).dateKey)).toEqual(["2026-11-05","2026-11-06","2026-11-07","2026-11-08"]);
 });
 it("repairs a legacy cursor only from verified completion dates, preserving explicit later shifts",()=>{
  const run={...newProgramRun(program,"run","2026-11-04"),cursor:3,marks:{
   "0":{status:"completed" as const,dateKey:"2026-11-04",workoutId:"chest"},
   "1":{status:"completed" as const,dateKey:"2026-11-05",workoutId:"legs"},
  }};
  const dates={"0":"2026-11-05","1":"2026-11-06"};
  const fixed=completedProgramCalendar(program,run,dates,"2026-11-07");
  expect(fixed.cursor).toBe(2);
  expect(programOccurrence(program,fixed,2).dateKey).toBe("2026-11-07");
  expect(completedProgramCalendar(program,fixed,dates,"2026-11-07")).toEqual(fixed);
  const shifted=resumeProgramRun(program,run,"2026-11-10");
  const retained=completedProgramCalendar(program,shifted,dates,"2026-11-07");
  expect(retained.anchorDateKey).toBe("2026-11-10");
  expect(retained.cursor).toBe(shifted.cursor);
 });
 it("uses the recorded workout date even when the save happens later",()=>{
  const run=newProgramRun(program,"run","2026-11-04");
  const next=completeProgramOccurrence(program,run,programDayLink(program,run,0)!,"chest","2026-11-07","2026-11-05");
  expect(programOccurrence(program,next,0).dateKey).toBe("2026-11-05");
  expect(programOccurrence(program,next,1).dateKey).toBe("2026-11-06");
 });
 it("keeps explicit skip choices and pending swaps when a late completion moves the calendar forward",()=>{
  let run=newProgramRun(program,"run","2026-11-04");
  run=changeProgramSchedule(program,run,1,"swap",3,"2026-11-04");
  run=changeProgramSchedule(program,run,4,"skip",undefined,"2026-11-04");
  const next=completeProgramOccurrence(program,run,programDayLink(program,run,0)!,"chest","2026-11-05");
  expect(programOccurrence(program,next,1)).toMatchObject({routineId:"routine-3",dateKey:"2026-11-06"});
  expect(programOccurrence(program,next,4)).toMatchObject({status:"skipped",dateKey:"2026-11-08"});
 });
 it("does not treat elapsed time as completed or shift missed workouts",()=>{const run=newProgramRun(program,"run","2026-10-01");expect(currentProgramOrdinal(program,run,"2026-11-02")).toBe(0);expect(programOccurrence(program,run,1).dateKey).toBe("2026-10-02");});
 it("completes only the linked day and is idempotent",()=>{const run=newProgramRun(program,"run","2026-10-01"),link=programDayLink(program,run,0)!;expect(()=>completeProgramOccurrence(program,run,{...link,runId:"different"},"workout")).toThrow();const next=completeProgramOccurrence(program,run,link,"workout","2026-10-01");expect(next.cursor).toBe(1);expect(completeProgramOccurrence(program,next,link,"retry")).toBe(next);expect(next.marks["0"].workoutId).toBe("workout");});
 it("resumes from the saved day today and preserves completed original dates",()=>{let run=newProgramRun(program,"run","2026-10-01");run=completeProgramOccurrence(program,run,programDayLink(program,run,0)!,"w1","2026-10-01");const next=resumeProgramRun(program,run,"2026-11-02");expect(next.cursor).toBe(1);expect(programOccurrence(program,next,0).dateKey).toBe("2026-10-01");expect(programOccurrence(program,next,1).dateKey).toBe("2026-11-02");expect(programOccurrence(program,next,2).dateKey).toBe("2026-11-03");expect(next.startedDateKey).toBe("2026-10-01");});
 it("restart creates a different run, leaving the previous run unchanged",()=>{const run=newProgramRun(program,"old","2026-10-01"),before=JSON.stringify(run),restart=newProgramRun(program,"new","2026-11-02");expect(restart.cursor).toBe(0);expect(restart.startedDateKey).toBe("2026-11-02");expect(restart.id).not.toBe(run.id);expect(JSON.stringify(run)).toBe(before);});
 it("moves/swaps only named occurrences and shift offsets subsequent dates",()=>{const run=newProgramRun(program,"run","2026-11-02"),moved=changeProgramSchedule(program,run,0,"move",2,"2026-11-02");expect(programOccurrence(program,moved,0).type).toBe("rest");expect(programOccurrence(program,moved,2).routineId).toBe("routine-0");expect(programOccurrence(program,moved,1)).toEqual(programOccurrence(program,run,1));const shifted=changeProgramSchedule(program,run,0,"shift",undefined,"2026-11-02");expect(programOccurrence(program,shifted,0).dateKey).toBe("2026-11-03");expect(programOccurrence(program,shifted,7).dateKey).toBe("2026-11-10");});
 it("starts the next cycle after completion and keeps stable routine IDs",()=>{let run=newProgramRun(program,"run","2026-10-01");for(const ordinal of [0,1,3,4,5])run=completeProgramOccurrence(program,run,programDayLink(program,run,ordinal)!,`w-${ordinal}`,"2026-10-08",`2026-10-${String(ordinal+1).padStart(2,"0")}`);expect(run.cursor).toBe(7);expect(programOccurrence(program,run,7).routineId).toBe("routine-0");expect(run.marks["0"].status).toBe("completed");});
 it("orders active, drafts, then other programs",()=>{expect(sortPrograms([{...program,id:"other",name:"A"},{...program,id:"draft",status:"draft",name:"Z"},program],program.id).map(p=>p.id)).toEqual(["program","draft","other"]);});
});

describe("elapsed rest-day presentation", () => {
 it("keeps today's completed workout separate from tomorrow's pending day, then rolls over by date", () => {
  const run = {...newProgramRun(program,"run","2026-11-05"),cursor:6,marks:{"5":{status:"completed" as const,dateKey:"2026-11-10",workoutId:"posterior"}}};
  const before = JSON.stringify(run);
  expect(currentProgramOrdinal(program,run,"2026-11-10")).toBe(6);
  expect(programContinueOrdinal(program,run,"2026-11-10")).toBe(5);
  expect(programOccurrence(program,run,programContinueOrdinal(program,run,"2026-11-10"))).toMatchObject({dayNumber:6,status:"completed",workoutId:"posterior"});
  expect(programContinueOrdinal(program,run,"2026-11-11")).toBe(6);
  expect(programContinueOrdinal(program,run,"2026-11-12")).toBe(7);
  expect(JSON.stringify(run)).toBe(before);
 });
 it("retains overdue workouts instead of jumping to a later calendar routine", () => {
  const run = newProgramRun(program,"run","2026-11-05");
  expect(programContinueOrdinal(program,run,"2026-11-10")).toBe(0);
 });
 it("uses actual completion dates and respects explicit shifts without inventing a day for today", () => {
  const run = {...newProgramRun(program,"run","2026-11-05"),anchorOrdinal:6,anchorDateKey:"2026-11-13",cursor:6,marks:{"5":{status:"completed" as const,dateKey:"2026-11-10",workoutId:"posterior"}}};
  expect(programContinueOrdinal(program,run,"2026-11-10")).toBe(5);
  const shifted = {...run,anchorOrdinal:6,anchorDateKey:"2026-11-14"};
  // Nov 13 has no scheduled occurrence: fall back to the explicitly pending day.
  expect(programContinueOrdinal(program,shifted,"2026-11-13")).toBe(6);
 });
 it("keeps the final completed day visible across a cycle boundary", () => {
  const run = {...newProgramRun(program,"run","2026-11-05"),cursor:7,marks:{"6":{status:"completed" as const,dateKey:"2026-11-11",workoutId:"extra"}}};
  expect(programContinueOrdinal(program,run,"2026-11-11")).toBe(6);
  expect(programContinueOrdinal(program,run,"2026-11-12")).toBe(7);
 });
 it("checks past rest dates without marking a workout complete or changing the run", () => {
  const run = {...newProgramRun(program, "run", "2026-11-05"), cursor: 2};
  const before = JSON.stringify(run), rest = programOccurrence(program, run, 2);
  expect(programDayDisplayStatus(rest, "2026-11-07")).toBe("pending");
  expect(programDayDisplayStatus(rest, "2026-11-10")).toBe("elapsed");
  expect(currentProgramOrdinal(program, run, "2026-11-10")).toBe(3);
  expect(programDayDisplayStatus(programOccurrence(program, run, 3), "2026-11-10")).toBe("pending");
  expect(JSON.stringify(run)).toBe(before);
 });
 it("preserves elapsed rest history when tomorrow shifts the next workout", () => {
  const run = {...newProgramRun(program, "run", "2026-11-05"), cursor: 2};
  const shifted = changeProgramSchedule(program, run, 3, "shift", undefined, "2026-11-10");
  expect(programOccurrence(program, shifted, 2)).toMatchObject({dateKey: "2026-11-07", type: "rest", status: "pending"});
  expect(programDayDisplayStatus(programOccurrence(program, shifted, 2), "2026-11-10")).toBe("elapsed");
  expect(programOccurrence(program, shifted, 3).dateKey).toBe("2026-11-11");
  expect(shifted.marks["2"].workoutId).toBeUndefined();
 });
 it("respects explicit skip/completion and blocks changing elapsed rests", () => {
  const run = {...newProgramRun(program, "run", "2026-11-05"), cursor: 2};
  const rest = programOccurrence(program, run, 2);
  expect(programDayDisplayStatus({...rest, status: "skipped"}, "2026-11-10")).toBe("skipped");
  expect(programDayDisplayStatus({...rest, status: "completed"}, "2026-11-10")).toBe("completed");
  expect(() => changeProgramSchedule(program, run, 2, "shift", undefined, "2026-11-10")).toThrow();
 });
});
