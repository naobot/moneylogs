import { describe, it, expect } from "vite-plus/test";
import {
  initialAuthView,
  placeholderDisplayName,
  sanitizeRedirect,
  welcomePath,
} from "@/features/auth/authRedirect";

describe("sanitizeRedirect", () => {
  it("allows internal paths", () => {
    expect(sanitizeRedirect("/g/abc123/invite")).toBe("/g/abc123/invite");
  });

  it("preserves query strings on internal paths", () => {
    expect(sanitizeRedirect("/g/abc123/invite?ref=email")).toBe("/g/abc123/invite?ref=email");
  });

  it("preserves the hash, so linked drawers still open after signing in", () => {
    expect(sanitizeRedirect("/me#logs")).toBe("/me#logs");
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

describe("welcomePath", () => {
  it("goes straight to the wizard with nowhere else to be", () => {
    expect(welcomePath()).toBe("/welcome");
    expect(welcomePath("/")).toBe("/welcome");
  });

  it("carries an internal destination along as next", () => {
    expect(welcomePath("/g/abc/invite")).toBe("/welcome?next=%2Fg%2Fabc%2Finvite");
  });

  it("drops destinations that fail sanitization", () => {
    expect(welcomePath("//evil.com")).toBe("/welcome");
    expect(welcomePath("https://evil.com")).toBe("/welcome");
  });
});

describe("placeholderDisplayName", () => {
  it("uses the email's local part", () => {
    expect(placeholderDisplayName("ada@example.com")).toBe("ada");
  });

  it("never comes back empty", () => {
    expect(placeholderDisplayName("@example.com")).toBe("new user");
  });
});
