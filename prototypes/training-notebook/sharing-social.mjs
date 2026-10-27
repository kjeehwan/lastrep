// Browser-only sharing preferences. No accounts, discovery or deliveries exist.
import { notebookIcon } from './notebook-icons.mjs';
import { sharingState, workoutPlanPreview, planForSharing } from './sharing.mjs';
import { startSharingCopy, sharingCopyDialog, handleSharingCopy, sharingCopyInput } from './sharing-editor.mjs';
export { installSharingEditorGestures } from './sharing-editor.mjs';
export function sharingInboxButton(social) {
  const count = social.inbox.filter(item => item.when.includes('New')).length + social.requests.length;
  return `<button type="button" class="icon-button sharing-inbox-button" data-action="social-inbox" aria-label="Workout sharing${count ? `, ${count} new items` : ''}" title="Workout sharing">${notebookIcon('inbox')}${count ? `<span class="sharing-inbox-badge" aria-hidden="true">${count > 99 ? '99+' : count}</span>` : ''}</button>`;
}
const KEY = 'lastrep-sharing-study-v1';
export function readSharingPreferences() {
  try { const p = JSON.parse(sessionStorage.getItem(KEY)); return { enabled: !!p?.enabled, username: String(p?.username || '') }; }
  catch { return { enabled: false, username: '' }; }
}
function persist(prefs) { try { sessionStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* Page-only preview remains usable. */ } }
export function resetSharingPreferences() { try { sessionStorage.removeItem(KEY); } catch { /* Optional demo storage. */ } }
export const socialExamples = [
  ['Workout sharing candidate', 'social-sent', 'Workout sharing / sent', 'Review previously sent workouts and choose Send again to select recipients before another delivery.'],
  ['Workout sharing candidate', 'social-inbox', 'Shared with you / inbox', 'Accepted senders appear here. Receiving a workout never applies it automatically.'],
  ['Workout sharing candidate', 'social-requests', 'Shared with you / requests', 'First-time senders go to Requests. Accept, decline or block before opening their workout.'],
  ['Workout sharing candidate', 'social-search', 'Send in Lastrep / find someone', 'Search by nickname or unique @username. Only sharing-enabled accounts appear.'],
];
export function socialState(id = '') {
  const prefs = readSharingPreferences();
  if (['social-requests','social-search','social-sent','sharing-enabled','sharing-username'].includes(id)) Object.assign(prefs, { enabled: true, username: 'daniel.lifts' });
  if (['sharing-off', 'sharing-profile'].includes(id)) Object.assign(prefs, { enabled: false, username: '' });
  return { prefs, username: prefs.username, query: '', error: '', notice: '',  selected: [], delivered: [],
    sent: [{ id: 'sent-example', title: 'Chest + Triceps', sharing: sharingState(), recipients: [{ id: 'alex', name: 'Alex', username: 'alex.lifts', accepted: true }], when: 'Earlier · 10:30' }],
    inbox: [{ id: 'alex-today', name: 'Alex', username: 'alex.lifts', when: 'Today · New' }, { id: 'alex-earlier', name: 'Alex', username: 'alex.lifts', when: 'Earlier' }],
    requests: [{ id: 'maya', name: 'Maya', username: 'maya.moves' }], blocked: [] };
}
const people = [{ id: 'alex', name: 'Alex', username: 'alex.lifts', accepted: true }, { id: 'maya', name: 'Maya', username: 'maya.moves', accepted: false }, { id: 'alex-run', name: 'Alex', username: 'alex.runs', accepted: false }];
export function socialDialog(s, { shell: baseShell, escape: esc, paragraph: p }) {
  const a = s.social, prefs = a.prefs;
  const shell = (...args) => baseShell(...args).replace('class="sheet', 'class="sheet sharing-sheet');
  if (s.modal.startsWith('social-copy-')) return sharingCopyDialog(s, { shell, escape: esc, paragraph: p });
  const b = (text, action, kind = '', id = '') => `<button class="btn ${kind}" data-action="social-${action}" ${id ? `data-person="${esc(id)}"` : ''}>${text}</button>`;
  const error = a.error ? `<p class="share-error" role="alert">${esc(a.error)}</p>` : '';
  const selected = people.filter(person => a.selected.includes(person.id)).sort((x, y) => x.name.localeCompare(y.name) || x.username.localeCompare(y.username));
  const note = a.notice ? `<p class="share-confirm" role="status">${esc(a.notice)}</p>` : '';
  const unread = a.inbox.filter(item => item.when.includes('New')).length;
  const tabs = `<div class="social-tabs">${b(`Inbox${unread ? ` (${unread})` : ''}`, 'inbox', s.modal === 'social-inbox' ? 'primary' : '')}${b(`Requests${a.requests.length ? ` (${a.requests.length})` : ''}`, 'requests', s.modal === 'social-requests' ? 'primary' : '')}${b('Sent', 'sent', s.modal === 'social-sent' ? 'primary' : '')}</div>`;
  switch (s.modal) {
    case 'social-username': return shell(prefs.username ? 'Edit username' : 'Choose a username', p('Optional for using Lastrep. Your nickname stays separate from your unique @username.') + `<label class="field"><span>Username</span><div class="social-username-input"><span aria-hidden="true">@</span><input data-social-field="username" value="${esc(a.username)}" placeholder="Choose a username" maxlength="24" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Username"></div></label>` + p('3–24 letters, numbers, dots or underscores. Your email stays private.') + p(prefs.enabled ? 'Sharing is on. People can find you using this username.' : 'Saving a username does not enable sharing. Switch sharing on in Settings when you are ready.') + error, b('Save username', 'save-username', 'primary') + b('Cancel', 'close'));
    case 'social-search': {
      if (!prefs.enabled) return shell('Send in Lastrep', p('Enable sharing and choose a username to find people and send workouts within Lastrep. External link sharing is still available.'), b('Sharing settings', 'settings', 'primary') + b('Back', 'back-share'));
      const q = a.query.trim().replace(/^@/, '').toLowerCase();
      const matches = people.filter(person => !a.blocked.includes(person.id) && (person.name.toLowerCase().includes(q) || person.username.includes(q))).sort((x, y) => x.name.localeCompare(y.name) || x.username.localeCompare(y.username));
      return shell('Send in Lastrep', `<label class="field"><span>Find people</span><div class="social-search-input"><input data-social-field="query" value="${esc(a.query)}" placeholder="Nickname or @username" autocomplete="off">${a.query ? '<button data-action="social-clear-query" aria-label="Clear people search">×</button>' : ''}</div></label>` + p('Select one or more people. Check the @username before sending.') + (selected.length ? `<div class="social-selected" aria-label="Selected recipients">${selected.map(person => `<button data-action="social-select" data-person="${person.id}" aria-label="Remove @${esc(person.username)}">@${esc(person.username)} <span aria-hidden="true">×</span></button>`).join('')}</div>` : '') + `<div class="social-people">${matches.length ? matches.map(person => `<button class="social-person" data-action="social-select" data-person="${person.id}" aria-pressed="${a.selected.includes(person.id)}"><span class="social-avatar" aria-hidden="true">${esc(person.name[0])}</span><span><strong>${esc(person.name)}</strong><small>@${esc(person.username)}</small></span><span class="checkmark ${a.selected.includes(person.id) ? 'checked' : ''}" aria-hidden="true">${a.selected.includes(person.id) ? '✓' : ''}</span></button>`).join('') : p('No people found. Try their exact @username.')}</div>`, `<button class="btn primary" data-action="social-deliver" ${selected.length ? '' : 'disabled'}>Send workout${selected.length > 1 ? ` to ${selected.length} people` : ''}</button>` + b('Back to workout preview', 'back-share'));
    }
    case 'social-delivered': return shell(a.delivered.length === 1 && !a.delivered[0].accepted ? 'Sharing request sent' : 'Workout sent', p(a.delivered.length === 1 ? (a.delivered[0].accepted ? "They'll find your workout in their Inbox." : "They'll see your request in Workout sharing.") : 'Each person gets a separate copy. See their status below.') + `<ul class="social-recipient-review">${a.delivered.map(person => `<li><span class="social-result-icon" aria-hidden="true">${person.accepted ? '✓' : '◷'}</span><span><strong>${esc(person.name)}</strong><small>${person.accepted ? 'In their inbox' : 'Sharing request sent'}</small></span></li>`).join('')}</ul>` + p('Delivery is simulated. No real person was contacted.', 'mock-disclaimer'), b('Done', 'close'));
    case 'social-sent': return shell('Workout sharing', tabs + (a.sent.length ? `<div class="social-sent-list">${a.sent.map(item => `<button class="social-sent-item" data-action="social-open-sent" data-person="${esc(item.id)}" aria-label="View sent ${esc(item.title)}"><strong class="social-sent-title">${esc(item.title)}</strong><span>To ${item.recipients.map(person => `${esc(person.name)} · @${esc(person.username)}`).join(', ')}</span><span class="supporting">${esc(item.when)}</span><span class="social-sent-chevron" aria-hidden="true">›</span></button>`).join('')}</div>` : p('No workouts sent yet. Open a workout and tap Share workout.')), b('Sharing settings', 'settings'));
    case 'social-sent-preview': {
      const item = a.sent.find(item => item.id === a.viewingSent);
      if (!item) return shell('Sent workout unavailable', p('Return to Sent to choose a workout.'), b('Back to Sent', 'sent', 'primary'));
      const saved = workoutPlanPreview(item.sharing, esc);
      return shell('Sent workout', saved.title + p(`To ${item.recipients.map(person => `${esc(person.name)} · @${esc(person.username)}`).join(', ')}`) + p(`Sent ${esc(item.when)}`) + p(item.sharing.weights ? 'Weights included' : 'Weights not shared') + saved.exercises, b('Edit workout', 'edit-sent', '', item.id) + b('Send again', 'resend', 'primary', item.id) + b('Back to Sent', 'sent'));
    }
    case 'social-inbox': return shell('Workout sharing', tabs + note + (!prefs.enabled ? p('Sharing is off. Previously received workouts remain available.') : '') + `<div class="social-people">${a.inbox.map(item => `<button class="social-inbox-item" data-action="social-open-workout" data-person="${esc(item.id)}"><strong>Chest + Triceps</strong><span>${esc(item.name)} · @${esc(item.username)}</span><small>${esc(item.when)}</small></button>`).join('')}</div>`, b('Sharing settings', 'settings'));
    case 'social-requests': return shell('Workout sharing', tabs + p('Accept a sender to open their workout. Future shares from them go to your inbox.') + note + (a.requests.length ? a.requests.map(person => `<div class="social-request"><strong>${esc(person.name)}</strong><span>@${esc(person.username)}</span><p>Wants to share Chest + Triceps</p><div class="social-request-actions">${b('Accept', 'accept', 'primary', person.id)}${b('Decline', 'decline', '', person.id)}${b('Block', 'block', 'danger', person.id)}</div></div>`).join('') : p('No sharing requests.')), b('Back to inbox', 'inbox'));
    default: return '';
  }
}
export function handleSocialAction(s, action, data, open) {
  if (!action.startsWith('social-')) return false;
  const a = s.social, navigate = open;
  open = name => {
    const previous=s.modal;
    if(typeof document!=='undefined') {
      a.dialogScroll ??={};a.dialogScroll[previous]=document.querySelector('.sheet-body')?.scrollTop || 0;
    }
    navigate(name);
    if(previous!==name && typeof requestAnimationFrame==='function') requestAnimationFrame(()=>{
      if(s.modal!==name)return;const body=document.querySelector('.sheet-body');if(body)body.scrollTop=a.dialogScroll?.[name] || 0;
    });
  };
  if (handleSharingCopy(s, action, data, open)) return true;
  a.error = ''; a.notice = '';
  switch (action.slice(7)) {
    case 'settings': location.href = './settings.html#sharing'; break;
    case 'enable':
      if (!a.prefs.username) { a.error = 'Choose a username before turning sharing on.'; break; }
      a.prefs.enabled = true; persist(a.prefs); break;
    case 'username': a.username = a.prefs.username; open('social-username'); break;
    case 'save-username': {
      const username = a.username.trim().replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9._]{3,24}$/.test(username)) { a.error = 'Use 3–24 letters, numbers, dots or underscores.'; break; }
      if (['alex','alex.lifts','maya.moves','alex.runs'].includes(username)) { a.error = 'That username is taken. Try another.'; break; }
      a.prefs = { ...a.prefs, username }; persist(a.prefs); open(''); break;
    }
    case 'disable': a.prefs.enabled = false; persist(a.prefs); a.notice = 'Sharing is off. New incoming shares and discovery are stopped.'; break;
    case 'profile': a.username = a.prefs.username; open('social-username'); break;
    case 'search': open('social-search'); break;
    case 'clear-query': a.query = ''; break;
    case 'select':
      a.selected = a.selected.includes(data.person) ? a.selected.filter(id => id !== data.person) : [...a.selected, data.person]; break;
    case 'deliver':
      a.delivered = people.filter(person => a.selected.includes(person.id) && !a.blocked.includes(person.id)).sort((x, y) => x.name.localeCompare(y.name) || x.username.localeCompare(y.username));
      if (a.delivered.length) {
        a.sent.unshift({ id: `sent-${Date.now()}-${a.sent.length}`, title: s.sharing.title || 'Chest + Triceps', recipients: structuredClone(a.delivered), when: new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), sharing: { title: s.sharing.title || 'Chest + Triceps', plan: planForSharing(s.sharing.plan, s.sharing.weights), weights: s.sharing.weights, effortScale: s.sharing.effortScale || 'RPE', used: false, routineSaved: false } });
        a.selected = []; a.editCopy = null; open('social-delivered');
      } break;
    case 'inbox': open('social-inbox'); break;
    case 'sent': open('social-sent'); break;
    case 'open-sent': a.editCopy = null; a.viewingSent = data.person; open('social-sent-preview'); break;
    case 'edit-sent': {
      const item = a.sent.find(item => item.id === data.person); if (!item) break;
      startSharingCopy(s, item); open('social-copy-editor'); break;
    }
    case 'resend': {
      const sent = a.sent.find(item => item.id === data.person); if (!sent) break;
      a.editCopy = null;
      s.sharing = structuredClone(sent.sharing);
      a.selected = sent.recipients.filter(person => !a.blocked.includes(person.id)).map(person => person.id);
      a.query = ''; open('social-search'); break;
    }
    case 'requests': open('social-requests'); break;
    case 'accept': case 'decline': case 'block': {
      const person = a.requests.find(person => person.id === data.person); if (!person) break;
      a.requests = a.requests.filter(person => person.id !== data.person);
      if (action === 'social-accept') { a.inbox.unshift({ ...person, when: 'Just received · New' }); a.notice = `${person.name} accepted. Their workout is in your inbox.`; }
      else if (action === 'social-block') { a.blocked.push(person.id); a.notice = `${person.name} blocked. They cannot send you new requests.`; }
      else a.notice = 'Request declined.';
      break;
    }
    case 'open-workout': {
      const item = a.inbox.find(item => item.id === data.person);
      if (item) item.when = item.when.replace(' · New', '');
      s.sharing.sender = item ? `${item.name} · @${item.username}` : 'Alex · @alex.lifts'; s.sharing.used = false; open('share-receive'); break;
    }
    case 'back-share': open(a.editCopy ? 'social-copy-review' : 'share-send'); break;
    case 'close': open(''); break;
  }
  return true;
}
export function socialInput(s, el, render) {
  if (sharingCopyInput(s, el, render)) return true;
  const key = el.dataset.socialField;
  if (!key) return false;
  s.social[key] = el.value; s.social.error = '';
  if (key === 'query') {
    const start = el.selectionStart; render();
    const next = document.querySelector('[data-social-field="query"]'); next?.focus({preventScroll:true}); next?.setSelectionRange(start, start);
  }
  return true;
}
