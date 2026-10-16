// Design-only context, shared between the two pages in this browser tab.
// No account data or network access. Reset example clears it.
const KEY = 'lastrep-notebook-check-in-2026-10-15';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function readCheckIn() {
  try { const value = JSON.parse(sessionStorage.getItem(KEY)); return value?.ratings && typeof value.pain === 'string' ? value : null; } catch { return null; }
}
export function writeCheckIn(value) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ratings: value.ratings, pain: value.pain ?? 'None', activity: value.activity ?? '', note: value.note ?? '' })); } catch { /* Storage can be disabled in a private browser. */ }
}
export function clearCheckIn() { try { sessionStorage.removeItem(KEY); } catch { /* No stored design state to clear. */ } }
export function checkInFields(value) {
  return `${['soreness', 'fatigue', 'motivation'].map(key => `<label class="field"><span class="rating-label"><span>${key[0].toUpperCase() + key.slice(1)}</span><output id="rating-${key}">${value.ratings[key] === '' ? 'Not recorded' : `${value.ratings[key]}/10`}</output></span><input type="range" min="0" max="10" step="1" data-rating="${key}" value="${value.ratings[key] === '' ? 5 : value.ratings[key]}" aria-label="${key}" aria-valuetext="${value.ratings[key] === '' ? 'Not recorded; move slider to set' : `${value.ratings[key]} out of 10`}"></label>`).join('')}<h3>Pain or discomfort</h3><div class="chip-grid">${['None', 'Neck', 'Shoulder', 'Elbow', 'Wrist / hand', 'Upper back', 'Lower back', 'Hip / groin', 'Knee', 'Ankle / foot', 'Other'].map(area => `<button class="chip ${value.pain === area ? 'selected' : ''}" data-action="pain" data-value="${area}" aria-pressed="${value.pain === area}">${area}</button>`).join('')}</div><label class="field"><span>Additional activity</span><input data-draft="activity" value="${esc(value.activity)}" placeholder="e.g. Travel, hiking, physical work"></label><label class="field"><span>Daily note</span><input data-draft="dailyNote" value="${esc(value.note)}" placeholder="Anything relevant to today"></label><p class="mock-disclaimer">Optional synthetic context. Saved check-ins are shared with Home and Workout in this browser tab only. No information is sent to a service.</p>`;
}
