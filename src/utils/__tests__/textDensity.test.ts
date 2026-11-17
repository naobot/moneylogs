import { describe, expect, it } from "vite-plus/test";
import { textDensity } from "../textDensity";

describe("textDensity", () => {
  it("keeps the working pages dense", () => {
    expect(textDensity("/g/abc123")).toBe("dense");
    expect(textDensity("/l/personal-u1")).toBe("dense");
    expect(textDensity("/l/abc/stats")).toBe("dense");
    expect(textDensity("/create")).toBe("dense");
  });

  it("gives reading pages room", () => {
    for (const path of ["/", "/about", "/privacy", "/login", "/welcome", "/me", "/notifications"]) {
      expect(textDensity(path)).toBe("roomy");
    }
    expect(textDensity("/u/abc")).toBe("roomy");
    expect(textDensity("/invite/CODE")).toBe("roomy");
  });

  it("treats invite pages as reading, not as the log", () => {
    expect(textDensity("/g/abc/invite")).toBe("roomy");
    expect(textDensity("/l/abc/invite")).toBe("roomy");
  });

  it("allows a trailing slash", () => {
    expect(textDensity("/g/abc/")).toBe("dense");
    expect(textDensity("/me/")).toBe("roomy");
  });
});
