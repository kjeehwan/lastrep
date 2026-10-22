export function modalViewportHeight(windowHeight: number, keyboardTop: number | null, topInset: number, bottomInset: number, margin = 32) {
  const visibleHeight = keyboardTop == null ? windowHeight : Math.min(windowHeight, keyboardTop);
  return Math.max(48, visibleHeight - topInset - bottomInset - margin);
}

export function focusedInputScrollOffset(offset: number, viewportTop: number, viewportHeight: number, inputTop: number, inputHeight: number) {
  const padding = 12;
  const top = viewportTop + padding;
  const bottom = viewportTop + viewportHeight - padding;
  const delta = inputTop < top || inputHeight > bottom - top
    ? inputTop - top
    : Math.max(0, inputTop + inputHeight - bottom);
  return Math.max(0, offset + delta);
}
export function modalFooterShouldScroll(availableHeight: number, fontScale: number): boolean {
  return availableHeight < 240 * Math.max(1, fontScale);
}
