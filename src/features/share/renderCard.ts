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
 * under the header with the buddy at their right, dashed tear lines between sections, and a knick-knack tucked into the
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
  /** Their public display location ("Kyoto"), under the name; null leaves it out. */
  location: string | null;
  /** The buddy's kaomoji. */
  face: string;
  /** The brag lines (daily) or a caption (breakdown). */
  lines: ReadonlyArray<string>;
  /** The pie's small caps-lock heading ("where my money went"). */
  pieTitle: string;
  /** A pie of shares; empty for none. */
  slices: ReadonlyArray<BreakdownSlice>;
  /** Show the pie's category names in a key. */
  showNames: boolean;
  /** The sharer's 30×30 avatar grid (or initial fallback); null leaves it out. */
  avatar: PixelGrid | null;
  /** A kept knick-knack's 32×32 art, a decoration in the footer's corner; null for none. */
  knickKnack: { grid: PixelGrid } | null;
};

export type Ink = "ink" | "paper" | "sheet";
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
      /** The surface under the pie, which the gaps between slices show. */
      ground: Ink;
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
  /** The buddy, at the right end of the ID line: its largest type size. */
  face: { size: number };
  /** Tear lines: dash and space lengths. */
  tear: { dash: number; space: number };
  /** The one gap between the middle's blocks (tear line, lines, the pie's box, footer). */
  section: number;
  /** Brag lines: left-aligned, each with a hanging "›". */
  lines: { size: number; leading: number; gap: number };
  /**
   * The pie's box: title is the heading's type size, gap the room under it, pad the box's
   * inner padding.
   */
  pie: {
    maxR: number;
    minR: number;
    sideBySide: boolean;
    title: number;
    gap: number;
    pad: number;
  };
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
    face: { size: 60 },
    tear: { dash: 18, space: 12 },
    section: 48,
    lines: { size: 34, leading: 50, gap: 16 },
    pie: { maxR: 270, minR: 100, sideBySide: false, title: 26, gap: 40, pad: 40 },
    legend: { swatch: 28, size: 26, row: 48 },
    footer: { word: 52, url: 36, height: 190, kkScale: 5 },
  },
  square: {
    inset: 24,
    padding: 36,
    header: { top: 56, height: 90, size: 44, stripe: 5 },
    id: { gap: 30, scale: 3, name: 38, sub: 27, leading: 38 },
    face: { size: 42 },
    tear: { dash: 14, space: 10 },
    section: 32,
    lines: { size: 28, leading: 40, gap: 10 },
    pie: { maxR: 140, minR: 70, sideBySide: true, title: 20, gap: 28, pad: 28 },
    legend: { swatch: 20, size: 19, row: 34 },
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
  /** --sheet: the framed surface the pie sits on. */
  sheet: string;
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
  sheet: "sheet",
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
    sheet: get(TOKEN_NAMES.sheet),
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
const MIN_KEY_ROW = 26;

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
  // The buddy takes its room at the right first (at most a third of the line, shrinking
  // a long kaomoji to fit); name, place and date fill what's between.
  const faceSize = Math.floor(
    Math.min(m.face.size, contentW / 3 / Math.max(1, textWidth(spec.face, 1))),
  );
  const faceW = textWidth(spec.face, faceSize);
  const textX = pad + (photoW ? photoW + id.gap : 0);
  const textW = W - pad - faceW - id.gap - textX;
  const idLines = [
    { text: spec.name, size: id.name, weight: 700 as const },
    ...(spec.location ? [{ text: spec.location, size: id.sub, weight: 400 as const }] : []),
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
  ops.push({
    op: "text",
    text: spec.face,
    x: W - pad,
    y: idTop + idH / 2,
    size: faceSize,
    weight: 700,
    align: "right",
    fill: "ink",
  });

  // A tear line under the ID line.
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

  // The middle, on the card's left edge like the ID line and the footer: brag lines, then
  // the pie in its box, one section gap apart. The box fills the room down to the footer
  // and the pie grows into it (up to a cap); with no pie, the lines sit centred instead.
  const S = m.section;
  const top = tearY + S;
  const bottom = footerTop - S;
  const middle: DrawOp[] = [];
  const ln = m.lines;
  const marker = "› ";
  const markerW = textWidth(marker, ln.size);
  let y = top;
  for (const paragraph of spec.lines) {
    const wrapped = wrapText(paragraph, ln.size, contentW - markerW);
    if (y + wrapped.length * ln.leading > bottom) break;
    wrapped.forEach((line, i) => {
      const mid = y + ln.leading / 2;
      const text = { size: ln.size, weight: 700, align: "left", fill: "ink" } as const;
      if (i === 0) middle.push({ op: "text", text: marker.trim(), x: pad, y: mid, ...text });
      middle.push({ op: "text", text: line, x: pad + markerW, y: mid, ...text });
      y += ln.leading;
    });
    y += ln.gap;
  }
  const linesBottom = middle.length ? y - ln.gap : top;

  const box = pieBox({
    spec,
    style,
    m,
    x: pad,
    w: contentW,
    top: middle.length ? linesBottom + S : top,
    bottom,
    hairline,
  });
  if (box.length) {
    ops.push(...middle, ...box);
  } else {
    const shift = Math.max(0, (bottom - linesBottom) / 2);
    for (const o of middle) ops.push(shiftDown(o, shift));
  }

  return ops;
};

/**
 * The pie and its key in a framed sheet box from `top` to `bottom`, headed by a small
 * caps-lock title at its top left. The pie takes the room the box has (up to maxR) and the
 * pie and key sit centred in it: below the pie in columns on a story, beside it on a
 * square. Empty when there's no pie or too little room for one.
 */
const pieBox = ({
  spec,
  style,
  m,
  x,
  w,
  top,
  bottom,
  hairline,
}: {
  spec: CardSpec;
  style: CardStyle;
  m: Metrics;
  x: number;
  w: number;
  top: number;
  bottom: number;
  hairline: number;
}): DrawOp[] => {
  const arcs = toArcs(spec.slices.map((sl) => ({ ...sl, value: sl.share })));
  if (!arcs.length) return [];
  const pp = m.pie;
  const lg = m.legend;
  // The pie's rim and the gaps between slices: hairlines, so small slices still show.
  const rim = hairline;
  const fills = sliceFills(arcs, style);
  const rows = spec.showNames ? arcs.length : 0;
  const innerX = x + pp.pad;
  const innerW = w - 2 * pp.pad;
  const areaTop = top + pp.pad + pp.title + pp.gap;
  const areaH = bottom - pp.pad - areaTop;
  const cx = x + w / 2;
  const ops: DrawOp[] = [
    { op: "rect", x, y: top, w, h: bottom - top, fill: "sheet" },
    { op: "frame", x, y: top, w, h: bottom - top, width: hairline },
    {
      op: "text",
      text: truncate(spec.pieTitle.toUpperCase(), pp.title, innerW),
      x: innerX,
      y: top + pp.pad + pp.title / 2,
      size: pp.title,
      weight: 700,
      align: "left",
      fill: "ink",
    },
  ];
  // +1: room for float rounding, so a name that fits isn't cut by a hair.
  const nameW = (key: Metrics["legend"]) =>
    key.swatch + key.size / 2 + Math.max(0, ...arcs.map((a) => textWidth(a.name, key.size))) + 1;

  if (pp.sideBySide) {
    // Key rows shrink to fit beside the pie, down to a readable minimum.
    const row = rows ? Math.min(lg.row, areaH / rows) : lg.row;
    const key: Metrics["legend"] = {
      row,
      swatch: Math.min(lg.swatch, Math.floor(row * 0.6)),
      size: Math.min(lg.size, Math.floor(row * 0.56)),
    };
    const showKey = rows > 0 && row >= MIN_KEY_ROW;
    const r = Math.min(pp.maxR, areaH / 2 - rim, innerW / 4);
    if (r < pp.minR) return [];
    const pieW = 2 * (r + rim);
    const keyGap = pp.gap * 1.5;
    const keyW = showKey ? Math.min(nameW(key), innerW - pieW - keyGap) : 0;
    const groupW = pieW + (showKey ? keyGap + keyW : 0);
    const pieCx = cx - groupW / 2 + pieW / 2;
    const cy = areaTop + areaH / 2;
    ops.push(pieOp(pieCx, cy, r, arcs, fills, rim));
    if (showKey) {
      legendOps(
        ops,
        arcs,
        fills,
        pieCx + pieW / 2 + keyGap,
        cy - (rows * row) / 2,
        keyW,
        key,
        hairline,
      );
    }
    return ops;
  }

  // Story: the title anchors the box's top and the key, in up to three columns on its left
  // edge, its bottom; the pie sits centred in the room between them.
  const cols = rows <= 2 ? Math.max(rows, 1) : rows <= 4 ? 2 : 3;
  const perCol = Math.ceil(rows / cols);
  const keyH = rows ? perCol * lg.row : 0;
  const keyTop = areaTop + areaH - keyH;
  const pieRoom = keyTop - (rows ? pp.gap : 0) - areaTop;
  const r = Math.min(pp.maxR, pieRoom / 2 - rim);
  if (r < pp.minR) return [];
  ops.push(pieOp(cx, areaTop + pieRoom / 2, r, arcs, fills, rim));
  const colW = innerW / cols;
  for (let c = 0; c < cols && rows; c++) {
    legendOps(
      ops,
      arcs.slice(c * perCol, (c + 1) * perCol),
      fills.slice(c * perCol, (c + 1) * perCol),
      innerX + c * colW,
      keyTop,
      colW - lg.swatch,
      lg,
      hairline,
    );
  }
  return ops;
};

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
  ground: "sheet",
  rim: weight,
});

/** A key: one row per slice, swatch then name in small caps-lock, from (x, top), cut to width. */
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
      text: truncate(name.toUpperCase(), lg.size, width - lg.swatch - lg.size / 2),
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

type Inks = Pick<CardStyle, "ink" | "paper" | "sheet">;

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
          ctx.strokeStyle = inks[o.ground];
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
