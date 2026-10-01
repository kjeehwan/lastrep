import AsyncStorage from "@react-native-async-storage/async-storage";

const HEALTH_SYNC_CONSENT_KEY_PREFIX = "healthSyncConsentAccepted";

const getHealthSyncConsentKey = (uid: string) => `${HEALTH_SYNC_CONSENT_KEY_PREFIX}:${uid}`;

export const hasHealthSyncConsent = async (uid: string): Promise<boolean> =>
  (await AsyncStorage.getItem(getHealthSyncConsentKey(uid))) === "true";

export const acceptHealthSyncConsent = async (uid: string): Promise<void> => {
  await AsyncStorage.setItem(getHealthSyncConsentKey(uid), "true");
};

export const clearHealthSyncConsent = async (uid: string): Promise<void> => {
  await AsyncStorage.removeItem(getHealthSyncConsentKey(uid));
};
