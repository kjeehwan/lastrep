import { describe, expect, it, vi } from "vitest";
import { lookupFoodByBarcode, normalizeBarcode, openFoodFactsProductToFood } from "./barcode";

describe("nutrition barcode lookup", () => {
  it("normalizes common barcode formatting", () => {
    expect(normalizeBarcode(" 880-1234-567890 ")).toBe("8801234567890");
    expect(normalizeBarcode("123")).toBeNull();
  });

  it("maps a Korean packaged product with serving nutrition", () => {
    expect(
      openFoodFactsProductToFood("8801234567890", {
        product_name_ko: "Protein Milk",
        brands: "Example",
        serving_size: "1 bottle (250 g)",
        serving_quantity: 250,
        nutriments: {
          "energy-kcal_100g": 80,
          proteins_100g: 8,
          carbohydrates_100g: 5,
          fat_100g: 2,
        },
      })
    ).toMatchObject({
      id: "off-8801234567890",
      barcode: "8801234567890",
      name: "Example Protein Milk",
      servingGrams: 250,
      caloriesPer100g: 80,
      proteinPer100g: 8,
    });
  });

  it("returns null when Open Food Facts has no usable product", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ status: 0 }), { status: 200 })
    ) as typeof fetch;
    await expect(lookupFoodByBarcode("8801234567890", fetcher)).resolves.toBeNull();
  });

  it("treats a missing barcode as not found rather than a connection error", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ status: 0 }), { status: 404 })
    ) as typeof fetch;
    await expect(lookupFoodByBarcode("8801234567890", fetcher)).resolves.toBeNull();
  });

  it("converts kJ energy when kcal is unavailable", () => {
    const food = openFoodFactsProductToFood("8801234567890", {
      product_name: "Local snack",
      nutriments: { energy_100g: 418.4, proteins_100g: 2 },
    });
    expect(food?.caloriesPer100g).toBeCloseTo(100);
  });
});
