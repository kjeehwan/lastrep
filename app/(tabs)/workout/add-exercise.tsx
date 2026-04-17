import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
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

export default function AddExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recent?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [customExercise, setCustomExercise] = useState("");
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
    const loadFavorites = async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_KEY);
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
  }, []);

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

  const filtered = useMemo(() => {
    const group =
      activeGroup === "all" || activeGroup === "favorites" || activeGroup === "recent"
        ? "all"
        : (activeGroup as ExerciseGroupKey);
    const needle = searchQuery.trim().toLowerCase();
    const base = group === "all" ? catalog : catalog.filter((item) => item.group === group);
    const matches = needle
      ? base.filter((item) => {
          const haystack = [
            item.name,
            ...item.aliases,
            ...item.primaryMuscles,
            ...item.secondaryMuscles,
            ...item.equipment,
            item.movementPattern,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        })
      : base;

    const filteredByTab = matches.filter((item) => {
      const name = item.name.toLowerCase();
      if (activeGroup === "favorites") return favoriteSet.has(name);
      if (activeGroup === "recent") return recentSet.has(name);
      return true;
    });

    return filteredByTab.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeGroup, searchQuery, catalog, favoriteSet, recentSet]);

  const toggleFavorite = useCallback(async (name: string) => {
    const needle = name.trim().toLowerCase();
    if (!needle) return;
    setFavoriteExercises((prev) => {
      const exists = prev.some((entry) => entry.toLowerCase() === needle);
      const next = exists
        ? prev.filter((entry) => entry.toLowerCase() !== needle)
        : [...prev, name.trim()];
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const submitSelection = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await setPendingExerciseSelection(trimmed);
      router.back();
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Exercise</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.topControls}>
        <TextInput
          placeholder="Search exercises"
          placeholderTextColor="#7a7a8c"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.input}
        />
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
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={24}
        maxToRenderPerBatch={36}
        windowSize={10}
        removeClippedSubviews
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.rowMain} onPress={() => void submitSelection(item.name)}>
              <Ionicons name="add-circle-outline" size={18} color="#7b61ff" />
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
                color="#ffd166"
              />
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.customRow}>
        <TextInput
          placeholder="Custom exercise"
          placeholderTextColor="#7a7a8c"
          value={customExercise}
          onChangeText={setCustomExercise}
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
        />
        <TouchableOpacity style={styles.addButton} onPress={() => void submitSelection(customExercise)}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d1a" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerSpacer: {
    width: 34,
    height: 34,
  },
  topControls: { paddingHorizontal: 12, paddingBottom: 8 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 8,
  },
  groupChips: { gap: 8, paddingVertical: 4 },
  groupChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  groupChipActive: { backgroundColor: "rgba(123,97,255,0.22)", borderColor: "#7b61ff" },
  groupChipText: { color: "#cdd0e0", fontSize: 12, fontWeight: "600" },
  groupChipTextActive: { color: "#fff" },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { color: "#fff", fontWeight: "600" },
  rowMeta: { color: "#98a0b3", fontSize: 12 },
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
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0d0d1a",
  },
  addButton: {
    backgroundColor: "#7b61ff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addButtonText: { color: "#fff", fontWeight: "700" },
});
