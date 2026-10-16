// Preserve the review sequence while opening the scrollable list at the current state.
const pickers = new WeakMap();
export function setReviewState(select, rows, current) {
  const fragment = document.createDocumentFragment();
  let group = null, label = null;
  rows.forEach(([id, title, category]) => {
    const option = document.createElement('option'); option.value = id; option.textContent = title;
    if (!category) { fragment.append(option); group = null; label = null; }
    else {
      if (category !== label) { group = document.createElement('optgroup'); group.label = category; fragment.append(group); label = category; }
      group.append(option);
    }
  });
  select.replaceChildren(fragment); select.value = current;
  if (!pickers.has(select)) installPicker(select);
  pickers.get(select).rows = rows;
  pickers.get(select).close();
}

function installPicker(select) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;min-width:0;width:100%';
  select.before(wrapper); wrapper.append(select);
  const popup = document.createElement('div');
  popup.id = `${select.id}-review-options`;
  popup.setAttribute('role', 'listbox'); popup.setAttribute('aria-label', 'Review states');
  popup.style.cssText = 'position:absolute;top:100%;left:0;right:0;z-index:1000;max-height:290px;overflow:auto;background:#fffcf5;color:#242720;border:1px solid #817b6e;border-radius:6px;box-shadow:0 6px 18px #0002;padding:4px';
  popup.hidden = true; wrapper.append(popup);
  select.setAttribute('aria-controls', popup.id); select.setAttribute('aria-expanded', 'false');
  const picker = { rows: [], close() { popup.hidden = true; select.setAttribute('aria-expanded', 'false'); } };
  pickers.set(select, picker);
  const buttons = () => [...popup.querySelectorAll('[role="option"]')];
  function open() {
    popup.replaceChildren(); popup.style.paddingBottom = '4px'; let category;
    picker.rows.forEach(([id, title, group]) => {
      if (group && group !== category) {
        const heading = document.createElement('div'); heading.textContent = group;
        heading.style.cssText = 'padding:10px 8px 4px;font-size:12px;font-weight:700'; popup.append(heading);
      }
      category = group;
      const option = document.createElement('button'); option.type = 'button'; option.textContent = title;
      option.dataset.value = id; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(id === select.value));
      option.style.cssText = `display:block;width:100%;text-align:left;padding:10px 8px;min-height:40px;border:0;border-radius:3px;font:inherit;color:inherit;cursor:pointer;background:${id === select.value ? '#eae2d4' : 'transparent'}`;
      option.addEventListener('click', () => { select.value = id; picker.close(); select.dispatchEvent(new Event('change', { bubbles: true })); select.focus({ preventScroll: true }); });
      popup.append(option);
    });
    popup.hidden = false; select.setAttribute('aria-expanded', 'true');
    const selected = popup.querySelector('[aria-selected="true"]');
    selected?.focus({ preventScroll: true });
    if (selected) popup.style.paddingBottom = `${Math.max(4, popup.clientHeight - selected.offsetHeight - 4)}px`;
    popup.scrollTop = selected ? selected.offsetTop - 4 : 0;
  }
  select.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); popup.hidden ? open() : picker.close(); });
  wrapper.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); picker.close(); select.focus({ preventScroll: true }); return; }
    if (event.key === 'Tab') { picker.close(); return; }
    if (event.target === select && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); open(); return; }
    if (popup.hidden || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); const options = buttons(), index = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    options[next]?.focus({ preventScroll: true }); options[next]?.scrollIntoView({ block: 'nearest' });
  });
  document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) picker.close(); });
  wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) picker.close(); });
}
