export function workoutDraft(workout) {
  return { date: workout.date, hours: workout.durationMin == null ? '' : String(Math.floor(workout.durationMin / 60)).padStart(2, '0'), minutes: workout.durationMin == null ? '' : String(workout.durationMin % 60).padStart(2, '0') };
}

export function workoutDetails(draft, today) {
  const date = new Date(`${draft.date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(date.getTime()) ||
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` !== draft.date) throw new Error('Choose a valid workout date.');
  if (draft.date > today) throw new Error('Choose today or an earlier date for a completed workout.');
  if (draft.hours === '' && draft.minutes === '') return { date: draft.date, durationMin: null };
  if (![draft.hours, draft.minutes].every(value => value === '' || /^\d{1,2}$/.test(value)) || Number(draft.minutes) > 59) throw new Error('Use whole hours from 0 to 99 and minutes from 0 to 59.');
  return { date: draft.date, durationMin: Number(draft.hours || 0) * 60 + Number(draft.minutes || 0) };
}
