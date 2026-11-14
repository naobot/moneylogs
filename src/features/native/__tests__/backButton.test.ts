import { describe, expect, it } from "vite-plus/test";
import { backButtonAction } from "../backButton";

describe("backButtonAction", () => {
  it("leaves the app from root screens", () => {
    expect(backButtonAction("/", true)).toBe("exit");
    expect(backButtonAction("/login", false)).toBe("exit");
  });

  it("goes back through history when there is some", () => {
    expect(backButtonAction("/g/abc", true)).toBe("back");
  });

  it("goes to the dashboard from a screen opened with no history", () => {
    expect(backButtonAction("/g/abc/invite", false)).toBe("home");
  });
});
