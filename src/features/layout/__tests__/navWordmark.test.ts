import { describe, expect, it } from "vite-plus/test";
import { showNavWordmark } from "../navWordmark";

describe("showNavWordmark", () => {
  it("hides it for signed-out visitors on pages with their own heading", () => {
    for (const path of ["/login", "/", "/invite/alice-0001", "/g/abc/invite", "/l/abc/invite"]) {
      expect(showNavWordmark(false, path)).toBe(false);
    }
  });

  it("keeps it on other signed-out pages", () => {
    for (const path of ["/about", "/privacy", "/g/abc", "/l/abc", "/create"]) {
      expect(showNavWordmark(false, path)).toBe(true);
    }
  });

  it("always shows it when signed in", () => {
    for (const path of ["/", "/invite/alice-0001", "/g/abc/invite", "/me"]) {
      expect(showNavWordmark(true, path)).toBe(true);
    }
  });
});
