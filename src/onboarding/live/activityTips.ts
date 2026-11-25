/** Session-only acknowledgements, scoped to the record's date and meal. */
export const foodAddedEvent = (date: string, section: string) => `food-added:${JSON.stringify([date, section])}`;
export const sleepSavedEvent = (date: string) => `sleep-saved:${date}`;

export function mealGuideTip(date: string, section: string, hasFood: boolean, events: readonly string[]) {
  const added = hasFood && events.includes(foodAddedEvent(date, section));
  return {
    id: `nutrition-meal:${JSON.stringify([date, section])}:${added ? "added" : hasFood ? "recorded" : "empty"}`,
    title: added ? "Food added" : hasFood ? "Review your meal" : "Add to this meal",
    text: hasFood
      ? "Tap a food to change its portion, or Add items to log more. Go back to Nutrition to see your daily totals, or use the guide bar to choose another topic."
      : "Tap Add items to choose food for this meal, then set its portion and add it.",
  };
}

export function sleepGuideTip(date: string, hasRecord: boolean, events: readonly string[]) {
  const saved = hasRecord && events.includes(sleepSavedEvent(date));
  return {
    id: `sleep-overview:${date}:${saved ? "saved" : hasRecord ? "recorded" : "empty"}`,
    title: saved ? "Sleep saved" : hasRecord ? "Review your sleep" : "Record sleep and see your trends",
    text: hasRecord
      ? "View your sleep duration in the chart below. Use View records to review or edit sessions, or the guide bar to explore another topic."
      : "Tap Record sleep to add your sleep times. You can also import sleep through Health sync in Profile.",
  };
}
