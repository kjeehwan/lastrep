import {describe,it,expect} from "vitest";
import {planContextRevision} from "./planContextRevision";
describe("review context revision",()=>{
 it("ignores advice writes and map key order",()=>{
  expect(planContextRevision({recoveryCheckIn:{ratings:{fatigue:4,soreness:2}},usage:{decisions:{lastResult:"new"}}})).toBe(planContextRevision({recoveryCheckIn:{ratings:{soreness:2,fatigue:4}}}));
 });
 it("invalidates advice after recovery, targets-related settings or phase changes",()=>{
  const base={trainingPhase:"Strength",recoveryCheckIn:{dateKey:"2026-11-02",ratings:{fatigue:4}}};
  expect(planContextRevision({...base,trainingPhase:"Power"})).not.toBe(planContextRevision(base));
  expect(planContextRevision({...base,recoveryCheckIn:{dateKey:"2026-11-02",ratings:{fatigue:8}}})).not.toBe(planContextRevision(base));
  expect(planContextRevision({...base,progressionPreferences:{bench:{maxIncreaseKg:5}}})).not.toBe(planContextRevision(base));
 });
});
