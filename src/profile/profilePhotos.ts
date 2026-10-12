import * as FileSystem from "expo-file-system/legacy";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Platform } from "react-native";
import { auth } from "../config/firebaseConfig";
import { cloudPhotoPath, cloudPhotoReference } from "./profilePhotoReference";

const MAX_INPUT_BYTES = 6 * 1024 * 1024;
const downloads = new Map<string, Promise<string>>();
const memoryCache = new Map<string, string>();
const cacheGeneration = new Map<string, number>();

function requireAccount(uid: string): void {
  if (auth.currentUser?.uid !== uid) throw new Error("Sign in again to manage your photo.");
}

function callable<Request, Response>(name: string, data: Request) {
  return httpsCallable<Request, Response>(getFunctions(getApp(), "asia-northeast3"), name)(data);
}

async function readPhotoBase64(uri: string): Promise<string> {
  if (Platform.OS !== "web") {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || (info.size ?? 0) > MAX_INPUT_BYTES) throw new Error("Choose an image smaller than 6 MB.");
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  if (blob.size > MAX_INPUT_BYTES) throw new Error("Choose an image smaller than 6 MB.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Couldn't read this photo."));
    reader.readAsDataURL(blob);
  });
}

export async function stageProfilePhoto(uid: string, uri: string): Promise<string> {
  requireAccount(uid);
  const base64 = await readPhotoBase64(uri);
  requireAccount(uid);
  const { data } = await callable<{ base64: string }, { path: string }>("stageProfilePhoto", { base64 });
  requireAccount(uid);
  return data.path;
}

export async function commitProfilePhoto(uid: string, path: string | null): Promise<string> {
  requireAccount(uid);
  await callable("commitProfilePhoto", { path });
  requireAccount(uid);
  return path ? cloudPhotoReference(path) : "";
}

export async function discardProfilePhotoUpload(uid: string, path: string): Promise<void> {
  requireAccount(uid);
  await callable("discardProfilePhotoUpload", { path });
}

export async function resolveProfilePhoto(uid: string, reference: string): Promise<string> {
  const path = cloudPhotoPath(reference);
  if (!path) return reference;
  requireAccount(uid);
  const key = `${uid}:${path}`;
  const generation = cacheGeneration.get(uid) ?? 0;
  const checkCacheAccount = () => {
    requireAccount(uid);
    if ((cacheGeneration.get(uid) ?? 0) !== generation) throw new Error("Photo cache was cleared.");
  };
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  if (downloads.has(key)) return downloads.get(key)!;
  const task = (async () => {
    const directory = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}profile-photos/` : null;
    const filename = `${encodeURIComponent(uid)}-${path.split("/").pop()}`;
    const cacheUri = directory ? `${directory}${filename}` : null;
    if (Platform.OS !== "web" && cacheUri && (await FileSystem.getInfoAsync(cacheUri)).exists) return cacheUri;
    const { data } = await callable<Record<string, never>, { path: string | null; base64: string | null }>("getProfilePhoto", {});
    checkCacheAccount();
    if (data.path !== path || !data.base64) throw new Error("Photo changed. Refresh your profile.");
    let uri = `data:image/jpeg;base64,${data.base64}`;
    if (Platform.OS !== "web" && directory && cacheUri) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      checkCacheAccount();
      await FileSystem.writeAsStringAsync(cacheUri, data.base64, { encoding: FileSystem.EncodingType.Base64 });
      try { checkCacheAccount(); }
      catch (error) {
        await FileSystem.deleteAsync(cacheUri, { idempotent: true });
        throw error;
      }
      uri = cacheUri;
    }
    return uri;
  })();
  downloads.set(key, task);
  try {
    const uri = await task;
    checkCacheAccount();
    memoryCache.set(key, uri);
    return uri;
  } finally {
    downloads.delete(key);
  }
}

export async function clearProfilePhotoCache(uid: string): Promise<void> {
  cacheGeneration.set(uid, (cacheGeneration.get(uid) ?? 0) + 1);
  for (const key of memoryCache.keys()) if (key.startsWith(`${uid}:`)) memoryCache.delete(key);
  if (Platform.OS === "web" || !FileSystem.cacheDirectory) return;
  const directory = `${FileSystem.cacheDirectory}profile-photos/`;
  if (!(await FileSystem.getInfoAsync(directory)).exists) return;
  const files = await FileSystem.readDirectoryAsync(directory);
  await Promise.all(files.filter((file) => file.startsWith(`${encodeURIComponent(uid)}-`))
    .map((file) => FileSystem.deleteAsync(`${directory}${file}`, { idempotent: true })));
}
