import { sharingSearchKey } from "./workoutSharingContract";

/** Bounded prefix index for any word, including phrases starting at that word. */
export function sharingNamePrefixes(nickname: string): string[] {
  const words = sharingSearchKey(nickname).slice(0, 40).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  const prefixes = new Set<string>();
  for (let start = 0; start < words.length; start++) {
    const suffix = words.slice(start).join(" ");
    for (let length = 2; length <= suffix.length; length++) prefixes.add(suffix.slice(0, length));
  }
  return [...prefixes];
}
