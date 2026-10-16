// Shared browser-study behavior, not a substitute for native IME testing.
let focused = null, pointerSelection = null, frame;
const viewport = window.visualViewport;
const editable = node => node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(node.type);
const numeric = node => node instanceof HTMLInputElement && ['decimal', 'numeric'].includes(node.inputMode);
function reveal() {
  const input = document.activeElement;
  if (!editable(input) || !input.closest('.device')) return;
  input.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}
function resizeForKeyboard() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const input = document.activeElement, device = editable(input) && input.closest('.device');
    document.querySelectorAll('.device[data-keyboard-fit]').forEach(node => { node.style.removeProperty('max-height'); delete node.dataset.keyboardFit; });
    if (!device || !viewport) return;
    const top = Math.max(0, device.getBoundingClientRect().top - viewport.offsetTop);
    const available = viewport.height - top - 8;
    if (available > 180 && available < device.getBoundingClientRect().height) {
      device.style.maxHeight = `${available}px`; device.dataset.keyboardFit = '';
    }
    reveal();
  });
}
document.addEventListener('focusin', event => {
  const input = event.target;
  if (!editable(input) || !input.closest('.device')) { focused = null; pointerSelection = null; resizeForKeyboard(); return; }
  const restoring = focused && !focused.isConnected;
  focused = input;
  if (!restoring && numeric(input) && input.value) {
    input.setSelectionRange(0, input.value.length, 'forward');
    pointerSelection = input;
  }
  requestAnimationFrame(reveal);
});
// A first pointer release must not collapse the selection made during focus.
document.addEventListener('pointerup', event => {
  if (pointerSelection === event.target) {
    pointerSelection.setSelectionRange(0, pointerSelection.value.length, 'forward');
    event.preventDefault();
  }
  pointerSelection = null;
});
document.addEventListener('input', () => { pointerSelection = null; });
viewport?.addEventListener('resize', resizeForKeyboard);
viewport?.addEventListener('scroll', resizeForKeyboard);
window.addEventListener('resize', resizeForKeyboard);
