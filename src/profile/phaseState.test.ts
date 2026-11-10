import { describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import { phaseTimeline, parsePhaseStartDate, phaseWeekFromDate, phaseDateKey, currentPhaseWeek, phaseForDate, phaseName, phasePatch, phaseWeek, phaseHistorySignature, type PhaseEdit } from "./phaseState";
vi.mock("../config/firebaseConfig", () => ({ db: {} }));

describe("phase state", () => {
  it("shows the current phase and derives contiguous ranges without merging repeated types", () => {
    const past = [{index:0,phase:"Strength",startDate:"2026-04-15"},{index:1,phase:"Hypertrophy",startDate:"2026-10-14"}];
    const current = {phase:"Hypertrophy",startDate:"2026-10-22"};
    expect(phaseTimeline(past,current)).toMatchObject([
      {index:0,startDate:"2026-04-15",endDate:"2026-10-13",current:false},
      {index:1,startDate:"2026-10-14",endDate:"2026-10-21",current:false},
      {index:-1,startDate:"2026-10-22",endDate:null,current:true},
    ]);
    expect(phaseTimeline([past[0]],current)[0].endDate).toBe("2026-10-21");
    expect(phaseTimeline([],current)).toHaveLength(1);
    expect(past[0].startDate).toBe("2026-04-15");
  });
  it("handles month/year boundaries and same-day transitions without reversed intervals", () => {
    expect(phaseTimeline([{index:0,phase:"Strength",startDate:"2025-12-01"}],{phase:"Power",startDate:"2026-01-01"})[0].endDate).toBe("2025-12-31");
    expect(phaseTimeline([{index:0,phase:"Strength",startDate:"2026-10-22"}],{phase:"Strength",startDate:"2026-10-22"})[0].endDate).toBe("2026-10-22");
  });
  it("shows only phases with known dates in day details", () => {
    const history = [{ phase: "Strength", startedAt: Timestamp.fromMillis(500) }, { phase: "Power", startedAt: Timestamp.fromMillis(1000) }];
    expect(phaseForDate(history, "Power", 1000, 499)).toBeNull();
    expect(phaseForDate(history, "Power", 1000, 750)).toBe("Strength");
    expect(phaseForDate(history, "Power", 1000, 1200)).toBe("Power");
    expect(phaseForDate([], "Power", null, 1200)).toBeNull();
  });
  it("does not invent a week for an unknown start", () => {
    expect(phaseWeek(null, Date.now())).toBeNull();
    expect(phaseWeek(100, 100)).toBe(1);
    expect(phaseWeek(100, 604800100)).toBe(2);
  });
  it("resets only the changed phase and preserves known history", () => {
    const old = Timestamp.fromMillis(100);
    const now = Timestamp.fromMillis(1000);
    expect(phasePatch({ trainingPhase: "Strength", trainingPhaseStartedAt: old, dietPhase: "Bulk" }, { trainingPhase: "Power" }, now)).toEqual({ trainingPhase: "Power", trainingPhaseName: "", trainingPhaseWeekAnchorAt: now, trainingPhaseWeekBase: 1, trainingPhaseStartedAt: now, trainingPhaseHistory: [{ phase: "Strength", startedAt: old }, { phase: "Power", startedAt: now }] });
  });
  const start = Timestamp.fromMillis(1000);
  const now = Timestamp.fromMillis(604801000);
  const current = { trainingPhase: "Strength", trainingPhaseStartedAt: start, trainingPhaseHistory: [{ phase: "Strength", startedAt: start }], dietPhase: "Bulk" };
  const edit: PhaseEdit = { mode: "edit", phase: "Strength", name: "Winter strength", week: null, expectedPhase: "Strength", expectedStartMs: 1000, requestId: "test-edit" };
  it("renames without restarting or changing the type used by recommendations", () => {
    const patch = phasePatch(current, { trainingPhase: edit }, now);
    expect(patch).toEqual({ trainingPhaseName: "Winter strength", trainingPhaseLastEditId: "test-edit" });
    expect(phaseName({ ...current, ...patch }, "trainingPhase")).toBe("Winter strength");
    expect(phaseName({ ...current, trainingPhaseName: " " }, "trainingPhase")).toBe("Strength");
    expect(currentPhaseWeek({ ...current, ...patch }, "trainingPhase", now.toMillis())).toBe(2);
  });
  it("corrects a week independently of the true start and advances it", () => {
    const patch = phasePatch(current, { trainingPhase: { ...edit, week: 8 } }, now);
    const updated = { ...current, ...patch };
    expect(updated.trainingPhaseStartedAt).toBe(start);
    expect(updated.trainingPhaseHistory).toBe(current.trainingPhaseHistory);
    expect(currentPhaseWeek(updated, "trainingPhase", now.toMillis())).toBe(8);
    expect(currentPhaseWeek(updated, "trainingPhase", now.toMillis() + 604800000)).toBe(9);
  });
  it("starts another phase of the same type with a separate history entry", () => {
    const patch = phasePatch(current, { trainingPhase: { ...edit, mode: "new", week: 3 } }, now);
    expect(patch.trainingPhaseStartedAt).toBe(now);
    expect(patch.trainingPhaseHistory).toHaveLength(2);
    expect(currentPhaseWeek({ ...current, ...patch }, "trainingPhase", now.toMillis())).toBe(3);
    expect(patch).not.toHaveProperty("dietPhase");
  });
  it("clears the preceding phase's custom name and week on a legacy type change", () => {
    const patch = phasePatch({ ...current, trainingPhaseName: "Winter", trainingPhaseWeekBase: 8 }, { trainingPhase: "Power" }, now);
    expect(patch.trainingPhaseName).toBe("");
    expect(patch.trainingPhaseWeekBase).toBe(1);
  });
  it("rejects stale edits and invalid weeks without writing a patch", () => {
    expect(() => phasePatch({ ...current, trainingPhaseStartedAt: now }, { trainingPhase: edit }, now)).toThrow("changed elsewhere");
    for (const week of [0, 1.5, 1000, NaN]) expect(() => phasePatch(current, { trainingPhase: { ...edit, week } }, now)).toThrow("whole week");
    expect(() => phasePatch(current, { trainingPhase: { ...edit, mode: "new" } }, now)).toThrow("whole week");
    expect(() => phasePatch(current, { trainingPhase: { ...edit, phase: "Power" } }, now)).toThrow("Start new phase");
  });
  it("does not restart a phase twice when a Profile save is retried", () => {
    const change: PhaseEdit = { ...edit, mode: "new", week: 1 };
    const patch = phasePatch(current, { trainingPhase: change }, now);
    expect(phasePatch({ ...current, ...patch }, { trainingPhase: change }, Timestamp.fromMillis(now.toMillis() + 1000))).toEqual({});
  });
  it("does not invent a legacy start when only a name is edited", () => {
    const patch = phasePatch({ trainingPhase: "Strength" }, { trainingPhase: { ...edit, expectedStartMs: null } }, now);
    expect(currentPhaseWeek(patch, "trainingPhase", now.toMillis())).toBeNull();
    expect(patch).not.toHaveProperty("trainingPhaseStartedAt");
  });
  it("handles a legacy account whose phase type was never stored", () => {
    const patch = phasePatch({}, { dietPhase: { ...edit, phase: "Maintain", expectedPhase: "Maintain", expectedStartMs: null, name: "Steady" } }, now);
    expect(patch.dietPhase).toBe("Maintain");
    expect(phaseName(patch, "dietPhase")).toBe("Steady");
    expect(currentPhaseWeek(patch, "dietPhase", now.toMillis())).toBeNull();
  });
  it("ignores an old week correction if an older app starts a later phase", () => {
    expect(currentPhaseWeek({ trainingPhaseStartedAt: now, trainingPhaseWeekAnchorAt: start, trainingPhaseWeekBase: 7 }, "trainingPhase", now.toMillis())).toBe(1);
  });
  it("does not reset unchanged phases or fabricate legacy history", () => {
    const now = Timestamp.now();
    expect(phasePatch({ dietPhase: "Bulk" }, { dietPhase: "Bulk" }, now)).toEqual({});
    expect(phasePatch({ dietPhase: "Bulk" }, { dietPhase: "Cut" }, now).dietPhaseHistory).toEqual([{ phase: "Cut", startedAt: now }]);
  });
});

describe("confirmed phase start dates", () => {
 const now = Timestamp.fromDate(new Date(2026, 10, 10, 18));
 const start = Timestamp.fromDate(new Date(2026, 9, 1, 12));
 const current = {trainingPhase: "Strength", trainingPhaseStartedAt: start, trainingPhaseWeekBase: 8, trainingPhaseWeekAnchorAt: now, trainingPhaseHistory: [{phase: "Strength", startedAt: start}]};
 const edit: PhaseEdit = {mode: "edit", phase: "Strength", name: "Strength", week: null, expectedPhase: "Strength", expectedStartMs: start.toMillis(), requestId: "date-edit"};
 it("preserves legacy weeks until a date is confirmed", () => {
  const named = {...current, ...phasePatch(current, {trainingPhase: edit}, now)};
  expect(currentPhaseWeek(named, "trainingPhase", now.toMillis())).toBe(8);
  expect(named.trainingPhaseStartedAt).toBe(start);
 });
 it("calculates by calendar date and corrects the existing history instead of appending a new phase", () => {
  const patch = phasePatch(current, {trainingPhase: {...edit, startDateKey: "2026-11-01"}}, now);
  const data = {...current, ...patch};
  expect(currentPhaseWeek(data, "trainingPhase", new Date(2026,10,7,23,59).getTime())).toBe(1);
  expect(currentPhaseWeek(data, "trainingPhase", new Date(2026,10,8,0,0).getTime())).toBe(2);
  expect(patch.trainingPhaseHistory).toHaveLength(1);
  expect(phaseDateKey(patch.trainingPhaseHistory[0].startedAt.toDate())).toBe("2026-11-01");
  expect(phasePatch(data, {trainingPhase: {...edit, startDateKey: "2026-11-01"}}, now)).toEqual({});
 });
 it("rejects invalid, future and out-of-order dates without a patch", () => {
  for (const key of ["2026-02-30", "2026-11-11", "2026-1-01"]) expect(() => phasePatch(current, {trainingPhase: {...edit, startDateKey: key}}, now)).toThrow();
  const withPrevious = {...current, trainingPhaseHistory: [{phase:"Power", startedAt: Timestamp.fromDate(new Date(2026,8,1))}, ...current.trainingPhaseHistory]};
  expect(() => phasePatch(withPrevious, {trainingPhase: {...edit,startDateKey:"2026-08-31"}}, now)).toThrow("previous phase");
  expect(parsePhaseStartDate("2024-02-29")).not.toBeNull();
  expect(parsePhaseStartDate("2026-02-29")).toBeNull();
  expect(phaseWeekFromDate("invalid")).toBeNull();
 });
 it("starts a backdated new phase and respects later starts by older clients", () => {
  const patch = phasePatch(current, {trainingPhase: {...edit,mode:"new",week:1,startDateKey:"2026-11-01"}}, now);
  const data = {...current, ...patch};
  expect(patch.trainingPhaseHistory).toHaveLength(2);
  expect(currentPhaseWeek(data,"trainingPhase",now.toMillis())).toBe(2);
  const newer = {...data,trainingPhaseStartedAt:now,trainingPhaseWeekAnchorAt:now,trainingPhaseWeekBase:1};
  expect(currentPhaseWeek(newer,"trainingPhase",now.toMillis())).toBe(1);
 });
 it("keeps same-day phase history ordered and rejects stale start-date edits", () => {
  const patch = phasePatch(current,{trainingPhase:{...edit,mode:"new",phase:"Power",week:1,startDateKey:"2026-10-01"}},now);
  expect(phaseForDate(patch.trainingPhaseHistory,"Power",patch.trainingPhaseStartedAt.toMillis(), now.toMillis())).toBe("Power");
  expect(() => phasePatch({...current,trainingPhaseStartedAt:now},{trainingPhase:{...edit,startDateKey:"2026-11-01"}},now)).toThrow("changed elsewhere");
 });
});

describe("phase-history date corrections", () => {
 const stamp = (key: string) => Timestamp.fromDate(new Date(key + "T12:00:00"));
 const start = stamp("2026-10-22"), now = stamp("2026-11-10");
 const history = [{phase:"Bulk",startedAt:stamp("2026-09-01"),note:"preserve"},{phase:"Cut",startedAt:stamp("2026-10-16")},{phase:"Maintain",startedAt:start}];
 const data = {dietPhase:"Maintain",dietPhaseStartedAt:start,dietPhaseHistory:history,dietPhaseWeekBase:8,dietPhaseWeekAnchorAt:now};
 const edit: PhaseEdit = {mode:"edit",phase:"Maintain",name:"",week:null,expectedPhase:"Maintain",expectedStartMs:start.toMillis(),requestId:"history-correction",expectedHistory:phaseHistorySignature(history),historyDates:[{index:1,startDateKey:"2026-10-05"}]};
 it("corrects earlier and current dates atomically, preserving entry metadata and idempotency", () => {
  const patch = phasePatch(data,{dietPhase:{...edit,startDateKey:"2026-10-10"}},now);
  expect(phaseDateKey(patch.dietPhaseHistory[1].startedAt.toDate())).toBe("2026-10-05");
  expect(phaseDateKey(patch.dietPhaseStartedAt.toDate())).toBe("2026-10-10");
  expect(patch.dietPhaseHistory[0].note).toBe("preserve");
  expect(patch.dietPhaseHistory).toHaveLength(3);
  expect(phasePatch({...data,...patch},{dietPhase:{...edit,startDateKey:"2026-10-10"}},now)).toEqual({});
  expect(phaseDateKey(history[1].startedAt.toDate())).toBe("2026-10-16");
 });
 it("keeps current weeks and timestamps when only a past date is corrected", () => {
  const patch=phasePatch(data,{dietPhase:edit},now);
  expect(patch.dietPhaseStartedAt).toBeUndefined();
  expect(currentPhaseWeek({...data,...patch},"dietPhase",now.toMillis())).toBe(8);
 });
 it("rejects reordered, future, stale and current-entry history edits", () => {
  expect(()=>phasePatch(data,{dietPhase:{...edit,historyDates:[{index:0,startDateKey:"2026-10-20"}]}},now)).toThrow("history order");
  expect(()=>phasePatch(data,{dietPhase:{...edit,historyDates:[{index:1,startDateKey:"2027-01-01"}]}},now)).toThrow("before today");
  expect(()=>phasePatch(data,{dietPhase:{...edit,expectedHistory:"old"}},now)).toThrow("changed elsewhere");
  expect(()=>phasePatch(data,{dietPhase:{...edit,historyDates:[{index:2,startDateKey:"2026-10-20"}]}},now)).toThrow("Reopen phase history");
 });
});

describe("past phase removal", () => {
 const stamp=(key:string)=>Timestamp.fromDate(new Date(key+"T12:00:00"));
 const start=stamp("2026-10-22"),now=stamp("2026-11-10");
 const history=[{phase:"Bulk",startedAt:stamp("2026-09-01")},{phase:"Cut",startedAt:stamp("2026-10-16")},{phase:"Maintain",startedAt:start}];
 const data={dietPhase:"Maintain",dietPhaseStartedAt:start,dietPhaseHistory:history};
 const edit:PhaseEdit={mode:"edit",phase:"Maintain",name:"",week:null,expectedPhase:"Maintain",expectedStartMs:start.toMillis(),requestId:"remove",expectedHistory:phaseHistorySignature(history),removedHistoryIndices:[0,1]};
 it("removes only selected past entries without changing the current phase or source data",()=>{
  const patch=phasePatch(data,{dietPhase:edit},now);
  expect(patch.dietPhaseHistory).toEqual([history[2]]);
  expect(patch.dietPhaseStartedAt).toBeUndefined();
  expect(history).toHaveLength(3);
  expect(phasePatch({...data,...patch},{dietPhase:edit},now)).toEqual({});
 });
 it("keeps date-edit indices stable when other entries are removed",()=>{
  const patch=phasePatch(data,{dietPhase:{...edit,removedHistoryIndices:[0],historyDates:[{index:1,startDateKey:"2026-10-05"}],startDateKey:"2026-10-10"}},now);
  expect(patch.dietPhaseHistory).toHaveLength(2);
  expect(patch.dietPhaseHistory[0].phase).toBe("Cut");
  expect(phaseDateKey(patch.dietPhaseHistory[0].startedAt.toDate())).toBe("2026-10-05");
 });
 it("rejects removal of current, invalid and stale entries",()=>{
  for(const indices of [[2],[99],[0,0],[-1]])expect(()=>phasePatch(data,{dietPhase:{...edit,removedHistoryIndices:indices}},now)).toThrow("past phase");
  expect(()=>phasePatch(data,{dietPhase:{...edit,expectedHistory:"stale"}},now)).toThrow("changed elsewhere");
 });
});
