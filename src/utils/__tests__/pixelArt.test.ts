import { describe, it, expect } from "vite-plus/test";
import {
  blankCells,
  isBlankGrid,
  isValidGrid,
  parseGrid,
  pixelPath,
  serializeGrid,
} from "../pixelArt";
import { avatarInitial, normaliseAvatar } from "../avatar";

describe("pixelArt", () => {
  it("draws runs of ink as rects", () => {
    expect(pixelPath([".##.#", "....."])).toBe("M1 0h2v1h-2zM4 0h1v1h-1z");
  });

  it("validates size and characters", () => {
    expect(isValidGrid(["#.", ".#"], 2)).toBe(true);
    expect(isValidGrid(["#.", ".#", ".."], 2)).toBe(false);
    expect(isValidGrid(["#.", ".x"], 2)).toBe(false);
    expect(isValidGrid(["#.", "."], 2)).toBe(false);
    expect(isValidGrid("##", 2)).toBe(false);
    expect(isValidGrid(null, 2)).toBe(false);
  });

  it("round-trips through cells", () => {
    const grid = ["#..", ".#.", "..#"];
    expect(serializeGrid(parseGrid(grid, 3))).toEqual(grid);
  });

  it("parses invalid input as a blank grid", () => {
    expect(parseGrid(["nope"], 2)).toEqual(blankCells(2));
  });

  it("knows a blank grid", () => {
    expect(isBlankGrid(["..", ".."])).toBe(true);
    expect(isBlankGrid(["..", ".#"])).toBe(false);
  });
});

describe("avatar", () => {
  const row = ".".repeat(30);
  const inked = ["#".padEnd(30, "."), ...Array(29).fill(row)];

  it("keeps a drawn 30×30 avatar", () => {
    expect(normaliseAvatar(inked)).toBe(inked);
  });

  it("drops blank, wrong-size or junk avatars", () => {
    expect(normaliseAvatar(Array(30).fill(row))).toBeNull();
    expect(normaliseAvatar(inked.slice(1))).toBeNull();
    expect(normaliseAvatar(undefined)).toBeNull();
  });

  it("uses the first character of the name as the fallback", () => {
    expect(avatarInitial("Mina")).toBe("m");
    expect(avatarInitial("  ")).toBe("?");
    expect(avatarInitial(undefined)).toBe("?");
  });
});
