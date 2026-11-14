import { describe, it, expect } from "vite-plus/test";
import { ART, GRID_SIZE, pixelPath } from "../art";
import { KNICK_KNACK_IDS } from "../catalog";

/** Paint a pixelPath back onto a blank grid. */
const decode = (d: string): string[] => {
  const cells = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill("."));
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) {
      const row = cells[Number(y)];
      expect(row[Number(x) + i]).toBe("."); // runs never overlap
      row[Number(x) + i] = "#";
    }
  }
  return cells.map((row) => row.join(""));
};

describe("knick-knack art", () => {
  it.each(Object.entries(ART))("%s is a 32×32 grid of ink and paper", (_, grid) => {
    expect(grid).toHaveLength(GRID_SIZE);
    for (const row of grid) expect(row).toMatch(/^[#.]{32}$/);
  });

  it.each(Object.entries(ART))("%s's path covers exactly its ink", (_, grid) => {
    expect(decode(pixelPath(grid))).toEqual(grid);
  });

  it("merges each run of ink into one rect", () => {
    expect(pixelPath([".##.#", "....."])).toBe("M1 0h2v1h-2zM4 0h1v1h-1z");
  });

  it("has art for every catalog entry", () => {
    expect(Object.keys(ART).sort()).toEqual([...KNICK_KNACK_IDS].sort());
  });
});
