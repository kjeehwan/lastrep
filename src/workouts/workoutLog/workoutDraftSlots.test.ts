import { describe, it, expect } from "vitest";
import { programDraftSlot, readDraftSlots, switchDraftSlot, refreshResumedWorkoutDate, serializeDraftSlot, workoutDraftContext, loadWorkoutDraftCache } from "./workoutDraftSlots";
import type { ProgramRecord } from "../programFlow";
describe("workout path drafts", () => {
  it("waits for the complete current/parked cache instead of publishing a partial draft list", async () => {
    let finish!:(entries:[string,string|null][])=>void;
    let ready=false;
    const current={sessionTitle:"Back + Biceps",exercises:[]};
    const parked={"program:run:1":{sessionTitle:"Back + Biceps",exercises:[]}};
    const storage={multiGet:(keys:string[])=>{expect(keys).toEqual(["current","parked"]);return new Promise<[string,string|null][]>(resolve=>{finish=resolve;});}};
    const pending=loadWorkoutDraftCache(storage,"current","parked").then(value=>{ready=true;return value;});
    await Promise.resolve();
    expect(ready).toBe(false);
    finish([["current",JSON.stringify(current)],["parked",JSON.stringify(parked)]]);
    expect(await pending).toEqual({raw:JSON.stringify(current),slots:parked});
  });
  it("distinguishes same-named separate, current-program and previous-run drafts", () => {
    const programs=[{id:"p",name:"My split",runId:"new"}] as ProgramRecord[];
    const draft={sessionTitle:"Back + Biceps",programLink:{programId:"p",runId:"new",ordinal:1,dayNumber:2,scheduledDateKey:"2026-11-03",routineId:"back"}};
    expect(workoutDraftContext({sessionTitle:draft.sessionTitle},programs)).toBe("Separate workout");
    expect(workoutDraftContext(draft,programs)).toBe("My split · Day 2");
    expect(workoutDraftContext({...draft,programLink:{...draft.programLink,runId:"old"}},programs)).toBe("My split · Day 2 · Previous run");
  });
  it("a restarted run cannot restore an old run's unfinished workout", () => {
    const oldSlot=programDraftSlot("old",1),newSlot=programDraftSlot("new",0);
    const old={workoutSlot:oldSlot,sessionTitle:"Back + Biceps",exercises:[{name:"Row"}]};
    const next=switchDraftSlot({[oldSlot]:old},old,newSlot,{sessionTitle:"Chest + Triceps",exercises:[{name:"Bench"}]});
    expect(next.draft.sessionTitle).toBe("Chest + Triceps");
    expect(next.slots[oldSlot]).toEqual(old);
  });
  it("moves a resumed program draft to today before a fresh save timestamp can hide its old date", () => {
    const draft = {sessionDateText:"2026-11-02",draftSavedAt:Date.now(),programLink:{runId:"run",ordinal:0},exercises:[{sets:[{reps:"6",rpe:"8",done:true}]}]};
    const resumed = JSON.parse(serializeDraftSlot(refreshResumedWorkoutDate(draft,"2026-11-03")));
    expect(resumed.sessionDateText).toBe("2026-11-03");
    expect(resumed.exercises).toEqual(draft.exercises);
    expect(resumed.programLink).toEqual(draft.programLink);
    expect(draft.sessionDateText).toBe("2026-11-02");
  });
  it("keeps routine builders and today's or future workout dates", () => {
    for(const draft of [{sessionDateText:"2026-11-02",routineBuilderMode:true},{sessionDateText:"2026-11-03"},{sessionDateText:"2026-11-04"}]){
      expect(refreshResumedWorkoutDate(draft,"2026-11-03")).toBe(draft);
    }
  });
  it("keeps pending workouts on different days of a run separate", () => {
    const first = programDraftSlot("run", 0), next = programDraftSlot("run", 1);
    const source = {workoutSlot:first,exercises:[{name:"Bench"}]};
    const result = switchDraftSlot({}, source, next, {exercises:[{name:"Row"}]});
    expect(result.slots[first]).toEqual(source);
    expect(result.draft.workoutSlot).toBe(next);
    expect(result.draft.exercises).toEqual([{name:"Row"}]);
  });
  it("preserves a program draft and restores the independent standalone draft", () => {
    const single = { workoutSlot: "single", exercises: [{ name: "Squat", sets: [{ reps: "8", rpe: "9", done: true }] }] };
    const program = { workoutSlot: "program:run", exercises: [{ name: "Bench" }], programLink: { runId: "run" } };
    const switched = switchDraftSlot({ single }, program, "single", { exercises: [] });
    expect(switched.draft).toEqual(single);
    expect(switched.slots["program:run"]).toEqual(program);
    expect(program.programLink.runId).toBe("run");
  });
  it("keeps a routine builder draft and does not overwrite an existing destination", () => {
    const builder = { workoutSlot: "builder:program", routineBuilderMode: true, exercises: [] };
    const existing = { workoutSlot: "program:run", exercises: [{ name: "Row" }] };
    const result = switchDraftSlot({ "program:run": existing }, builder, "program:run", { exercises: [] });
    expect(result.draft).toEqual(existing); expect(result.slots["builder:program"]).toEqual(builder);
  });
  it("refuses corrupted parked drafts instead of discarding them", () => {
    expect(() => readDraftSlots("broken")).toThrow(); expect(() => readDraftSlots("[]")).toThrow();
    expect(() => readDraftSlots(JSON.stringify({single:{exercises:[]},broken:{title:"Lost"}}))).toThrow();
  });
});
