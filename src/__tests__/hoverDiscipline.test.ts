// @vitest-environment node
/// <reference types="node" />
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "sass";
import { describe, expect, it } from "vite-plus/test";

// 2026-11 audit (design-system README → States): hover styles only where the pointer
// hovers. On touch, :hover sticks to the last thing tapped, so a tapped card or row
// stayed inverted when you came back to it. src/states.scss has the hover() mixin.

const SRC = fileURLToPath(new URL("..", import.meta.url));

const stylesheets = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : stylesheets(full);
    // Partials (_name.scss) are compiled through the files that use them.
    return name.endsWith(".scss") && !name.startsWith("_") ? [full] : [];
  });

/** Resolves `@/…` and root-relative `/src/…` imports the way Vite does. */
const aliasImporter = {
  findFileUrl: (url: string) => {
    if (url.startsWith("@/")) return pathToFileURL(path.join(SRC, url.slice(2)));
    if (url.startsWith("/src/")) return pathToFileURL(path.join(SRC, url.slice(5)));
    return null;
  },
};

/** Selectors with :hover that aren't inside @media (hover: hover). */
const ungatedHovers = (css: string): string[] => {
  const stack: string[] = [];
  const found: string[] = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      const prelude = css.slice(start, i).trim();
      const gated = stack.some((p) => /@media[^{]*\(hover:\s*hover\)/.test(p));
      if (prelude.includes(":hover") && !prelude.startsWith("@") && !gated) found.push(prelude);
      stack.push(prelude);
      start = i + 1;
    } else if (c === "}") {
      stack.pop();
      start = i + 1;
    } else if (c === ";") {
      start = i + 1;
    }
  }
  return found;
};

const compiled = (file: string) =>
  compile(file, { importers: [aliasImporter], quietDeps: true, logger: { warn: () => {} } }).css;

describe("hover discipline", () => {
  it.each(stylesheets(SRC).map((file) => [path.relative(SRC, file), file]))(
    "%s puts every :hover behind @media (hover: hover)",
    (_name, file) => {
      expect(ungatedHovers(compiled(file))).toEqual([]);
    },
  );

  it("inverts buttons and row buttons on a press, for touch", () => {
    const css = compiled(path.join(SRC, "App.scss"));
    expect(css).toMatch(/\.Button--primary:active:not\(\.Button--disabled\)/);
    expect(css).toMatch(/\.RowButton:active:not\(:disabled\)/);
  });

  it("finds an ungated hover", () => {
    expect(ungatedHovers(".A:hover{color:red}@media (hover: hover){.B:hover{color:red}}")).toEqual([
      ".A:hover",
    ]);
  });
});
