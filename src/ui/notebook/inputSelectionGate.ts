/** Initial selection must never run after typing has begun or repeat during keyboard resizing. */
export function createInputSelectionGate() {
  let revision = 0;
  let claimed = false;
  return {
    reset() { revision++; claimed = false; },
    changed() { revision++; },
    claim() {
      if (claimed) return null;
      claimed = true;
      const expected = ++revision;
      return () => expected === revision;
    },
  };
}
