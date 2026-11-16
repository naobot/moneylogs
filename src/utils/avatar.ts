import { isBlankGrid, isValidGrid } from "./pixelArt";

/** Avatars are 30×30 one-ink pixel grids, shown at 30px (1×) or 60px (2×). */
export const AVATAR_SIZE = 30;

/** A stored avatar if it's a drawable 30×30 grid with some ink, else null. */
export const normaliseAvatar = (value: unknown): string[] | null =>
  isValidGrid(value, AVATAR_SIZE) && !isBlankGrid(value) ? value : null;

/** First visible character of a display name, for the no-avatar fallback. */
export const avatarInitial = (name?: string | null): string => {
  const first = Array.from((name ?? "").trim())[0];
  return first ? first.toLocaleLowerCase() : "?";
};
