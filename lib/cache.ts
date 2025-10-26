import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "lastrep_cache_";

/**
 * Save any object or primitive value in the cache.
 * @param key Cache key (e.g., "user_profile", "workout_history")
 * @param value Any serializable value
 */
export async function cacheSet(key: string, value: any) {
  try {
    const json = JSON.stringify(value);
    await AsyncStorage.setItem(CACHE_PREFIX + key, json);
  } catch (err) {
    console.warn(`[cacheSet] Failed to store ${key}:`, err);
  }
}

/**
 * Retrieve a cached item. Returns fallback if missing or invalid.
 * @param key Cache key
 * @param fallback Default value if none exists
 */
export async function cacheGet<T = any>(
  key: string,
  fallback: T | null = null
): Promise<T | null> {
  try {
    const json = await AsyncStorage.getItem(CACHE_PREFIX + key);
    return json ? JSON.parse(json) : fallback;
  } catch (err) {
    console.warn(`[cacheGet] Failed to read ${key}:`, err);
    return fallback;
  }
}

/**
 * Remove a specific cache entry.
 * @param key Cache key to remove
 */
export async function cacheRemove(key: string) {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch (err) {
    console.warn(`[cacheRemove] Failed to remove ${key}:`, err);
  }
}

/**
 * Clear all LastRep cache entries (user/session data).
 * Keeps persistent settings intact (from storage.ts).
 */
export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const appCacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (appCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(appCacheKeys);
    }
  } catch (err) {
    console.warn("[clearCache] Failed to clear cache:", err);
  }
}
