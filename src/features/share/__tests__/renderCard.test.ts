import { describe, it, expect } from "vite-plus/test";
import {
  CARD_SIZES,
  CardFormat,
  CardSpec,
  DrawOp,
  layoutCard,
  readCardStyle,
  CARD_SCALE,
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
  face: "ฅ^•ω•^ฅ",
  lines: ["I spent 3× less than on a usual Saturday!", "4 no-spend days in a row!"],
  slices: [],
  showNames: true,
  avatar: grid(30),
  knickKnack: { grid: grid(32), name: "pebble" },
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

  it("draws the heading, date, buddy, lines and footer", () => {
    const t = texts(layoutCard(spec(), format));
    expect(t).toEqual(
      expect.arrayContaining(["today", "sat 21 nov", "ฅ^•ω•^ฅ", "moneylogs", "moneylogs.app"]),
    );
    expect(t.join(" ")).toContain("usual Saturday!");
    expect(t).toContain("pebble");
  });

  it("puts the avatar and knick-knack on the shelf at whole-pixel scales", () => {
    const pixels = layoutCard(spec(), format).filter((o) => o.op === "pixels");
    expect(pixels).toHaveLength(2);
    for (const p of pixels) expect(Number.isInteger(p.scale)).toBe(true);
  });

  it("leaves out what isn't there", () => {
    const ops = layoutCard(spec({ avatar: null, knickKnack: null }), format);
    expect(ops.filter((o) => o.op === "pixels")).toHaveLength(0);
    expect(texts(ops)).not.toContain("pebble");
  });

  it("draws a pie with a key, or without names when hidden", () => {
    const named = layoutCard(spec({ lines: ["Where my money went"], slices }), format);
    expect(named.filter((o) => o.op === "pie")).toHaveLength(1);
    expect(named.filter((o) => o.op === "swatch")).toHaveLength(slices.length);
    expect(texts(named)).toEqual(expect.arrayContaining(["Food", "other"]));

    const hidden = layoutCard(
      spec({ lines: ["Where my money went"], slices, showNames: false }),
      format,
    );
    expect(hidden.filter((o) => o.op === "pie")).toHaveLength(1);
    expect(hidden.filter((o) => o.op === "swatch")).toHaveLength(0);
    expect(texts(hidden)).not.toContain("Food");
  });

  it("gives neighbouring slices different fills", () => {
    const pie = layoutCard(spec({ lines: [], slices }), format).find((o) => o.op === "pie");
    const fills = pie && pie.op === "pie" ? pie.slices.map((s) => s.fill) : [];
    for (let i = 1; i < fills.length; i++) expect(fills[i]).not.toBe(fills[i - 1]);
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
      font: "Hack, monospace",
      hairline: 1,
      rule: 2,
    });
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
    expect(pie && pie.op === "pie" && [pie.rim, pie.gap]).toEqual([15, 15]);
    expect(swatch && swatch.op === "swatch" && swatch.border).toBe(2 * CARD_SCALE);
    const shelfRule = ops.find(
      (o) => o.op === "rect" && o.fill === "ink" && o.h === 2 * CARD_SCALE,
    );
    expect(shelfRule).toBeDefined();
  });
});
