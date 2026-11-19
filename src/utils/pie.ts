/**
 * Pie geometry and 1-bit fills, shared by the budget wizard's pie (SVG) and the share
 * cards' breakdown (canvas). Angles are radians clockwise from 12 o'clock.
 */

export type Arc = { start: number; end: number };

/** Each item's arc, in the order given, sized by `value`; zero and negative values dropped. */
export const toArcs = <T extends { value: number }>(items: ReadonlyArray<T>): (T & Arc)[] => {
  const shown = items.filter((d) => d.value > 0);
  const total = shown.reduce((s, d) => s + d.value, 0);
  let angle = 0;
  return shown.map((d) => {
    const start = angle;
    angle += (d.value / total) * 2 * Math.PI;
    return { ...d, start, end: angle };
  });
};

/** A point on the rim of a circle centred at (c, c). */
export const rimPoint = (angle: number, c: number, r: number): [number, number] => [
  c + r * Math.sin(angle),
  c - r * Math.cos(angle),
];

const fmt = ([x, y]: [number, number]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** SVG path for one slice; a full circle when it's the only one. */
export const slicePath = ({ start, end }: Arc, c: number, r: number): string =>
  end - start >= 2 * Math.PI - 1e-9
    ? `M${c} ${c - r}A${r} ${r} 0 1 1 ${c - 0.01} ${c - r}Z`
    : `M${c} ${c}L${fmt(rimPoint(start, c, r))}A${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${fmt(rimPoint(end, c, r))}Z`;

/**
 * The same pixel tiles as src/texture.scss: which cells of a size×size tile are ink.
 * "solid" and "paper" need no tile.
 */
export const PIXEL_TILES = {
  dots: {
    size: 2,
    cells: [[0, 0]],
  },
  dither: {
    size: 2,
    cells: [
      [0, 0],
      [1, 1],
    ],
  },
  hatch: {
    size: 4,
    cells: [
      [3, 0],
      [2, 1],
      [1, 2],
      [0, 3],
    ],
  },
  // horizontal 1-on-1-off, like the striped modal headers
  stripe: {
    size: 2,
    cells: [
      [0, 0],
      [1, 0],
    ],
  },
} as const satisfies Record<
  string,
  { size: number; cells: ReadonlyArray<readonly [number, number]> }
>;

export type PixelTile = keyof typeof PIXEL_TILES;
