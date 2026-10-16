import './input-behavior.mjs';
import { demoAvatar } from './notebook-avatar.mjs';
import { accountFixture, profileStates, settingsStates, isDirty, phaseWeek, healthStatus, commitProfile, tdeeEstimate, applyTdee, restoreMessages } from './account-model.mjs';
import { readNotebookPreferences, writeNotebookPreferences, clearNotebookPreferences } from './notebook-preferences.mjs';
import { notebookIcon as icon } from './notebook-icons.mjs';
import { setReviewState } from './review-state-picker.mjs';

const $ = query => document.querySelector(query), page = document.body.dataset.study, states = page === 'profile' ? profileStates : settingsStates;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const p = (text, cls = 'supporting') => `<p class="${cls}">${text}</p>`;
const btn = (text, action, cls = 'text', attrs = '', disabled = false) => `<button class="btn ${cls}" data-action="${action}" ${attrs} ${disabled ? 'disabled' : ''}>${text}</button>`;
const unitValue = (kg, unit) => kg === '' ? 'Not recorded' : `${Number((Number(kg) * (unit === 'lbs' ? 2.2046226218 : 1)).toFixed(2))} ${unit}`;
const field = (label, key, value, placeholder = '', extra = '') => `<label class="field"><span>${label}</span><input data-field="${key}" value="${esc(value)}" placeholder="${placeholder}" ${extra}></label>`;
const section = (title, body, action = '', id = '') => `<section class="account-panel" ${id ? `id="${id}"` : ''}><div class="account-heading"><h3>${title}</h3>${action}</div>${body}</section>`;
const accessBadge = () => `<span class="account-badge" role="status">${s.checking ? 'Checking access' : s.access ? 'Premium' : 'Free'}</span>`;
function bodyRow(key, label, value, help = '') {
  return `<div class="account-body-summary"><div class="account-body-title"><button data-action="body-edit" data-key="${key}" aria-label="Edit ${label}">${label}</button>${help ? `<button class="account-help" data-action="open" data-modal="${help}" aria-label="About ${label}"><span>?</span></button>` : ''}</div><button class="account-body-value" data-action="body-edit" data-key="${key}" aria-label="Edit ${label} value"><span>${esc(value)}</span>${icon('right')}</button></div>`;
}
const row = (label, value, modal = '', hint = '') => `<${modal ? 'button' : 'div'} class="account-row" ${modal ? `data-action="open" data-modal="${modal}"` : ''}><span class="account-row-copy"><span>${label}</span>${hint ? `<small>${hint}</small>` : ''}</span><span class="account-row-end"><span class="account-row-value">${esc(value)}</span>${modal ? `<span class="account-chevron">${icon('right')}</span>` : ''}</span></${modal ? 'button' : 'div'}>`;
const linkRow = (label, symbol, action) => `<button class="account-link-row" data-action="${action}">${icon(symbol)}<span>${label}</span>${icon('right').replace('class="', 'class="trailing ')}</button>`;
const choiceLabel = value => ({ named: 'Named meals', numbered: 'Meals 1–6', custom: 'Custom names', male: 'Male', female: 'Female', sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate', 'very-active': 'Very active' })[value] ?? value;
const choices = (key, values) => values.map(value => `<button class="account-choice" data-action="choice" data-field="${key}" data-value="${value}" aria-pressed="${get(s.draft, key) === value}"><span>${esc(choiceLabel(value))}</span>${get(s.draft, key) === value ? icon('check') : ''}</button>`).join('');
let s, example = 'overview', size = [390, 844], dark = false, large = false, timer, toastTimer;
const get = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
const set = (obj, path, value) => { const keys = path.split('.'), key = keys.pop(); keys.reduce((value, key) => value[key], obj)[key] = value; };
const mutable = new Set(['identity', 'photo', 'training', 'diet', 'availability', 'units', 'body', 'tdee', 'nutrition', 'sleep']);
function choose(id, shared = false) {
  clearTimeout(timer); clearTimeout(toastTimer); example = id;
  const preferences = shared ? readNotebookPreferences() : null;
  s = accountFixture(page, id, preferences?.profile); if (preferences?.health && ['overview', 'health', 'identity', 'sleep', 'training', 'diet', 'meals'].includes(id)) s.health = preferences.health;
  s.modalBefore = structuredClone(s.saved); s.stack = []; s.permissionDraft = { sleep: s.health.sleep, body: s.health.body };
  if (s.modal === 'body') bodyInputs();
  dark = id === 'dark'; large = id === 'large'; $('#dark').checked = dark; $('#large').checked = large;
  setReviewState($('#example'), states.map(([id, title]) => [id, title]), id); render(false);
  if (['health', 'disconnected', 'partial', 'revoked', 'unavailable'].includes(id)) $('#health-sync')?.scrollIntoView({ block: 'start' });
}
function avatar(d, large = false) {
  return `<div class="account-avatar ${large ? 'large' : ''}" role="img" aria-label="${d.photo ? 'Illustrative demo avatar, not an uploaded photo' : esc(d.name[0] || 'Profile initial')}">${d.photo ? demoAvatar() : esc(d.name[0]?.toUpperCase() || 'D')}</div>`;
}
function phaseText(kind) {
  const value = s.draft[kind], saved = s.saved[kind], week = phaseWeek(saved.since);
  return `${value.phase} · ${value.phase !== saved.phase ? 'Week 1 when saved' : week ? 'Week ' + week : 'Start not recorded'}`;
}
function profilePage() {
  if (s.loading) return `<div role="status">${p('Loading saved profile…')}<div class="skeleton-block"></div><div class="skeleton-block"></div></div>`;
  const d = s.draft, estimate = tdeeEstimate(d);
  return `${s.offline ? notice('Offline. Showing saved preferences. Your edits will stay here until you can save online.') : ''}${isDirty(s) ? p('Unsaved changes', 'account-dirty') : ''}${s.error && !s.modal ? p(esc(s.error), 'account-error') : ''}${section('Identity', `<div class="account-identity">${avatar(d)}<div class="account-identity-copy"><strong class="account-name">${esc(d.name)}</strong>${p(esc(d.description))}${accessBadge()}</div></div>`, btn('Edit', 'open', 'text', 'data-modal="identity"'))}${section('Training', row('Training phase', phaseText('training'), 'training') + row('Diet phase', phaseText('diet'), 'diet') + row('Availability', `${d.availability} days / week`, 'availability'))}${section('Units', row('Exercise effort', d.units.effort, 'units') + row('Weight', d.units.weight, 'units') + row('Height', d.units.height, 'units') + row('Food energy', d.units.energy, 'units'))}${section('Body composition', bodyRow('weight', 'Weight', unitValue(d.body.weight, d.units.weight)) + bodyRow('bodyFat', 'Body fat', d.body.bodyFat ? d.body.bodyFat + '%' : 'Not recorded') + bodyRow('lean', 'Lean body mass', d.body.lean ? unitValue(d.body.lean, d.units.weight) : 'Not recorded', 'lean-help') + bodyRow('skeletal', 'Skeletal muscle', d.body.skeletal ? unitValue(d.body.skeletal, d.units.weight) : 'Not recorded', 'muscle-help') + p('Saved profile snapshot. Body history remains in the Home study.'), '', 'profile-body')}${section('TDEE calculator', estimate == null ? p('Enter age, height and weight to estimate maintenance.') : `<p class="account-estimate">${energy(estimate)} ${d.units.energy}<span class="supporting"> / day</span></p>${p('Estimated maintenance, not a measured calorie need.')}`, btn('Calculate', 'open', 'text', 'data-modal="tdee"'))}${section('Nutrition targets', ['Cut', 'Maintain', 'Bulk'].map(phase => row(phase, `${energy(Number(d.calories[phase]))} ${d.units.energy}`, 'nutrition')).join('') + row('Protein', d.protein ? `${d.protein} g / day` : 'Not set', 'nutrition'))}${section('Sleep target', row('Daily sleep', `${d.sleepTarget || '—'} hours`, 'sleep'))}${healthPanel()}`;
}
function healthPanel() {
  const h = s.health, connected = healthStatus(h) === 'Connected';
  const primary = !h.available ? btn('Set up Health Connect', 'open', '', 'data-modal="health-setup"') : !h.consent ? btn('Connect', 'open', 'primary', 'data-modal="consent"') : !h.sleep && !h.body ? btn('Review permissions', 'permissions') : btn(s.syncBusy ? 'Syncing…' : 'Sync now', 'sync', '', '', s.syncBusy || s.offline);
  return section('Health sync', row('Status', healthStatus(h)) + row('Supported data', 'Sleep, body composition') + row('Sleep', !h.consent ? 'Not connected' : !h.available ? 'Unavailable' : h.sleep ? 'Ready' : 'Not allowed') + row('Body composition', !h.consent ? 'Not connected' : !h.available ? 'Unavailable' : h.body ? 'Ready (partial)' : 'Not allowed', 'body-access') + row(connected ? 'Last sleep sync' : 'Saved sleep data', (connected ? h.lastSleepSync : h.savedSleep) ?? 'Not synced yet') + row(connected ? 'Last body sync' : 'Saved body data', (connected ? h.lastBodySync : h.savedBody) ?? 'Not synced yet') + `<div class="account-actions">${primary}${h.available ? btn('Manage permissions', 'permissions') : ''}${h.consent ? btn('Disconnect', 'open', 'text', 'data-modal="disconnect"') : ''}</div>`, '', 'health-sync');
}
function settingsPage() {
  const d = s.saved;
  return `${s.offline ? notice('Offline. Store and account operations need a connection. Saved details remain visible.') : ''}${section('Account', `<div class="account-link-row">${icon('profile')}<span class="account-row-copy"><span class="account-nickname"><strong>${esc(d.name)}</strong>${accessBadge()}</span><small>demo@example.test</small></span></div>`)}${section('Support', linkRow('Report a problem', 'mail', 'support') + '<div class="account-link-row account-version-row">' + icon('info') + '<span>App version</span><span>1.0.1</span></div>')}${section('Legal', linkRow('Privacy policy', 'document', 'privacy'))}${section('Subscription', s.checking ? p('Checking subscription status…') : `${s.dev ? p('Billing is unavailable in Lastrep Dev. Use the Play-installed app to test subscriptions.') : s.access && !s.paid ? p('Premium access does not necessarily mean you have a paid Google Play subscription.') : p(s.paid ? 'Your Google Play subscription is active.' : 'View Premium options or restore an existing subscription.')}<div class="account-actions">${s.dev ? '' : btn(s.paid || s.access ? 'Manage subscription' : 'Upgrade to Premium', s.paid || s.access ? 'manage' : 'upgrade', s.paid || s.access ? '' : 'primary', '', s.offline)}${s.dev ? '' : btn(s.restoring ? 'Checking purchases…' : 'Restore purchases', 'restore', '', '', s.restoring || s.offline)}</div>${s.feedback ? `<div class="account-notice" role="status">${p(esc(s.feedback))}</div>` : ''}`)}${section('Session', btn('Log out', 'open', '', 'data-modal="logout"', s.offline))}${section('Delete account', p('Permanently deletes your account and associated Lastrep data.') + `<div class="account-actions">${btn('Delete account', 'open', 'danger', 'data-modal="delete"', s.offline)}</div>`)}`;
}
function energy(kcal) { return Math.round(kcal * (s.draft.units.energy === 'kJ' ? 4.184 : 1)).toLocaleString('en-US'); }
function notice(text) { return `<div class="account-notice" role="status">${p(text)}</div>`; }
function dialog(title, body, footer = '') { return `<div class="overlay" data-action="outside"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title"><header class="sheet-head"><h2 id="account-dialog-title">${title}</h2><button class="icon-button close" data-action="close" aria-label="Close dialog">×</button></header><div class="sheet-body">${body}${s.error ? p(esc(s.error), 'account-error') : ''}</div>${footer ? `<footer class="sheet-footer">${footer}</footer>` : ''}</section></div>`; }
const done = () => btn('Done', 'done', 'primary') + btn('Cancel', 'close');
function bodyInputs() { s.bodyRaw = Object.fromEntries(['weight', 'bodyFat', 'lean', 'skeletal'].map(key => [key, s.draft.body[key] === '' ? '' : String(Number((Number(s.draft.body[key]) * (key !== 'bodyFat' && s.draft.units.weight === 'lbs' ? 2.2046226218 : 1)).toFixed(2)))])); }
function modal() {
  const d = s.draft, h = s.health;
  switch (s.modal) {
    case 'identity': return dialog('Profile identity', `<div class="account-photo-preview">${avatar(d)}${btn(d.photo ? 'Change photo' : 'Add photo', 'open', '', 'data-modal="photo"')}</div>${field('Nickname', 'name', d.name, 'Your nickname', 'maxlength="40"') }<label class="field"><span>Description</span><textarea data-field="description" maxlength="240" placeholder="A short description">${esc(d.description)}</textarea></label>${p('Visible profile text, not private recovery notes.')}`, done());
    case 'photo': return dialog('Profile photo', `${avatar(d)}${p('Prototype: use an illustrative avatar to review selection, saving and removal. No camera, photo library or upload is used.')}`, btn('Use example avatar', 'photo', 'primary', 'data-value="true"') + (d.photo ? btn('Remove photo', 'photo', 'danger', 'data-value="false"') : '') + btn('Cancel', 'close'));
    case 'training': case 'diet': return dialog(s.modal === 'training' ? 'Training phase' : 'Diet phase', choices(`${s.modal}.phase`, s.modal === 'training' ? ['Hypertrophy', 'Strength', 'Power'] : ['Cut', 'Maintain', 'Bulk']) + p('A different phase starts Week 1 when you save Profile. Selecting the current phase keeps its start date.'), done());
    case 'availability': return dialog('Training availability', `<label class="field"><span><output data-availability>${d.availability}</output> days / week</span><input type="range" min="1" max="7" step="1" data-field="availability" value="${d.availability}" aria-label="Training days per week"></label>`, done());
    case 'units': return dialog('Units and effort', `<h3>Exercise effort</h3>${choices('units.effort', ['RPE', 'RIR'])}${p('Applies to all resistance exercises. RPE 8 is approximately 2 RIR.')}<h3>Weight</h3>${choices('units.weight', ['kg', 'lbs'])}<h3>Height</h3>${choices('units.height', ['cm', 'ft/in'])}<h3>Food energy</h3>${choices('units.energy', ['kcal', 'kJ'])}`, done());
    case 'body': return dialog('Body composition data', `${p('Edit this illustrative profile snapshot. Changes remain staged until Save changes. The Home chart has its own measurement fixture.')}${[['weight', 'Weight'], ['bodyFat', 'Body fat'], ['lean', 'Lean body mass'], ['skeletal', 'Skeletal muscle']].map(([key, label]) => `<label class="account-body-row"><span>${label}</span><input data-body="${key}" inputmode="decimal" value="${esc(s.bodyRaw[key])}" placeholder="e.g. ${({ weight: '80.15', bodyFat: '18.5', lean: '65.3', skeletal: '35.5' })[key]}" aria-label="${label}"><small>${key === 'bodyFat' ? '%' : d.units.weight}</small></label>`).join('')}`, done());
    case 'lean-help': return dialog('Lean body mass', p('Body mass excluding fat, including muscles, organs, bone and water. It is not the same as skeletal muscle mass.'), btn('Done', 'close', 'primary'));
    case 'muscle-help': return dialog('Skeletal muscle mass', p('The mass of muscles attached to the skeleton. Keep this manual value separate from lean body mass imported from health data.'), btn('Done', 'close', 'primary'));
    case 'tdee': return dialog('TDEE calculator', `<div class="account-form-grid">${field('Age', 'tdee.age', d.tdee.age, 'e.g. 31', 'inputmode="numeric"')}${field('Height (cm)', 'tdee.height', d.tdee.height, 'e.g. 178', 'inputmode="decimal"')}</div>${p(`Weight from Body composition · ${unitValue(d.body.weight, d.units.weight)}`)}<h3>Sex used by the equation</h3>${choices('tdee.sex', ['male', 'female'])}<h3>Activity</h3>${choices('tdee.activity', ['sedentary', 'light', 'moderate', 'very-active'])}<p class="account-estimate" data-estimate>${estimateText()}</p>${p('Starting estimate. Applying sets Cut to maintenance −400 kcal and Bulk to maintenance +300 kcal, preserving your protein target.')}`, btn('Use for nutrition targets', 'apply-tdee', 'primary', '', tdeeEstimate(d) == null) + btn('Done', 'done') + btn('Cancel', 'close'));
    case 'nutrition': return dialog('Nutrition targets', p('Stored in kcal; displayed in your selected food-energy unit.') + ['Cut', 'Maintain', 'Bulk'].map(phase => `<label class="field"><span>${phase} (${d.units.energy})</span><input data-energy="${phase}" inputmode="decimal" value="${Math.round(Number(d.calories[phase]) * (d.units.energy === 'kJ' ? 4.184 : 1))}"></label>`).join('') + field('Protein (g/day)', 'protein', d.protein, 'e.g. 170', 'inputmode="decimal"'), done());
    case 'sleep': return dialog('Sleep target', field('Daily target in hours', 'sleepTarget', d.sleepTarget, 'e.g. 7.5', 'inputmode="decimal"') + p('Shares the same saved preference as the Sleep study. Save Profile to apply your change.'), done());
    case 'body-access': return dialog('Supported body data', p('This example has weight and body-fat data. Lean body mass is not available, so Body composition is Ready (partial). Availability is not a grant of permissions.'), btn('Done', 'close', 'primary'));
    case 'consent': return dialog('Connect health data', p('On supported Android devices, Lastrep can read permitted sleep, weight, body-fat and lean-body-mass records.') + p('Imported summaries are saved to your Lastrep account for sleep, recovery and body-composition trends. Relevant summaries may support AI-assisted recommendations; that feature has a separate disclosure before sending context to OpenAI.') + p('Connecting is optional. Disconnect in Lastrep to stop future reads, or revoke permissions in Health Connect. This browser flow only simulates consent and permissions.'), btn('Review permissions', 'consent-next', 'primary') + btn('Not now', 'close'));
    case 'permissions': return dialog('Health Connect permissions', p('Device-permission preview only. These controls do not change Android settings.') + [['sleep', 'Read sleep'], ['body', 'Read body composition']].map(([key, label]) => `<button class="account-choice" data-action="permission" data-key="${key}" aria-pressed="${s.permissionDraft[key]}"><span>${label}</span><span class="health-toggle ${s.permissionDraft[key] ? 'checked' : ''}">${s.permissionDraft[key] ? icon('check') : ''}</span></button>`).join(''), btn('Apply simulated access', 'apply-permissions', 'primary') + btn('Cancel', 'close'));
    case 'disconnect': return dialog('Disconnect health sync?', p('Stop future health reads in Lastrep. Your saved account data stays available.') + p('To also revoke device permissions, use Manage permissions. Disconnecting here does not delete records in Health Connect.'), btn('Disconnect in Lastrep', 'disconnect', 'primary') + btn('Cancel', 'close'));
    case 'health-setup': return dialog('Set up Health Connect', '<ol><li>Open Health Connect in Android settings. Install or update it if your supported device prompts you to.</li><li>Allow your sleep/body-data app to share supported records.</li><li>Return here to Connect and review permissions.</li></ol>' + p('If the device does not support Health Connect, manual entries remain available. No settings or store app is opened by this study.'), btn('Back', 'close', 'primary'));
    case 'unsaved': return dialog('Save your changes?', p('Your Profile edits have not been saved. Save before leaving, discard them, or keep editing.'), btn('Save and leave', 'save-leave', 'primary') + btn('Discard and leave', 'discard-leave', 'danger') + btn('Keep editing', 'close'));
    case 'manage': return dialog('Manage subscription', p('Opens Google Play. To cancel, tap Lastrep in the subscription list.') + p('Destination preview only. This study does not open billing or change your subscription.'), btn('Back to Settings', 'close', 'primary'));
    case 'upgrade': return dialog('Premium options', p('Prices are unavailable in this design study. No localized price, subscription offer or purchase is invented.') + p('The real app must load current Google Play products before enabling a purchase.'), btn('Purchase unavailable', 'close', 'primary', '', true) + btn('Back', 'close'));
    case 'support': return dialog('Report a problem', '<div class="account-readonly">lastrep.dev@gmail.com</div>' + p('Include your app version (shown in Settings > Support) and what happened. Do not send your password or private health information.') + '<a class="btn" href="mailto:lastrep.dev@gmail.com?subject=Lastrep%20support">Open email app</a>' + p('No message is composed or sent automatically.'), btn('Back', 'close', 'primary'));
    case 'privacy': return dialog('Privacy policy', p('Read the published Lastrep privacy policy in your browser.') + '<a class="btn primary" href="https://puddle-rabbit-c2c.notion.site/Lastrep-Privacy-Policy-33df486c73fa807eba7ec8e0b1aa1c10" target="_blank" rel="noopener noreferrer">Open privacy policy</a>', btn('Back', 'close'));
    case 'logout': return dialog('Log out?', p('You can sign back in to access your saved account data. This study will only simulate the result.'), btn('Log out', 'logout-confirm', 'primary') + btn('Stay signed in', 'close'));
    case 'logged-out': return dialog('Signed out / prototype', p('No real account was signed out. This is a preview of the signed-out destination.'), btn('Return to Settings study', 'close', 'primary'));
    case 'delete': return dialog('Delete your account?', p('This permanently deletes your Lastrep account and associated app data.') + p('It does not automatically cancel a Google Play subscription. Manage subscriptions in Google Play separately.') + p('Prototype: the action below simulates the result. No data is deleted.'), btn('Delete account', 'delete-confirm', 'danger') + btn('Keep account', 'close', 'primary'));
    case 'delete-error': return dialog('Could not delete account', p('Your account is still available. Check your connection and try again.'), btn('Try again', 'open', 'primary', 'data-modal="delete"') + btn('Keep account', 'close'));
    case 'deleted': return dialog('Account deleted / prototype', p('No real account or data was deleted. This is the simulated confirmation.'), btn('Return to Settings study', 'close', 'primary'));
    default: return '';
  }
}
function estimateText() { const value = tdeeEstimate(s.draft); return value == null ? 'Enter age, height and weight to calculate.' : `${energy(value)} ${s.draft.units.energy} / day`; }
function tabs() { return `<nav class="bottom-tabs" aria-label="App destinations">${[['Home', './home.html'], ['Workout', './'], ['Nutrition', './nutrition.html'], ['Sleep', './sleep.html'], ['Profile', './profile.html']].map(([name, href]) => `<a class="tab tab-link ${page === 'profile' && name === 'Profile' ? 'active' : ''}" data-action="navigate" data-href="${href}" href="${href}" ${page === 'profile' && name === 'Profile' ? 'aria-current="page"' : ''}>${icon(name.toLowerCase())}${name}</a>`).join('')}</nav>`; }
function render(preserve = true) {
  const active = document.activeElement, focus = preserve && active?.dataset.field ? { key: active.dataset.field, start: active.selectionStart, end: active.selectionEnd } : null;
  const y = $('.account-device .viewport')?.scrollTop ?? 0, dy = $('.account-device .sheet-body')?.scrollTop ?? 0;
  $('#state-title').textContent = states.find(row => row[0] === example)[1]; $('#state-description').textContent = states.find(row => row[0] === example)[2];
  $('#stage').innerHTML = `<div class="frame-wrap"><h3>${page === 'profile' ? 'Profile / Personal preferences' : 'Settings / Account controls'}</h3><section class="device account-device ${dark ? 'dark' : ''} ${large ? 'large-text' : ''}" style="--width:${size[0]}px;--height:${size[1]}px" aria-label="Interactive ${page} prototype"><div class="system-bar" aria-hidden="true"><span>9:41</span><span>LTE&nbsp;&nbsp;92%</span></div><header class="toolbar notebook-toolbar ${page === 'profile' ? 'has-header-action' : ''}"><div><button class="icon-button" data-action="navigate" data-href="./home.html" aria-label="Back to Home">${icon('left')}</button><h2 class="toolbar-title">${page === 'profile' ? 'Profile' : 'Settings'}</h2>${page === 'profile' ? btn('Save', 'save', 'primary toolbar-action', '', !isDirty(s) || s.loading) : '<span style="width:44px" aria-hidden="true"></span>'}</div></header><div class="viewport" tabindex="0" aria-label="Scrollable ${page}"><div class="page-content">${page === 'profile' ? profilePage() : settingsPage()}</div></div>${tabs()}${s.modal ? modal() : ''}${s.toast && !s.modal ? `<div class="toast" role="status"><span>${esc(s.toast)}</span><button class="icon-button" data-action="dismiss" aria-label="Dismiss notification">×</button></div>` : ''}</section><p class="frame-caption">${size.join(' × ')} / ${dark ? 'Dark' : 'Paper'} / ${large ? '200%' : '100%'} text. Synthetic data only.</p></div>`;
  $('.account-device .viewport').scrollTop = preserve ? y : 0; if ($('.sheet-body')) $('.sheet-body').scrollTop = preserve ? dy : 0;
  if (focus) { const input = $(`[data-field="${focus.key}"]`); input?.focus({ preventScroll: true }); if (input && focus.start != null && input.type !== 'range') input.setSelectionRange(focus.start, focus.end); }
  else if (s.modal) $('.sheet-head .close')?.focus({ preventScroll: true });
}
function open(name) { if (s.modal) s.stack.push({ modal: s.modal, before: s.modalBefore }); s.modalBefore = structuredClone(s.draft); s.modal = name; s.error = ''; if (name === 'body') bodyInputs(); if (name === 'permissions') s.permissionDraft = { sleep: s.health.sleep, body: s.health.body }; render(); if ($('.sheet-body')) $('.sheet-body').scrollTop = 0; }
function close(accept = false) { if (!accept && mutable.has(s.modal)) s.draft = structuredClone(s.modalBefore); if (s.modal === 'permissions') s.pendingConsent = false; const parent = s.stack.pop(); s.modal = parent?.modal ?? ''; s.modalBefore = parent?.before; s.error = ''; render(); }
function notify(text) { clearTimeout(toastTimer); s.toast = text; render(); toastTimer = setTimeout(() => { s.toast = ''; render(); }, 4000); }
function save(leave = false) {
  if (s.offline) { s.error = 'You’re offline. Your changes are kept; reconnect before saving.'; render(); return; }
  if (s.failSave) { s.failSave = false; s.error = 'Could not save. Your changes are kept. Try again.'; render(); return; }
  try { const profile = commitProfile(s), shared = writeNotebookPreferences({ profile }); s.error = ''; s.modal = ''; s.stack = []; if (leave) location.href = s.leaveTo; else notify(shared ? 'Profile saved in this browser tab.' : 'Saved in this page only. Browser storage is unavailable.'); } catch (error) { s.error = error.message; render(); }
}
function navigate(href) { if (page === 'profile' && isDirty(s)) { s.leaveTo = href; open('unsaved'); } else location.href = href; }
function publishHealth() { writeNotebookPreferences({ health: s.health }); }
$('#stage').addEventListener('click', event => {
  const el = event.target.closest('[data-action]'); if (!el || el.disabled) return; const d = el.dataset;
  if (d.action === 'navigate') { event.preventDefault(); navigate(d.href); return; }
  switch (d.action) {
    case 'outside': if (event.target === el) close(); return;
    case 'open': open(d.modal); return;
    case 'close': close(); return;
    case 'done': if (s.modal === 'sleep' && (!s.draft.sleepTarget.trim() || Number(s.draft.sleepTarget) <= 0 || Number(s.draft.sleepTarget) > 24 || !Number.isFinite(Number(s.draft.sleepTarget)))) { s.error = 'Enter more than 0 and no more than 24 hours.'; render(); return; } close(true); return;
    case 'choice': set(s.draft, d.field, d.value); render(); return;
    case 'body-edit': open('body'); { const input = $(`[data-body="${d.key}"]`); input?.focus({ preventScroll: true }); input?.scrollIntoView({ block: 'nearest' }); } return;
    case 'photo': s.draft.photo = d.value === 'true'; close(true); return;
    case 'apply-tdee': try { applyTdee(s.draft); close(true); notify('Estimate applied to staged targets. Review and Save Profile.'); } catch (error) { s.error = error.message; render(); } return;
    case 'save': save(); return;
    case 'save-leave': save(true); return;
    case 'discard-leave': s.draft = structuredClone(s.saved); location.href = s.leaveTo; return;
    case 'permissions': s.pendingConsent = false; open('permissions'); return;
    case 'consent-next': s.pendingConsent = true; s.permissionDraft = { sleep: s.health.sleep, body: s.health.body }; s.modal = 'permissions'; render(false); return;
    case 'permission': s.permissionDraft[d.key] = !s.permissionDraft[d.key]; render(); return;
    case 'apply-permissions': Object.assign(s.health, s.permissionDraft); if (s.pendingConsent) s.health.consent = true; s.pendingConsent = false; s.modal = ''; s.stack = []; publishHealth(); notify('Simulated access updated. Saved records are unchanged.'); return;
    case 'disconnect': s.health.consent = false; s.modal = ''; s.stack = []; publishHealth(); notify('Disconnected in this mock device. Saved data is kept.'); return;
    case 'sync': if (!s.health.consent || !s.health.sleep && !s.health.body || !s.health.available || s.syncBusy || s.offline) return; s.syncBusy = true; render(); { const current = s; timer = setTimeout(() => { if (s !== current) return; s.syncBusy = false; if (s.health.sleep) s.health.lastSleepSync = 'Oct 15, 18:30'; if (s.health.body) s.health.lastBodySync = 'Oct 15, 18:30'; publishHealth(); notify('Simulated sync complete. No external data was read.'); }, 600); } return;
    case 'restore': if (s.dev || s.offline || s.restoring) return; s.restoring = true; s.feedback = restoreMessages.loading; render(); { const current = s; timer = setTimeout(() => { if (s !== current) return; const outcome = ['restored', 'notFound', 'unconfirmed', 'failed'].includes(example) ? example : s.paid ? 'restored' : 'notFound'; s.feedback = restoreMessages[outcome]; if (outcome === 'restored') { s.access = true; s.paid = true; } s.restoring = false; render(); }, 650); } return;
    case 'manage': case 'upgrade': case 'support': case 'privacy': open(d.action); return;
    case 'logout-confirm': s.modal = 'logged-out'; render(); return;
    case 'delete-confirm': s.modal = s.offline ? 'delete-error' : 'deleted'; render(); return;
    case 'dismiss': s.toast = ''; render(); return;
    default: return;
  }
});
$('#stage').addEventListener('input', event => {
  const el = event.target;
  if (el.dataset.field) { set(s.draft, el.dataset.field, el.value); if (el.dataset.field === 'availability') $('[data-availability]').textContent = el.value; }
  if (el.dataset.body) { s.bodyRaw[el.dataset.body] = el.value; const value = el.value.trim(); s.draft.body[el.dataset.body] = value === '' ? '' : String(Number(value) / (el.dataset.body !== 'bodyFat' && s.draft.units.weight === 'lbs' ? 2.2046226218 : 1)); }
  if (el.dataset.energy) s.draft.calories[el.dataset.energy] = el.value === '' ? '' : String(Number(el.value) / (s.draft.units.energy === 'kJ' ? 4.184 : 1));
  if (s.modal === 'tdee') { $('[data-estimate]').textContent = estimateText(); $('[data-action="apply-tdee"]').disabled = tdeeEstimate(s.draft) == null; }
});
document.addEventListener('keydown', event => { if (!s.modal) return; if (event.key === 'Escape') { close(); return; } if (event.key !== 'Tab') return; const nodes = [...document.querySelectorAll('.account-device .sheet button:not(:disabled),.account-device .sheet input,.account-device .sheet textarea,.account-device .sheet a')]; const index = nodes.indexOf(document.activeElement); if (event.shiftKey && index <= 0) { event.preventDefault(); nodes.at(-1)?.focus(); } else if (!event.shiftKey && index === nodes.length - 1) { event.preventDefault(); nodes[0]?.focus(); } });
$('#example').addEventListener('change', event => choose(event.target.value));
$('#viewport').addEventListener('change', event => { size = event.target.value.split(',').map(Number); render(); });
$('#dark').addEventListener('change', event => { dark = event.target.checked; render(); });
$('#large').addEventListener('change', event => { large = event.target.checked; render(); });
$('#reset').addEventListener('click', () => { clearNotebookPreferences(); choose(example); });
const initial = location.hash.slice(1); choose(states.some(row => row[0] === initial) ? initial : 'overview', true);
window.addEventListener('pageshow', event => {
  if (!event.persisted || page === 'profile' && isDirty(s)) return;
  const preferences = readNotebookPreferences();
  if (preferences?.profile) { s.saved = { ...s.saved, ...preferences.profile }; s.saved.sleepTarget = String(s.saved.sleepTarget); s.draft = structuredClone(s.saved); }
  if (preferences?.health) s.health = preferences.health;
  render();
});
