export type ThemePreference = "light" | "dark" | "system";
export const THEME_PREFERENCE_KEY = "lastrep.appearance";
export const accountThemeKey = (uid: string | null) => `${THEME_PREFERENCE_KEY}.account.${uid ?? "signed-out"}`;
export type ThemePreferenceState = { preference: ThemePreference; ready: boolean; saving: boolean; feedback: string | null };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveTheme(preference: ThemePreference, system: "light" | "dark" | "unspecified" | null | undefined): "light" | "dark" {
  return preference === "system" ? system === "dark" ? "dark" : "light" : preference;
}

/** Serialize device-local writes; failed/older requests must not erase a newer selection. */
export function createThemePreferenceStore(storage: Storage) {
  let state: ThemePreferenceState = { preference: "system", ready: false, saving: false, feedback: null };
  let saved: ThemePreference = "system";
  let request = 0;
  let loading: Promise<void> | null = null;
  let storageKey = THEME_PREFERENCE_KEY;
  let generation = 0;
  let loaded = false;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ThemePreferenceState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load: (key = THEME_PREFERENCE_KEY) => {
      if (loading && key === storageKey) return loading;
      storageKey = key;
      const scope = ++generation;
      loaded = false;
      saved = "system";
      update({ preference: "system", saving: state.ready, feedback: null });
      loading = (async () => {
        try {
          const value = parseThemePreference(await storage.getItem(key));
          if (scope === generation) { loaded = true; saved = value; update({ preference: value, ready: true, saving: false }); }
        } catch {
          if (scope === generation) { loaded = true; update({ ready: true, saving: false, feedback: "Couldn't load appearance. Using System." }); }
        }
      })();
      return loading;
    },
    setPreference: (preference: ThemePreference): Promise<void> => {
      if (!state.ready || !loaded) return Promise.resolve();
      const id = ++request;
      const key = storageKey;
      const scope = generation;
      update({ preference, saving: true, feedback: null });
      writes = writes.then(async () => {
        try {
          await storage.setItem(key, preference);
          if (scope === generation) saved = preference;
          if (scope === generation && id === request) update({ saving: false });
        } catch {
          if (scope === generation && id === request) update({ preference: saved, saving: false, feedback: "Couldn't save appearance. Please try again." });
        }
      });
      return writes;
    },
  };
}
