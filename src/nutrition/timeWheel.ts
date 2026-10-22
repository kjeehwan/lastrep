export function wrapTimePart(index: number, count: number): number {
  return ((Math.round(index) % count) + count) % count;
}

// Keep two full cycles on either side so a normal swipe can cross midnight.
export function centeredTimeIndex(index: number, count: number): number {
  return count * 2 + wrapTimePart(index, count);
}
