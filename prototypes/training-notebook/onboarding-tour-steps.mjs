const a = name => `[data-action="${name}"]`;
const step = (target,title,text,mode='click',extra={})=>({target,title,text,mode,...extra});
export const chapters = [
 {id:'workout',title:'Log a workout',url:'index.html#layout-minimal-today-newuser',steps:[
  step(a('we-single'),'Start a workout','Tap Start workout. You can log a session without a routine or program.'),
  step(a('search'),'Add your first exercise','Tap Add exercise to open the exercise picker.'),
  step('[data-action="toggle-exercise"][data-id="bench"]','Choose Bench press','Tap the checkbox beside Bench press. This is a practice example, not a recommended exercise.'),
  step(a('add-selected'),'Add the exercise','Tap Add to put your selected exercise into the workout.'),
  step('input[data-field="weight"]','Record the load','Enter a practice weight, such as 40 kg. Tap Continue here when you are ready.','input'),
  step('input[data-field="reps"]','Record your reps','Enter a practice rep count, such as 8, then Continue.','input'),
  step(a('done'),'Mark the set done','Tap the checkbox after recording your set. Effort can be recorded in the RPE column too.'),
  step('[data-action="open"][data-modal="finish"]','Finish your workout','Tap Finish workout to review what will be saved.'),
  step('[role="dialog"]','Review before saving','Check the recorded sets before saving to history. The feedback questions can wait. This practice does not save to your account.','read',{overlay:true,protect:['[role="dialog"] .sheet-head','[role="dialog"] .stats','[role="dialog"] .sheet-footer']})
 ]},
 {id:'routines',title:'Create and use routines',url:'index.html#layout-minimal-today-entry',steps:[
  step(a('we-single'),'Open the workout editor','Start a workout to access your routine tools.'),
  step('[data-action="open"][data-modal="create-routine"]','Create a reusable routine','Tap Create routine. A routine holds exercises and planned sets for another session.'),
  step('input[data-draft="routineName"]','Name your routine','Enter a name, such as Practice upper body, then Continue.','input'),
  step(a('build-routine'),'Build the routine','Tap Start building to add exercises and planned sets.'),
  step(a('search'),'Choose exercises','Open Add exercise. The same picker is used for workouts and routines.'),
  step('[data-action="toggle-exercise"][data-id="bench"]','Select an exercise','Tap the checkbox beside Bench press.'),
  step(a('add-selected'),'Add it to the routine','Tap Add to include the exercise.'),
  step('[data-action="save"]','Save the routine','Add exercise remains available for a longer routine. Tap Save routine once to keep this template.','click',{delay:750,reveal:[a('search')]}),
  step('[role="dialog"]','Routine saved','Your practice routine has been saved in this example. Next, see how to choose a saved routine.','read'),
  step('[data-action="open"][data-modal="routines"]','Use a saved routine','Tap My routines to choose a plan for an empty workout.','click',{route:'index.html#layout-minimal-today-entry',prepare:[a('we-single')]}),
  step('[data-action="up-preview-routine"][data-routine-id="chest-barbell"]','Choose a saved routine','Tap Chest + Triceps to preview its exercises and planned sets.'),
  step(a('up-load'),'Load the routine','Tap Load workout to put the routine’s exercises into this workout.'),
  step('.exercise-heading','Routine loaded','Chest + Triceps is loaded. Review the planned sets, then scroll to the other exercises. Logging a workout does not change the template automatically.','read',{scrollBlock:'start'})
 ]},
 {id:'programs',title:'Build a program',url:'index.html#layout-minimal-today-entry',steps:[
  step(a('we-create'),'Create a program','Tap Create program to arrange routines and rest days.'),
  step('input[data-we-name]','Give the program a name','Enter a name, such as Practice cycle, then Continue.','input'),
  step('select[data-we-length]','Use a short practice cycle','Choose 3 days for this practice. You will assign every day. You can use 7 days or a different cycle length in your own program.','input',{value:'3'}),
  step(a('we-assign'),'Assign Day 1','Tap Day 1 to choose a routine or a rest day.'),
  step('[data-action="we-pick"][data-routine-id="chest-barbell"]','Choose a routine','Select Chest + Triceps. The exercise list helps distinguish routines with the same name.'),
  step('[data-action="we-assign"][data-value="1"]','Plan a rest day','Tap Day 2 to assign a rest day.'),
  step('[data-action="we-pick"][data-routine-id="rest"]','Choose Rest day','Rest days are part of the schedule too.'),
  step('[data-action="we-assign"][data-value="2"]','Assign the last day','Tap Day 3. Every day needs a routine or Rest before starting.'),
  step('[data-action="we-pick"][data-routine-id="back"]','Choose Back + Biceps','Select Back + Biceps to complete the cycle.'),
  step(a('we-start'),'Start the complete program','All three days are assigned. Tap Start program. Save for later is available when you are not ready to start.'),
  step('[data-action="up-day"][data-value="0"]','Select a program day','Tap 1 in the day selector to inspect the pending workout you assigned.'),
  step(a('up-schedule-open'),'Open the schedule controls','Tap Change schedule to review the available ways to adjust a day.'),
  step('[role="dialog"]','Review schedule choices','Skip: leave this day unfinished and move on.\nMove: exchange it with a future rest day.\nSwap: exchange it with another future day.\nTomorrow: move this day and every following day forward one day.\nThis practice keeps the schedule unchanged.','read')
 ]},
 {id:'recovery',title:'Edit recovery inputs',url:'home.html',steps:[
  step('[data-action="open"][data-modal="check-in"]','Update your recovery','Tap Edit recovery check-in. You can also reach the same inputs through Today’s Plan.', 'click',{last:true}),
  step('input[data-rating="fatigue"]','Record how you feel','Adjust fatigue. Soreness and motivation are in this same check-in. Then Continue.','input'),
  step('input[data-draft="activity"]','Add daily context','You can report additional activity here. Pain areas have their own detail controls. Enter a practice note or continue without one.','input',{optional:true}),
  step(a('save-check-in'),'Save the check-in','Tap Save check-in. In the app, these inputs can inform the workout review.'),
  step('[data-action="open"][data-modal="check-in"]','You can edit it again','Your check-in is editable from Home. Next, try reviewing a planned workout.','read',{last:true})
 ]},
 {id:'plan',title:'Use Today’s Plan',url:'index.html#layout-minimal-today-planned',steps:[
  step(a('up-review'),'Review a planned workout','Tap Review workout. This section uses example history and recovery inputs so there is something to review.'),
  step(a('up-expand'),'Understand the suggestion','Tap an exercise to see why its prescription might change.'),
  step('[role="dialog"]','Read the explanation','Suggestions use the available context. A new user with little history may receive no progression suggestion.','read'),
  step(a('up-basis'),'Review the inputs','Tap Review context to see the information behind this example.', 'click',{route:'index.html#layout-minimal-today-planned',prepare:[a('up-review')]}),
  step('[role="dialog"]','Edit recovery from here','Review context includes Edit recovery check-in. In the app, it edits the same check-in you access on Home.','read'),
  step(a('up-apply'),'Choose what to apply','Review the selected exercise changes, then tap Apply selected changes. Recorded sets remain protected.','click',{route:'index.html#layout-minimal-today-planned',prepare:[a('up-review')]}),
  step('[data-action="up-review"], [data-action="up-update"]','You stay in control','Tap View changes to review the changes you applied. You can review again when relevant inputs change.'),
  step('[role="dialog"]','Review applied changes','The review stays available after applying. Your recorded sets remain protected.','read')
 ]},
 {id:'nutrition',title:'Log nutrition',url:'nutrition.html?practice=onboarding#empty',steps:[
  step(a('meal'),'Choose a meal','Tap a meal to start adding food.'),
  step('[data-action="view-food"][data-id="oats"]','Review a food','Tap the oatmeal result to review its quantity and nutrition. Search and barcode lookup are alternative ways to find food.'),
  step('input[data-quantity]','Change the amount','Enter a practice quantity. The nutrition preview changes with the amount.','input'),
  step(a('confirm-quantity'),'Confirm the amount','Tap Confirm amount to keep the chosen portion.'),
  step(a('add-staged'),'Add to your meal','Tap Add to log the selected food in the example meal.'),
  step('[data-action="back"]','Return to your diary','Your practice food is now in the meal. Tap Back to see the daily diary.'),
  step('[data-action="expand-meal"][data-index="0"]','Review your diary','Tap the item count or caret under Breakfast to show its food. P, C and F show the meal’s protein, carbohydrate and fat totals.'),
  step('.meal-content','Review the logged food','Breakfast now shows the food you logged and its P/C/F totals. Tap the meal name when you want to edit its contents.','read')
 ]},
 {id:'sleep',title:'Record sleep',url:'sleep.html#empty',steps:[
  step(a('entry'),'Add a sleep session','Tap Add sleep session. Manual logging works without a health connection.'),
  step('input[data-sleep-time="bedtime"]','Set your sleep time','Drag B on the clock or type a bedtime, such as 23:00. Check the dates when sleep crosses midnight.','input'),
  step('input[data-sleep-time="wakeTime"]','Set your wake time','Drag W on the clock or type a wake time, such as 07:00, then Continue.','input'),
  step(a('save'),'Save the session','Tap Save session to add the practice night.'),
  step(a('history'),'Find your history','Tap View records to see recorded nights and their sources.'),
  step('[data-action="record"]','Review recorded nights','Tap the recorded night to select its day. Missing nights are gaps, not zero hours of sleep.'),
  step('[data-action="session"]','Open the sleep entry','Tap the sleep session to review its saved details.'),
  step('[role="dialog"]','Review the saved night','Here you can review the saved sleep entry. Corrections to imported records do not change the source health service.','read')
 ]},
 {id:'health',title:'Optional Health Connect',url:'profile.html#activity-connect',steps:[
  step('#health-sync h3','Connect when you choose','Profile contains optional health sync for supported sleep, body measurements and daily steps. Records depend on the source app and permissions.','read'),
  step('[data-action="open"][data-modal="consent"], [data-action="activity-connect"]','Review access first','Tap Connect to read what is accessed. This is a simulated disclosure; no Android permission is requested.'),
  step('[role="dialog"]','Your data, your choice','In the app, read the disclosure and choose which permissions to grant. You can keep using Lastrep without connecting. This tour does not enable health access.','read')
 ]}
];
