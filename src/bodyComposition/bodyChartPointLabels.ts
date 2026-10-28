type LabelPoint = { key: string; x: number; y: number; label: string };

/** Place values above their points, lifting neighboring labels when their bounds overlap. */
export function bodyChartPointLabels(points: LabelPoint[], scale = 1) {
  const height = 14 * scale;
  const gap = 4 * scale;
  const placed: { key: string; x: number; y: number; label: string; width: number }[] = [];
  for (const point of points) {
    const width = point.label.length * 7.5 * scale;
    let y = point.y - 12 * scale;
    while (placed.some(previous => Math.abs(previous.x - point.x) < (previous.width + width) / 2 + gap && Math.abs(previous.y - y) < height + gap)) {
      y -= height + gap;
    }
    placed.push({ ...point, y, width });
  }
  return placed;
}
