import { describe, it, expect, beforeEach, vi, afterEach } from "vite-plus/test";
import {
  DEFAULT_DISPLAY_PREFS,
  getDisplayPrefs,
  initDisplayPrefs,
  parsePrefs,
  readStoredPrefs,
  setDisplayPrefs,
  STORAGE_KEY,
} from "@/utils/displayPrefs";

describe("displayPrefs", () => {
  const root = document.documentElement;

  beforeEach(() => {
    window.localStorage.clear();
    delete root.dataset.entrySize;
    delete root.dataset.entryAlign;
    delete root.dataset.charts;
    initDisplayPrefs();
  });

  afterEach(() => vi.restoreAllMocks());

  it("defaults to today's formats with no data attributes", () => {
    expect(getDisplayPrefs()).toEqual(DEFAULT_DISPLAY_PREFS);
    expect(root.dataset.entrySize).toBeUndefined();
    expect(root.dataset.entryAlign).toBeUndefined();
    expect(root.dataset.charts).toBeUndefined();
    expect(getDisplayPrefs().charts).toBe("colour");
  });

  it("applies, remembers and merges partial changes", () => {
    setDisplayPrefs({ entrySize: "xl", entryAlign: "justify" });
    setDisplayPrefs({ clock: "12h" });

    expect(getDisplayPrefs()).toEqual({
      clock: "12h",
      dateOrder: "dmy",
      entrySize: "xl",
      entryAlign: "justify",
      charts: "colour",
    });
    expect(root.dataset.entrySize).toBe("xl");
    expect(root.dataset.entryAlign).toBe("justify");
    expect(readStoredPrefs()).toEqual(getDisplayPrefs());
  });

  it("clears the data attributes when going back to the defaults", () => {
    setDisplayPrefs({ entrySize: "s", entryAlign: "center" });
    setDisplayPrefs({ entrySize: "m", entryAlign: "left" });
    expect(root.dataset.entrySize).toBeUndefined();
    expect(root.dataset.entryAlign).toBeUndefined();
  });

  it("restores stored prefs on init, falling back per field", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ clock: "12h", dateOrder: "nope", entrySize: "l", entryAlign: 3 }),
    );
    initDisplayPrefs();
    expect(getDisplayPrefs()).toEqual({
      clock: "12h",
      dateOrder: "dmy",
      entrySize: "l",
      entryAlign: "left",
      charts: "colour",
    });
    expect(root.dataset.entrySize).toBe("l");
  });

  it("marks mono charts on <html> and clears it going back to colour", () => {
    setDisplayPrefs({ charts: "mono" });
    expect(root.dataset.charts).toBe("mono");
    expect(readStoredPrefs().charts).toBe("mono");
    setDisplayPrefs({ charts: "colour" });
    expect(root.dataset.charts).toBeUndefined();
  });

  it("restores mono charts, and falls back to colour for a bad value only", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ clock: "12h", charts: "mono" }));
    initDisplayPrefs();
    expect(root.dataset.charts).toBe("mono");
    expect(parsePrefs({ clock: "12h", charts: "rainbow" })).toEqual({
      ...DEFAULT_DISPLAY_PREFS,
      clock: "12h",
    });
  });

  it("ignores junk JSON and non-objects", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readStoredPrefs()).toEqual(DEFAULT_DISPLAY_PREFS);
    expect(parsePrefs(null)).toEqual(DEFAULT_DISPLAY_PREFS);
    expect(parsePrefs("12h")).toEqual(DEFAULT_DISPLAY_PREFS);
  });

  it("still applies changes when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setDisplayPrefs({ entrySize: "l" });
    expect(getDisplayPrefs().entrySize).toBe("l");
    expect(root.dataset.entrySize).toBe("l");
  });
});
