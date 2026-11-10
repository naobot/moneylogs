// Re-cut each icon's viewBox to a square centred on its art, so the art sits in the
// middle of the square .Icon box (and of any flex row it's in) without CSS nudges.
//
// Stock icons usually ship with a tall viewBox (e.g. 0 0 100 125) whose bottom fifth is
// space for an attribution line; rendered into a square box, that leaves the art ~10%
// above centre. The new side is the old viewBox's longer edge, so the icon renders at
// the same size it did before.
//
// Usage: npm run center-icons [-- public/icons/new-icon.svg ...]   (default: all icons)
// Borrows sharp from functions/ to rasterise each SVG and measure its ink.

import { createRequire } from "node:module";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const sharp = require("sharp");

const DIR = "public/icons";
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(DIR)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => `${DIR}/${f}`);

const round = (n) => +n.toFixed(2);

for (const file of files) {
  const svg = readFileSync(file, "utf8");
  const current = svg.match(/viewBox="([^"]*)"/)?.[1];
  if (!current) {
    console.warn(`${file}: no viewBox, skipped`);
    continue;
  }
  const [x, y, w, h] = current.split(/[\s,]+/).map(Number);

  // Rasterise at ~2000px on the long edge and find the bounding box of opaque pixels.
  const scale = 2000 / Math.max(w, h);
  const { data, info } = await sharp(Buffer.from(svg), { density: 72 * scale })
    .resize(Math.round(w * scale), Math.round(h * scale), { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let py = 0; py < info.height; py++) {
    for (let px = 0; px < info.width; px++) {
      if (data[(py * info.width + px) * 4 + 3] > 128) {
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
    }
  }
  if (x1 < 0) {
    console.warn(`${file}: no visible art, skipped`);
    continue;
  }

  const cx = x + ((x0 + x1 + 1) / 2 / info.width) * w;
  const cy = y + ((y0 + y1 + 1) / 2 / info.height) * h;
  const side = Math.max(w, h);
  const next = [cx - side / 2, cy - side / 2, side, side].map(round).join(" ");

  writeFileSync(file, svg.replace(`viewBox="${current}"`, `viewBox="${next}"`));
  console.log(`${file}: ${current} -> ${next}`);
}
