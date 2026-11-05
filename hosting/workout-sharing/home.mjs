const appearancePicker = document.querySelector('.appearance-picker');
if (appearancePicker) appearancePicker.hidden = false;
const appearanceChoices = [...document.querySelectorAll('input[name="appearance"]')];
const appearanceSummary = appearancePicker?.querySelector('summary');
const savedAppearance = document.documentElement.dataset.appearance || 'system';
appearanceChoices.forEach(choice => {
  choice.checked = choice.value === savedAppearance;
  choice.addEventListener('change', () => {
    if (!choice.checked) return;
    if (choice.value === 'system') delete document.documentElement.dataset.appearance;
    else document.documentElement.dataset.appearance = choice.value;
    try { localStorage.setItem('lastrep-site-appearance', choice.value); } catch { /* Keep the choice for this page when storage is unavailable. */ }
  });
});
document.addEventListener('click', event => {
  if (appearancePicker?.open && !appearancePicker.contains(event.target)) appearancePicker.open = false;
});
appearancePicker?.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    appearancePicker.open = false;
    appearanceSummary.focus();
    event.preventDefault();
  }
});

// Native horizontal scrolling also works without JavaScript. This enhances the
// links with an active-view indicator and keeps anchor navigation on this section.
const gallery = document.querySelector('.app-gallery');
const links = [...document.querySelectorAll('.view-tabs a')];
const panels = [...document.querySelectorAll('.app-view')];
if (gallery && panels.length) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function mark(index) {
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    panels.forEach((panel, i) => { panel.inert = i !== index; });
  }
  function select(index) {
    gallery.scrollTo({left: panels[index].offsetLeft - panels[0].offsetLeft, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  }
  links.forEach((link, index) => link.addEventListener('click', event => {
    event.preventDefault(); select(index);
  }));
  gallery.addEventListener('keydown', event => {
    if (event.target !== gallery || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Math.round(gallery.scrollLeft / gallery.clientWidth);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1 : Math.max(0, Math.min(panels.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    select(next);
  });
  let frame;
  gallery.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => mark(Math.round(gallery.scrollLeft / gallery.clientWidth)));
  }, {passive: true});
  let selected = 0;
  const observer = new ResizeObserver(() => {
    selected = links.findIndex(link => link.hasAttribute('aria-current'));
    gallery.scrollTo({left: panels[Math.max(selected, 0)].offsetLeft - panels[0].offsetLeft, behavior: 'instant'});
  });
  observer.observe(gallery);
  mark(0);
}
