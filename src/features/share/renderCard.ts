import { PIXEL_TILES, PixelTile, toArcs } from "@/utils/pie";
import type { PixelGrid } from "@/utils/pixelArt";
import type { BreakdownSlice } from "./shareLines";
import TOKENS_SCSS from "@/tokens.scss?raw";

/**
 * Share cards as images: a pure layout (layoutCard → DrawOps, testable without a canvas)
 * and a thin painter that runs those ops on a canvas (renderCard → PNG blob).
 *
 * Same look as the app: two inks, Hack, square corners, a striped header like the tool
 * modals, 1-bit fills for the pie. Pixel art (avatar, knick-knack) is drawn cell by cell
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
  /** Under the header: "sat 21 nov". */
  date: string;
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
  /** A kept knick-knack's 32×32 art and name; null leaves the shelf without it. */
  knickKnack: { grid: PixelGrid; name: string } | null;
};

export type Ink = "ink" | "paper";
export type SliceFill = "solid" | "paper" | PixelTile;

/** Fills in slice order: as different from their neighbours as two inks allow. */
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
  date: { y: number; size: number };
  face: { y: number; size: number };
  shelf: { y: number; scale: number; gap: number; caption: number };
  lines: { size: number; leading: number; gap: number };
  pie: { maxR: number; minR: number; sideBySide: boolean };
  legend: { swatch: number; size: number; row: number };
  footer: { word: number; url: number; height: number };
};

const METRICS: Record<CardFormat, Metrics> = {
  story: {
    inset: 36,
    padding: 36,
    header: { top: 84, height: 120, size: 56, stripe: 6 },
    date: { y: 262, size: 40 },
    face: { y: 400, size: 120 },
    shelf: { y: 700, scale: 6, gap: 120, caption: 34 },
    lines: { size: 60, leading: 82, gap: 36 },
    pie: { maxR: 300, minR: 120, sideBySide: false },
    legend: { swatch: 48, size: 40, row: 68 },
    footer: { word: 52, url: 36, height: 190 },
  },
  square: {
    inset: 24,
    padding: 36,
    header: { top: 56, height: 90, size: 44, stripe: 5 },
    date: { y: 186, size: 30 },
    face: { y: 286, size: 84 },
    shelf: { y: 520, scale: 4, gap: 80, caption: 26 },
    lines: { size: 44, leading: 60, gap: 22 },
    pie: { maxR: 170, minR: 80, sideBySide: true },
    legend: { swatch: 36, size: 30, row: 50 },
    footer: { word: 38, url: 26, height: 128 },
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
  /** --border-hairline: secondary lines (the shelf, the footer rule, key swatches). */
  hairline: number;
  /** --border-rule: containers (the card's frame, the pie's rim and the gaps between slices). */
  rule: number;
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
} as const satisfies Record<keyof CardStyle, string>;

/** A token's light-theme value as written in src/tokens.scss (its first definition). */
export const tokenFromSource = (source: string, name: string): string | undefined =>
  source.match(new RegExp(`(?<![\\w-])--${name}:\\s*([^;]+);`))?.[1].trim();

const toStyle = (value: (name: string) => string | undefined): CardStyle => {
  const fromSource = (name: string) => tokenFromSource(TOKENS_SCSS, name) ?? "";
  const get = (name: string) => value(name) || fromSource(name);
  const px = (name: string) => parseFloat(get(name)) || parseFloat(fromSource(name));
  return {
    ink: get(TOKEN_NAMES.ink),
    paper: get(TOKEN_NAMES.paper),
    font: get(TOKEN_NAMES.font),
    hairline: px(TOKEN_NAMES.hairline),
    rule: px(TOKEN_NAMES.rule),
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
  return toStyle((name) => computed.getPropertyValue(`--${name}`).trim() || undefined);
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
  ops.push({
    op: "text",
    text: spec.date,
    x: W / 2,
    y: m.date.y,
    size: m.date.size,
    weight: 400,
    align: "center",
    fill: "ink",
  });

  // The buddy, then the avatar and knick-knack side by side on a shelf.
  const faceSize = Math.min(m.face.size, contentW / Math.max(1, textWidth(spec.face, 1)));
  ops.push({
    op: "text",
    text: spec.face,
    x: W / 2,
    y: m.face.y,
    size: Math.floor(faceSize),
    weight: 700,
    align: "center",
    fill: "ink",
  });
  const s = m.shelf;
  const avatarW = spec.avatar ? spec.avatar.length * s.scale : 0;
  const kkW = spec.knickKnack ? spec.knickKnack.grid.length * s.scale : 0;
  if (avatarW || kkW) {
    const rowW = avatarW + kkW + (avatarW && kkW ? s.gap : 0);
    let x = (W - rowW) / 2;
    if (spec.avatar) {
      ops.push({ op: "pixels", grid: spec.avatar, x, y: s.y - avatarW, scale: s.scale });
      x += avatarW + (kkW ? s.gap : 0);
    }
    if (spec.knickKnack) {
      ops.push({ op: "pixels", grid: spec.knickKnack.grid, x, y: s.y - kkW, scale: s.scale });
      ops.push({
        op: "text",
        text: truncate(spec.knickKnack.name, s.caption, kkW + s.gap),
        x: x + kkW / 2,
        y: s.y + hairline + s.caption,
        size: s.caption,
        weight: 400,
        align: "center",
        fill: "ink",
      });
    }
    const ruleW = Math.min(contentW, rowW + 2 * s.gap);
    ops.push({ op: "rect", x: (W - ruleW) / 2, y: s.y, w: ruleW, h: hairline, fill: "ink" });
  }

  // Footer, from the bottom up, so the middle knows how much room it has.
  const f = m.footer;
  const footerTop = H - m.inset - frame - f.height;
  ops.push({ op: "rect", x: pad, y: footerTop, w: contentW, h: hairline, fill: "ink" });
  ops.push({
    op: "text",
    text: "moneylogs",
    x: W / 2,
    y: footerTop + f.height * 0.38,
    size: f.word,
    weight: 700,
    align: "center",
    fill: "ink",
  });
  ops.push({
    op: "text",
    text: "moneylogs.app",
    x: W / 2,
    y: footerTop + f.height * 0.72,
    size: f.url,
    weight: 400,
    align: "center",
    fill: "ink",
  });

  // The middle: lines, then the pie and its key. Laid out from the top of the space, then
  // centred in it, so a short card doesn't leave a gap above the footer.
  const middle: DrawOp[] = [];
  const top = s.y + hairline + s.caption * 2 + m.lines.gap;
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
  const rim = frame;
  if (arcs.length) {
    const fills = arcs.map((_, i) => SLICE_FILLS[i % SLICE_FILLS.length]);
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
        middle.push(pieOp(pieCx, cy, r, arcs, fills, frame));
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
        middle.push(pieOp(W / 2, cy, r, arcs, fills, frame));
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

const pieOp = (
  cx: number,
  cy: number,
  r: number,
  arcs: ReadonlyArray<{ start: number; end: number }>,
  fills: ReadonlyArray<SliceFill>,
  /** The rim and the paper gaps between slices: the container weight. */
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
  fill === "solid"
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
