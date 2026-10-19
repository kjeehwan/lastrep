export const onboardingSteps = ["experience", "availability", "nickname", "health"] as const;
export type OnboardingStep = typeof onboardingSteps[number];
export type Experience = "" | "beginner" | "intermediate" | "advanced";
export type OnboardingDraft = { experience: Experience; availabilityDays: number; nickname: string };
export type OnboardingProgress = { version: 1; completed: boolean; step: OnboardingStep };
export type OnboardingCache = { progress: OnboardingProgress; draft: OnboardingDraft };
export const onboardingKey = (uid: string) => `lastrep.onboarding.account.${uid}`;
export const initialProgress: OnboardingProgress = { version: 1, completed: false, step: "experience" };
export const emptyDraft: OnboardingDraft = { experience: "", availabilityDays: 4, nickname: "" };
export const isOnboardingStep = (value: unknown): value is OnboardingStep => onboardingSteps.some(step => step === value);
export function parseProgress(value: unknown): OnboardingProgress | null {
  const data = value as Partial<OnboardingProgress> | null;
  return data?.version === 1 && typeof data.completed === "boolean" && isOnboardingStep(data.step)
    ? { version: 1, completed: data.completed, step: data.step } : null;
}
export function parseDraft(value: unknown): OnboardingDraft {
  const data = value as Partial<OnboardingDraft> | null;
  return {
    experience: ["beginner", "intermediate", "advanced"].includes(data?.experience ?? "") ? data!.experience! : "",
    availabilityDays: typeof data?.availabilityDays === "number" && Number.isFinite(data.availabilityDays) ? Math.max(1, Math.min(7, Math.round(data.availabilityDays))) : 4,
    nickname: typeof data?.nickname === "string" ? data.nickname : "",
  };
}
export function parseCache(raw: string | null): OnboardingCache | null {
  try {
    const data = raw ? JSON.parse(raw) : null;
    const progress = parseProgress(data?.progress);
    return progress ? { progress, draft: parseDraft(data.draft) } : null;
  } catch { return null; }
}
export function onboardingDestination(data: Record<string, unknown> | null, cache: OnboardingCache | null): "/(tabs)/home" | `/onboarding/${OnboardingStep}` {
  const cloud = parseProgress(data?.onboarding);
  // Cloud completion wins over an older local draft from another session/device.
  if (cloud?.completed || cache?.progress.completed) return "/(tabs)/home";
  const pending = cloud ?? cache?.progress;
  return pending ? `/onboarding/${pending.step}` : "/(tabs)/home";
  // Accounts predating explicit progress keep access, even with optional answers missing.
}
export function stepSubmission(step: OnboardingStep, draft: OnboardingDraft, skip: boolean) {
  const next = onboardingSteps[Math.min(onboardingSteps.indexOf(step) + 1, onboardingSteps.length - 1)];
  const progress: OnboardingProgress = { version: 1, completed: step === "health", step: next };
  const fields: Record<string, unknown> = { onboarding: progress };
  if (!skip && step === "experience" && draft.experience) fields.experience = draft.experience;
  if (!skip && step === "availability") { fields.availabilityDays = draft.availabilityDays; fields.availability = String(draft.availabilityDays); }
  if (!skip && step === "nickname" && draft.nickname.trim()) fields.nickname = draft.nickname.trim();
  return { progress, fields, destination: progress.completed ? "/(tabs)/home" as const : `/onboarding/${next}` as const };
}
