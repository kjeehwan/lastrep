import type { FoodItem } from "./foodDb";

type OpenFoodFactsProduct = {
  product_name?: unknown;
  product_name_en?: unknown;
  product_name_ko?: unknown;
  brands?: unknown;
  serving_size?: unknown;
  serving_quantity?: unknown;
  nutriments?: Record<string, unknown>;
};

type OpenFoodFactsResponse = {
  status?: unknown;
  product?: OpenFoodFactsProduct;
};

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBarcode(value: string): string | null {
  const barcode = value.replace(/\D/g, "");
  return barcode.length >= 8 && barcode.length <= 14 ? barcode : null;
}

export function openFoodFactsProductToFood(
  barcode: string,
  product: OpenFoodFactsProduct
): FoodItem | null {
  const nutriments = product.nutriments ?? {};
  const calories =
    finiteNumber(nutriments["energy-kcal_100g"]) ??
    finiteNumber(nutriments["energy-kcal"]) ??
    (() => {
      const energyKj = finiteNumber(nutriments.energy_100g);
      return energyKj == null ? null : energyKj / 4.184;
    })();
  const protein = finiteNumber(nutriments.proteins_100g) ?? 0;
  if (calories == null || calories <= 0 || protein < 0) return null;

  const localizedName =
    text(product.product_name_ko) || text(product.product_name) || text(product.product_name_en);
  if (!localizedName) return null;
  const brand = text(product.brands).split(",")[0]?.trim() ?? "";
  const name = brand && !localizedName.toLowerCase().includes(brand.toLowerCase())
    ? `${brand} ${localizedName}`
    : localizedName;
  const servingQuantity = finiteNumber(product.serving_quantity);
  const servingGrams = servingQuantity != null && servingQuantity > 0 ? servingQuantity : 100;
  const servingLabel = text(product.serving_size) || `${Math.round(servingGrams)} g`;

  return {
    id: `off-${barcode}`,
    barcode,
    name,
    aliases: brand ? [localizedName, brand] : [localizedName],
    servingLabel,
    servingGrams,
    caloriesPer100g: calories,
    proteinPer100g: protein,
    carbsPer100g: finiteNumber(nutriments.carbohydrates_100g) ?? undefined,
    fatPer100g: finiteNumber(nutriments.fat_100g) ?? undefined,
    isBranded: true,
  };
}

export async function lookupFoodByBarcode(
  rawBarcode: string,
  fetcher: typeof fetch = fetch
): Promise<FoodItem | null> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) throw new Error("invalid_barcode");
  const fields = [
    "product_name",
    "product_name_en",
    "product_name_ko",
    "brands",
    "serving_size",
    "serving_quantity",
    "nutriments",
  ].join(",");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let response: Response;
  try {
    response = await fetcher(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Lastrep/1.0 (lastrep.dev@gmail.com)",
        },
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`barcode_lookup_${response.status}`);
  const payload = (await response.json()) as OpenFoodFactsResponse;
  if (Number(payload.status) !== 1 || !payload.product) return null;
  return openFoodFactsProductToFood(barcode, payload.product);
}
