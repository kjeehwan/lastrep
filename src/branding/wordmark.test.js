import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import geometry from "./wordmarkGeometry.json";

describe("startup wordmark safe area", () => {
  it.each(["dev", "prod"])("keeps every visible %s pixel within Android's 192dp safe circle", (variant) => {
    const image = new Resvg(readFileSync(new URL(`../../assets/images/wordmark-splash-${variant}.svg`, import.meta.url)), { fitTo: { mode: "width", value: 864 } }).render();
    const png = { width: image.width, height: image.height, data: image.pixels };
    const radius = png.width * (192 / 288) / 2;
    let visible = 0;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      if (!png.data[(y * png.width + x) * 4 + 3]) continue;
      visible++;
      expect(Math.hypot(x - png.width / 2, y - png.height / 2)).toBeLessThan(radius);
    }
    expect(visible).toBeGreaterThan(1000);
  });
  it("uses a modest native enlargement of Home's wordmark", () => {
    const homeInkWidth = geometry.bounds.width * geometry.header.width / 260;
    expect(geometry.native.wordmarkWidth).toBeGreaterThan(homeInkWidth);
    expect(geometry.native.wordmarkWidth).toBeLessThan(homeInkWidth * 1.6);
  });
});
