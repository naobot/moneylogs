#!/usr/bin/env node
/**
 * Check every theme's chart palette in src/tokens.scss.
 *
 *   node scripts/chart-palette.mjs
 *
 * Reads each [data-theme] block's inks (two-inks) and chart colours (chart-palette) and
 * checks, per theme:
 *   - each chart colour stands out from paper and sheet (contrast >= 1.5:1), so a fill
 *     reads as a shape;
 *   - chroma stays muted (OKLCH C <= 0.11), so no fill is loud;
 *   - all six differ (OKLab distance >= 0.06), and the first four, which sit side by side
 *     in the category bar and pie, differ more (>= 0.08) and still differ under a
 *     deuteranopia and protanopia simulation (>= 0.04).
 * To design a new palette: pick hues near the theme's own, keep C around 0.07-0.09, and
 * alternate lightness between neighbours so they differ in value as well as hue.
 * Exits 1 if any theme fails.
 */
import { readFileSync } from "node:fs";

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toLin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLin = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
};
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const linToOklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const oklab = (rgb) => linToOklab(rgb.map(toLin));
const distance = (a, b) => {
  const [p, q] = [oklab(a), oklab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};
const chroma = (hex) => {
  const [, a, b] = oklab(hexToRgb(hex));
  return Math.hypot(a, b);
};

// Machado et al. 2009, severity 1, on linear RGB.
const CVD = {
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
};
const simulate = (hex, m) => {
  const l = hexToRgb(hex).map(toLin);
  return m.map((row) => fromLin(row[0] * l[0] + row[1] * l[1] + row[2] * l[2]));
};

const scss = readFileSync(new URL("../src/tokens.scss", import.meta.url), "utf8");
const HEX = /#[0-9a-f]{6}/gi;
const themes = [...scss.matchAll(/\[data-theme="([a-z]+)"\] \{([\s\S]*?)\n\}/g)].map(
  ([, id, body]) => {
    const inks = body.match(/two-inks\(([\s\S]*?)\);/)?.[1].match(HEX) ?? [];
    const chart = body.match(/chart-palette\(([^)]*)\)/)?.[1].match(HEX) ?? [];
    return { id, paper: inks[0], sheet: inks[1], chart };
  },
);

let failed = 0;
for (const { id, paper, sheet, chart } of themes) {
  const issues = [];
  if (chart.length !== 6) issues.push(`expected 6 chart colours, found ${chart.length}`);
  chart.forEach((c, i) => {
    const k = Math.min(contrast(c, paper), contrast(c, sheet));
    if (k < 1.5) issues.push(`chart-${i + 1} ${k.toFixed(2)}:1 on the ground`);
    if (chroma(c) > 0.11) issues.push(`chart-${i + 1} too loud`);
  });
  for (let i = 0; i < chart.length; i++) {
    for (let j = i + 1; j < chart.length; j++) {
      const core = j < 4;
      const d = distance(hexToRgb(chart[i]), hexToRgb(chart[j]));
      if (d < (core ? 0.08 : 0.06)) issues.push(`chart-${i + 1}/${j + 1} too close`);
      if (!core) continue;
      for (const [name, m] of Object.entries(CVD)) {
        if (distance(simulate(chart[i], m), simulate(chart[j], m)) < 0.04) {
          issues.push(`chart-${i + 1}/${j + 1} too close for ${name}`);
        }
      }
    }
  }
  if (issues.length) failed++;
  console.log(`${id.padEnd(10)} ${chart.join(" ")}  ${issues.length ? issues.join("; ") : "ok"}`);
}
process.exit(failed ? 1 : 0);
