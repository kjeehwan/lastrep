import { chapters } from './onboarding-tour-steps.mjs';
import { paddedHighlight, visibleTextRects } from './tour-highlight.mjs';

const $ = selector => document.querySelector(selector);
const app = $('#app-frame'), frame = $('#tour-frame'), coach = $('#coach'), ring = $('#target-ring');
let chapter = chapters[0], index = 0, active = false, ready = false, complete = false;
let generation = 0, observer, target, transitionTimer, demoTimer, repositionFrame;
let transitioning = false, docked = false;
let welcoming = false, replaying = false;
let replaySequence = 0;
let needsReveal = false;
const remembered = new Map();
const values = () => { if (!remembered.has(chapter.id)) remembered.set(chapter.id, new Map()); return remembered.get(chapter.id); };
const storageKeys = ['lastrep-notebook-check-in-2026-10-15', 'lastrep-notebook-preferences-v1'];
const originalStorage = new Map(storageKeys.map(key => [key, sessionStorage.getItem(key)]));
const restore = () => { for (const [key, value] of originalStorage) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch {}
} };
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current = () => chapter.steps[index];
const doc = () => app.contentDocument;
const device = () => doc()?.querySelector('.device:not(.reference)');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

$('#chapter').innerHTML = '<option value="welcome">Welcome</option>' + chapters.map(c => `<option value="${c.id}">${c.title}</option>`).join('');

function query(selector, last = false) {
  const nodes = [...doc().querySelectorAll('.device:not(.reference) ' + selector.split(',').join(', .device:not(.reference) '))]
    .filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height);
  return last ? nodes.at(-1) : nodes[0];
}
function sizes() {
  const [width, height] = $('#viewport').value.split(',').map(Number);
  frame.style.width = width + 'px'; frame.style.height = height + 'px';
  frame.classList.toggle('dark', $('#dark').checked);
  frame.classList.toggle('large-text', $('#large').checked);
}
function resetRoom() {
  docked = false;
  app.style.width = '100%'; app.style.height = '100%';
  coach.style.maxHeight = ''; coach.dataset.side = '';
}
function cancelPending() {
  clearTimeout(transitionTimer); clearTimeout(demoTimer);
  transitioning = false;
  $('#tap-demo').hidden = true;
}
function clearMarks() {
  doc()?.querySelectorAll('.tour-checkbox,.tour-border-muted,.tour-annotated').forEach(node => node.classList.remove('tour-checkbox','tour-border-muted','tour-annotated'));
}
function configure() {
  const d = doc(); if (!device()) return;
  sizes();
  for (const name of ['dark', 'large']) {
    const input = d.getElementById(name);
    if (input) { input.checked = $('#' + name).checked; input.dispatchEvent(new Event('change', {bubbles:true})); }
  }
  const compare = d.querySelector('#compare');
  if (compare?.checked) { compare.checked = false; compare.dispatchEvent(new Event('change', {bubbles:true})); }
  let style = d.querySelector('#tour-layout');
  if (!style) { style = d.createElement('style'); style.id = 'tour-layout'; d.head.append(style); }
  style.textContent = `html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:transparent!important}
    .workbench,.skip,.review-heading,.state-description,.review-footer,.frame-caption,.frame-wrap>h3,.prototype-tag{display:none!important}
    main,#preview{margin:0!important;padding:0!important;min-height:0!important;overflow:visible!important}
    .stage,#stage{display:block!important;margin:0!important;width:100%!important}.frame-wrap{margin:0!important}
    .device.reference{display:none!important}.device:not(.reference){width:100%!important;--width:100%!important;height:100vh!important;--height:100vh!important;border:0!important;box-shadow:none!important}
    .tour-guided .toast{display:none!important}
    .tour-guided .tour-checkbox{border-color:var(--accent)!important;box-shadow:inset 0 0 0 1px var(--accent)!important}
    .tour-guided .tour-border-muted{border-color:transparent!important}
    .tour-guided .tour-annotated:focus-visible{outline:none!important}
    html{scroll-behavior:auto!important}`;
  d.body.classList.toggle('tour-guided', active);
}

function expectedControl(node) {
  const st = current();
  if (st.mode === 'input' && st.target.includes('data-sleep-time') && node.closest?.('.sleep-clock')) return true;
  const expected = query(st.target, st.last);
  return expected && (node === expected || expected.contains(node));
}
function guardClick(event, scope) {
  if (!active || scope !== generation) return;
  if (replaying) return;
  // Practice restricts navigation, while leaving scrolling and text selection available.
  const st = current();
  const allowed = ready && !welcoming && !complete && !transitioning && expectedControl(event.target)
    && (st.mode === 'click' || st.mode === 'input');
  if (!allowed) {
    event.preventDefault(); event.stopImmediatePropagation();
    return;
  }
  if (st.mode !== 'click') return;
  transitioning = true;
  const stepAtClick = st;
  transitionTimer = setTimeout(() => {
    if (!active || scope !== generation || current() !== stepAtClick) return;
    transitioning = false;
    advance().catch(showFailure);
  }, st.delay || 100);
}
async function load(url, prepare = [], clearExamples = true, retry = 0) {
  cancelPending(); resetRoom(); ready = false; target = null; ring.hidden = true;
  observer?.disconnect();
  const scope = ++generation;
  if (clearExamples) for (const key of storageKeys) try { sessionStorage.removeItem(key); } catch {}
  const destination = new URL(url, location.href);
  destination.searchParams.set('tour-session', String(scope));
  await new Promise(resolve => { app.onload = resolve; app.src = destination.href; });
  if (scope !== generation) return;
  for (let attempt = 0; attempt < 80 && scope === generation && (doc()?.URL !== destination.href || !device()); attempt++) await pause(50);
  if (scope !== generation) return;
  if (doc()?.URL !== destination.href || !device()) {
    if (retry === 0) return load(url, prepare, clearExamples, 1);
    throw Error('The practice screen could not load. Please restart this section.');
  }
  configure();
  for (const selector of prepare) {
    if (scope !== generation) return;
    const node = query(selector);
    if (!node) throw Error('Missing setup control ' + selector);
    node.click(); await pause(80);
  }
  const d = doc();
  d.addEventListener('click', event => guardClick(event, scope), true);
  d.addEventListener('input', () => {
    if (!active || !ready || replaying || welcoming || complete || scope !== generation || current()?.mode !== 'input') return;
    syncInputValidity();
  }, true);
  for (const event of ['change','pointerup','keyup']) d.addEventListener(event, () => requestAnimationFrame(syncInputValidity), true);
  d.addEventListener('keydown', event => {
    if (!active || scope !== generation) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); exit(); }
    else if (['Enter', ' '].includes(event.key) && (!ready || welcoming || complete || !expectedControl(event.target))) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  d.addEventListener('scroll', schedulePosition, true);
  observer = new MutationObserver(schedulePosition);
  observer.observe(d.querySelector('#stage') || d.body, {subtree:true, childList:true});
  ready = true;
  if (active && !replaying) { if (welcoming) showWelcome(); else showStep(true); }
  else if (!active) restore();
}
function validInput() {
  if (current()?.target.includes('data-sleep-time')) return /^([01]\d|2[0-3]):[0-5]\d$/.test(target?.value || '');
  return current()?.value ? target?.value === current().value : current()?.optional || !!target?.value?.trim?.();
}
function syncInputValidity() {
  if (!active || !ready || replaying || welcoming || complete || current()?.mode !== 'input') return;
  target = query(current().target, current().last);
  const next = coach.querySelector('[data-tour="continue"]');
  if (next) next.disabled = !validInput();
}
function showFailure(error) {
  if (!active) return;
  replaying = false; frame.classList.remove('replaying'); app.inert = false; ready = false; cancelPending(); resetRoom(); ring.hidden = true;
  coach.hidden = false; coach.className = 'coach'; coach.style.width = Math.min(312,frame.clientWidth-24)+'px';
  coach.innerHTML = `${heading('Practice paused')}<h3>Let’s reload this section</h3><p>${esc(error.message)}</p><div class="coach-controls"><button data-tour="restart">Restart</button><button data-tour="exit">Exit tour</button></div>`;
  makeRoom();
}
function controls() {
  const st = current();
  return `<div class="coach-controls">${st.mode === 'click'
    ? '<button class="coach-demo" data-tour="demo">Show me</button>'
    : `<button class="coach-primary" data-tour="continue" ${st.mode === 'input' && !validInput() ? 'disabled' : ''}>Continue</button>`}
    <div class="coach-secondary"><button data-tour="back">Back</button><button class="coach-skip" data-tour="skip">Skip</button></div></div>`;
}
function heading(label, progress = false) {
  return `<div class="coach-heading"><span>${esc(label)}</span><button data-tour="exit" aria-label="Exit tour">×</button></div>
    ${progress ? `<div class="coach-progress" role="progressbar" aria-label="${esc(label)} progress" aria-valuemin="0" aria-valuemax="${chapter.steps.length}" aria-valuenow="${index + 1}"><span style="width:${(index + 1) / chapter.steps.length * 100}%"></span></div>` : ''}`;
}
function showStep(scroll = false) {
  if (!active || !ready) return;
  if (welcoming) { showWelcome(); return; }
  resetRoom();
  clearMarks();
  coach.hidden = false; coach.className = 'coach';
  coach.style.width = Math.min(312, frame.clientWidth - 24) + 'px';
  if (complete) {
    ring.hidden = true;
    coach.innerHTML = `${heading('Practice complete')}<h3>${esc(chapter.title)}</h3><p>You’ve reached the end of this section. These examples have not changed your Lastrep account.</p>
      <div class="coach-controls"><button class="coach-primary" data-tour="next-section">${chapters.indexOf(chapter) === chapters.length - 1 ? 'Finish tour' : 'Next section'}</button><button data-tour="back">Back</button></div>`;
    makeRoom();
    return;
  }
  const st = current();
  target = query(st.target, st.last);
  coach.innerHTML = `${heading(chapter.title, true)}<h3>${esc(st.title)}</h3><p>${esc(st.text)}</p>${controls()}`;
  if (!target) {
    ring.hidden = true;
    coach.innerHTML = `${heading(chapter.title)}<h3>Resume this practice</h3><p>Restart this section, or skip to the next one.</p><div class="coach-controls"><button data-tour="restart">Restart</button><button data-tour="skip">Skip</button></div>`;
    makeRoom(); return;
  }
  // Protect the entire dialog, not only the title or the current button.
  if (!st.overlay && (st.mode === 'read' || target.closest('[role="dialog"]'))) makeRoom();
  if (scroll) target.scrollIntoView({block:st.scrollBlock || 'nearest', inline:'nearest', behavior:'instant'});
  needsReveal = scroll;
  syncStatus();
  position();
}
function showWelcome() {
  resetRoom(); ring.hidden = true; coach.hidden = false; coach.className = 'coach';
  coach.style.width = Math.min(312, frame.clientWidth - 24) + 'px';
  coach.innerHTML = `${heading('Welcome to Lastrep')}<h3>Your training, in one notebook.</h3><p>Try logging a workout, building a program and tracking recovery. These short practices use sample data. You can go Back, Skip or leave at any time.</p><div class="coach-controls"><button class="coach-primary" data-tour="begin">Start tour</button><button data-tour="exit">Explore on my own</button></div>`;
  coach.dataset.side = 'overlay';
  coach.style.left = (frame.clientWidth - coach.offsetWidth) / 2 + 'px';
  coach.style.top = Math.max(24,(frame.clientHeight - coach.offsetHeight) / 2) + 'px';
}
async function welcome() {
  replaySequence++;
  app.inert = false;
  frame.classList.remove('replaying');
  cancelPending(); welcoming = true; replaying = false; active = true; complete = false;
  $('#resume').hidden = true; $('#exit').hidden = false;
  $('#chapter-title').textContent = 'Welcome';
  $('#chapter').value = 'welcome';
  history.replaceState(null, '', '#welcome');
  await load('home.html');
}
function syncStatus() {
  if (!active || welcoming || complete) return;
  const text = doc()?.querySelector('.device:not(.reference) .toast>span')?.textContent?.trim() || '';
  let status = coach.querySelector('.coach-status');
  if (!text) { if (status) { status.remove(); if (docked) makeRoom(); } return; }
  const message = text.replace(/in this mock session|in this mock flow/g, 'in practice');
  if (status?.textContent === message) return;
  if (!status) { status = document.createElement('p'); status.className = 'coach-status'; status.setAttribute('role','status'); coach.querySelector('.coach-controls')?.before(status); }
  status.textContent = message;
  if (docked) makeRoom();
}
function makeRoom() {
  docked = true;
  needsReveal = true;
  const w = frame.clientWidth, h = frame.clientHeight;
  coach.dataset.side = 'docked';
  if (w > h && w >= 700) {
    const width = Math.min(312, w * .42);
    coach.style.width = width + 'px'; coach.style.maxHeight = (h - 24) + 'px';
    coach.style.left = (w - width - 12) + 'px'; coach.style.top = '12px';
    app.style.width = (w - width - 24) + 'px'; app.style.height = '100%';
  } else {
    coach.style.maxHeight = Math.floor(h * .44) + 'px';
    const ch = coach.offsetHeight;
    coach.style.left = Math.max(12, (w - coach.offsetWidth) / 2) + 'px';
    coach.style.top = (h - ch - 12) + 'px';
    app.style.height = (h - ch - 24) + 'px'; app.style.width = '100%';
  }
}
function schedulePosition() {
  if (repositionFrame != null) return;
  repositionFrame = requestAnimationFrame(() => {
    repositionFrame = null;
    if (active && !complete && ready && !welcoming && !replaying) { syncStatus(); position(); }
  });
}
function protectedRects() {
  const st = current();
  if (st.overlay) return st.protect.map(selector => query(selector)).filter(Boolean).map(node => node.getBoundingClientRect());
  return [st.target, ...(st.reveal || [])].map(selector => query(selector, selector === st.target && st.last)).filter(Boolean)
    .map(node => (node.closest('[role="dialog"]') || node).getBoundingClientRect());
}
function visualTarget(control) {
  const checkbox = control.querySelector('.checkmark');
  if (checkbox) return checkbox;
  if (control.matches('button,a')) {
    const caret = control.querySelector('svg.icon-right,svg.icon-down,svg.icon-up,svg.icon-left');
    if (caret) return caret;
  }
  return control.matches('[role="dialog"]') ? control.querySelector('h2,h3') || control : control;
}
function position() {
  const st = current(), node = query(st.target, st.last);
  if (!node) { ring.hidden = true; return; }
  target = node;
  syncInputValidity();
  target.classList.add('tour-annotated');
  const checkbox = target.querySelector('.checkmark');
  if (checkbox) checkbox.classList.add('tour-checkbox');
  // The old studies focus Close after every modal render. Keep that focus ring
  // from masquerading as a second tour target, without disabling keyboard outlines.
  if (doc().activeElement?.matches('.sheet-head .close') && (target.matches('[role="dialog"]') || !target.contains(doc().activeElement))) {
    if (target.matches('button')) target.focus({preventScroll:true});
    else doc().activeElement.blur();
  }
  const revealTarget = () => {
    const scroller = target.closest('.sheet-body,.viewport');
    if (!scroller) return;
    const r = target.getBoundingClientRect(), bounds = scroller.getBoundingClientRect();
    if (r.height <= bounds.height - 24) {
      if (r.bottom > bounds.bottom - 12) scroller.scrollTop += r.bottom - bounds.bottom + 12;
      else if (r.top < bounds.top + 12) scroller.scrollTop -= bounds.top + 12 - r.top;
    }
  };
  if (needsReveal) { revealTarget(); needsReveal = false; }
  const w = frame.clientWidth, h = frame.clientHeight;
  let r = target.getBoundingClientRect();
  if (!docked) {
    const ch = coach.offsetHeight, rects = protectedRects();
    const candidates = st.overlay ? rects.flatMap(r => [r.bottom + 12, r.top - ch - 12])
      : [Math.max(...rects.map(r => r.bottom)) + 12, Math.min(...rects.map(r => r.top)) - ch - 12];
    const y = candidates.find(y => y >= 24 && y + ch <= h - 12 && rects.every(r => y + ch <= r.top - 10 || y >= r.bottom + 10)) ?? null;
    if (y === null) {
      makeRoom(); target.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
      revealTarget(); needsReveal = false;
      r = target.getBoundingClientRect();
    } else {
      coach.dataset.side = 'anchored'; coach.style.top = y + 'px';
      coach.style.left = Math.max(12, Math.min(w - coach.offsetWidth - 12, r.left + r.width / 2 - coach.offsetWidth / 2)) + 'px';
    }
  }
  const highlight = visualTarget(target);
  r = highlight.getBoundingClientRect();
  const style = doc().defaultView.getComputedStyle(highlight);
  const limitW = app.clientWidth, limitH = app.clientHeight;
  const caret = highlight.matches('svg');
  const base = caret ? {left:r.left-6,right:r.right+6,top:r.top-6,bottom:r.bottom+6} : r;
  const bounds = paddedHighlight(base, visibleTextRects(highlight), {width:limitW,height:limitH});
  const expanded = bounds.left < r.left || bounds.top < r.top || bounds.right > r.right || bounds.bottom > r.bottom;
  if (expanded && ['Top','Right','Bottom','Left'].every(side => parseFloat(style['border'+side+'Width']) > 0)) highlight.classList.add('tour-border-muted');
  ring.hidden = !!checkbox || bounds.bottom <= bounds.top || r.right <= 0 || r.left >= limitW;
  const radius = style.borderRadius === '0px' ? '6px' : style.borderRadius;
  ring.style.cssText = `left:${bounds.left}px;top:${bounds.top}px;width:${bounds.right-bounds.left}px;height:${Math.max(0,bounds.bottom-bounds.top)}px;border-radius:${radius}`;
  ring.dataset.target = caret ? 'caret' : 'control';
}
async function advance() {
  if (!active || !ready || complete) return;
  if (current().mode === 'input') values().set(index, target?.value);
  cancelPending(); index++; complete = index >= chapter.steps.length;
  if (complete) { showStep(); return; }
  const st = current();
  if (st.route) { coach.hidden = true; await load(st.route, st.prepare || []); }
  else showStep(true);
}
async function start(id) {
  replaySequence++;
  app.inert = false;
  frame.classList.remove('replaying');
  cancelPending();
  welcoming = false; replaying = false;
  chapter = chapters.find(c => c.id === id) || chapters[0];
  index = 0; active = true; complete = false; ready = false;
  $('#chapter').value = chapter.id; $('#chapter-title').textContent = chapter.title;
  $('#resume').hidden = true; $('#exit').hidden = false;
  history.replaceState(null, '', '#' + chapter.id);
  coach.hidden = false; coach.innerHTML = '<h3>Loading practice screen</h3>';
  await load(chapter.url);
}
function defaultValue(step) {
  return step.value || (step.target.includes('bedtime') ? '23:00' : step.target.includes('wakeTime') ? '07:00'
    : step.target.includes('quantity') ? '80' : step.target.includes('weight') ? '40'
    : step.target.includes('reps') ? '8' : step.target.includes('fatigue') ? '3' : 'Practice example');
}
async function back() {
  if (!active || !ready || replaying) return;
  if (!complete && current().mode === 'input') values().set(index, query(current().target, current().last)?.value);
  if (!complete && index === 0) {
    const previous = chapters[chapters.indexOf(chapter) - 1];
    if (previous) await start(previous.id); else await welcome();
    return;
  }
  const destination = complete ? chapter.steps.length - 1 : index - 1;
  const job = ++replaySequence;
  app.inert = true;
  frame.classList.add('replaying'); ring.hidden = true;
  cancelPending(); replaying = true; complete = false; index = 0;
  coach.hidden = false; coach.innerHTML = '<h3>Returning to the previous step</h3>';
  await load(chapter.url);
  if (job !== replaySequence || !replaying) return;
  let scope = generation;
  // Rebuild only the synthetic scenario. Never rewind a real account or draft.
  for (let i = 0; i < destination; i++) {
    if (job !== replaySequence || !replaying || !active || scope !== generation) return;
    index = i;
    const step = current();
    if (step.route) {
      await load(step.route, step.prepare || []);
      if (job !== replaySequence || !replaying) return;
      scope = generation;
      // Loading is intentional during replay, unlike a user switching sections.
    }
    const replayScope = generation;
    const node = query(step.target, step.last);
    if (!node) { replaying = false; frame.classList.remove('replaying'); app.inert = false; showStep(true); return; }
    if (step.mode === 'input') {
      node.value = values().get(i) ?? defaultValue(step);
      node.dispatchEvent(new Event('input', {bubbles:true}));
      node.dispatchEvent(new Event('change', {bubbles:true}));
    } else if (step.mode === 'click') {
      node.click(); await pause(node.dataset.action === 'save' ? 750 : 120);
    }
    if (job !== replaySequence || !replaying || replayScope !== generation) return;
  }
  index = destination;
  const step = current();
  if (step.route) await load(step.route, step.prepare || []);
  if (job !== replaySequence || !active || !replaying) return;
  if (step.mode === 'input' && values().has(index)) {
    const node = query(step.target, step.last);
    node.value = values().get(index); node.dispatchEvent(new Event('input', {bubbles:true})); node.dispatchEvent(new Event('change', {bubbles:true}));
  }
  replaying = false; app.inert = false; showStep(true);
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (job === replaySequence) frame.classList.remove('replaying');
}
async function exit() {
  replaySequence++;
  app.inert = false;
  frame.classList.remove('replaying');
  cancelPending(); active = false; ready = false; complete = false; welcoming = false; replaying = false;
  coach.hidden = true; ring.hidden = true;
  $('#resume').hidden = false; $('#exit').hidden = true;
  $('#chapter-title').textContent = 'Home'; history.replaceState(null, '', '#home');
  restore();
  // Fresh Home closes the previous modal. Finishing never enables health access.
  await load('home.html', [], false);
}
function demo() {
  if (!target) return;
  target.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
  position();
  const dot = $('#tap-demo'), r = visualTarget(target).getBoundingClientRect();
  const to = {x:r.left + r.width / 2 - 10, y:r.top + r.height / 2 - 10};
  dot.hidden = false; dot.style.left = to.x + 'px'; dot.style.top = to.y + 'px';
  const reduced = $('#reduced').checked || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) {
    const from = coach.getBoundingClientRect(), base = frame.getBoundingClientRect();
    dot.animate([{transform:`translate(${from.left-base.left+30-to.x}px,${from.top-base.top+from.height-35-to.y}px) scale(.6)`,opacity:.4},
      {transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate(0,0) scale(1.7)',opacity:0}], {duration:900,easing:'ease-out'});
  }
  clearTimeout(demoTimer); demoTimer = setTimeout(() => { dot.hidden = true; }, reduced ? 700 : 900);
}
coach.addEventListener('click', async event => {
  try {
  const action = event.target.closest('[data-tour]')?.dataset.tour;
  if (action === 'exit') await exit();
  else if (action === 'begin') await start('workout');
  else if (action === 'back') await back();
  else if (action === 'restart') await start(chapter.id);
  else if (action === 'demo') demo();
  else if (action === 'continue' && ready && !complete && (current().mode !== 'input' || validInput())) await advance();
  else if (action === 'skip' || action === 'next-section') {
    const next = chapters[chapters.indexOf(chapter) + 1];
    if (next) await start(next.id); else await exit();
  }
  } catch (error) { showFailure(error); }
});
$('#chapter').onchange = event => (event.target.value === 'welcome' ? welcome() : start(event.target.value)).catch(showFailure);
$('#reset').onclick = () => (welcoming ? welcome() : start(chapter.id)).catch(showFailure);
$('#resume').onclick = () => welcome().catch(showFailure);
$('#exit').onclick = () => exit().catch(showFailure);
for (const id of ['viewport','dark','large']) $('#' + id).onchange = () => { sizes(); configure(); if (active) showStep(true); };
window.addEventListener('resize', schedulePosition);
window.addEventListener('pagehide', restore);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && active) exit(); });
(location.hash && location.hash !== '#welcome' ? start(location.hash.slice(1)) : welcome()).catch(showFailure);
