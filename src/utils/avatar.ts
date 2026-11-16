import { isBlankGrid, isValidGrid } from "./pixelArt";
import { GLYPH_HEIGHT, GLYPH_WIDTH, PIXEL_GLYPHS } from "./pixelFont";

/** Avatars are 30×30 one-ink pixel grids, shown at 30px (1×) or 60px (2×). */
export const AVATAR_SIZE = 30;

/** A stored avatar if it's a drawable 30×30 grid with some ink, else null. */
export const normaliseAvatar = (value: unknown): string[] | null =>
  isValidGrid(value, AVATAR_SIZE) && !isBlankGrid(value) ? value : null;

/**
 * First letter of a display name for the no-avatar fallback: lowercase, accents
 * dropped (é → e), "?" when there's no name.
 */
export const avatarInitial = (name?: string | null): string => {
  const first = Array.from((name ?? "").trim())[0];
  if (!first) return "?";
  return first.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase() || "?";
};

/** Glyphs are drawn at 2× inside a 1-cell frame; the baseline sits a little below middle. */
const GLYPH_SCALE = 2;
const GLYPH_LEFT = (AVATAR_SIZE - GLYPH_WIDTH * GLYPH_SCALE) / 2;
const GLYPH_TOP = 7;

/**
 * The fallback avatar as a 30×30 grid: a one-cell frame with the name's initial in the
 * pixel font. Null when the initial has no glyph (e.g. kana), so the caller can show it
 * as text instead.
 */
export const initialAvatarGrid = (name?: string | null): string[] | null => {
  const glyph = PIXEL_GLYPHS[avatarInitial(name)];
  if (!glyph) return null;
  return Array.from({ length: AVATAR_SIZE }, (_, y) =>
    Array.from({ length: AVATAR_SIZE }, (_, x) => {
      if (x === 0 || y === 0 || x === AVATAR_SIZE - 1 || y === AVATAR_SIZE - 1) return "#";
      const gx = Math.floor((x - GLYPH_LEFT) / GLYPH_SCALE);
      const gy = Math.floor((y - GLYPH_TOP) / GLYPH_SCALE);
      if (gx < 0 || gy < 0 || gx >= GLYPH_WIDTH || gy >= GLYPH_HEIGHT) return ".";
      return glyph[gy][gx];
    }).join(""),
  );
};
