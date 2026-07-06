import { describe, it, expect } from "vite-plus/test";
import { initialAuthView, sanitizeRedirect } from "@/features/auth/authRedirect";

describe("sanitizeRedirect", () => {
  it("allows internal paths", () => {
    expect(sanitizeRedirect("/g/abc123/invite")).toBe("/g/abc123/invite");
  });

  it("preserves query strings on internal paths", () => {
    expect(sanitizeRedirect("/g/abc123/invite?ref=email")).toBe("/g/abc123/invite?ref=email");
  });

  it("returns undefined when no destination is given", () => {
    expect(sanitizeRedirect(undefined)).toBeUndefined();
    expect(sanitizeRedirect("")).toBeUndefined();
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeRedirect("https://evil.com/phish")).toBeUndefined();
  });

  it("rejects protocol-relative URLs", () => {
    // "//evil.com" starts with "/" but window.location.href would leave the site
    expect(sanitizeRedirect("//evil.com")).toBeUndefined();
  });

  it("rejects relative paths that don't start with /", () => {
    expect(sanitizeRedirect("g/abc123/invite")).toBeUndefined();
  });
});

describe("initialAuthView", () => {
  it("defaults to login with no state", () => {
    expect(initialAuthView(null)).toBe("login");
    expect(initialAuthView(undefined)).toBe("login");
    expect(initialAuthView({})).toBe("login");
  });

  it("respects an explicitly requested view", () => {
    expect(initialAuthView({ view: "register" })).toBe("register");
    expect(initialAuthView({ view: "login", from: "/g/abc123/invite" })).toBe("login");
  });

  it("defaults to register when arriving from an invite link", () => {
    expect(initialAuthView({ from: "/g/abc123/invite" })).toBe("register");
  });

  it("defaults to login when arriving from a non-invite page", () => {
    expect(initialAuthView({ from: "/me" })).toBe("login");
  });

  it("ignores invite-looking destinations that fail sanitization", () => {
    expect(initialAuthView({ from: "//evil.com/g/abc123/invite" })).toBe("login");
  });
});
