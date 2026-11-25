#!/usr/bin/env node
// Builds a review page from the screenshots `vp test --project visual` saves through
// v.sizes() (src/test/visual.tsx): one section per scene, a 3 × 3 grid of text size
// (rows) by UI size (columns), plus a row of the same scene on a narrow phone. Writes .vitest/gallery/index.html next to the images.
//
//   npx vp test --project visual && node scripts/visual-gallery.mjs
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const GALLERY = join(ROOT, ".vitest/gallery");
const SIZES = ["s", "m", "l"];

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const escape = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Scene name → the test file that renders it, from the v.sizes("…") calls in src/.
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const scenes = new Map();
for (const file of walk(join(ROOT, "src")).filter((f) => f.endsWith(".visual.test.tsx"))) {
  for (const [, name] of readFileSync(file, "utf8").matchAll(/v\.sizes\(\s*"([^"]+)"/g)) {
    scenes.set(slug(name), { name, file: relative(ROOT, file) });
  }
}

const shot = (id, text, ui, narrow = false) =>
  `${id}/${narrow ? "narrow__" : ""}text-${text}__ui-${ui}.png`;
// Must match NARROW_PAIRS in src/test/visual.tsx.
const NARROW_PAIRS = [
  ["m", "m"],
  ["l", "m"],
  ["l", "l"],
];
const found = readdirSync(GALLERY)
  .filter((id) => statSync(join(GALLERY, id)).isDirectory())
  .sort();

const section = (id) => {
  const { name, file } = scenes.get(id) ?? { name: id.replace(/-/g, " "), file: "" };
  const cells = SIZES.flatMap((text) =>
    SIZES.map((ui) => {
      const label = `${name} · text ${text.toUpperCase()} · ui ${ui.toUpperCase()}`;
      const tag = text === "m" && ui === "m" ? `<span class="tag">default</span>` : "";
      return `<figure class="cell" id="${id}--text-${text}-ui-${ui}">
          <figcaption>text ${text.toUpperCase()} · ui ${ui.toUpperCase()} ${tag}</figcaption>
          <img src="${shot(id, text, ui)}" alt="${escape(label)}" loading="lazy" width="390">
        </figure>`;
    }),
  );
  return `<section class="scene" id="${id}">
      <header>
        <h2>${escape(name)}</h2>
        ${file ? `<code>${escape(file)}</code>` : ""}
      </header>
      <div class="scroller">
        <div class="axis-top"><span></span>${SIZES.map((s) => `<span>ui ${s.toUpperCase()}</span>`).join("")}</div>
        <div class="grid">
          ${SIZES.map(
            (text, row) => `<div class="axis-side">text ${text.toUpperCase()}</div>
          ${cells.slice(row * 3, row * 3 + 3).join("\n")}`,
          ).join("\n")}
          <div class="axis-side axis-side--narrow">narrow 360px</div>
          ${NARROW_PAIRS.filter(([t, u]) => existsSync(join(GALLERY, shot(id, t, u, true))))
            .map(
              ([
                text,
                ui,
              ]) => `<figure class="cell cell--narrow" id="${id}--narrow-text-${text}-ui-${ui}">
          <figcaption>narrow · text ${text.toUpperCase()} · ui ${ui.toUpperCase()}</figcaption>
          <img src="${shot(id, text, ui, true)}" alt="${escape(`${name} · narrow phone · text ${text.toUpperCase()} · ui ${ui.toUpperCase()}`)}" loading="lazy" width="360">
        </figure>`,
            )
            .join("\n")}
        </div>
      </div>
    </section>`;
};

const html = `<title>moneylogs size review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap">
<style>
  /* Layout: a contents strip, then one scene per section as a text-size × UI-size grid
     of phone screenshots, scrolling sideways inside its own frame on narrow screens.
     Monochrome like the app: two inks, square corners, frames for structure. */
  :root {
    --paper: #f3f1ec;
    --sheet: #fbfaf7;
    --ink: #242424;
    --muted: #5c5a55;
    --rule: #b9b5ac;
    --mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #1b1b1a; --sheet: #242423; --ink: #e9e6df; --muted: #aaa69d; --rule: #4a4844;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --paper: #1b1b1a; --sheet: #242423; --ink: #e9e6df; --muted: #aaa69d; --rule: #4a4844;
    color-scheme: dark;
  }
  body {
    background: var(--paper);
    color: var(--ink);
    font: 14px/1.5 var(--mono);
    padding-block: 2rem 4rem;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
  }
  main { display: flex; flex-direction: column; gap: 3rem; max-width: 1340px; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin: 0 0 0.5rem; text-wrap: balance; }
  .intro p { margin: 0; max-width: 65ch; color: var(--muted); }
  .intro p + p { margin-top: 0.5rem; }
  nav { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 1rem; }
  nav a {
    color: var(--ink); text-decoration: none; border: 1px solid var(--ink);
    padding: 0.15rem 0.5rem; font-size: 0.85rem;
  }
  nav a:hover, nav a:focus-visible { background: var(--ink); color: var(--paper); outline: none; }
  .scene header {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 1rem;
    border-bottom: 2px solid var(--ink); padding-bottom: 0.4rem; margin-bottom: 0.75rem;
  }
  .scene h2 { font-size: 1.15rem; margin: 0; }
  .scene code { color: var(--muted); font-size: 0.8rem; min-width: 0; overflow-wrap: anywhere; }
  .scroller { overflow-x: auto; }
  .axis-top, .grid { display: grid; grid-template-columns: 2.5rem repeat(3, 390px); gap: 1.25rem; }
  .axis-top { margin-bottom: 0.4rem; font-weight: 700; font-size: 0.85rem; }
  .axis-side {
    writing-mode: vertical-rl; transform: rotate(180deg); text-align: right;
    font-weight: 700; font-size: 0.85rem; border-right: 1px dotted var(--rule);
  }
  .grid { align-items: start; }
  .cell { margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .cell figcaption { font-size: 0.8rem; color: var(--muted); display: flex; gap: 0.5rem; }
  .tag { background: var(--ink); color: var(--paper); padding: 0 0.35rem; }
  .axis-side--narrow { border-top: 2px solid var(--ink); padding-top: 0.5rem; }
  .cell--narrow { border-top: 2px solid var(--ink); padding-top: 0.5rem; }
  .cell.cell--narrow img { width: 360px; }
  .cell img { display: block; width: 390px; max-width: none; border: 1px solid var(--rule); background: var(--sheet); }
  .cell:target img { outline: 3px solid var(--ink); outline-offset: 2px; }
</style>
<main>
  <div class="intro">
    <h1>size review</h1>
    <p>Each scene from the visual tests at phone width (390px), at every Display → Text size (rows) and UI size (columns). Text M · UI M is the default and matches production. The last row is the same scene on a narrow phone (360px), where text collides first.</p>
    <p>Leave a comment on any screenshot. Saying the scene and the size pair is enough for me to find the component. Comments on a whole row or column apply to that size across the scene.</p>
    <nav aria-label="Scenes">
      ${found.map((id) => `<a href="#${id}">${escape(scenes.get(id)?.name ?? id)}</a>`).join("\n      ")}
    </nav>
  </div>
  ${found.map(section).join("\n  ")}
</main>
`;

writeFileSync(join(GALLERY, "index.html"), html);
console.log(`${found.length} scenes → ${relative(ROOT, join(GALLERY, "index.html"))}`);
