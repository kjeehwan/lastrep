import { expect, it, vi } from "vitest";
import { createThemePreferenceStore, parseThemePreference, resolveTheme, THEME_PREFERENCE_KEY } from "./themePreference";

it("defaults missing/invalid preferences to System and resolves each override independently", () => {
  for (const raw of [null, "", "invalid", "system"]) expect(parseThemePreference(raw)).toBe("system");
  expect(resolveTheme("light", "dark")).toBe("light");
  expect(resolveTheme("dark", "light")).toBe("dark");
  expect(resolveTheme("system", "dark")).toBe("dark");
  expect(resolveTheme("system", "light")).toBe("light");
  expect(resolveTheme("system", null)).toBe("light");
  expect(resolveTheme("system", "unspecified")).toBe("light");
});

it("loads the saved choice before readiness and persists it for the next app instance", async () => {
  let value: string | null = "dark";
  const storage = { getItem: vi.fn(async () => value), setItem: vi.fn(async (_key: string, next: string) => { value = next; }) };
  const store = createThemePreferenceStore(storage);
  expect(store.getSnapshot().ready).toBe(false);
  await Promise.all([store.load(), store.load()]);
  expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(THEME_PREFERENCE_KEY);
  expect(store.getSnapshot()).toMatchObject({ preference: "dark", ready: true });
  const save = store.setPreference("light");
  expect(store.getSnapshot()).toMatchObject({ preference: "light", saving: true });
  await save;
  expect(storage.setItem).toHaveBeenCalledWith(THEME_PREFERENCE_KEY, "light");
  const reopened = createThemePreferenceStore(storage);
  await reopened.load();
  expect(reopened.getSnapshot()).toMatchObject({ preference: "light", ready: true, saving: false });
});

it("settles a read failure without blocking the app", async () => {
  const store = createThemePreferenceStore({ getItem: async () => { throw Error("unavailable"); }, setItem: async () => undefined });
  await expect(store.load()).resolves.toBeUndefined();
  expect(store.getSnapshot()).toMatchObject({ preference: "system", ready: true, feedback: "Couldn't load appearance. Using System." });
});

it("rolls a failed save back to the durable preference and allows retry", async () => {
  let fail = true;
  const store = createThemePreferenceStore({ getItem: async () => "dark", setItem: async () => { if (fail) throw Error("full"); } });
  await store.load();
  await expect(store.setPreference("light")).resolves.toBeUndefined();
  expect(store.getSnapshot()).toMatchObject({ preference: "dark", saving: false, feedback: "Couldn't save appearance. Please try again." });
  fail = false;
  await store.setPreference("light");
  expect(store.getSnapshot()).toMatchObject({ preference: "light", saving: false, feedback: null });
});

it("serializes overlapping writes and prevents an earlier failure from undoing a newer choice", async () => {
  let rejectFirst!: (error: Error) => void;
  const firstWrite = new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
  const setItem = vi.fn().mockImplementationOnce(() => firstWrite).mockResolvedValueOnce(undefined);
  const store = createThemePreferenceStore({ getItem: async () => null, setItem });
  await store.load();
  const first = store.setPreference("light");
  const second = store.setPreference("dark");
  await vi.waitFor(() => expect(setItem).toHaveBeenCalledTimes(1));
  rejectFirst(Error("failed"));
  await Promise.all([first, second]);
  expect(setItem.mock.calls.map((call) => call[1])).toEqual(["light", "dark"]);
  expect(store.getSnapshot()).toMatchObject({ preference: "dark", saving: false, feedback: null });
});

it("unsubscribes listeners when screens close", async () => {
  const store = createThemePreferenceStore({ getItem: async () => null, setItem: async () => undefined });
  const listener = vi.fn();
  const unsubscribe = store.subscribe(listener);
  await store.load();
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  await store.setPreference("dark");
  expect(listener).toHaveBeenCalledTimes(2);
});


it("defaults each account to System and restores only its own local choice", async () => {
  const { accountThemeKey } = await import("./themePreference");
  const data = new Map<string, string>([[THEME_PREFERENCE_KEY, "dark"]]);
  const store = createThemePreferenceStore({ getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } });
  await store.load(accountThemeKey("first"));
  expect(store.getSnapshot().preference).toBe("system");
  await store.setPreference("dark");
  await store.load(accountThemeKey("new"));
  expect(store.getSnapshot().preference).toBe("system");
  await store.setPreference("light");
  await store.load(accountThemeKey(null));
  expect(store.getSnapshot().preference).toBe("system");
  await store.load(accountThemeKey("first"));
  expect(store.getSnapshot().preference).toBe("dark");
});

it("ignores a late account read and isolates queued writes during account switching", async () => {
  let finishRead!: (value: string | null) => void;
  let finishWrite!: () => void;
  const data = new Map<string, string>();
  const store = createThemePreferenceStore({
    getItem: key => key === "slow" ? new Promise(resolve => { finishRead = resolve; }) : Promise.resolve(data.get(key) ?? null),
    setItem: async (key, value) => { await new Promise<void>(resolve => { finishWrite = resolve; }); data.set(key, value); },
  });
  const slow = store.load("slow");
  await store.load("first");
  finishRead("dark"); await slow;
  expect(store.getSnapshot().preference).toBe("system");
  const write = store.setPreference("dark");
  await Promise.resolve();
  await store.load("second");
  finishWrite(); await write;
  expect(data.get("first")).toBe("dark");
  expect(data.has("second")).toBe(false);
  expect(store.getSnapshot()).toMatchObject({ preference: "system", saving: false });
});
