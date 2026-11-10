import { describe, it, expect, beforeEach } from "vite-plus/test";
import { getTheme, initTheme, markdownColorMode, readStoredTheme, setTheme } from "@/utils/theme";

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
});
