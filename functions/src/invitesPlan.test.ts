import { describe, it, expect } from "vite-plus/test";
import {
  INVITE_CODE_LENGTH,
  newInviteCode,
  parseInviteCode,
  parseReset,
  planInvite,
} from "./invitesPlan";

describe("newInviteCode", () => {
  it("makes URL-safe codes that parse", () => {
    for (let i = 0; i < 50; i++) {
      const code = newInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(parseInviteCode({ code })).toBe(code);
    }
  });

  it("doesn't repeat", () => {
    const codes = new Set(Array.from({ length: 200 }, newInviteCode));
    expect(codes.size).toBe(200);
  });
});

describe("parseInviteCode", () => {
  it("accepts a well-formed code", () => {
    expect(parseInviteCode({ code: "aB3_-xYz09" })).toBe("aB3_-xYz09");
  });

  it.each([
    undefined,
    null,
    "aB3_-xYz09",
    {},
    { code: 1234567890 },
    { code: "short" },
    { code: "elevenchars" },
    { code: "has/slash." },
  ])("rejects %j", (data) => {
    expect(parseInviteCode(data)).toBeNull();
  });
});

describe("parseReset", () => {
  it("is true only for reset: true", () => {
    expect(parseReset({ reset: true })).toBe(true);
    expect(parseReset({ reset: "yes" })).toBe(false);
    expect(parseReset({})).toBe(false);
    expect(parseReset(null)).toBe(false);
  });
});

describe("planInvite", () => {
  it("makes new friends, accepts pending requests either way, and leaves friends be", () => {
    expect(planInvite("none")).toBe("create-accepted");
    expect(planInvite("outgoing")).toBe("accept");
    expect(planInvite("incoming")).toBe("accept");
    expect(planInvite("friends")).toBe("noop");
  });
});
