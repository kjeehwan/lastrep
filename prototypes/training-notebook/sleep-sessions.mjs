// Browser-only session ledger. Native imports need timezone-aware timestamps and provider pagination.
const HOUR = 3600000;
export function sessionBounds(row) {
  if (!row.bedDate || !row.wakeDate || !row.bedtime || !row.wakeTime) return null;
  const start = Date.parse(`${row.bedDate}T${row.bedtime}:00Z`), end = Date.parse(`${row.wakeDate}T${row.wakeTime}:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && end > start && new Date(start).toISOString().slice(0, 16) === `${row.bedDate}T${row.bedtime}` && new Date(end).toISOString().slice(0, 16) === `${row.wakeDate}T${row.wakeTime}` ? [start, end] : null;
}
function mergeRanges(ranges) {
  const merged = [];
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end); else merged.push([start, end]);
  }
  return merged;
}
function uncoveredLength(range, covered) {
  let length = range[1] - range[0];
  for (const other of covered) length -= Math.max(0, Math.min(range[1], other[1]) - Math.max(range[0], other[0]));
  return Math.max(0, length);
}
export function rebuildSleepDays(s) {
  const active = s.sessions.filter(row => !row.excluded), unknownDates = new Set(active.filter(row => !sessionBounds(row)).map(row => row.date));
  let covered = [];
  // Explicit manual corrections win; the fixture's chosen primary provider wins across sources.
  const priority = row => row.source === 'manual' ? 0 : row.origin === 'mock.health' ? 1 : 2;
  for (const row of s.sessions) { row.countedHours = 0; row.overlapHours = 0; row.needsReview = false; }
  for (const row of [...active].sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id))) {
    const range = sessionBounds(row);
    if (!range) { row.countedHours = row.hours; continue; }
    if (unknownDates.has(row.date)) { row.needsReview = true; continue; }
    row.countedHours = uncoveredLength(range, covered) / HOUR;
    row.overlapHours = row.hours - row.countedHours;
    row.needsReview = row.overlapHours > .00001;
    covered = mergeRanges([...covered, range]);
  }
  const days = new Map();
  for (const row of active) {
    const day = days.get(row.date) ?? { date: row.date, hours: 0, source: row.source, saved: row.saved, sessionCount: 0, needsReview: false, sources: new Set() };
    day.hours += row.countedHours; day.sessionCount += row.kind === 'legacy-total' ? 0 : 1;
    day.needsReview ||= row.needsReview; day.sources.add(row.source);
    if (row.saved > day.saved) day.saved = row.saved;
    days.set(row.date, day);
  }
  s.records = [...days.values()].map(({ sources, ...day }) => ({ ...day, source: sources.size > 1 ? 'mixed' : [...sources][0] })).sort((a, b) => a.date.localeCompare(b.date));
  return s.records;
}
export function sleepConflicts(s, candidate) {
  const range = sessionBounds(candidate);
  return s.sessions.filter(row => {
    if (row.excluded || row.id === s.editingSessionId) return false;
    const other = sessionBounds(row);
    return range && other ? Math.min(range[1], other[1]) > Math.max(range[0], other[0]) : row.date === candidate.date;
  });
}
export function commitSleepSession(s, candidate, replaceConflicts = false) {
  const conflicts = sleepConflicts(s, candidate);
  if (conflicts.length && !replaceConflicts) {
    const error = Error('Review existing sleep before saving. These entries may describe the same sleep.');
    error.code = 'sleep-overlap'; error.sessionIds = conflicts.map(row => row.id); throw error;
  }
  const editing = s.sessions.find(row => row.id === s.editingSessionId);
  if (s.editingSessionId && (!editing || editing.excluded)) throw Error('This session is no longer available. Close and reopen it.');
  for (const row of conflicts) row.excluded = true;
  if (editing?.source === 'health') editing.excluded = true;
  const id = editing?.source === 'manual' ? editing.id : `manual-${++s.serial}`;
  const corrects = editing?.source === 'health' ? editing.id : editing?.corrects;
  const row = { ...candidate, id, ...(corrects ? { corrects } : {}) };
  const index = s.sessions.findIndex(item => item.id === id);
  if (index < 0) s.sessions.push(row); else s.sessions[index] = row;
  s.editingSessionId = id; s.selected = row.date; rebuildSleepDays(s); return row;
}
export function importSleepSessions(s, incoming) {
  // Validate the batch before changing anything; keys are stable across repeated syncs.
  const rows = incoming.map(item => {
    const bounds = sessionBounds(item);
    if (!item.origin || !item.externalId || !bounds || bounds[1] - bounds[0] > 24 * HOUR) throw Error('Invalid imported sleep session.');
    return { ...item, id: `health:${encodeURIComponent(item.origin)}:${encodeURIComponent(item.externalId)}`, date: item.wakeDate, hours: (bounds[1] - bounds[0]) / HOUR, source: 'health', kind: 'session' };
  });
  for (const row of rows) {
    for (const legacy of s.sessions) if (legacy.kind === 'legacy-total' && legacy.date === row.date && legacy.source === 'health') legacy.excluded = true;
    const index = s.sessions.findIndex(item => item.id === row.id);
    if (index < 0) s.sessions.push(row); else s.sessions[index] = { ...row, excluded: s.sessions[index].excluded ?? false };
  }
  rebuildSleepDays(s); return rows.length;
}
export function excludeSleepSession(s, id) {
  const row = s.sessions.find(item => item.id === id);
  if (!row) throw Error('Session not found.');
  row.excluded = true; rebuildSleepDays(s);
}
export function sessionsForDate(s, date = s.selected, excluded = false) {
  return s.sessions.filter(row => row.date === date && Boolean(row.excluded) === excluded).sort((a, b) => (sessionBounds(a)?.[0] ?? 0) - (sessionBounds(b)?.[0] ?? 0));
}
export const mockWearableSessions = () => [
  { externalId: 'night-a', origin: 'mock.health', originLabel: 'Sleep tracker · example', bedDate: '2026-10-14', bedtime: '23:00', wakeDate: '2026-10-15', wakeTime: '03:00', saved: 'Oct 15, 08:12' },
  { externalId: 'night-b', origin: 'mock.health', originLabel: 'Sleep tracker · example', bedDate: '2026-10-15', bedtime: '04:00', wakeDate: '2026-10-15', wakeTime: '07:00', saved: 'Oct 15, 08:12' },
];
