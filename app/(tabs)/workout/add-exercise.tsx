import { NotebookHeader } from "../../../src/ui/notebook/NotebookHeader";
import { useNotebook, useNotebookStyles, notebookSheet } from "../../../src/ui/notebook/Notebook";
import { type NotebookColors } from "../../../src/ui/notebook/tokens";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { setPendingExerciseSelection } from "../../../src/workouts/addExerciseBridge";
import { loadFreeExerciseDbCatalog } from "../../../src/workouts/freeExerciseDbCatalog";
import {
  EXERCISE_CATALOG,
  EXERCISE_GROUPS,
  type ExerciseCatalogItem,
  type ExerciseGroupKey,
} from "../../../src/workouts/exerciseCatalog";

const FAVORITES_KEY = "workout-favorite-exercises-v1";
const FAVORITES_KEY_PREFIX = "workout-favorite-exercises-v1";
const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const isSubsequence = (needle: string, haystack: string) => {
  if (!needle) return true;
  let index = 0;
  for (let i = 0; i < haystack.length && index < needle.length; i += 1) {
    if (haystack[i] === needle[index]) index += 1;
  }
  return index === needle.length;
};
const scoreExerciseSearch = (needle: string, searchableText: string, title: string) => {
  if (!needle) return 1;
  let score = 0;
  if (title.startsWith(needle)) score += 120;
  if (title.includes(needle)) score += 80;
  if (searchableText.includes(needle)) score += 60;
  const tokens = needle.split(" ").filter(Boolean);
  const tokenHits = tokens.filter((token) => searchableText.includes(token)).length;
  score += tokenHits * 20;
  if (isSubsequence(needle.replace(/\s+/g, ""), title.replace(/\s+/g, ""))) score += 20;
  return score;
};

export default function AddExerciseScreen() {
  const { colors } = useNotebook();
  const styles = useNotebookStyles(createStyles);
  const router = useRouter();
  const auth = getAuth();
  const [activeUid, setActiveUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const params = useLocalSearchParams<{ recent?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<TextInput>(null);
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [customExercise, setCustomExercise] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ExerciseCatalogItem[]>(EXERCISE_CATALOG);
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);

  const recentExercises = useMemo(() => {
    try {
      const raw = params.recent;
      if (!raw) return [] as string[];
      const parsed = JSON.parse(String(raw));
      if (!Array.isArray(parsed)) return [] as string[];
      return parsed.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    } catch {
      return [] as string[];
    }
  }, [params.recent]);

  const favoriteSet = useMemo(
    () => new Set(favoriteExercises.map((item) => item.toLowerCase())),
    [favoriteExercises]
  );
  const recentSet = useMemo(
    () => new Set(recentExercises.map((item) => item.toLowerCase())),
    [recentExercises]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setActiveUid(user?.uid ?? null);
    });
    return unsubscribe;
  }, [auth]);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        if (!activeUid) {
          setFavoriteExercises([]);
          return;
        }
        setFavoriteExercises([]);
        const scopedKey = activeUid ? `${FAVORITES_KEY_PREFIX}:${activeUid}` : FAVORITES_KEY;
        let raw = await AsyncStorage.getItem(scopedKey);
        // Backward compatibility with pre-scoped favorites key.
        if (!raw) {
          raw = await AsyncStorage.getItem(FAVORITES_KEY);
        }
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteExercises(parsed.filter((item) => typeof item === "string"));
        }
      } catch {
        // no-op
      }
    };
    void loadFavorites();
  }, [activeUid]);

  useEffect(() => {
    let cancelled = false;
    const hydrateCatalog = async () => {
      const remote = await loadFreeExerciseDbCatalog();
      if (cancelled || !remote.length) return;
      const dedup = new Map<string, ExerciseCatalogItem>();
      [...EXERCISE_CATALOG, ...remote].forEach((item) => {
        const key = item.name.trim().toLowerCase();
        if (!key || dedup.has(key)) return;
        dedup.set(key, item);
      });
      setCatalog(Array.from(dedup.values()));
    };
    void hydrateCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // Normalize and alphabetize once, not on each keystroke or clear action.
  const searchIndex = useMemo(() => catalog.map((item) => ({
    item,
    title: normalizeSearch(item.name),
    searchableText: normalizeSearch([
      item.name, ...item.aliases, ...item.primaryMuscles,
      ...item.secondaryMuscles, ...item.equipment, item.movementPattern,
    ].join(" ")),
  })).sort((a, b) => a.item.name.localeCompare(b.item.name)), [catalog]);

  const filtered = useMemo(() => {
    const group =
      activeGroup === "all" || activeGroup === "favorites" || activeGroup === "recent"
        ? "all"
        : (activeGroup as ExerciseGroupKey);
    const needle = normalizeSearch(deferredSearchQuery);
    const base = searchIndex.filter(({ item }) => {
      if (group !== "all" && item.group !== group) return false;
      const name = item.name.toLowerCase();
      if (activeGroup === "favorites") return favoriteSet.has(name);
      if (activeGroup === "recent") return recentSet.has(name);
      return true;
    });
    if (!needle) return base.map(({ item }) => item);
    const matches = base
      .map(({ item, title, searchableText }) => {
        return {
          item,
          score: scoreExerciseSearch(needle, searchableText, title),
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .map((entry) => entry.item);

    return matches;
  }, [activeGroup, deferredSearchQuery, searchIndex, favoriteSet, recentSet]);

  const toggleFavorite = useCallback(async (name: string) => {
    const needle = name.trim().toLowerCase();
    if (!needle) return;
    setFavoriteExercises((prev) => {
      const exists = prev.some((entry) => entry.toLowerCase() === needle);
      const next = exists
        ? prev.filter((entry) => entry.toLowerCase() !== needle)
        : [...prev, name.trim()];
      const scopedKey = activeUid ? `${FAVORITES_KEY_PREFIX}:${activeUid}` : FAVORITES_KEY;
      AsyncStorage.setItem(scopedKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [activeUid]);

  const toggleExerciseSelection = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSelectedExercises((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === trimmed.toLowerCase());
      return exists ? prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()) : [...prev, trimmed];
    });
  }, []);

  const submitSelection = useCallback(
    async (names: string[]) => {
      if (!names.length) return;
      await setPendingExerciseSelection(names, activeUid);
      router.back();
    },
    [activeUid, router]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <NotebookHeader title="Add exercise" onBack={() => router.back()} action={`Add (${selectedExercises.length})`} onAction={() => void submitSelection(selectedExercises)} disabled={!selectedExercises.length} />

        <View style={styles.topControls}>
          <View style={styles.searchField}>
            <TextInput disableFullscreenUI
              ref={searchInputRef}
              placeholder="Search exercises"
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear exercise search"
                style={styles.searchClear}
                onPress={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
          {selectedExercises.length ? (
            <View style={styles.selectedExerciseList}>
              {selectedExercises.map((name) => (
                <TouchableOpacity key={name.toLowerCase()} style={styles.selectedExerciseChip} onPress={() => toggleExerciseSelection(name)}>
                  <Text style={styles.selectedExerciseText} numberOfLines={1}>{name}</Text>
                  <Ionicons name="close" size={14} color={colors.ink} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <FlatList
            horizontal
            data={[
              { key: "all", label: "All" },
              { key: "favorites", label: "Favorites" },
              ...(recentExercises.length > 0 ? [{ key: "recent", label: "Recent" }] : []),
              ...EXERCISE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
            ]}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupChips}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.groupChip, activeGroup === item.key && styles.groupChipActive]}
                onPress={() => setActiveGroup(item.key)}
              >
                <Text style={[styles.groupChipText, activeGroup === item.key && styles.groupChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <FlatList
          data={filtered}
          contentContainerStyle={styles.exerciseList}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={24}
          maxToRenderPerBatch={36}
          windowSize={10}
          removeClippedSubviews
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity style={styles.rowMain} onPress={() => toggleExerciseSelection(item.name)}>
                <Ionicons
                  name={selectedExercises.some((name) => name.toLowerCase() === item.name.toLowerCase()) ? "checkmark-circle" : "add-circle-outline"}
                  size={20}
                  color={colors.accent}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.primaryMuscles.slice(0, 2).join(", ")} | {item.equipment.slice(0, 2).join(", ")}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void toggleFavorite(item.name)} style={styles.iconButton}>
                <Ionicons
                  name={favoriteSet.has(item.name.toLowerCase()) ? "star" : "star-outline"}
                  size={16}
                  color={colors.accent}
                />
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.customRow}>
          <TextInput disableFullscreenUI
            placeholder="Custom exercise"
            placeholderTextColor={colors.muted}
            value={customExercise}
            onChangeText={setCustomExercise}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              const trimmed = customExercise.trim();
              if (!trimmed) return;
              void submitSelection([...selectedExercises, trimmed]);
            }}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: NotebookColors) => { const base = notebookSheet({
  safe: { flex: 1, backgroundColor: colors.canvas },
  keyboardAvoiding: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.subtle,
  },
  addSelectedButton: { minWidth: 58, paddingHorizontal: 10, height: 34, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  addSelectedButtonDisabled: { backgroundColor: colors.subtle },
  addSelectedText: { color: colors.onPrimary, fontSize: 12, fontWeight: "800" },
  topControls: { paddingHorizontal: 12, paddingBottom: 8 },
  exerciseList: { paddingHorizontal: 12 },
  searchField: {
    flexDirection: "row", alignItems: "center", marginBottom: 8,
    backgroundColor: colors.subtle, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.rule,
  },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, paddingHorizontal: 12, paddingVertical: 10 },
  searchClear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  input: {
    backgroundColor: colors.subtle,
    color: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    marginBottom: 8,
  },
  groupChips: { gap: 8, paddingVertical: 4 },
  selectedExerciseList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  selectedExerciseChip: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: colors.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  selectedExerciseText: { color: colors.ink, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  groupChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  groupChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  groupChipText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  groupChipTextActive: { color: colors.ink },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { color: colors.ink, fontWeight: "600" },
  rowMeta: { color: colors.muted, fontSize: 12 },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    backgroundColor: colors.canvas,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addButtonText: { color: colors.onPrimary, fontWeight: "700" },
}); return { ...base, ...notebookSheet({
 searchField: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 4, backgroundColor: colors.surface, paddingHorizontal: 12, marginBottom: 12 },
 searchInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 16 },
 row: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: colors.canvas },
 rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" }, rowMeta: { color: colors.muted, fontSize: 14, marginTop: 4 },
 input: { borderWidth: 1, borderColor: colors.border, borderRadius: 4, color: colors.ink, backgroundColor: colors.surface, minHeight: 48, paddingHorizontal: 12, fontSize: 16 },
 addButton: { minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
}) }; };
