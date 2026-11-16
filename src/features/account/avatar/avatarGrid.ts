/** Pure painting helpers for the avatar editor. Cells are [row][col], true = ink. */

export type Cells = boolean[][];
export type Cell = { x: number; y: number };

/** The cell under a point, given the canvas box and grid size; null when outside. */
export const cellFromPoint = (
  px: number,
  py: number,
  box: { left: number; top: number; width: number; height: number },
  size: number,
): Cell | null => {
  const x = Math.floor(((px - box.left) / box.width) * size);
  const y = Math.floor(((py - box.top) / box.height) * size);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
};

/** Every cell on the straight line from a to b, inclusive (Bresenham). */
export const lineCells = (a: Cell, b: Cell): Cell[] => {
  const cells: Cell[] = [];
  let { x, y } = a;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) return cells;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
};

/**
 * Paint `ink` along the line from `from` (or just `to`) and return new cells, or the
 * same array when nothing changed so React can skip the render.
 */
export const paintLine = (cells: Cells, from: Cell | null, to: Cell, ink: boolean): Cells => {
  const path = from ? lineCells(from, to) : [to];
  if (path.every(({ x, y }) => cells[y]?.[x] === ink)) return cells;
  const next = cells.map((row) => row.slice());
  for (const { x, y } of path) {
    if (next[y] && x >= 0 && x < next[y].length) next[y][x] = ink;
  }
  return next;
};
