import AsyncStorage from "@react-native-async-storage/async-storage";

// Save any key/value pair as JSON
export const saveSetting = async (key: string, value: any) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to save setting for ${key}:`, err);
  }
};

// Retrieve value; if none, return a default
export const getSetting = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const item = await AsyncStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.warn(`Failed to read setting for ${key}:`, err);
    return defaultValue;
  }
};

// Remove a setting key
export const removeSetting = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.warn(`Failed to remove setting for ${key}:`, err);
  }
};
