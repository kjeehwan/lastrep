import { NativeModules, Platform } from "react-native";

type SamsungHealthBodyCompositionPayload = {
  weightKg?: number;
  bodyFatPercent?: number;
  muscleMassKg?: number;
  skeletalMuscleKg?: number;
  skeletalMuscleMassKg?: number;
  muscleMassFieldKg?: number;
  fatFreeMassKg?: number;
  recordedAtMs?: number;
  sourceAppId?: string | null;
  sourceDeviceId?: string | null;
  muscleFieldUsed?: string | null;
};

type SamsungHealthBodyCompositionModuleShape = {
  isAvailable(): Promise<boolean>;
  hasBodyCompositionPermission(): Promise<boolean>;
  requestBodyCompositionPermission(): Promise<boolean>;
  readLatestBodyComposition(): Promise<SamsungHealthBodyCompositionPayload | null>;
};

const moduleRef = NativeModules.SamsungHealthBodyComposition as
  | SamsungHealthBodyCompositionModuleShape
  | undefined;

export const isSamsungHealthBodyCompositionSupported = (): boolean =>
  Platform.OS === "android" && !!moduleRef;

export const isSamsungHealthBodyCompositionAvailable = async (): Promise<boolean> => {
  if (!isSamsungHealthBodyCompositionSupported()) return false;
  try {
    return await moduleRef!.isAvailable();
  } catch {
    return false;
  }
};

export const hasSamsungHealthBodyCompositionPermission = async (): Promise<boolean> => {
  if (!isSamsungHealthBodyCompositionSupported()) return false;
  return moduleRef!.hasBodyCompositionPermission();
};

export const requestSamsungHealthBodyCompositionPermission = async (): Promise<boolean> => {
  if (!isSamsungHealthBodyCompositionSupported()) return false;
  return moduleRef!.requestBodyCompositionPermission();
};

export const readLatestSamsungHealthBodyComposition = async (): Promise<SamsungHealthBodyCompositionPayload | null> => {
  if (!isSamsungHealthBodyCompositionSupported()) return null;
  return moduleRef!.readLatestBodyComposition();
};

export type { SamsungHealthBodyCompositionPayload };
