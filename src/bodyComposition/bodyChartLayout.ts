/** Equal observation spacing, right aligned with room for complete date labels. */
export function bodyChartLayout(count: number, viewportWidth: number, scale = 1) {
  const padding = 44 * scale;
  const spacing = 64 * scale;
  const width = Math.max(viewportWidth, padding * 2 + Math.max(0, count - 1) * spacing);
  const start = width - padding - Math.max(0, count - 1) * spacing;
  return { width, padding, positions: Array.from({ length: count }, (_, index) => start + index * spacing) };
}
