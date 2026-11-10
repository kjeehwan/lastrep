import {describe,it,expect} from "vitest";
import {copySetPrescription,duplicateSetPrescription} from "./copySetPrescription";
import {exerciseDisplayUnit,resolveExerciseMode} from "./exercisePresentation";
const current = {weightKg:80,reps:"6",rpe:"",targetRpe:8,done:false,setType:"drop" as const};
describe("set prescriptions and cardio presentation",()=>{
 it("copies the last load/reps without copying historical effort, preserving current recorded effort",()=>{
  const previous={weightKg:90,reps:"8",rpe:"10"};
  expect(copySetPrescription(current,previous,"resistance")).toMatchObject({weightKg:90,reps:"8",rpe:"",targetRpe:8,setType:"drop"});
  const effortInput={scale:"rir" as const,value:"2",canonicalRpe:"8"};
  expect(copySetPrescription({...current,rpe:"8",effortInput},previous,"resistance")).toMatchObject({rpe:"8",effortInput});
 });
 it("duplicates the prescription with blank actual effort and completion",()=>{
  expect(duplicateSetPrescription({...current,rpe:"10",done:true,effortInput:{scale:"rpe",value:"10",canonicalRpe:"10"}})).toMatchObject({weightKg:80,reps:"6",targetRpe:8,rpe:"",effortInput:undefined,done:false,setType:"normal"});
 });
 it("copies cardio duration/distance without resistance data or historical effort",()=>{
  expect(copySetPrescription(current,{weightKg:90,reps:"6",rpe:"9",distanceKm:5,durationSec:1800,zone:"2"},"cardio")).toMatchObject({weightKg:null,reps:"",rpe:"",distanceKm:5,durationSec:1800,zone:"2"});
 });
 it("repairs legacy cardio defaults while keeping custom cardio and valid unit overrides",()=>{
  expect(resolveExerciseMode("resistance","cardio")).toBe("cardio");
  expect(resolveExerciseMode("cardio","custom")).toBe("cardio");
  expect(resolveExerciseMode(undefined,"chest")).toBe("resistance");
  expect(exerciseDisplayUnit("cardio","kg","mi")).toBe("mi");
  expect(exerciseDisplayUnit("cardio","mi","km")).toBe("mi");
  expect(exerciseDisplayUnit("resistance","km","mi")).toBe("kg");
 });
});
