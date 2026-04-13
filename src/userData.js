import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./config/firebaseConfig";
import { isExpectedOfflineError } from "./utils/networkErrors";

const getDateStringFromOffset = (now, tzOffsetMinutes) => {
  const effective = new Date(now.getTime() - tzOffsetMinutes * 60 * 1000);
  const year = effective.getUTCFullYear();
  const month = String(effective.getUTCMonth() + 1).padStart(2, "0");
  const day = String(effective.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildDefaultUsage = (now = new Date(), tzOffsetMinutes = new Date().getTimezoneOffset()) => ({
  decisions: {
    freeRemaining: 3,
    dailyCount: 0,
    dailyDate: getDateStringFromOffset(now, tzOffsetMinutes),
    tzOffsetMinutes,
  },
});

// Local read fallback only. The client must not write entitlement data.
export const buildDefaultEntitlement = () => ({
  isSubscribed: false,
  source: null,
  productId: null,
  expiresAt: null,
});

export const buildDefaultUserDoc = (
  overrides = {},
  now = new Date(),
  tzOffsetMinutes = new Date().getTimezoneOffset()
) => ({
  usage: buildDefaultUsage(now, tzOffsetMinutes),
  ...overrides,
});

export const getDecisionUsage = (userDoc = {}, now = new Date(), tzOffsetMinutes = new Date().getTimezoneOffset()) => {
  const usage = userDoc.usage || {};
  const decisions = usage.decisions || {};
  const effectiveOffset =
    typeof decisions.tzOffsetMinutes === "number" ? decisions.tzOffsetMinutes : tzOffsetMinutes;
  const base = {
    freeRemaining: typeof decisions.freeRemaining === "number" ? decisions.freeRemaining : 3,
    dailyCount: typeof decisions.dailyCount === "number" ? decisions.dailyCount : 0,
    dailyDate:
      typeof decisions.dailyDate === "string"
        ? decisions.dailyDate
        : getDateStringFromOffset(now, effectiveOffset),
    tzOffsetMinutes: effectiveOffset,
  };
  if (decisions.lastDecisionAt) base.lastDecisionAt = decisions.lastDecisionAt;
  if (typeof decisions.lastInputsHash === "string") base.lastInputsHash = decisions.lastInputsHash;
  if (decisions.lastResult) base.lastResult = decisions.lastResult;
  return base;
};

export const normalizeDecisionUsage = (decisions = {}, now = new Date(), tzOffsetMinutes = new Date().getTimezoneOffset()) => {
  const today = getDateStringFromOffset(now, tzOffsetMinutes);
  const dailyDate = decisions.dailyDate || today;
  if (dailyDate !== today) {
    return {
      ...decisions,
      dailyDate: today,
      dailyCount: 0,
      tzOffsetMinutes,
    };
  }
  return { ...decisions, dailyDate, tzOffsetMinutes };
};

// Save user data to Firestore (default to merging to avoid overwriting previous onboarding steps)
export const saveUserData = async (userId, userData, merge = true) => {
  try {
    await setDoc(doc(db, "users", userId), userData, { merge });
    console.log(merge ? "User data merged." : "User data saved.");
  } catch (error) {
    console.error("Error saving user data:", error);
  }
};

export const getUserData = async (userId) => {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }

    console.warn("No such user document!");
    return null;
  } catch (error) {
    if (!isExpectedOfflineError(error)) {
      console.error("Error fetching user data:", error);
    }
    return null;
  }
};
