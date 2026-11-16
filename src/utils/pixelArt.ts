/**
 * One-ink pixel grids: an array of equal-length strings, "#" = ink, "." = paper.
 * Knick-knack art (32×32) and user avatars (30×30) share this format.
 */

export type PixelGrid = readonly string[];

/** One SVG path drawing every horizontal run of ink as a 1-unit-tall rect. */
export const pixelPath = (grid: PixelGrid): string => {
  let d = "";
  grid.forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) {
      const w = run[0].length;
      d += `M${run.index} ${y}h${w}v1h-${w}z`;
    }
  });
  return d;
};

/** True when `rows` is exactly size×size and only contains "#" / ".". */
export const isValidGrid = (rows: unknown, size: number): rows is string[] => {
  if (!Array.isArray(rows) || rows.length !== size) return false;
  const pattern = new RegExp(`^[#.]{${size}}$`);
  return rows.every((row) => typeof row === "string" && pattern.test(row));
};

/** A blank (all-paper) size×size grid as mutable cells. */
export const blankCells = (size: number): boolean[][] =>
  Array.from({ length: size }, () => Array<boolean>(size).fill(false));

/** Grid strings → mutable cells (true = ink). Invalid input gives a blank grid. */
export const parseGrid = (rows: unknown, size: number): boolean[][] =>
  isValidGrid(rows, size)
    ? rows.map((row) => Array.from(row, (ch) => ch === "#"))
    : blankCells(size);

/** Cells → grid strings. */
export const serializeGrid = (cells: readonly (readonly boolean[])[]): string[] =>
  cells.map((row) => row.map((ink) => (ink ? "#" : ".")).join(""));

/** True when no cell is inked. */
export const isBlankGrid = (rows: PixelGrid): boolean => rows.every((row) => !row.includes("#"));
