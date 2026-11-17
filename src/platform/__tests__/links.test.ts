import { describe, expect, it } from "vite-plus/test";
import { isExternalUrl } from "../links";

const base = "https://moneylogs.app/g/abc";

describe("isExternalUrl", () => {
  it("treats relative and same-origin links as internal", () => {
    expect(isExternalUrl("/me", base)).toBe(false);
    expect(isExternalUrl("#post-1", base)).toBe(false);
    expect(isExternalUrl("https://moneylogs.app/about", base)).toBe(false);
  });

  it("treats other origins as external", () => {
    expect(isExternalUrl("https://example.com", base)).toBe(true);
    expect(isExternalUrl("//example.com/x", base)).toBe(true);
    expect(isExternalUrl("http://moneylogs.app/about", base)).toBe(true);
  });

  it("treats unparseable links as internal", () => {
    expect(isExternalUrl("http://", base)).toBe(false);
  });
});
