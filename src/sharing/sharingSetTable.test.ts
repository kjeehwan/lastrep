import { describe, expect, it } from "vitest";
import { sharingSetTable, sharingWorkoutTotals } from "./sharingSetTable";
import type { SharedWorkoutExercise } from "./sharingContract";
const base = (): SharedWorkoutExercise => ({name:"Bench",mode:"resistance",unit:"kg",restSec:120,tempo:"",instructions:"",targets:{minReps:6,maxReps:8,targetRpe:8},sets:[{setType:"normal",weightKg:80,reps:"8",targetRpe:8,durationSec:null,distanceKm:null}]});
describe("shared set tables", () => {
  it("keeps identical sets separate and suppresses repeated exercise effort", () => {
    const exercise=base();exercise.sets.push({...exercise.sets[0]});
    const table=sharingSetTable(exercise,"rpe");
    expect(table.rows.map(row=>row.marker)).toEqual(["1","2"]);
    expect(table.showEffort).toBe(false);
  });
  it("uses workout markers and group targets without borrowing effort for warm-ups",()=>{
    const exercise=base();exercise.groupTargets={backoff:{minReps:8,maxReps:10,targetRpe:7}};
    exercise.sets=[{...exercise.sets[0],setType:"warmup",targetRpe:null},{...exercise.sets[0],setType:"top"},{...exercise.sets[0],setType:"backoff",targetRpe:7},{...exercise.sets[0],setType:"drop",targetRpe:null},{...exercise.sets[0],setType:"failure",targetRpe:null}];
    const table=sharingSetTable(exercise,"rpe");expect(table.rows.map(row=>row.marker)).toEqual(["W","T","B","D","F"]);expect(table.showEffort).toBe(false);
    exercise.sets[2].targetRpe=9;
    const changed=sharingSetTable(exercise,"rir");expect(changed.showEffort).toBe(true);expect(changed.rows.map(row=>row.effort)).toEqual(["\u2014","2","1","\u2014","\u2014"]);
  });
  it("converts preferred units without changing the snapshot and preserves hidden loads",()=>{
    const exercise=base(),before=structuredClone(exercise);
    expect(sharingSetTable(exercise,"rpe",{weightUnit:"lbs",distanceUnit:"mi"})).toMatchObject({unit:"lbs",rows:[{load:"176.37"}]});
    expect(exercise).toEqual(before);exercise.sets[0].weightKg=null;
    expect(sharingSetTable(exercise,"rpe").rows[0].load).toBe("\u2014");
  });
  it("formats cardio duration and canonical distance including zero and missing values",()=>{
    const exercise=base();exercise.mode="cardio";exercise.unit="km";exercise.targets=null;exercise.sets=[{...exercise.sets[0],targetRpe:null,durationSec:90,distanceKm:1.60934}];
    expect(sharingSetTable(exercise,"rpe",{weightUnit:"kg",distanceUnit:"mi"})).toMatchObject({unit:"mi",rows:[{duration:"1:30",distance:"1"}]});
    exercise.sets[0].durationSec=0;exercise.sets[0].distanceKm=null;
    expect(sharingSetTable(exercise,"rpe").rows[0]).toMatchObject({duration:"0:00",distance:"\u2014"});
  });
});

describe("shared workout totals", () => {
  it("counts working sets and canonical load times reps without warm-ups or cardio", () => {
    const exercise=base();exercise.sets.unshift({...exercise.sets[0],setType:"warmup",weightKg:20});
    exercise.sets.push({...exercise.sets[1],setType:"drop",weightKg:40,reps:"10"});
    const cardio={...base(),mode:"cardio" as const,unit:"km" as const};
    const plan={version:1 as const,title:"QA",effortScale:"rpe" as const,exercises:[exercise,cardio]};
    const before=structuredClone(plan);
    expect(sharingWorkoutTotals(plan)).toEqual({workingSets:2,weightUnit:"kg",missingWeights:false,volume:1040});
    expect(sharingWorkoutTotals(plan,{weightUnit:"lbs",distanceUnit:"mi"}).volume).toBeCloseTo(2292.8075,3);
    expect(plan).toEqual(before);
  });
  it("does not present a partial total when any working load is absent",()=>{
    const exercise=base();exercise.sets.push({...exercise.sets[0],weightKg:null});
    expect(sharingWorkoutTotals({version:1,title:"QA",effortScale:"rpe",exercises:[exercise]})).toMatchObject({workingSets:2,missingWeights:true,volume:null});
  });
  it("distinguishes an explicit zero load from missing weights and ignores absent warm-up loads",()=>{
    const exercise=base();exercise.sets[0].weightKg=0;exercise.sets.unshift({...exercise.sets[0],setType:"warmup",weightKg:null});
    expect(sharingWorkoutTotals({version:1,title:"QA",effortScale:"rpe",exercises:[exercise]})).toMatchObject({workingSets:1,missingWeights:false,volume:0});
    exercise.mode="cardio";exercise.unit="km";
    expect(sharingWorkoutTotals({version:1,title:"QA",effortScale:"rpe",exercises:[exercise]})).toMatchObject({workingSets:0,volume:null});
  });
});
