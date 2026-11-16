import { describe, it, expect } from "vite-plus/test";
import { cellFromPoint, lineCells, paintLine } from "../avatarGrid";
import { blankCells, serializeGrid } from "@/utils/pixelArt";

const box = { left: 10, top: 20, width: 300, height: 300 };

describe("cellFromPoint", () => {
  it("maps a point inside the canvas to its cell", () => {
    expect(cellFromPoint(10, 20, box, 30)).toEqual({ x: 0, y: 0 });
    expect(cellFromPoint(10 + 299, 20 + 299, box, 30)).toEqual({ x: 29, y: 29 });
    expect(cellFromPoint(10 + 55, 20 + 101, box, 30)).toEqual({ x: 5, y: 10 });
  });

  it("returns null outside the canvas", () => {
    expect(cellFromPoint(9, 30, box, 30)).toBeNull();
    expect(cellFromPoint(310, 30, box, 30)).toBeNull();
    expect(cellFromPoint(50, 320, box, 30)).toBeNull();
  });
});

describe("lineCells", () => {
  it("includes both ends and has no gaps", () => {
    const cells = lineCells({ x: 0, y: 0 }, { x: 4, y: 2 });
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 4, y: 2 });
    for (let i = 1; i < cells.length; i++) {
      expect(Math.abs(cells[i].x - cells[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(cells[i].y - cells[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });

  it("handles a single point and reversed lines", () => {
    expect(lineCells({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual([{ x: 3, y: 3 }]);
    expect(lineCells({ x: 2, y: 0 }, { x: 0, y: 0 })).toEqual([
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
});

describe("paintLine", () => {
  it("inks a dot, then a line from the last point", () => {
    let cells = paintLine(blankCells(4), null, { x: 0, y: 0 }, true);
    cells = paintLine(cells, { x: 0, y: 0 }, { x: 3, y: 0 }, true);
    expect(serializeGrid(cells)).toEqual(["####", "....", "....", "...."]);
  });

  it("erases with ink=false and doesn't mutate the input", () => {
    const inked = paintLine(blankCells(3), { x: 0, y: 1 }, { x: 2, y: 1 }, true);
    const erased = paintLine(inked, null, { x: 1, y: 1 }, false);
    expect(serializeGrid(inked)).toEqual(["...", "###", "..."]);
    expect(serializeGrid(erased)).toEqual(["...", "#.#", "..."]);
  });

  it("returns the same array when nothing changes", () => {
    const cells = blankCells(3);
    expect(paintLine(cells, null, { x: 1, y: 1 }, false)).toBe(cells);
  });
});
