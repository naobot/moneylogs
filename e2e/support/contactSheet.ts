// One page with every walkthrough's screenshots side by side, a row per variant, plus
// what went wrong along the way (console errors, blocked requests). Open it after a run
// to review the flows by eye.
import fs from "node:fs";
import path from "node:path";
import { NOTES_DIR, OUTPUT_DIR, SCREENS_DIR } from "./env";

export type WalkthroughNotes = {
  walkthrough: string;
  title: string;
  variant: string;
  finished: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  blockedRequests: string[];
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const list = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);

export function writeContactSheet(): string | null {
  const walkthroughs = list(SCREENS_DIR);
  if (!walkthroughs.length) return null;

  const notes = new Map<string, WalkthroughNotes>();
  for (const file of list(NOTES_DIR)) {
    const n = JSON.parse(fs.readFileSync(path.join(NOTES_DIR, file), "utf8")) as WalkthroughNotes;
    notes.set(`${n.walkthrough}/${n.variant}`, n);
  }

  const sections = walkthroughs.map((walkthrough) => {
    const variants = list(path.join(SCREENS_DIR, walkthrough));
    const title = notes.get(`${walkthrough}/${variants[0]}`)?.title ?? walkthrough;
    const rows = variants.map((variant) => {
      const n = notes.get(`${walkthrough}/${variant}`);
      const shots = list(path.join(SCREENS_DIR, walkthrough, variant)).filter((f) =>
        f.endsWith(".png"),
      );
      const issues = [
        ...(n && !n.finished ? ["did not finish: see the test output"] : []),
        ...(n?.pageErrors ?? []).map((e) => `page error: ${e}`),
        ...(n?.consoleErrors ?? []).map((e) => `console: ${e}`),
        ...(n?.blockedRequests ?? []).map((e) => `blocked: ${e}`),
      ];
      return `
        <div class="row">
          <h3>${esc(variant)}${n && !n.finished ? " · <b>stopped early</b>" : ""}</h3>
          <div class="strip">${shots
            .map((f) => {
              const src = `screens/${walkthrough}/${variant}/${f}`;
              return `<figure><a href="${esc(src)}"><img src="${esc(src)}" loading="lazy" alt=""></a><figcaption>${esc(f.replace(/\.png$/, ""))}</figcaption></figure>`;
            })
            .join("")}</div>
          ${issues.length ? `<ul class="issues">${issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
        </div>`;
    });
    return `<section><h2>${esc(title)}</h2>${rows.join("")}</section>`;
  });

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Walkthroughs</title>
<style>
  :root { --ink: #111; --paper: #fff; --muted: rgba(17,17,17,.7); color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root { --ink: #eee; --paper: #111; --muted: rgba(238,238,238,.7); } }
  body { margin: 0; padding: 16px; background: var(--paper); color: var(--ink); font: 14px/1.4 ui-monospace, Menlo, monospace; }
  h1 { font-size: 20px; } h2 { font-size: 16px; margin: 32px 0 8px; border-bottom: 2px solid var(--ink); }
  h3 { font-size: 13px; margin: 12px 0 6px; color: var(--muted); font-weight: 400; }
  .strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
  figure { margin: 0; flex: 0 0 auto; width: 195px; }
  img { width: 100%; border: 1px solid var(--ink); display: block; }
  figcaption { font-size: 12px; margin-top: 4px; overflow-wrap: anywhere; }
  .issues { border: 3px solid var(--ink); padding: 8px 8px 8px 28px; margin: 8px 0; }
</style></head><body>
<h1>walkthroughs · ${esc(new Date().toLocaleString())}</h1>
<p>Each row is one run of the flow; click a step for the full-size screenshot. docs/user-states.md says what to look for.</p>
${sections.join("")}
</body></html>`;
  const file = path.join(OUTPUT_DIR, "index.html");
  fs.writeFileSync(file, html);
  return file;
}
