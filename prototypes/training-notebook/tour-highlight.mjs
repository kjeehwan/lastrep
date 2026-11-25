// Annotation geometry never changes the underlying row's padding or alignment.
export const HIGHLIGHT_CLEARANCE = 8;
export const HIGHLIGHT_STROKE = 2;
export function paddedHighlight(rect, textRects, limits) {
  const gap = HIGHLIGHT_CLEARANCE + HIGHLIGHT_STROKE;
  return {
    left: Math.max(0, Math.min(rect.left, ...textRects.map(r => r.left - gap))),
    top: Math.max(0, Math.min(rect.top, ...textRects.map(r => r.top - gap))),
    right: Math.min(limits.width, Math.max(rect.right, ...textRects.map(r => r.right + gap))),
    bottom: Math.min(limits.height, Math.max(rect.bottom, ...textRects.map(r => r.bottom + gap))),
  };
}
export function visibleTextRects(element) {
  const document = element.ownerDocument, rects = [];
  if (element.matches('input:not([type="range"]):not([type="checkbox"]),textarea')) {
    const text = element.value || element.placeholder;
    if (!text) return rects;
    const style = document.defaultView.getComputedStyle(element), box = element.getBoundingClientRect();
    const context = document.createElement('canvas').getContext('2d');
    context.font = style.font || `${style.fontSize} ${style.fontFamily}`;
    const width = Math.min(context.measureText(text).width, box.width), height = parseFloat(style.fontSize) * 1.2;
    const left = style.textAlign === 'center' ? box.left + (box.width - width) / 2
      : style.textAlign === 'right' ? box.right - parseFloat(style.paddingRight) - width
      : box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    return [{left,right:left+width,top:box.top+(box.height-height)/2,bottom:box.top+(box.height+height)/2}];
  }
  const walker = document.createTreeWalker(element, 4);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || node.parentElement.closest('svg,[hidden],[aria-hidden="true"]')) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    for (const r of range.getClientRects()) if (r.width && r.height) rects.push(r);
  }
  return rects;
}
