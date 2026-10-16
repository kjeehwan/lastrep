export const ACCOUNT_DAY = '2026-10-15';
export const restoreMessages = {
  loading: 'Checking purchases...',
  restored: 'Purchases restored. Premium is active.',
  notFound: "No active subscription found. Make sure you're using the Google Play account you subscribed with.",
  unconfirmed: "An active subscription was found, but Lastrep hasn't confirmed Premium access yet. Please try again shortly.",
  failed: "Couldn't restore purchases. Check your connection and try again.",
};
export const profileStates = [
  ['overview', 'Profile / saved preferences', 'Identity, training and personal targets, without a wall of inputs.'],
  ['identity', 'Edit identity', 'Photo, nickname and description stay staged until Save changes.'],
  ['photo', 'Photo actions', 'Illustrative avatar selection only; no camera or cloud upload.'],
  ['photo-pending', 'Photo / unsaved example', 'Discard restores the previous profile image.'],
  ['training', 'Training phase', 'Changing phase starts week 1 only when saved.'],
  ['diet', 'Diet phase', 'Uses the same saved phase as Home; selecting it again does not reset the week.'],
  ['availability', 'Training availability', 'Choose one to seven days a week.'],
  ['units', 'Units and effort', 'RPE/RIR is one preference across resistance exercises.'],
  ['body', 'Body data / edit', 'Canonical kg values prevent repeated unit changes from altering recorded weight.'],
  ['body-empty', 'Body data / empty', 'Missing data is not zero.'],
  ['tdee', 'TDEE calculator', 'Existing estimate and calorie offsets; not a new diet prescription.'],
  ['tdee-empty', 'TDEE / incomplete', 'No estimate or active Apply button when required data is absent.'],
  ['nutrition', 'Nutrition targets', 'Calorie targets by phase, plus the separate protein target.'],
  ['sleep', 'Sleep target', 'Same saved preference as the Sleep study, staged until Save changes.'],
  ['health', 'Health sync / connected', 'Consent, permissions, saved records and last sync are separate.'],
  ['disconnected', 'Health sync / disconnected', 'Saved account timestamps remain visible without claiming a current connection.'],
  ['consent', 'Health sync / consent', 'Disclosure before the separately simulated device-permission step.'],
  ['permissions', 'Health sync / permission review', 'Granting permissions alone does not silently accept app consent.'],
  ['partial', 'Health sync / partial access', 'Sleep can be ready while body composition is not permitted.'],
  ['revoked', 'Health sync / permissions removed', 'App consent alone does not make health sync Connected.'],
  ['unavailable', 'Health sync / setup required', 'Supported-provider setup steps, with manual data still usable.'],
  ['disconnect', 'Disconnect health sync', 'Stop future reads in Lastrep; source permissions are managed separately.'],
  ['dirty', 'Unsaved changes', 'Navigation offers Save, Discard and Keep editing only after actual edits.'],
  ['validation', 'Validation / retained draft', 'Invalid input never silently updates saved preferences.'],
  ['save-error', 'Save failed', 'The draft survives failure and can be retried.'],
  ['offline', 'Offline / saved profile', 'Saved values remain; no claim that an offline save reached the server.'],
  ['loading', 'Loading profile', 'Neutral placeholders, not empty/default values presented as saved.'],
  ['dark', 'Dark paper', 'Charcoal ledger and the same action hierarchy.'],
  ['large', '200% text', 'Reflow control rows and keep dialog actions accessible.'],
];
export const settingsStates = [
  ['overview', 'Settings / Premium', 'Account, support, legal and subscription actions.'],
  ['free', 'Settings / free access', 'Upgrade is separate from restoring an existing purchase.'],
  ['grant', 'Premium grant / no paid subscription', 'Premium access is not proof of a Google Play subscription.'],
  ['dev', 'Development build', 'Billing unavailable; no purchase or restore request.'],
  ['checking', 'Checking subscription', 'Do not briefly show free while access is loading.'],
  ['restoring', 'Restore / checking', 'One in-flight request; the button is disabled.'],
  ['restored', 'Restore / Premium confirmed', 'The verified success message from the native app.'],
  ['notFound', 'Restore / no active subscription', 'No false account-verification promise or lost manual Premium grant.'],
  ['unconfirmed', 'Restore / purchase not confirmed', 'Clearly distinguish a found subscription from confirmed app access.'],
  ['failed', 'Restore / network or billing failure', 'Keep access unchanged and offer retry.'],
  ['manage', 'Manage subscription', 'Explicit Google Play destination preview; no live store access.'],
  ['upgrade', 'Premium options / prices unavailable', 'Do not invent localized prices or enable a fake purchase.'],
  ['support', 'Report a problem', 'One support address and no automatic sending of private data.'],
  ['privacy', 'Privacy policy', 'Open the published policy only on an explicit link tap.'],
  ['logout', 'Log out confirmation', 'Confirmation and a clearly labeled simulated result.'],
  ['delete', 'Account deletion confirmation', 'Permanent data deletion and subscription cancellation are distinct.'],
  ['delete-error', 'Account deletion failed', 'Account remains available; no false success.'],
  ['offline', 'Offline / Settings', 'Support details remain visible; store/account operations require connection.'],
  ['dark', 'Dark paper', 'The same rows and restrained destructive actions.'],
  ['large', '200% text', 'Readable account rows, subscription messages and stacked actions.'],
];
export function defaultProfile() {
  return { name: 'Daniel', description: 'Training for steady progress, one session at a time.', photo: false,
    goal: 'Build muscle', availability: '4', training: { phase: 'Hypertrophy', since: '2026-10-01' }, diet: { phase: 'Bulk', since: '2026-10-08' },
    phaseHistory: { training: [{ phase: 'Strength', since: '2026-09-01' }, { phase: 'Hypertrophy', since: '2026-10-01' }], diet: [{ phase: 'Maintain', since: '2026-09-01' }, { phase: 'Bulk', since: '2026-10-08' }] },
    units: { weight: 'kg', height: 'cm', energy: 'kcal', effort: 'RPE' },
    body: { weight: '80.15', bodyFat: '18.5', skeletal: '35.5', lean: '', date: '2026-10-15' },
    tdee: { age: '31', height: '178', sex: 'male', activity: 'moderate' },
    calories: { Cut: '2200', Maintain: '2600', Bulk: '2900' }, protein: '170', sleepTarget: '7',
    mealPreset: 'named', mealLabels: ['Breakfast', 'Lunch', 'Dinner', 'Snack 1', 'Snack 2', 'Snack 3'] };
}
export function accountFixture(page, id = 'overview', shared = null) {
  const saved = { ...defaultProfile(), ...(shared ?? {}) };
  saved.sleepTarget = String(saved.sleepTarget);
  const s = { page, id, saved: structuredClone(saved), draft: structuredClone(saved), modal: '', error: '', notice: '', leaveTo: './home.html', loading: id === 'loading', offline: id === 'offline',
    access: !['free', 'unconfirmed'].includes(id), paid: !['free', 'grant', 'notFound', 'unconfirmed', 'dev'].includes(id), dev: id === 'dev', checking: id === 'checking', restoring: id === 'restoring', feedback: '',
    health: { consent: true, sleep: true, body: true, available: true, lastSleepSync: 'Oct 15, 08:12', lastBodySync: 'Oct 15, 08:15', savedSleep: 'Oct 15, 2026', savedBody: 'Oct 15, 2026' }, syncBusy: false, failSave: id === 'save-error' };
  if (page === 'settings') {
    if (restoreMessages[id]) s.feedback = restoreMessages[id];
    if (id === 'restoring') s.feedback = restoreMessages.loading;
    if (['manage', 'upgrade', 'support', 'privacy', 'logout', 'delete', 'delete-error'].includes(id)) s.modal = id;
    return s;
  }
  if (['identity', 'photo', 'training', 'diet', 'availability', 'units', 'body', 'tdee', 'nutrition', 'sleep', 'consent', 'permissions', 'disconnect'].includes(id)) s.modal = id;
  if (id === 'photo-pending') s.draft.photo = true;
  if (['disconnected', 'consent'].includes(id)) s.health.consent = false;
  if (id === 'partial') s.health.body = false;
  if (id === 'revoked') { s.health.sleep = false; s.health.body = false; }
  if (id === 'unavailable') s.health.available = false;
  if (id === 'body-empty' || id === 'tdee-empty') { s.saved.body = { weight: '', bodyFat: '', skeletal: '', lean: '', date: null }; s.draft.body = structuredClone(s.saved.body); }
  if (id === 'tdee-empty') s.modal = 'tdee';
  if (['dirty', 'validation', 'save-error'].includes(id)) s.draft.name = 'Daniel, updated';
  if (id === 'dirty') s.modal = 'unsaved';
  if (id === 'validation') { s.modal = 'sleep'; s.draft.sleepTarget = '0'; s.error = 'Sleep target must be more than 0 and no more than 24 hours.'; }
  if (id === 'save-error') s.error = 'Could not save. Your changes are kept. Try again.';
  return s;
}
export const isDirty = s => JSON.stringify(s.saved) !== JSON.stringify(s.draft);
export function phaseWeek(since) { return since ? Math.max(1, Math.floor((Date.parse(ACCOUNT_DAY) - Date.parse(since)) / 604800000) + 1) : null; }
export function healthStatus(h) { return !h.available ? 'Unavailable on this device' : !h.consent ? 'Not connected' : !h.sleep && !h.body ? 'Permission needed' : 'Connected'; }
export function validateProfile(d) {
  if (!d.name.trim() || d.name.length > 40) throw Error('Use a nickname between 1 and 40 characters.');
  if (d.description.length > 240) throw Error('Keep the description within 240 characters.');
  if (!Number.isFinite(Number(d.sleepTarget)) || Number(d.sleepTarget) <= 0 || Number(d.sleepTarget) > 24 || Math.round(Number(d.sleepTarget) * 10) === 0) throw Error('Sleep target must be more than 0 and no more than 24 hours.');
  for (const value of Object.values(d.calories)) if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) <= 0) throw Error('Enter a positive calorie target for every diet phase.');
  if (d.protein.trim() && (!Number.isFinite(Number(d.protein)) || Number(d.protein) <= 0)) throw Error('Protein target must be positive or blank.');
  if (d.mealLabels.some(label => !label.trim() || label.length > 24) || new Set(d.mealLabels.map(label => label.trim().toLowerCase())).size !== 6) throw Error('Use six distinct meal names, each between 1 and 24 characters.');
  for (const [key, value] of Object.entries(d.body)) if (!['date'].includes(key) && value !== '' && (!Number.isFinite(Number(value)) || Number(value) <= 0 || key === 'bodyFat' && Number(value) > 100)) throw Error('Body values must be positive; body fat cannot exceed 100%.');
}
export function commitProfile(s) {
  validateProfile(s.draft);
  const next = structuredClone(s.draft);
  for (const kind of ['training', 'diet']) {
    if (next[kind].phase !== s.saved[kind].phase) { next[kind].since = ACCOUNT_DAY; next.phaseHistory[kind].push({ ...next[kind] }); }
    else next[kind].since = s.saved[kind].since;
  }
  next.sleepTarget = String(Math.round(Number(next.sleepTarget) * 10) / 10);
  s.saved = next; s.draft = structuredClone(next); return next;
}
export function tdeeEstimate(d) {
  const age = Number(d.tdee.age), height = Number(d.tdee.height), weight = Number(d.body.weight), activity = { sedentary: 1.2, light: 1.375, moderate: 1.55, 'very-active': 1.725 }[d.tdee.activity];
  if (!d.body.weight || !d.tdee.age || !d.tdee.height || !Number.isFinite(age) || age < 13 || age > 100 || !Number.isFinite(height) || height < 100 || height > 250 || !Number.isFinite(weight) || weight <= 0 || !activity) return null;
  return Math.round((10 * weight + 6.25 * height - 5 * age + (d.tdee.sex === 'male' ? 5 : -161)) * activity);
}
export function applyTdee(d) { const estimate = tdeeEstimate(d); if (estimate == null) throw Error('Enter age, height and body weight first.'); d.calories = { Cut: String(Math.max(0, estimate - 400)), Maintain: String(estimate), Bulk: String(estimate + 300) }; }
