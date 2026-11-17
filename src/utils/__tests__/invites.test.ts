import { describe, it, expect } from "vite-plus/test";
import { invitePath, isInviteNotFound } from "@/utils/invites";

describe("invitePath", () => {
  it("points at the invite route", () => {
    expect(invitePath("aB3_-xYz09")).toBe("/invite/aB3_-xYz09");
  });
});

describe("isInviteNotFound", () => {
  it("is true for a bad or retired link", () => {
    expect(isInviteNotFound({ code: "functions/not-found" })).toBe(true);
    expect(isInviteNotFound({ code: "functions/invalid-argument" })).toBe(true);
  });

  it("is false for anything worth retrying", () => {
    expect(isInviteNotFound({ code: "functions/internal" })).toBe(false);
    expect(isInviteNotFound(new Error("offline"))).toBe(false);
    expect(isInviteNotFound(null)).toBe(false);
  });
});
