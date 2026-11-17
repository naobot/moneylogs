import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { storage } from "../storage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("storage", () => {
  it("round-trips strings", () => {
    expect(storage.set("k", "v")).toBe(true);
    expect(storage.get("k")).toBe("v");
    storage.remove("k");
    expect(storage.get("k")).toBeNull();
  });

  it("round-trips JSON", () => {
    storage.setJSON("j", { a: [1, 2] });
    expect(storage.getJSON("j")).toEqual({ a: [1, 2] });
  });

  it("reads missing or malformed JSON as undefined", () => {
    expect(storage.getJSON("missing")).toBeUndefined();
    window.localStorage.setItem("bad", "{not json");
    expect(storage.getJSON("bad")).toBeUndefined();
  });

  it("never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(storage.get("k")).toBeNull();
    expect(storage.getJSON("k")).toBeUndefined();
    expect(storage.set("k", "v")).toBe(false);
    expect(storage.setJSON("k", 1)).toBe(false);
    expect(() => storage.remove("k")).not.toThrow();
  });

  it("reports false for values JSON can't serialise", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(storage.setJSON("c", cyclic)).toBe(false);
  });
});
