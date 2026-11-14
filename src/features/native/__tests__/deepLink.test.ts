import { describe, expect, it } from "vite-plus/test";
import { deepLinkPath } from "../deepLink";

describe("deepLinkPath", () => {
  it("opens invites, logs and notifications on moneylogs.app", () => {
    expect(deepLinkPath("https://moneylogs.app/g/abc/invite")).toBe("/g/abc/invite");
    expect(deepLinkPath("https://moneylogs.app/l/xyz")).toBe("/l/xyz");
    expect(deepLinkPath("https://moneylogs.app/l/xyz/stats?month=2026-11")).toBe(
      "/l/xyz/stats?month=2026-11",
    );
    expect(deepLinkPath("https://moneylogs.app/notifications")).toBe("/notifications");
  });

  it("keeps the post and comment a notification points at", () => {
    expect(deepLinkPath("https://moneylogs.app/g/abc?post=p1&comment=c2")).toBe(
      "/g/abc?post=p1&comment=c2",
    );
  });

  it("ignores other hosts, schemes and paths", () => {
    expect(deepLinkPath("https://evil.example/g/abc")).toBeNull();
    expect(deepLinkPath("http://moneylogs.app/g/abc")).toBeNull();
    expect(deepLinkPath("https://moneylogs.app/me")).toBeNull();
    expect(deepLinkPath("https://moneylogs.app/g/abc/../../me")).toBeNull();
    expect(deepLinkPath("not a url")).toBeNull();
  });
});
