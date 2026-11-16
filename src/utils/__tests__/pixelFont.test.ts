import { describe, it, expect } from "vite-plus/test";
import { GLYPH_HEIGHT, GLYPH_WIDTH, PIXEL_GLYPHS } from "../pixelFont";
import {
  AVATAR_SIZE,
  avatarInitial,
  initialAvatarGrid,
  miniAvatar,
  normaliseAvatar,
} from "../avatar";
import { PRESET_AVATARS } from "@/features/account/avatar/presets";

describe("pixel font", () => {
  it("has every lowercase letter, digit and ?", () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789?") {
      expect(PIXEL_GLYPHS[ch], ch).toBeDefined();
    }
  });

  it("draws each glyph on a 5×9 one-ink grid with ink in it", () => {
    for (const [ch, rows] of Object.entries(PIXEL_GLYPHS)) {
      expect(rows, ch).toHaveLength(GLYPH_HEIGHT);
      for (const row of rows) expect(row, ch).toMatch(new RegExp(`^[#.]{${GLYPH_WIDTH}}$`));
      expect(rows.join(""), ch).toContain("#");
    }
  });

  it("only descends below the baseline for g j p q y", () => {
    const descenders = Object.entries(PIXEL_GLYPHS)
      .filter(([, rows]) => rows.slice(7).some((r) => r.includes("#")))
      .map(([ch]) => ch)
      .sort();
    expect(descenders).toEqual(["g", "j", "p", "q", "y"]);
  });
});

describe("initialAvatarGrid", () => {
  it("draws a framed initial as a valid avatar", () => {
    const grid = initialAvatarGrid("Mina")!;
    expect(normaliseAvatar(grid)).toBe(grid);
    expect(grid[0]).toBe("#".repeat(AVATAR_SIZE));
    expect(grid[AVATAR_SIZE - 1]).toBe("#".repeat(AVATAR_SIZE));
    expect(grid.every((row) => row[0] === "#" && row[AVATAR_SIZE - 1] === "#")).toBe(true);
  });

  it("scales the glyph 2× and centres it horizontally", () => {
    const grid = initialAvatarGrid("l")!;
    // "l" row 0 is ".##..": at 2× from x=10 that's x 12-15 on rows 8-9.
    expect(grid[8].slice(10, 20)).toBe("..####....");
    expect(grid[9].slice(10, 20)).toBe("..####....");
  });

  it("uses the base letter for accents and ? for no name", () => {
    expect(avatarInitial("Émile")).toBe("e");
    expect(initialAvatarGrid("Émile")).toEqual(initialAvatarGrid("e"));
    expect(initialAvatarGrid("")).toEqual(initialAvatarGrid("?"));
  });

  it("gives null when the font has no glyph", () => {
    expect(initialAvatarGrid("みな")).toBeNull();
  });
});

describe("premade avatars", () => {
  it("are valid, distinct avatars", () => {
    for (const preset of PRESET_AVATARS) {
      expect(normaliseAvatar([...preset.grid]), preset.id).not.toBeNull();
    }
    expect(new Set(PRESET_AVATARS.map((p) => p.grid.join(""))).size).toBe(PRESET_AVATARS.length);
  });
});

describe("miniAvatar", () => {
  it("shrinks to 15×15, keeping 1-pixel lines", () => {
    const grid = Array.from({ length: AVATAR_SIZE }, (_, y) =>
      y === 7 ? "#".repeat(AVATAR_SIZE) : ".".repeat(AVATAR_SIZE),
    );
    const mini = miniAvatar(grid);
    expect(mini).toHaveLength(15);
    expect(mini.every((row) => row.length === 15)).toBe(true);
    expect(mini[3]).toBe("#".repeat(15));
    expect(mini.filter((row) => row.includes("#"))).toHaveLength(1);
  });

  it("shrinks an initial to its 1× glyph in a 1-pixel frame", () => {
    const mini = miniAvatar(initialAvatarGrid("l")!);
    expect(mini[0]).toBe("#".repeat(15));
    expect(mini[14]).toBe("#".repeat(15));
    // Glyph rows land 1:1 from row 4, columns 5-9.
    expect(PIXEL_GLYPHS.l.map((_, i) => mini[4 + i].slice(5, 10))).toEqual([...PIXEL_GLYPHS.l]);
  });
});
