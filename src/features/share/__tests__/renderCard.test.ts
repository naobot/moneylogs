import { describe, it, expect } from "vite-plus/test";
import {
  CARD_SIZES,
  CardFormat,
  CardSpec,
  DrawOp,
  layoutCard,
  readCardStyle,
  CARD_SCALE,
  SLICE_FILLS,
  sliceFills,
  TOKEN_CARD_STYLE,
  tokenFromSource,
  textWidth,
  truncate,
  wrapText,
} from "../renderCard";

const grid = (n: number) => Array.from({ length: n }, () => "#".repeat(n));

const spec = (extra: Partial<CardSpec> = {}): CardSpec => ({
  heading: "today",
  date: "sat 21 nov",
  name: "Alice",
  location: "Kyoto",
  face: "ฅ^•ω•^ฅ",
  lines: ["I spent 3× less than on a usual Saturday!", "4 no-spend days in a row!"],
  pieTitle: "where my money went",
  slices: [],
  showNames: true,
  avatar: grid(30),
  knickKnack: { grid: grid(32) },
  ...extra,
});

const slices = ["Food", "Fun", "Transit", "Gifts", "Books", "other"].map((name, i) => ({
  id: name,
  name,
  share: [0.3, 0.25, 0.15, 0.12, 0.1, 0.08][i],
}));

const FORMATS: CardFormat[] = ["story", "square"];

const texts = (ops: DrawOp[]) =>
  ops.filter((o): o is Extract<DrawOp, { op: "text" }> => o.op === "text").map((o) => o.text);

const footerTop = (ops: DrawOp[]) => {
  const word = ops.find((o) => o.op === "text" && o.text === "moneylogs") as Extract<
    DrawOp,
    { op: "text" }
  >;
  return word.y - word.size;
};

describe("text helpers", () => {
  it("measures Hack as monospace and wide glyphs as wider", () => {
    expect(textWidth("abcd", 100)).toBeCloseTo(240.8);
    expect(textWidth("日本", 100)).toBe(200);
  });

  it("wraps on words and cuts a word too long for a line", () => {
    expect(wrapText("one two three", 10, textWidth("one two", 10))).toEqual(["one two", "three"]);
    expect(wrapText("supercalifragilistic", 10, textWidth("superca…", 10))).toEqual(["superca…"]);
  });

  it("truncates only when needed", () => {
    expect(truncate("Food", 10, 100)).toBe("Food");
    expect(truncate("Groceries and household", 10, textWidth("Groce…", 10))).toBe("Groce…");
  });
});

describe.each(FORMATS)("layoutCard (%s)", (format) => {
  const { width, height } = CARD_SIZES[format];

  it("keeps every shape on the card", () => {
    for (const ops of [layoutCard(spec(), format), layoutCard(spec({ slices }), format)]) {
      for (const o of ops) {
        if (o.op === "rect" || o.op === "tile" || o.op === "frame") {
          expect(o.x).toBeGreaterThanOrEqual(0);
          expect(o.y).toBeGreaterThanOrEqual(0);
          expect(o.x + o.w).toBeLessThanOrEqual(width);
          expect(o.y + o.h).toBeLessThanOrEqual(height);
        }
        if (o.op === "pie") {
          expect(o.cx - o.r).toBeGreaterThan(0);
          expect(o.cx + o.r).toBeLessThan(width);
          expect(o.cy + o.r).toBeLessThan(footerTop(ops));
        }
        if (o.op === "pixels") {
          expect(o.x).toBeGreaterThan(0);
          expect(o.x + o.grid.length * o.scale).toBeLessThan(width);
        }
        if (o.op === "text" && o.align === "center") {
          expect(textWidth(o.text, o.size)).toBeLessThanOrEqual(width);
        }
      }
    }
  });

  it("draws the heading, ID line, buddy, lines and footer", () => {
    const t = texts(layoutCard(spec(), format));
    expect(t).toEqual(
      expect.arrayContaining([
        "today",
        "Alice",
        "Kyoto",
        "sat 21 nov",
        "ฅ^•ω•^ฅ",
        "moneylogs",
        "moneylogs.app",
      ]),
    );
    expect(t.join(" ")).toContain("usual Saturday!");
  });

  it("puts the photo top left beside the name, at a whole-pixel scale", () => {
    const ops = layoutCard(spec(), format);
    const [photo] = ops.filter((o) => o.op === "pixels");
    const name = ops.find((o) => o.op === "text" && o.text === "Alice");
    const heading = ops.find((o) => o.op === "text" && o.text === "today");
    expect(photo.op === "pixels" && Number.isInteger(photo.scale)).toBe(true);
    if (photo.op !== "pixels" || name?.op !== "text" || heading?.op !== "text") throw 0;
    expect(photo.x).toBeLessThan(name.x);
    expect(photo.y).toBeGreaterThan(heading.y);
    expect(name.y).toBeGreaterThan(photo.y);
    expect(name.y).toBeLessThan(photo.y + photo.grid.length * photo.scale);
  });

  it("puts a smaller buddy at the right end of the ID line, clear of the name", () => {
    const ops = layoutCard(spec({ name: "Bartholomew Montgomery-Fitzwilliam III" }), format);
    const find = (pred: (o: Extract<DrawOp, { op: "text" }>) => boolean) =>
      ops.find((o): o is Extract<DrawOp, { op: "text" }> => o.op === "text" && pred(o))!;
    const face = find((o) => o.text === "ฅ^•ω•^ฅ");
    const name = find((o) => o.text.startsWith("Bart"));
    const date = find((o) => o.text === "sat 21 nov");
    const firstLine = find((o) => o.text.includes("usual"));
    expect(face.align).toBe("right");
    expect(face.x).toBeLessThanOrEqual(width);
    expect(face.size).toBeLessThan(name.size * 1.25);
    // Level with the ID line, above the lines below it.
    expect(face.y).toBeGreaterThan(name.y);
    expect(face.y).toBeLessThan(date.y + date.size);
    expect(firstLine.y).toBeGreaterThan(face.y);
    // The name is cut short of the buddy.
    expect(name.x + textWidth(name.text, name.size)).toBeLessThan(
      face.x - textWidth(face.text, face.size),
    );
  });

  it("tucks the knick-knack into the footer's bottom-right corner, unlabelled", () => {
    const ops = layoutCard(spec(), format);
    const kk = ops.filter((o) => o.op === "pixels")[1];
    if (kk?.op !== "pixels") throw 0;
    expect(Number.isInteger(kk.scale)).toBe(true);
    expect(kk.x + kk.grid.length * kk.scale).toBeGreaterThan(width * 0.85);
    expect(kk.y).toBeGreaterThanOrEqual(footerTop(ops) - kk.grid.length * kk.scale);
    expect(kk.y + kk.grid.length * kk.scale).toBeLessThan(height);
    // Only the header, ID line, buddy, lines and footer carry words: no item name.
    expect(texts(ops)).toHaveLength(texts(layoutCard(spec({ knickKnack: null }), format)).length);
  });

  it("leaves out what isn't there", () => {
    const ops = layoutCard(spec({ avatar: null, knickKnack: null, location: null }), format);
    expect(ops.filter((o) => o.op === "pixels")).toHaveLength(0);
    expect(texts(ops)).not.toContain("Kyoto");
    expect(texts(ops)).toContain("Alice");
  });

  it("cuts a long name to fit beside the photo", () => {
    const ops = layoutCard(spec({ name: "Bartholomew Montgomery-Fitzwilliam III" }), format);
    const name = ops.find((o) => o.op === "text" && o.weight === 700 && o.text.startsWith("Bart"));
    if (name?.op !== "text") throw 0;
    expect(name.x + textWidth(name.text, name.size)).toBeLessThanOrEqual(width);
  });

  it("draws a pie with a key, or without names when hidden", () => {
    const named = layoutCard(spec({ lines: ["Where my money went"], slices }), format);
    expect(named.filter((o) => o.op === "pie")).toHaveLength(1);
    expect(named.filter((o) => o.op === "swatch")).toHaveLength(slices.length);
    expect(texts(named)).toEqual(expect.arrayContaining(["FOOD", "OTHER"]));

    const hidden = layoutCard(
      spec({ lines: ["Where my money went"], slices, showNames: false }),
      format,
    );
    expect(hidden.filter((o) => o.op === "pie")).toHaveLength(1);
    expect(hidden.filter((o) => o.op === "swatch")).toHaveLength(0);
    expect(texts(hidden)).not.toContain("FOOD");
  });

  it("heads the pie with a small caps-lock title, and only when there's a pie", () => {
    const ops = layoutCard(spec({ slices }), format);
    const title = ops.find((o) => o.op === "text" && o.text === "WHERE MY MONEY WENT");
    const pie = ops.find((o) => o.op === "pie");
    const line = ops.find((o) => o.op === "text" && o.text.includes("usual"));
    if (title?.op !== "text" || pie?.op !== "pie" || line?.op !== "text") throw 0;
    expect(title.y).toBeLessThan(pie.cy - pie.r);
    expect(title.y).toBeGreaterThan(line.y);
    expect(title.size).toBeLessThan(line.size);
    expect(texts(layoutCard(spec(), format))).not.toContain("WHERE MY MONEY WENT");
  });

  it("lines up the brag lines, the box and the footer on the card's left edge", () => {
    const ops = layoutCard(spec({ slices }), format);
    const photo = ops.find((o) => o.op === "frame" && o.w < width / 2);
    const markers = ops.filter((o) => o.op === "text" && o.text === "›");
    const brag = ops.find((o) => o.op === "text" && o.text.startsWith("I spent"));
    const sheet = ops.find((o) => o.op === "rect" && o.fill === "sheet");
    const word = ops.find((o) => o.op === "text" && o.text === "moneylogs");
    if (photo?.op !== "frame" || brag?.op !== "text" || sheet?.op !== "rect") throw 0;
    if (word?.op !== "text") throw 0;
    expect(markers).toHaveLength(2);
    for (const mk of markers) expect(mk.op === "text" && mk.x).toBe(photo.x);
    expect(brag.align).toBe("left");
    expect(sheet.x).toBe(photo.x);
    expect(word.x).toBe(photo.x);
  });

  it("fills the room above the footer with the box, one section gap clear of each", () => {
    const ops = layoutCard(spec({ lines: [], slices }), format);
    const sheet = ops.find((o) => o.op === "rect" && o.fill === "sheet");
    const tears = ops.filter((o) => o.op === "dashes");
    if (sheet?.op !== "rect" || tears[0]?.op !== "dashes" || tears[1]?.op !== "dashes") throw 0;
    const above = sheet.y - tears[0].y;
    const below = tears[1].y - (sheet.y + sheet.h);
    expect(above).toBeGreaterThan(0);
    expect(below).toBe(above);
  });

  it("boxes the title, pie and key on a sheet, title at the top left", () => {
    const ops = layoutCard(spec({ slices }), format);
    const sheet = ops.find((o) => o.op === "rect" && o.fill === "sheet");
    const frames = ops.filter((o) => o.op === "frame");
    const title = ops.find((o) => o.op === "text" && o.text === "WHERE MY MONEY WENT");
    const pie = ops.find((o) => o.op === "pie");
    const swatches = ops.filter((o) => o.op === "swatch");
    if (sheet?.op !== "rect" || title?.op !== "text" || pie?.op !== "pie") throw 0;
    // Card frame, photo frame, and the box's hairline frame over the sheet.
    expect(frames.some((f) => f.op === "frame" && f.y === sheet.y && f.h === sheet.h)).toBe(true);
    expect(title.align).toBe("left");
    expect(title.x).toBeGreaterThan(sheet.x);
    expect(title.x).toBeLessThan(width / 4);
    const inside = (top: number, bottom: number) => {
      expect(top).toBeGreaterThan(sheet.y);
      expect(bottom).toBeLessThan(sheet.y + sheet.h);
    };
    inside(title.y - title.size / 2, title.y + title.size / 2);
    inside(pie.cy - pie.r, pie.cy + pie.r);
    for (const sw of swatches) if (sw.op === "swatch") inside(sw.y, sw.y + sw.size);
    // The gaps between slices show the sheet, not the paper.
    expect(pie.ground).toBe("sheet");
  });

  it("gives neighbouring slices different fills, in colour and in mono", () => {
    for (const style of [TOKEN_CARD_STYLE, { ...TOKEN_CARD_STYLE, chart: null }]) {
      const ops = layoutCard(spec({ lines: [], slices }), format, style);
      const pie = ops.find((o) => o.op === "pie");
      const fills = pie && pie.op === "pie" ? pie.slices.map((s) => JSON.stringify(s.fill)) : [];
      expect(fills.length).toBeGreaterThan(1);
      for (let i = 1; i < fills.length; i++) expect(fills[i]).not.toBe(fills[i - 1]);
    }
  });

  it("keeps lines clear of the footer, however many there are", () => {
    const many = Array.from({ length: 12 }, (_, i) => `A long brag line number ${i} that wraps`);
    const ops = layoutCard(spec({ lines: many }), format);
    const top = footerTop(ops);
    for (const o of ops) {
      if (o.op === "text" && !["moneylogs", "moneylogs.app"].includes(o.text)) {
        expect(o.y).toBeLessThan(top);
      }
    }
  });
});

describe("card style", () => {
  it("reads tokens as src/tokens.scss writes them", () => {
    const source = `:root {\n  --ink: #111;\n  --inverse-ink: var(--paper);\n  --ink-muted: rgba(0, 0, 0, 0.7);\n}\n.night { --ink: #eee; }`;
    expect(tokenFromSource(source, "ink")).toBe("#111");
    expect(tokenFromSource(source, "ink-muted")).toBe("rgba(0, 0, 0, 0.7)");
    expect(tokenFromSource(source, "paper")).toBeUndefined();
  });

  it("defaults to the light theme's tokens", () => {
    expect(TOKEN_CARD_STYLE).toEqual({
      ink: "#242424",
      paper: "#f5f3f0",
      sheet: "#ffffff",
      font: "Hack, monospace",
      hairline: 1,
      rule: 2,
      chart: expect.arrayContaining([expect.stringMatching(/^#[0-9a-f]{6}$/)]),
      chartRest: "rgba(36, 36, 36, 0.3)",
    });
    expect(TOKEN_CARD_STYLE.chart).toHaveLength(6);
  });

  it("fills slices with chart colours in order, other in the rest wash", () => {
    const style = { chart: ["#1", "#2", "#3", "#4", "#5", "#6"], chartRest: "rest" };
    expect(sliceFills([{ id: "a" }, { id: "b" }, { id: "other" }], style)).toEqual([
      { colour: "#1" },
      { colour: "#2" },
      { colour: "rest" },
    ]);
  });

  it("falls back to the 1-bit fills when charts are mono", () => {
    const arcs = [{ id: "a" }, { id: "b" }, { id: "other" }];
    expect(sliceFills(arcs, { chart: null, chartRest: "rest" })).toEqual(SLICE_FILLS.slice(0, 3));
  });

  it("prefers the page's current values, falling back token by token", () => {
    const root = document.documentElement.style;
    root.setProperty("--ink", "#f5f3f0");
    root.setProperty("--paper", "#242424");
    root.setProperty("--border-rule", "3px");
    try {
      expect(readCardStyle()).toEqual({
        ...TOKEN_CARD_STYLE,
        ink: "#f5f3f0",
        paper: "#242424",
        rule: 3,
      });
    } finally {
      root.removeProperty("--ink");
      root.removeProperty("--paper");
      root.removeProperty("--border-rule");
    }
  });

  it("draws line weights from the style it's given, at the card scale", () => {
    const style = { ...TOKEN_CARD_STYLE, hairline: 2, rule: 5 };
    const ops = layoutCard(spec({ lines: ["Where my money went"], slices }), "story", style);
    const frame = ops.find((o) => o.op === "frame");
    const pie = ops.find((o) => o.op === "pie");
    const swatch = ops.find((o) => o.op === "swatch");
    expect(frame && frame.op === "frame" && frame.width).toBe(5 * CARD_SCALE);
    // The pie's rim and gaps are hairlines, like the tear lines.
    expect(pie && pie.op === "pie" && [pie.rim, pie.gap]).toEqual([6, 6]);
    expect(swatch && swatch.op === "swatch" && swatch.border).toBe(2 * CARD_SCALE);
    const tears = ops.filter((o) => o.op === "dashes");
    expect(tears).toHaveLength(2);
    for (const t of tears) expect(t.op === "dashes" && t.h).toBe(2 * CARD_SCALE);
  });
});
