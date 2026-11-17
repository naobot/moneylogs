import { describe, it, expect } from "vite-plus/test";
import { shareUrl } from "@/utils/shareUrl";

describe("shareUrl", () => {
  it("prepends https:// to the host and path", () => {
    expect(shareUrl("/g/g1/invite", "example.com")).toBe("https://example.com/g/g1/invite");
  });

  it("adds a missing leading slash", () => {
    expect(shareUrl("u/abc", "example.com")).toBe("https://example.com/u/abc");
  });

  it("defaults to the current host", () => {
    expect(shareUrl("/u/abc")).toBe(`https://${window.location.host}/u/abc`);
  });
});
