// Synthetic routine records have stable identities. Names are display text only.
export const programRoutines = [
  {id:'chest-barbell',name:'Chest + Triceps',exercises:['bench','fly','pushdown'],detail:'Bench press · Cable fly · Tricep pushdown'},
  {id:'anterior',name:'Anterior Legs',exercises:['squat','leg-press'],detail:'Barbell squat · Leg press'},
  {id:'back',name:'Back + Biceps',exercises:['row','dumbbell-curl'],detail:'Chest-supported row · Dumbbell curl'},
  {id:'shoulders',name:'Shoulders + Arms',exercises:['shoulder-press','dumbbell-curl'],detail:'Dumbbell shoulder press · Dumbbell curl'},
  {id:'posterior',name:'Posterior Legs',exercises:['romanian-deadlift','curl'],detail:'Romanian deadlift · Seated leg curl'},
  {id:'chest-dumbbell',name:'Chest + Triceps',exercises:['dumbbell-bench','pushdown'],detail:'Dumbbell bench press · Tricep pushdown'},
];
export const routineById = id => programRoutines.find(routine=>routine.id===id);
export const initialProgramDays = () => ['chest-barbell','anterior',null,'back','shoulders','posterior',null].map(routineId=>({routineId,title:routineById(routineId)?.name??'Rest',rest:!routineId,completed:false,skipped:false}));
export function dateLabel(u,index,extra=0) {
  const fixed=u.occurrenceDates?.[index];
  const date=new Date(`${fixed??u.dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+(fixed?0:index-u.today)+(index>=u.shiftFrom?u.shiftDays:0)+extra);
  return date.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
}
export function programWeek(u) {
  return Math.floor((Date.parse(u.dateKey+'T12:00:00Z')-Date.parse(u.programStartedAt+'T12:00:00Z'))/604800000)+1;
}
export function shiftPreview(u) {
  const from=u.preview;
  return Array.from({length:8},(_,offset)=>{
    const index=from+offset,day=index>=u.days.length?u.templateDays[index%u.days.length]:u.days[index];
    return {dayNumber:index%u.days.length+1,title:day.title,before:dateLabel(u,index),after:dateLabel(u,index,1)};
  });
}
