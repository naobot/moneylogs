import { describe, it, expect } from "vite-plus/test";
import { resolveSection } from "../sections";

const ids = ["profile", "friends", "logs"] as const;

describe("resolveSection", () => {
  it("falls back to the first section when there's no hash", () => {
    expect(resolveSection("", ids)).toEqual({ id: "profile", explicit: false });
  });

  it("picks the section the hash names", () => {
    expect(resolveSection("#logs", ids)).toEqual({ id: "logs", explicit: true });
  });

  it("ignores a hash that isn't a section", () => {
    expect(resolveSection("#nope", ids)).toEqual({ id: "profile", explicit: false });
  });
});
