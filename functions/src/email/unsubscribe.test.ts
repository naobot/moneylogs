import { describe, it, expect } from "vite-plus/test";
import {
  confirmPage,
  isUnsubscribeScope,
  signUnsubscribe,
  unsubscribeHeaders,
  unsubscribePatch,
  unsubscribeUrl,
  verifyUnsubscribe,
} from "./unsubscribe";

const SECRET = "test-secret";

describe("unsubscribe links", () => {
  it("verifies its own signature", () => {
    const sig = signUnsubscribe(SECRET, "doc1", "all");
    expect(verifyUnsubscribe(SECRET, "doc1", "all", sig)).toBe(true);
  });

  it("rejects a signature for another user, scope or secret", () => {
    const sig = signUnsubscribe(SECRET, "doc1", "all");
    expect(verifyUnsubscribe(SECRET, "doc2", "all", sig)).toBe(false);
    expect(verifyUnsubscribe(SECRET, "doc1", "comment", sig)).toBe(false);
    expect(verifyUnsubscribe("other", "doc1", "all", sig)).toBe(false);
    expect(verifyUnsubscribe(SECRET, "doc1", "all", sig.slice(1))).toBe(false);
    expect(verifyUnsubscribe(SECRET, "doc1", "all", undefined)).toBe(false);
    expect(verifyUnsubscribe("", "doc1", "all", signUnsubscribe("", "doc1", "all"))).toBe(false);
  });

  it("accepts only 'all' and emailable types as scopes", () => {
    expect(isUnsubscribeScope("all")).toBe(true);
    expect(isUnsubscribeScope("comment")).toBe(true);
    expect(isUnsubscribeScope("log_created")).toBe(false);
    expect(isUnsubscribeScope("emailPaused")).toBe(false);
    expect(isUnsubscribeScope(["all"])).toBe(false);
  });

  it("builds a verifiable URL on the app's domain, or none without a secret", () => {
    const url = new URL(unsubscribeUrl("https://app.test/", SECRET, "doc1")!);
    expect(url.origin + url.pathname).toBe("https://app.test/email/unsubscribe");
    const { u, s, sig } = Object.fromEntries(url.searchParams);
    expect(verifyUnsubscribe(SECRET, u, s, sig)).toBe(true);
    expect(unsubscribeUrl("https://app.test", "", "doc1")).toBeNull();
  });

  it("sends one-click headers", () => {
    expect(unsubscribeHeaders("https://x.test/u")).toEqual({
      "List-Unsubscribe": "<https://x.test/u>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("pauses all email, or switches one type off", () => {
    expect(unsubscribePatch("all")).toEqual({ emailPaused: true });
    expect(unsubscribePatch("comment")).toEqual({ "emailPrefs.comment": false });
  });

  it("asks before unsubscribing on GET", () => {
    const html = confirmPage("all", "https://app.test/me#notifications");
    expect(html).toContain('<form method="post">');
    expect(html).toContain("all moneylogs email");
  });
});
