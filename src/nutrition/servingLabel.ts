const fractions: Record<string, number> = {
  "¼": 1 / 4, "½": 1 / 2, "¾": 3 / 4, "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 1 / 10,
  "⅓": 1 / 3, "⅔": 2 / 3, "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5, "⅘": 4 / 5,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};
const decimal = (value: number) => {
  const rounded = Number(value.toFixed(3));
  // A very small positive source amount must never be displayed as zero.
  return String(rounded === 0 && value !== 0 ? Number(value.toPrecision(3)) : rounded);
};

/** Display only. Source labels and numeric serving weights remain authoritative. */
export function formatServingLabel(label: string): string {
  return String(label ?? "").trim()
    .replace(/(?<![\p{L}\p{N}./])(?:(\d+)\s+)?(\d+)\s*[/⁄]\s*(\d+)(?![\d/])/gu,
      (match, whole: string | undefined, numerator: string, denominator: string) => {
        const divisor = Number(denominator);
        return divisor > 0 ? decimal(Number(whole ?? 0) + Number(numerator) / divisor) : match;
      })
    .replace(/(?<![\p{L}\p{N}.])(?:(\d+)\s*)?([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/gu,
      (_match, whole: string | undefined, fraction: string) => decimal(Number(whole ?? 0) + fractions[fraction]));
}

/** Shared by search/recent/favorites and both new/existing-food serving previews. */
export function normalizeServingInfo(label: string | null | undefined, servingGrams: number): string {
  const raw = formatServingLabel(label ?? "");
  if (!raw) return "1 serving";
  const gramsPattern = /^\d+(?:\.\d+)?\s*(?:g|grams?)$/i;
  if (gramsPattern.test(raw)) return "1 serving";
  const alphaOnly = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (["g", "gram", "grams"].includes(alphaOnly)) return "1 serving";
  const gramsThenParen = raw.match(/^\d+(?:\.\d+)?\s*g\s*\(([^)]+)\)\s*$/i);
  if (gramsThenParen?.[1]) return gramsPattern.test(gramsThenParen[1].trim()) ? "1 serving" : gramsThenParen[1].trim();
  const textThenGramsParen = raw.match(/^(.+?)\s*\(\s*\d+(?:\.\d+)?\s*g\s*\)\s*$/i);
  if (textThenGramsParen?.[1]) return textThenGramsParen[1].trim();
  const normalized = raw.replace(/\s+/g, " ");
  return normalized.toLowerCase() === `${Math.round(servingGrams)} g` ? "1 serving" : normalized;
}
