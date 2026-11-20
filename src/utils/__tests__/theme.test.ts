import { describe, it, expect, beforeEach } from "vite-plus/test";
import TOKENS_SCSS from "@/tokens.scss?raw";
import {
  COLOUR_THEMES,
  THEME_FAMILIES,
  THEMES,
  themesInFamily,
  getLastColourTheme,
  getTheme,
  initTheme,
  markdownColorMode,
  nextToggleTheme,
  readStoredTheme,
  setTheme,
  themeTone,
} from "@/utils/theme";

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    initTheme();
  });

  it("defaults to paper with no data-theme attribute", () => {
    expect(getTheme()).toBe("paper");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("applies and remembers night shift", () => {
    setTheme("night");
    expect(document.documentElement.dataset.theme).toBe("night");
    expect(readStoredTheme()).toBe("night");

    setTheme("paper");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(readStoredTheme()).toBe("paper");
  });

  it("restores the stored theme on init and ignores junk", () => {
    window.localStorage.setItem("ML__theme", "night");
    initTheme();
    expect(getTheme()).toBe("night");

    window.localStorage.setItem("ML__theme", "neon");
    initTheme();
    expect(getTheme()).toBe("paper");
  });

  it("picks the markdown colour mode from theme and inversion", () => {
    expect(markdownColorMode("paper")).toBe("light");
    expect(markdownColorMode("paper", true)).toBe("dark");
    expect(markdownColorMode("night")).toBe("dark");
    expect(markdownColorMode("night", true)).toBe("light");
  });

  it("applies colour themes and remembers the last one", () => {
    expect(getLastColourTheme()).toBeNull();

    setTheme("amber");
    expect(document.documentElement.dataset.theme).toBe("amber");
    expect(readStoredTheme()).toBe("amber");
    expect(getLastColourTheme()).toBe("amber");

    setTheme("night");
    expect(getLastColourTheme()).toBe("amber");

    initTheme();
    expect(getTheme()).toBe("night");
    expect(getLastColourTheme()).toBe("amber");
  });

  it("ignores a junk last colour theme", () => {
    window.localStorage.setItem("ML__theme_colour", "night");
    initTheme();
    expect(getLastColourTheme()).toBeNull();
  });

  it("knows each theme's tone", () => {
    expect(themeTone("riso")).toBe("light");
    expect(themeTone("amber")).toBe("dark");
    expect(themeTone("blueprint")).toBe("dark");
    expect(markdownColorMode("riso")).toBe("light");
    expect(markdownColorMode("amber")).toBe("dark");
    expect(markdownColorMode("blueprint", true)).toBe("light");
  });

  it.each([
    ["paper", true, "riso", "riso"],
    ["riso", true, "riso", "night"],
    ["night", true, "riso", "paper"],
    ["paper", false, "riso", "night"],
    ["paper", true, null, "night"],
    ["amber", false, "amber", "night"],
    ["night", false, null, "paper"],
  ] as const)("toggles from %s (star %s, last %s) to %s", (from, includeStar, lastColour, to) => {
    expect(nextToggleTheme(from, { includeStar, lastColour })).toBe(to);
  });
});

describe("colour theme registry", () => {
  it("puts every colour theme in exactly one family, in registry order", () => {
    expect(THEME_FAMILIES.flatMap(themesInFamily)).toEqual([...COLOUR_THEMES]);
    for (const id of COLOUR_THEMES) expect(THEMES[id].family).toBeTruthy();
  });
});

describe("chart palettes", () => {
  // Each [data-theme] block in src/tokens.scss, by id.
  const blocks = new Map(
    [...TOKENS_SCSS.matchAll(/\[data-theme="([a-z]+)"\] \{([\s\S]*?)\n\}/g)].map(([, id, body]) => [
      id,
      body,
    ]),
  );

  it("gives every theme six chart colours", () => {
    for (const id of Object.keys(THEMES)) {
      const palette = blocks.get(id)?.match(/chart-palette\(([^)]*)\)/)?.[1];
      expect(palette?.match(/#[0-9a-f]{6}/gi), id).toHaveLength(6);
    }
  });

  it("sets Paper's chart colours on :root too, for the page without a data-theme", () => {
    const paper = blocks
      .get("paper")!
      .match(/#[0-9a-f]{6}/gi)!
      .slice(-6);
    for (const [i, hex] of paper.entries()) {
      expect(TOKENS_SCSS).toContain(`--chart-${i + 1}: ${hex};`);
    }
  });
});
