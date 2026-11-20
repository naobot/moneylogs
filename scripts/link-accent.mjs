#!/usr/bin/env node
/**
 * Check, or design, each theme's link accent in src/tokens.scss.
 *
 *   node scripts/link-accent.mjs                                  # check every theme
 *   node scripts/link-accent.mjs <paper> <sheet> <ink> <hue> [chroma]  # suggest a pair
 *
 * Links in posts are the one place text takes a colour other than the two inks. Each
 * theme's accent(...) include gives two: --accent for links on the ground (paper and
 * sheet) and --accent-inverse for links on an inverted block (pinned posts, the log
 * owner's comments), where the ground is --ink. Checks, per theme:
 *   - --accent is >= 4.5:1 on paper and on sheet, and --accent-inverse >= 4.5:1 on ink;
 *   - each reads as a colour, not as the ink beside it (OKLab distance >= 0.08 from the
 *     text around it).
 * To design one: pick an OKLCH hue that stands apart from the theme's ink (a cool blue
 * on a warm ink, a warm gold on a cool one) and run the suggest form. It solves OKLCH
 * lightness at that hue so each colour sits just past 5:1, the most colourful value that
 * still reads comfortably, lowering chroma until it fits in sRGB.
 * Exits 1 if any theme fails.
 */
import { readFileSync } from "node:fs";

const MIN_CONTRAST = 4.5;
const TARGET = 5;
const MIN_DISTANCE = 0.08;

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
const distance = (a, b) => {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
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

/** The lightness at `hue` that sits just past TARGET contrast on every ground. */
const solve = (grounds, hue, maxChroma) => {
  const dark = grounds.every((g) => luminance(g) < 0.18); // light text on a dark ground
  // Walk lightness from the ground's own end towards the far end; the first passing value
  // is the least extreme one, so it keeps the most colour. Each step takes the most
  // chroma (up to maxChroma) that fits in sRGB at that lightness.
  for (let i = 0; i <= 1000; i++) {
    const L = dark ? i / 1000 : 1 - i / 1000;
    for (let C = maxChroma; C >= 0; C -= 0.002) {
      const hex = oklch(L, C, hue);
      if (!hex) continue;
      if (grounds.every((g) => contrast(hex, g) >= TARGET)) return hex;
      break;
    }
  }
  return null;
};

const args = process.argv.slice(2);
if (args.length >= 4) {
  const [paper, sheet, ink, hue, chroma = "0.14"] = args;
  const accent = solve([paper, sheet], Number(hue), Number(chroma));
  const inverse = solve([ink], Number(hue), Number(chroma));
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
    if (distance(onGround, ink) < MIN_DISTANCE) issues.push("accent too close to ink");
    const ki = contrast(onInverse, ink);
    if (ki < MIN_CONTRAST) issues.push(`accent-inverse ${ki.toFixed(2)}:1 on ink`);
    if (distance(onInverse, paper) < MIN_DISTANCE) issues.push("accent-inverse too close to paper");
  }
  if (issues.length) failed++;
  console.log(`${id.padEnd(10)} ${accent.join(" ")}  ${issues.length ? issues.join("; ") : "ok"}`);
}
process.exit(failed ? 1 : 0);
