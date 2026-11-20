import { PIXEL_TILES, PixelTile, toArcs } from "@/utils/pie";
import type { PixelGrid } from "@/utils/pixelArt";
import type { BreakdownSlice } from "./shareLines";
import TOKENS_SCSS from "@/tokens.scss?raw";
import { getDisplayPrefs } from "@/utils/displayPrefs";

/**
 * Share cards as images: a pure layout (layoutCard → DrawOps, testable without a canvas)
 * and a thin painter that runs those ops on a canvas (renderCard → PNG blob).
 *
 * Same look as the app: two inks, Hack, square corners, a striped header like the tool
 * modals, and the theme's chart colours for the pie (1-bit fills when charts are mono).
 * Laid out like an ID card that turns into a receipt: the sharer's photo, name and place
 * under the header, dashed tear lines between sections, and a knick-knack tucked into the
 * footer's corner as a sticker. Pixel art (avatar, knick-knack) is drawn cell by cell
 * at whole-number scales so it stays crisp.
 */

export type CardFormat = "story" | "square";

export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export type CardSpec = {
  /** In the header's paper box: "today", "november". Lowercase, like the app's headings. */
  heading: string;
  /** On the ID line: "sat 21 nov". */
  date: string;
  /** The sharer's display name, beside the photo. */
  name: string;
  /** Their public display location ("Kyoto"), shown in brackets; null leaves it out. */
  location: string | null;
  /** The buddy's kaomoji. */
  face: string;
  /** The brag lines (daily) or a caption (breakdown). */
  lines: ReadonlyArray<string>;
  /** A pie of shares; empty for none. */
  slices: ReadonlyArray<BreakdownSlice>;
  /** Show the pie's category names in a key. */
  showNames: boolean;
  /** The sharer's 30×30 avatar grid (or initial fallback); null leaves it out. */
  avatar: PixelGrid | null;
  /** A kept knick-knack's 32×32 art, a decoration in the footer's corner; null for none. */
  knickKnack: { grid: PixelGrid } | null;
};

export type Ink = "ink" | "paper";
/** A two-ink fill, or a chart colour (any CSS colour the canvas takes). */
export type SliceFill = "solid" | "paper" | PixelTile | { colour: string };

/** Mono fills in slice order: as different from their neighbours as two inks allow. */
export const SLICE_FILLS: readonly SliceFill[] = [
  "solid",
  "dither",
  "paper",
  "hatch",
  "dots",
  "stripe",
];

export type DrawOp =
  | { op: "rect"; x: number; y: number; w: number; h: number; fill: Ink }
  | { op: "frame"; x: number; y: number; w: number; h: number; width: number }
  /** A receipt's tear line: a dashed horizontal rule in ink. */
  | { op: "dashes"; x: number; y: number; w: number; h: number; dash: number; space: number }
  | { op: "tile"; x: number; y: number; w: number; h: number; tile: PixelTile; scale: number }
  | {
      op: "text";
      text: string;
      /** x is the left edge, centre or right edge, per align; y is the middle of the line. */
      x: number;
      y: number;
      size: number;
      weight: 400 | 700;
      align: "left" | "center" | "right";
      fill: Ink;
    }
  | { op: "pixels"; grid: PixelGrid; x: number; y: number; scale: number }
  | {
      op: "pie";
      cx: number;
      cy: number;
      r: number;
      slices: ReadonlyArray<{ start: number; end: number; fill: SliceFill }>;
      gap: number;
      rim: number;
    }
  | { op: "swatch"; x: number; y: number; size: number; fill: SliceFill; border: number };

/** Hack's advance width, in ems. Wide glyphs (CJK, kana) take about one em. */
const MONO_EM = 0.602;
const charEms = (ch: string) => (ch.codePointAt(0)! >= 0x2e80 ? 1 : MONO_EM);

/** Estimated width of a line of Hack at `size` px. */
export const textWidth = (text: string, size: number): number =>
  Array.from(text).reduce((w, ch) => w + charEms(ch) * size, 0);

/** Greedy word wrap to `maxWidth`; a word longer than a line is cut with "…". */
export const wrapText = (text: string, size: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = textWidth(word, size) <= maxWidth ? word : truncate(word, size, maxWidth);
  }
  if (line) lines.push(line);
  return lines;
};

/** `text` cut to fit `maxWidth`, ending in "…" when cut. */
export const truncate = (text: string, size: number, maxWidth: number): string => {
  if (textWidth(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && textWidth(`${chars.join("")}…`, size) > maxWidth) chars.pop();
  return `${chars.join("")}…`;
};

/**
 * One format's composition: where things sit and how big the type is, in image pixels for
 * a fixed-size export. Line weights aren't here: they come from the design tokens
 * (CardStyle), scaled by CARD_SCALE.
 */
type Metrics = {
  /** Paper margin outside the frame. */
  inset: number;
  /** Room between the frame and the content. */
  padding: number;
  header: { top: number; height: number; size: number; stripe: number };
  /** The ID line: photo scale, room around it, name and sub-line type sizes and leading. */
  id: { gap: number; scale: number; name: number; sub: number; leading: number };
  /** The buddy, centred under the ID line; gap is the room above and below it. */
  face: { size: number; gap: number };
  /** Tear lines: dash and space lengths. */
  tear: { dash: number; space: number };
  lines: { size: number; leading: number; gap: number };
  pie: { maxR: number; minR: number; sideBySide: boolean };
  legend: { swatch: number; size: number; row: number };
  /** kkScale: the corner knick-knack's pixel scale (32 cells). */
  footer: { word: number; url: number; height: number; kkScale: number };
};

const METRICS: Record<CardFormat, Metrics> = {
  story: {
    inset: 36,
    padding: 36,
    header: { top: 84, height: 120, size: 56, stripe: 6 },
    id: { gap: 44, scale: 5, name: 52, sub: 36, leading: 54 },
    face: { size: 110, gap: 44 },
    tear: { dash: 18, space: 12 },
    lines: { size: 42, leading: 60, gap: 26 },
    pie: { maxR: 300, minR: 120, sideBySide: false },
    legend: { swatch: 44, size: 36, row: 62 },
    footer: { word: 52, url: 36, height: 190, kkScale: 5 },
  },
  square: {
    inset: 24,
    padding: 36,
    header: { top: 56, height: 90, size: 44, stripe: 5 },
    id: { gap: 30, scale: 3, name: 38, sub: 27, leading: 38 },
    face: { size: 76, gap: 26 },
    tear: { dash: 14, space: 10 },
    lines: { size: 31, leading: 44, gap: 16 },
    pie: { maxR: 170, minR: 80, sideBySide: true },
    legend: { swatch: 32, size: 27, row: 44 },
    footer: { word: 38, url: 26, height: 128, kkScale: 3 },
  },
};

// ---- Style ------------------------------------------------------------------------

/**
 * What a card takes from the design tokens: the two inks, the typeface and the frame
 * weights (CSS px). Serializable, so the layout stays pure: read once at the browser
 * boundary (readCardStyle) and passed in.
 */
export type CardStyle = {
  ink: string;
  paper: string;
  font: string;
  /** --border-hairline: secondary lines (tear lines, the photo frame, the pie, key swatches). */
  hairline: number;
  /** --border-rule: containers (the card's frame). */
  rule: number;
  /** --chart-1…6 for the pie's slices, or null when Display → Charts is mono. */
  chart: string[] | null;
  /** --chart-rest (the ink-faint wash) for the "other" slice. */
  chartRest: string;
};

/**
 * Image pixels per CSS pixel. A 1080px card is shown about 360 CSS px wide on a phone, so a
 * token drawn at 3× keeps the weight it has in the app.
 */
export const CARD_SCALE = 3;

const TOKEN_NAMES = {
  ink: "ink",
  paper: "paper",
  font: "font-mono",
  hairline: "border-hairline",
  rule: "border-rule",
} as const satisfies Record<Exclude<keyof CardStyle, "chart" | "chartRest">, string>;

const CHART_TOKENS = [1, 2, 3, 4, 5, 6].map((n) => `chart-${n}`);

/** A token's light-theme value as written in src/tokens.scss (its first definition). */
export const tokenFromSource = (source: string, name: string): string | undefined =>
  source.match(new RegExp(`(?<![\\w-])--${name}:\\s*([^;]+);`))?.[1].trim();

const toStyle = (value: (name: string) => string | undefined, mono = false): CardStyle => {
  const fromSource = (name: string) => tokenFromSource(TOKENS_SCSS, name) ?? "";
  const get = (name: string) => value(name) || fromSource(name);
  const px = (name: string) => parseFloat(get(name)) || parseFloat(fromSource(name));
  return {
    ink: get(TOKEN_NAMES.ink),
    paper: get(TOKEN_NAMES.paper),
    font: get(TOKEN_NAMES.font),
    hairline: px(TOKEN_NAMES.hairline),
    rule: px(TOKEN_NAMES.rule),
    chart: mono ? null : CHART_TOKENS.map(get),
    // --chart-rest is var(--ink-faint): read that directly, so the source fallback is a colour.
    chartRest: get("ink-faint"),
  };
};

/** The tokens as src/tokens.scss defines them (light theme): for layout and tests. */
export const TOKEN_CARD_STYLE: CardStyle = toStyle(() => undefined);

/**
 * The tokens as the page has them now (Night shift included), so the card looks like the
 * app; any the page can't resolve fall back to src/tokens.scss.
 */
export const readCardStyle = (): CardStyle => {
  if (typeof document === "undefined") return TOKEN_CARD_STYLE;
  const computed = getComputedStyle(document.documentElement);
  return toStyle(
    (name) => computed.getPropertyValue(`--${name}`).trim() || undefined,
    getDisplayPrefs().charts === "mono",
  );
};

/** Below this a key row's name would be too small to read on a phone. */
const MIN_KEY_ROW = 34;

/** Where the card's parts go, as draw ops, for one format. Pure. */
export const layoutCard = (
  spec: CardSpec,
  format: CardFormat,
  style: CardStyle = TOKEN_CARD_STYLE,
): DrawOp[] => {
  const { width: W, height: H } = CARD_SIZES[format];
  const m = METRICS[format];
  const frame = style.rule * CARD_SCALE;
  const hairline = style.hairline * CARD_SCALE;
  const ops: DrawOp[] = [];
  const pad = m.inset + frame + m.padding;
  const contentW = W - 2 * pad;

  // Paper, then the frame.
  ops.push({ op: "rect", x: 0, y: 0, w: W, h: H, fill: "paper" });
  ops.push({
    op: "frame",
    x: m.inset,
    y: m.inset,
    w: W - 2 * m.inset,
    h: H - 2 * m.inset,
    width: frame,
  });

  // Striped header with the heading in a paper box.
  const bandX = m.inset + frame + m.padding / 3;
  const band = { x: bandX, w: W - 2 * bandX };
  ops.push({
    op: "tile",
    x: band.x,
    y: m.header.top,
    w: band.w,
    h: m.header.height,
    tile: "stripe",
    scale: m.header.stripe,
  });
  const heading = truncate(spec.heading, m.header.size, contentW - 2 * m.header.size);
  const boxW = textWidth(heading, m.header.size) + 2 * m.header.size;
  ops.push({
    op: "rect",
    x: (W - boxW) / 2,
    y: m.header.top,
    w: boxW,
    h: m.header.height,
    fill: "paper",
  });
  ops.push({
    op: "text",
    text: heading,
    x: W / 2,
    y: m.header.top + m.header.height / 2,
    size: m.header.size,
    weight: 700,
    align: "center",
    fill: "ink",
  });
  // The ID line: a framed photo, then name, (place) and date beside it.
  const id = m.id;
  const idTop = m.header.top + m.header.height + id.gap;
  const photoPad = id.scale * 2;
  const photoW = spec.avatar ? spec.avatar.length * id.scale + 2 * (photoPad + hairline) : 0;
  if (spec.avatar) {
    ops.push({ op: "frame", x: pad, y: idTop, w: photoW, h: photoW, width: hairline });
    ops.push({
      op: "pixels",
      grid: spec.avatar,
      x: pad + hairline + photoPad,
      y: idTop + hairline + photoPad,
      scale: id.scale,
    });
  }
  const textX = pad + (photoW ? photoW + id.gap : 0);
  const textW = W - pad - textX;
  const idLines = [
    { text: spec.name, size: id.name, weight: 700 as const },
    ...(spec.location ? [{ text: `(${spec.location})`, size: id.sub, weight: 400 as const }] : []),
    { text: spec.date, size: id.sub, weight: 400 as const },
  ];
  const textH = idLines.length * id.leading;
  const idH = Math.max(photoW, textH);
  idLines.forEach((line, i) => {
    ops.push({
      op: "text",
      text: truncate(line.text, line.size, textW),
      x: textX,
      y: idTop + (idH - textH) / 2 + (i + 0.5) * id.leading,
      size: line.size,
      weight: line.weight,
      align: "left",
      fill: "ink",
    });
  });

  // A tear line, then the buddy.
  const tear = (y: number) =>
    ops.push({
      op: "dashes",
      x: pad,
      y,
      w: contentW,
      h: hairline,
      dash: m.tear.dash,
      space: m.tear.space,
    });
  const tearY = idTop + idH + id.gap;
  tear(tearY);
  const faceSize = Math.floor(
    Math.min(m.face.size, contentW / Math.max(1, textWidth(spec.face, 1))),
  );
  ops.push({
    op: "text",
    text: spec.face,
    x: W / 2,
    y: tearY + m.face.gap + faceSize / 2,
    size: faceSize,
    weight: 700,
    align: "center",
    fill: "ink",
  });

  // Footer, from the bottom up, so the middle knows how much room it has: a tear line,
  // the wordmark on the left and the knick-knack, unlabelled, in the corner.
  const f = m.footer;
  const footerTop = H - m.inset - frame - f.height;
  tear(footerTop);
  ops.push({
    op: "text",
    text: "moneylogs",
    x: pad,
    y: footerTop + f.height * 0.38,
    size: f.word,
    weight: 700,
    align: "left",
    fill: "ink",
  });
  ops.push({
    op: "text",
    text: "moneylogs.app",
    x: pad,
    y: footerTop + f.height * 0.72,
    size: f.url,
    weight: 400,
    align: "left",
    fill: "ink",
  });
  if (spec.knickKnack) {
    const kkW = spec.knickKnack.grid.length * f.kkScale;
    ops.push({
      op: "pixels",
      grid: spec.knickKnack.grid,
      x: W - pad - kkW,
      y: footerTop + (f.height - kkW) / 2,
      scale: f.kkScale,
    });
  }

  // The middle: lines, then the pie and its key. Laid out from the top of the space, then
  // centred in it, so a short card doesn't leave a gap above the footer.
  const middle: DrawOp[] = [];
  const top = tearY + 2 * m.face.gap + faceSize;
  const bottom = footerTop - m.lines.gap;
  let y = top;
  for (const paragraph of spec.lines) {
    const wrapped = wrapText(paragraph, m.lines.size, contentW);
    if (y + wrapped.length * m.lines.leading > bottom) break;
    for (const line of wrapped) {
      middle.push({
        op: "text",
        text: line,
        x: W / 2,
        y: y + m.lines.leading / 2,
        size: m.lines.size,
        weight: 700,
        align: "center",
        fill: "ink",
      });
      y += m.lines.leading;
    }
    y += m.lines.gap;
  }

  // The pie (and its key), in whatever room is left; left out if that's too little.
  const arcs = toArcs(spec.slices.map((sl) => ({ ...sl, value: sl.share })));
  // The pie's rim and the paper gaps between slices: hairlines, so small slices still show.
  const rim = hairline;
  if (arcs.length) {
    const fills = sliceFills(arcs, style);
    const lg = m.legend;
    const keyRows = spec.showNames ? arcs.length : 0;
    const room = bottom - y;
    const keyWidth = (key: Metrics["legend"], maxWidth: number) =>
      Math.min(
        maxWidth,
        key.swatch + key.size / 2 + Math.max(0, ...arcs.map((a) => textWidth(a.name, key.size))),
      );
    if (m.pie.sideBySide) {
      // Key rows shrink to fit beside the pie, down to a readable minimum.
      const row = keyRows ? Math.min(lg.row, room / keyRows) : lg.row;
      const key: Metrics["legend"] = {
        row,
        swatch: Math.min(lg.swatch, Math.floor(row * 0.7)),
        size: Math.min(lg.size, Math.floor(row * 0.62)),
      };
      const showKey = keyRows > 0 && row >= MIN_KEY_ROW;
      const r = Math.min(m.pie.maxR, (room - 2 * rim) / 2, contentW / 4);
      if (r >= m.pie.minR) {
        const pieW = 2 * (r + rim);
        const keyW = showKey ? keyWidth(key, contentW - pieW - lg.swatch) : 0;
        const groupW = pieW + (showKey ? lg.swatch + keyW : 0);
        const pieCx = (W - groupW) / 2 + pieW / 2;
        const cy = y + rim + r;
        middle.push(pieOp(pieCx, cy, r, arcs, fills, rim));
        if (showKey) {
          const keyX = pieCx + pieW / 2 + lg.swatch;
          const keyH = keyRows * key.row;
          legendOps(middle, arcs, fills, keyX, cy - keyH / 2, keyW, key, hairline);
        }
      }
    } else {
      const keyCols = keyRows > 2 ? 2 : 1;
      const perCol = Math.ceil(keyRows / keyCols);
      const keyH = perCol * lg.row;
      const r = Math.min(m.pie.maxR, (room - keyH - lg.row) / 2 - rim);
      if (r >= m.pie.minR) {
        const cy = y + rim + r;
        middle.push(pieOp(W / 2, cy, r, arcs, fills, rim));
        const keyTop = cy + r + rim + lg.row / 2;
        const colW = contentW / keyCols;
        for (let c = 0; c < keyCols; c++) {
          const col = arcs.slice(c * perCol, (c + 1) * perCol);
          const width = keyCols === 1 ? keyWidth(lg, colW) : colW - lg.swatch;
          const x = keyCols === 1 ? (W - width) / 2 : pad + c * colW + lg.swatch / 2;
          legendOps(
            middle,
            col,
            fills.slice(c * perCol, (c + 1) * perCol),
            x,
            keyTop,
            width,
            lg,
            hairline,
          );
        }
      }
    }
  }

  const shift = Math.max(0, (bottom - opsBottom(middle, top)) / 2);
  for (const o of middle) ops.push(shiftDown(o, shift));

  return ops;
};

/** The lowest point any of these ops reaches (or `fallback` with none). */
const opsBottom = (ops: ReadonlyArray<DrawOp>, fallback: number): number =>
  ops.reduce((low, o) => {
    switch (o.op) {
      case "text":
        return Math.max(low, o.y + o.size / 2);
      case "pie":
        return Math.max(low, o.cy + o.r + o.rim);
      case "swatch":
        return Math.max(low, o.y + o.size);
      default:
        return low;
    }
  }, fallback);

const shiftDown = (o: DrawOp, by: number): DrawOp =>
  !by ? o : o.op === "pie" ? { ...o, cy: o.cy + by } : "y" in o ? { ...o, y: o.y + by } : o;

/**
 * Fills in slice order: the chart colours ("other" in the neutral rest wash), or in mono
 * the 1-bit SLICE_FILLS. A breakdown has at most six slices, so colours never repeat.
 */
export const sliceFills = (
  arcs: ReadonlyArray<{ id: string }>,
  style: Pick<CardStyle, "chart" | "chartRest">,
): SliceFill[] => {
  const { chart } = style;
  if (!chart) return arcs.map((_, i) => SLICE_FILLS[i % SLICE_FILLS.length]);
  return arcs.map(({ id }, i) => ({
    colour: id === "other" ? style.chartRest : chart[i % chart.length],
  }));
};

const pieOp = (
  cx: number,
  cy: number,
  r: number,
  arcs: ReadonlyArray<{ start: number; end: number }>,
  fills: ReadonlyArray<SliceFill>,
  /** The rim and the paper gaps between slices. */
  weight: number,
): DrawOp => ({
  op: "pie",
  cx,
  cy,
  r: Math.floor(r),
  slices: arcs.map(({ start, end }, i) => ({ start, end, fill: fills[i] })),
  gap: weight,
  rim: weight,
});

/** A key: one row per slice, swatch then name, starting at (x, top), names cut to width. */
const legendOps = (
  ops: DrawOp[],
  arcs: ReadonlyArray<{ name: string }>,
  fills: ReadonlyArray<SliceFill>,
  x: number,
  top: number,
  width: number,
  lg: Metrics["legend"],
  border: number,
) => {
  arcs.forEach(({ name }, i) => {
    const mid = top + i * lg.row + lg.row / 2;
    ops.push({
      op: "swatch",
      x,
      y: mid - lg.swatch / 2,
      size: lg.swatch,
      fill: fills[i],
      border,
    });
    ops.push({
      op: "text",
      text: truncate(name, lg.size, width - lg.swatch - lg.size / 2),
      x: x + lg.swatch + lg.size / 2,
      y: mid,
      size: lg.size,
      weight: 400,
      align: "left",
      fill: "ink",
    });
  });
};

// ---- Painting ---------------------------------------------------------------------

type Inks = Pick<CardStyle, "ink" | "paper">;

// Kaomoji need glyphs Hack doesn't have; the system fonts fill in.
const fontStack = (font: string) =>
  `${font}, "Hiragino Sans", "Noto Sans", "Noto Sans Thai", sans-serif`;

const tilePattern = (
  ctx: CanvasRenderingContext2D,
  tile: PixelTile,
  scale: number,
  inks: Inks,
): CanvasPattern | string => {
  const { size, cells } = PIXEL_TILES[tile];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * scale;
  const t = canvas.getContext("2d");
  if (!t) return inks.ink;
  t.fillStyle = inks.paper;
  t.fillRect(0, 0, canvas.width, canvas.height);
  t.fillStyle = inks.ink;
  for (const [x, y] of cells) t.fillRect(x * scale, y * scale, scale, scale);
  return ctx.createPattern(canvas, "repeat") ?? inks.ink;
};

/** Pixel tiles scale up so a dither still reads as a texture once a phone shrinks it. */
const FILL_SCALE = 4;

const fillStyle = (ctx: CanvasRenderingContext2D, fill: SliceFill, inks: Inks) =>
  typeof fill === "object"
    ? fill.colour
    : fill === "solid"
      ? inks.ink
      : fill === "paper"
        ? inks.paper
        : tilePattern(ctx, fill, FILL_SCALE, inks);

/** Run draw ops on a 2D context. */
export const paintOps = (
  ctx: CanvasRenderingContext2D,
  ops: ReadonlyArray<DrawOp>,
  style: CardStyle,
) => {
  const inks: Inks = style;
  const family = fontStack(style.font);
  ctx.textBaseline = "middle";
  for (const o of ops) {
    switch (o.op) {
      case "rect":
        ctx.fillStyle = inks[o.fill];
        ctx.fillRect(o.x, o.y, o.w, o.h);
        break;
      case "frame":
        ctx.strokeStyle = inks.ink;
        ctx.lineWidth = o.width;
        ctx.strokeRect(o.x + o.width / 2, o.y + o.width / 2, o.w - o.width, o.h - o.width);
        break;
      case "dashes":
        ctx.fillStyle = inks.ink;
        for (let x = o.x; x < o.x + o.w; x += o.dash + o.space) {
          ctx.fillRect(x, o.y, Math.min(o.dash, o.x + o.w - x), o.h);
        }
        break;
      case "tile":
        ctx.fillStyle = tilePattern(ctx, o.tile, o.scale, inks);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillRect(0, 0, o.w, o.h);
        ctx.restore();
        break;
      case "text":
        ctx.fillStyle = inks[o.fill];
        ctx.font = `${o.weight} ${o.size}px ${family}`;
        ctx.textAlign = o.align;
        ctx.fillText(o.text, o.x, o.y);
        break;
      case "pixels":
        ctx.fillStyle = inks.ink;
        o.grid.forEach((row, y) => {
          Array.from(row).forEach((cell, x) => {
            if (cell === "#") ctx.fillRect(o.x + x * o.scale, o.y + y * o.scale, o.scale, o.scale);
          });
        });
        break;
      case "pie": {
        for (const slice of o.slices) {
          ctx.beginPath();
          ctx.moveTo(o.cx, o.cy);
          ctx.arc(o.cx, o.cy, o.r, slice.start - Math.PI / 2, slice.end - Math.PI / 2);
          ctx.closePath();
          ctx.fillStyle = fillStyle(ctx, slice.fill, inks);
          ctx.fill();
        }
        if (o.slices.length > 1) {
          ctx.strokeStyle = inks.paper;
          ctx.lineWidth = o.gap;
          for (const slice of o.slices) {
            const x = o.cx + o.r * Math.sin(slice.start);
            const y = o.cy - o.r * Math.cos(slice.start);
            ctx.beginPath();
            ctx.moveTo(o.cx, o.cy);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
        }
        ctx.strokeStyle = inks.ink;
        ctx.lineWidth = o.rim;
        ctx.beginPath();
        ctx.arc(o.cx, o.cy, o.r, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case "swatch":
        ctx.fillStyle = fillStyle(ctx, o.fill, inks);
        ctx.fillRect(o.x, o.y, o.size, o.size);
        ctx.strokeStyle = inks.ink;
        ctx.lineWidth = o.border;
        ctx.strokeRect(o.x, o.y, o.size, o.size);
        break;
    }
  }
};

/** Make sure the typeface is loaded before drawing with it (a canvas won't wait for it). */
const loadFonts = async (font: string) => {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`400 40px ${font}`),
    document.fonts.load(`700 40px ${font}`),
  ]);
};

/** The card as a PNG. */
export const renderCard = async (
  spec: CardSpec,
  format: CardFormat,
  style: CardStyle = readCardStyle(),
): Promise<Blob> => {
  await loadFonts(style.font);
  const { width, height } = CARD_SIZES[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D isn't available");
  paintOps(ctx, layoutCard(spec, format, style), style);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the card"))),
      "image/png",
    ),
  );
};
