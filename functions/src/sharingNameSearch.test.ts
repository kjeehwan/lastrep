import { describe, expect, it } from "vitest";
import { sharingNamePrefixes } from "./sharingNameSearch";

describe("nickname word search", () => {
  it("indexes prefixes of every nickname word and phrase", () => {
    const prefixes = sharingNamePrefixes("Program QA Alex");
    for (const query of ["al", "alex", "qa", "qa al", "program qa"]) expect(prefixes).toContain(query);
    for (const query of ["lex", "a", "unknown"]) expect(prefixes).not.toContain(query);
  });
  it("normalizes case, compatibility characters, whitespace and punctuation", () => {
    expect(sharingNamePrefixes("  Program-QA   Ａｌｅｘ ")).toContain("alex");
    expect(sharingNamePrefixes("Alex Alex").filter(value=>value==="alex")).toHaveLength(1);
    expect(sharingNamePrefixes("라스트렙 사용자")).toContain("사용");
  });
  it("bounds index size and excludes empty names", () => {
    expect(sharingNamePrefixes("")).toEqual([]);
    const prefixes = sharingNamePrefixes("Ab ".repeat(100));
    expect(prefixes.length).toBeLessThanOrEqual(800);
    expect(prefixes.every(value=>value.length<=40)).toBe(true);
  });
});
