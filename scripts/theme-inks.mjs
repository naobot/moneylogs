#!/usr/bin/env node
/**
 * Check a colour theme's inks and generate its icon filters for src/tokens.scss.
 *
 *   node scripts/theme-inks.mjs <paper> <sheet> <ink>
 *   node scripts/theme-inks.mjs '#1c1408' '#221a0c' '#ffb000'
 *
 * Prints the contrast of --ink-muted (ink at 0.7) on paper and sheet, which must stay
 * >= 5:1, and two CSS filters that turn the black icon <img>s into the ink (for
 * --icon-filter) and into the paper (for --icon-filter-inverse). The filters come from
 * a randomised solver (SPSA), so each run differs slightly; any result with loss < 1 is
 * visually exact.
 */

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const luminance = ([r, g, b]) => {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const blend = (fg, bg, alpha) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

// ---- filter solver (after Barrett Sonntag's hex-to-filter, MIT) ----

const clamp = (v) => Math.max(0, Math.min(255, v));

class Color {
  constructor(r, g, b) {
    this.set(r, g, b);
  }
  set(r, g, b) {
    this.r = clamp(r);
    this.g = clamp(g);
    this.b = clamp(b);
  }
  multiply(m) {
    const { r, g, b } = this;
    this.set(
      r * m[0] + g * m[1] + b * m[2],
      r * m[3] + g * m[4] + b * m[5],
      r * m[6] + g * m[7] + b * m[8],
    );
  }
  hueRotate(angle = 0) {
    const a = (angle / 180) * Math.PI;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    this.multiply([
      0.213 + cos * 0.787 - sin * 0.213,
      0.715 - cos * 0.715 - sin * 0.715,
      0.072 - cos * 0.072 + sin * 0.928,
      0.213 - cos * 0.213 + sin * 0.143,
      0.715 + cos * 0.285 + sin * 0.14,
      0.072 - cos * 0.072 - sin * 0.283,
      0.213 - cos * 0.213 - sin * 0.787,
      0.715 - cos * 0.715 + sin * 0.715,
      0.072 + cos * 0.928 + sin * 0.072,
    ]);
  }
  sepia(v = 1) {
    this.multiply([
      0.393 + 0.607 * (1 - v),
      0.769 - 0.769 * (1 - v),
      0.189 - 0.189 * (1 - v),
      0.349 - 0.349 * (1 - v),
      0.686 + 0.314 * (1 - v),
      0.168 - 0.168 * (1 - v),
      0.272 - 0.272 * (1 - v),
      0.534 - 0.534 * (1 - v),
      0.131 + 0.869 * (1 - v),
    ]);
  }
  saturate(v = 1) {
    this.multiply([
      0.213 + 0.787 * v,
      0.715 - 0.715 * v,
      0.072 - 0.072 * v,
      0.213 - 0.213 * v,
      0.715 + 0.285 * v,
      0.072 - 0.072 * v,
      0.213 - 0.213 * v,
      0.715 - 0.715 * v,
      0.072 + 0.928 * v,
    ]);
  }
  linear(slope = 1, intercept = 0) {
    this.set(
      this.r * slope + intercept * 255,
      this.g * slope + intercept * 255,
      this.b * slope + intercept * 255,
    );
  }
  brightness(v = 1) {
    this.linear(v);
  }
  contrast(v = 1) {
    this.linear(v, -(0.5 * v) + 0.5);
  }
  invert(v = 1) {
    this.set(
      (v + (this.r / 255) * (1 - 2 * v)) * 255,
      (v + (this.g / 255) * (1 - 2 * v)) * 255,
      (v + (this.b / 255) * (1 - 2 * v)) * 255,
    );
  }
  hsl() {
    const r = this.r / 255;
    const g = this.g / 255;
    const b = this.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h * 100, s: s * 100, l: l * 100 };
  }
}

const solve = (target) => {
  const targetHsl = target.hsl();
  const loss = (f) => {
    const c = new Color(0, 0, 0);
    c.invert(f[0] / 100);
    c.sepia(f[1] / 100);
    c.saturate(f[2] / 100);
    c.hueRotate(f[3] * 3.6);
    c.brightness(f[4] / 100);
    c.contrast(f[5] / 100);
    const hsl = c.hsl();
    return (
      Math.abs(c.r - target.r) +
      Math.abs(c.g - target.g) +
      Math.abs(c.b - target.b) +
      Math.abs(hsl.h - targetHsl.h) +
      Math.abs(hsl.s - targetHsl.s) +
      Math.abs(hsl.l - targetHsl.l)
    );
  };

  const spsa = (A, a, c, values, iters) => {
    const alpha = 1;
    const gamma = 1 / 6;
    let best = null;
    let bestLoss = Infinity;
    const deltas = Array.from({ length: 6 }, () => 0);
    const highArgs = Array.from({ length: 6 }, () => 0);
    const lowArgs = Array.from({ length: 6 }, () => 0);
    const fix = (value, idx) => {
      let max = 100;
      if (idx === 2) max = 7500;
      else if (idx === 4 || idx === 5) max = 200;
      if (idx === 3) {
        if (value > max) value %= max;
        else if (value < 0) value = max + (value % max);
      } else if (value < 0) value = 0;
      else if (value > max) value = max;
      return value;
    };
    for (let k = 0; k < iters; k++) {
      const ck = c / (k + 1) ** gamma;
      for (let i = 0; i < 6; i++) {
        deltas[i] = Math.random() > 0.5 ? 1 : -1;
        highArgs[i] = values[i] + ck * deltas[i];
        lowArgs[i] = values[i] - ck * deltas[i];
      }
      const diff = loss(highArgs) - loss(lowArgs);
      for (let i = 0; i < 6; i++) {
        const g = (diff / (2 * ck)) * deltas[i];
        const ak = a[i] / (A + k + 1) ** alpha;
        values[i] = fix(values[i] - ak * g, i);
      }
      const l = loss(values);
      if (l < bestLoss) {
        best = values.slice(0);
        bestLoss = l;
      }
    }
    return { values: best, loss: bestLoss };
  };

  let best = { loss: Infinity };
  for (let attempt = 0; attempt < 60 && best.loss > 0.5; attempt++) {
    let wide = { loss: Infinity };
    for (let i = 0; wide.loss > 25 && i < 3; i++) {
      wide = spsa(5, [60, 180, 18000, 600, 1.2, 1.2], 15, [50, 20, 3750, 50, 100, 100], 1000);
    }
    const A = wide.loss;
    const narrow = spsa(
      A,
      [0.25 * (A + 1), 0.25 * (A + 1), A + 1, 0.25 * (A + 1), 0.2 * (A + 1), 0.2 * (A + 1)],
      2,
      wide.values,
      500,
    );
    if (narrow.loss < best.loss) best = narrow;
  }
  const v = best.values.map((x) => Math.round(x));
  return {
    loss: best.loss,
    css:
      `brightness(0) saturate(100%) invert(${v[0]}%) sepia(${v[1]}%) saturate(${v[2]}%) ` +
      `hue-rotate(${Math.round(v[3] * 3.6)}deg) brightness(${v[4]}%) contrast(${v[5]}%)`,
  };
};

const [paperHex, sheetHex, inkHex] = process.argv.slice(2);
if (!paperHex || !sheetHex || !inkHex) {
  console.error("usage: node scripts/theme-inks.mjs <paper> <sheet> <ink>");
  process.exit(1);
}
const paper = hexToRgb(paperHex);
const sheet = hexToRgb(sheetHex);
const ink = hexToRgb(inkHex);

const onPaper = contrast(blend(ink, paper, 0.7), paper);
const onSheet = contrast(blend(ink, sheet, 0.7), sheet);
const ok = Math.min(onPaper, onSheet) >= 5;
console.log(
  `ink ${contrast(ink, paper).toFixed(1)}:1 · muted on paper ${onPaper.toFixed(1)}:1 · ` +
    `muted on sheet ${onSheet.toFixed(1)}:1 ${ok ? "ok" : "TOO LOW (needs >= 5:1)"}`,
);
if (process.argv.includes("--check")) process.exit(ok ? 0 : 1);

const inkFilter = solve(new Color(...ink));
const paperFilter = solve(new Color(...paper));
console.log(`icon-filter (loss ${inkFilter.loss.toFixed(2)}):\n  ${inkFilter.css}`);
console.log(`icon-filter-inverse (loss ${paperFilter.loss.toFixed(2)}):\n  ${paperFilter.css}`);
