import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { storage } from "@/platform";
import {
  clearPostDraft,
  DRAFT_KEY,
  LEGACY_DRAFT_KEY,
  parseDraft,
  readPostDraft,
  writePostDraft,
} from "../postDraft";

describe("post draft", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("keeps the old draft when the new one can't be stored", () => {
    localStorage.setItem(LEGACY_DRAFT_KEY, "old text");
    vi.spyOn(storage, "setJSON").mockReturnValue(false);
    writePostDraft("u1", { content: "old text", rows: [{ currency: "JPY", amount: 0 }] });
    expect(readPostDraft("u1")).toEqual({ content: "old text" });
  });

  it("restores text, rows and pulls together for the same account", () => {
    writePostDraft("u1", {
      content: "- ramen · food — 1,200 JPY",
      rows: [{ currency: "JPY", amount: 1200 }],
      pulledIds: ["pabc"],
    });
    expect(readPostDraft("u1")).toEqual({
      content: "- ramen · food — 1,200 JPY",
      rows: [{ currency: "JPY", amount: 1200 }],
      pulledIds: ["pabc"],
    });
  });

  it("isn't shown to another account", () => {
    writePostDraft("u1", { content: "private", pulledIds: ["pabc"] });
    expect(readPostDraft("u2")).toBeNull();
  });

  it("is gone once cleared", () => {
    writePostDraft("u1", { content: "x" });
    clearPostDraft();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(readPostDraft("u1")).toBeNull();
  });

  it("reads an old text-only draft as its text, even text that looks like JSON", () => {
    for (const text of ["a good day", "42", '{"lunch":"12 CAD"}', '["a","b"]']) {
      localStorage.clear();
      localStorage.setItem(LEGACY_DRAFT_KEY, text);
      expect(readPostDraft("u1")).toEqual({ content: text });
    }
  });

  it("replaces the old draft once saved, and clears both", () => {
    localStorage.setItem(LEGACY_DRAFT_KEY, "old");
    writePostDraft("u1", { content: "old, edited" });
    expect(localStorage.getItem(LEGACY_DRAFT_KEY)).toBeNull();
    expect(readPostDraft("u1")).toEqual({ content: "old, edited" });
    localStorage.setItem(LEGACY_DRAFT_KEY, "old");
    clearPostDraft();
    expect(readPostDraft("u1")).toBeNull();
  });

  it("keeps the author's draft when another member's tab is showing", () => {
    writePostDraft("alice", { content: "- lunch — 1,200 JPY", pulledIds: ["p1"] });
    expect(readPostDraft("bob")).toBeNull();
    expect(readPostDraft("alice")).toEqual({ content: "- lunch — 1,200 JPY", pulledIds: ["p1"] });
  });

  it("drops malformed rows and ids", () => {
    const raw = JSON.stringify({
      uid: "u1",
      content: "x",
      rows: [{ currency: "XXX", amount: 1 }, { currency: "CAD", amount: "5" }, null],
      pulledIds: [3, "p1"],
    });
    expect(parseDraft(raw, "u1")).toEqual({ content: "x", pulledIds: ["p1"] });
  });
});
