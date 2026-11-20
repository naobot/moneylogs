#!/usr/bin/env node
/**
 * Check, or design, each theme's link accent in src/tokens.scss.
 *
 *   node scripts/link-accent.mjs                               # check every theme
 *   node scripts/link-accent.mjs <paper> <sheet> <ink> [chroma]  # suggest a pair
 *
 * Links in posts are the one place text leaves the two inks, and only just: the accent is
 * the theme's own ink, brighter and more saturated. Each theme's accent(...) include
 * gives two: --accent for links on the ground (paper and sheet), the ink's hue pushed
 * up in chroma, and --accent-inverse for links on an inverted block (pinned posts, the
 * log owner's comments), the paper's hue on an --ink ground. A theme whose inks are
 * neutral grey (Paper, Night shift) has no hue to push, so its links stay ink: bold and
 * underline still mark them. Checks, per theme:
 *   - --accent is >= 4.5:1 on paper and on sheet, and --accent-inverse >= 4.5:1 on ink;
 *   - each keeps the hue of the ink it stands in for (within 30 degrees of OKLCH hue),
 *     or equals that ink when the ink is neutral.
 * The suggest form solves OKLCH lightness at the ink's (and paper's) hue so each colour
 * sits just past 5:1, the brightest, most saturated value that still reads comfortably,
 * lowering chroma until it fits in sRGB.
 * Exits 1 if any theme fails.
 */
import { readFileSync } from "node:fs";

const MIN_CONTRAST = 4.5;
const TARGET = 5; // on a light ground: the lightest value past this
const TARGET_DARK = 7; // on a dark ground: never dimmer than this
const MAX_HUE_SHIFT = 30;
const NEUTRAL = 0.01; // OKLCH chroma below which an ink has no hue to push

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
const toLin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const oklab = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const chroma = (hex) => {
  const [, a, b] = oklab(hex);
  return Math.hypot(a, b);
};
const hue = (hex) => {
  const [, a, b] = oklab(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
};
const hueShift = (a, b) => {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return d > 180 ? 360 - d : d;
};
// OKLCH -> sRGB hex, or null when out of gamut.
const oklch = (L, C, h) => {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (lin.some((v) => v < -1e-4 || v > 1 + 1e-4)) return null;
  return rgbToHex(lin.map((v) => Math.round(Math.max(0, Math.min(1, fromLin(v))) * 255)));
};

const lightness = (hex) => oklab(hex)[0];
// The most chroma (up to maxChroma) that fits in sRGB at lightness L and hue h.
const richest = (L, h, maxChroma) => {
  for (let C = maxChroma; C > 0; C -= 0.002) {
    const hex = oklch(L, C, h);
    if (hex) return { hex, C };
  }
  return { hex: oklch(L, 0, h), C: 0 };
};

/**
 * A brighter, more saturated `text` for links on `grounds`. On a light ground the link
 * is dark, so brighter means lighter: the lightest value at the text's hue that still
 * sits past TARGET. On a dark ground the text is already bright, so the link stays
 * between TARGET_DARK and the text's own lightness and takes whichever value there holds
 * the most chroma.
 */
const tint = (text, grounds, maxChroma) => {
  if (chroma(text) < NEUTRAL) return text; // a grey ink has no hue to push
  const h = hue(text);
  const passes = (hex, target) => grounds.every((g) => contrast(hex, g) >= target);
  if (grounds.every((g) => luminance(g) >= 0.18)) {
    for (let L = 1; L >= 0; L -= 0.001) {
      const { hex } = richest(L, h, maxChroma);
      if (passes(hex, TARGET)) return hex;
    }
    return null;
  }
  let best = null;
  for (let L = lightness(text); L >= 0; L -= 0.001) {
    const r = richest(L, h, maxChroma);
    if (!passes(r.hex, TARGET_DARK)) break;
    if (!best || r.C > best.C + 1e-3) best = r;
  }
  return best?.hex ?? text;
};

const args = process.argv.slice(2);
if (args.length >= 3) {
  const [paper, sheet, ink, maxChroma = "0.17"] = args;
  const accent = tint(ink, [paper, sheet], Number(maxChroma));
  const inverse = tint(paper, [ink], Number(maxChroma));
  console.log(`@include accent(${accent}, ${inverse});`);
  console.log(
    `accent ${contrast(accent, paper).toFixed(1)}:1 on paper, ${contrast(accent, sheet).toFixed(1)}:1 on sheet · ` +
      `inverse ${contrast(inverse, ink).toFixed(1)}:1 on ink`,
  );
  process.exit(0);
}

const scss = readFileSync(new URL("../src/tokens.scss", import.meta.url), "utf8");
const HEX = /#[0-9a-f]{6}/gi;
const themes = [...scss.matchAll(/\[data-theme="([a-z]+)"\] \{([\s\S]*?)\n\}/g)].map(
  ([, id, body]) => {
    const inks = body.match(/two-inks\(([\s\S]*?)\);/)?.[1].match(HEX) ?? [];
    const accent = body.match(/accent\(([^)]*)\)/)?.[1].match(HEX) ?? [];
    return { id, paper: inks[0], sheet: inks[1], ink: inks[2], accent };
  },
);

let failed = 0;
for (const { id, paper, sheet, ink, accent } of themes) {
  const issues = [];
  const [onGround, onInverse] = accent;
  if (accent.length !== 2) {
    issues.push(`expected 2 accent colours, found ${accent.length}`);
  } else {
    const k = Math.min(contrast(onGround, paper), contrast(onGround, sheet));
    if (k < MIN_CONTRAST) issues.push(`accent ${k.toFixed(2)}:1 on the ground`);
    const keeps = (link, of) =>
      chroma(of) < NEUTRAL
        ? link.toLowerCase() === of.toLowerCase()
        : hueShift(link, of) <= MAX_HUE_SHIFT;
    if (!keeps(onGround, ink)) issues.push("accent strays from the ink's hue");
    const ki = contrast(onInverse, ink);
    if (ki < MIN_CONTRAST) issues.push(`accent-inverse ${ki.toFixed(2)}:1 on ink`);
    if (!keeps(onInverse, paper)) issues.push("accent-inverse strays from the paper's hue");
  }
  if (issues.length) failed++;
  console.log(`${id.padEnd(10)} ${accent.join(" ")}  ${issues.length ? issues.join("; ") : "ok"}`);
}
process.exit(failed ? 1 : 0);
