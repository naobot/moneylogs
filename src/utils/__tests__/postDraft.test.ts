import { beforeEach, describe, expect, it } from "vite-plus/test";
import { clearPostDraft, DRAFT_KEY, parseDraft, readPostDraft, writePostDraft } from "../postDraft";

describe("post draft", () => {
  beforeEach(() => localStorage.clear());

  it("restores text, rows and pulls together for the same account", () => {
    writePostDraft("u1", {
      content: "- ramen · food · 1,200 JPY",
      rows: [{ currency: "JPY", amount: 1200 }],
      pulledIds: ["pabc"],
    });
    expect(readPostDraft("u1")).toEqual({
      content: "- ramen · food · 1,200 JPY",
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

  it("reads an old text-only draft as its text", () => {
    expect(parseDraft("a good day", "u1")).toEqual({ content: "a good day" });
    expect(parseDraft("42", "u1")).toEqual({ content: "42" });
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
