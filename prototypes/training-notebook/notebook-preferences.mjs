// Synthetic preferences shared only by these studies in the same browser tab.
const KEY = 'lastrep-notebook-preferences-v1';
export function readNotebookPreferences() {
  try { const value = JSON.parse(sessionStorage.getItem(KEY)); return value?.version === 1 && value.profile && typeof value.profile === 'object' ? value : null; } catch { return null; }
}
export function writeNotebookPreferences(patch) {
  try { const current = readNotebookPreferences() ?? {}; sessionStorage.setItem(KEY, JSON.stringify({ version: 1, ...current, ...patch, profile: { ...current.profile, ...patch.profile } })); return true; } catch { return false; }
}
export function clearNotebookPreferences() { try { sessionStorage.removeItem(KEY); } catch { /* Private-mode storage can be unavailable. */ } }
