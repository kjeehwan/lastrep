import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "ai-decision-consent-v1";

const keyFor = (uid: string) => `${KEY_PREFIX}:${uid}`;

export const hasAiDecisionConsent = async (uid: string) =>
  (await AsyncStorage.getItem(keyFor(uid))) === "true";

export const setAiDecisionConsent = async (uid: string, accepted: boolean) => {
  if (accepted) {
    await AsyncStorage.setItem(keyFor(uid), "true");
  } else {
    await AsyncStorage.removeItem(keyFor(uid));
  }
};
