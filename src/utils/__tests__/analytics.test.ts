import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  PAGE_ROUTES,
  logKindParam,
  pageInfo,
  setAnalyticsSink,
  toGaParams,
  track,
  trackPageView,
} from "../analytics";

const logEvent = vi.fn();
beforeEach(() => {
  logEvent.mockReset();
  setAnalyticsSink(logEvent);
});
afterEach(() => setAnalyticsSink(null));

describe("pageInfo", () => {
  it.each([
    ["/", "/", "home"],
    ["/me", "/me", "me"],
    ["/g/abc123", "/g/:groupId", "social log"],
    ["/g/abc123/invite", "/g/:groupId/invite", "social log invite"],
    ["/l/xyz", "/l/:ledgerId", "financial log"],
    ["/l/xyz/stats", "/l/:ledgerId/stats", "financial log stats"],
    ["/l/xyz/invite", "/l/:ledgerId/invite", "financial log invite"],
    ["/u/doc1", "/u/:userDocId", "profile"],
    ["/invite/CODE", "/invite/:code", "friend invite"],
  ])("maps %s to its route pattern", (pathname, path, title) => {
    expect(pageInfo(pathname)).toEqual({ path, title });
  });

  it("puts unknown paths in one bucket", () => {
    expect(pageInfo("/nope/at/all")).toEqual({ path: "(not found)", title: "not found" });
  });

  it("never reports an id-bearing segment", () => {
    for (const { pattern } of PAGE_ROUTES) {
      const concrete = pattern.replace(/:[A-Za-z]+/g, "SECRET");
      expect(pageInfo(concrete).path).not.toContain("SECRET");
    }
  });
});

describe("toGaParams", () => {
  it("turns booleans into strings and keeps the rest", () => {
    expect(toGaParams({ a: true, b: false, c: 3, d: "x" })).toEqual({
      a: "true",
      b: "false",
      c: 3,
      d: "x",
    });
  });

  it("passes undefined through", () => {
    expect(toGaParams(undefined)).toBeUndefined();
  });
});

describe("logKindParam", () => {
  it("names ledgers as financial logs", () => {
    expect(logKindParam("ledger")).toBe("financial");
    expect(logKindParam("financial")).toBe("financial");
    expect(logKindParam("social")).toBe("social");
  });
});

describe("track", () => {
  it("logs the named event with GA-ready params", () => {
    track("add_entry", { shared_log: true, has_note: false });
    expect(logEvent).toHaveBeenCalledWith("add_entry", {
      shared_log: "true",
      has_note: "false",
    });
  });

  it("logs param-less events", () => {
    track("add_comment");
    expect(logEvent).toHaveBeenCalledWith("add_comment", undefined);
  });

  it("drops events until a sink is set", () => {
    setAnalyticsSink(null);
    expect(() => track("add_reaction")).not.toThrow();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("never throws when analytics fails", () => {
    logEvent.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    let threw = false;
    try {
      track("no_spend_day");
    } catch {
      threw = true;
    }
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(threw).toBe(false);
  });
});

describe("trackPageView", () => {
  it("sends the route pattern, not the real path", () => {
    trackPageView("/g/abc123", true);
    expect(logEvent).toHaveBeenCalledWith("page_view", {
      page_location: `${window.location.origin}/g/:groupId`,
      page_path: "/g/:groupId",
      page_title: "social log",
      signed_in: "true",
    });
  });
});
