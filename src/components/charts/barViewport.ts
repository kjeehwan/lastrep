/** An inverted history starts at the newest/right edge, with native offset zero. */
export function barViewportRange(pointCount: number, scrollFromEnd: number, viewportWidth: number) {
  if (pointCount <= 0) return { start: 0, end: 0 };
  const width = Math.max(0, viewportWidth);
  const contentWidth = pointCount * 52 - 6;
  const offset = Math.min(Math.max(0, contentWidth - width), Math.max(0, scrollFromEnd));
  const end = pointCount - Math.floor(offset / 52);
  const start = Math.max(0, pointCount - Math.max(1, Math.ceil((offset + width) / 52)));
  return { start, end };
}
