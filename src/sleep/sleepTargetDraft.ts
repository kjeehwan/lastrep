export function reconcileSleepTargetDraft(baseline: string, draft: string, remote: unknown) {
  if (typeof remote !== "number" || !Number.isFinite(remote) || remote <= 0 || remote > 24) return { baseline, draft };
  const saved = String(Math.round(remote * 10) / 10);
  return { baseline: saved, draft: draft === baseline ? saved : draft };
}
