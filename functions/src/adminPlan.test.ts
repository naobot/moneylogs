import { describe, it, expect } from "vite-plus/test";
import {
  confirmsAccount,
  grantBlock,
  isAdminToken,
  parseAdminDeleteAccountRequest,
  parseAdminDeleteLogRequest,
  parseAdminGiftRequest,
  previewAccountDeletion,
} from "./adminPlan";
import { KNICK_KNACK_FINDS } from "./knickknacks";

const ref = (id: string) => ({ id });
const me = new Set(["meDoc"]);

describe("isAdminToken", () => {
  it("accepts only an explicit admin: true claim", () => {
    expect(isAdminToken({ admin: true })).toBe(true);
    expect(isAdminToken({ admin: "true" })).toBe(false);
    expect(isAdminToken({ admin: 1 })).toBe(false);
    expect(isAdminToken({})).toBe(false);
    expect(isAdminToken(undefined)).toBe(false);
    expect(isAdminToken(null)).toBe(false);
  });
});

describe("parseAdminGiftRequest", () => {
  const ok = { userDocId: "abc123", item: "acorn", count: 3, mode: "spirit" };

  it("accepts a well-formed request", () => {
    expect(parseAdminGiftRequest(ok)).toEqual(ok);
    expect(parseAdminGiftRequest({ ...ok, mode: "grant", count: 150 })).toEqual({
      ...ok,
      mode: "grant",
      count: 150,
    });
  });

  it("caps counts per mode", () => {
    expect(parseAdminGiftRequest({ ...ok, count: 21 })).toBeNull();
    expect(parseAdminGiftRequest({ ...ok, mode: "grant", count: 201 })).toBeNull();
    expect(parseAdminGiftRequest({ ...ok, count: 0 })).toBeNull();
    expect(parseAdminGiftRequest({ ...ok, count: 1.5 })).toBeNull();
  });

  it("rejects bad ids, items and modes", () => {
    expect(parseAdminGiftRequest({ ...ok, mode: "find" })).toBeNull();
    expect(parseAdminGiftRequest({ ...ok, userDocId: "a/b" })).toBeNull();
    expect(parseAdminGiftRequest({ ...ok, item: "Acorn!" })).toBeNull();
    expect(parseAdminGiftRequest(null)).toBeNull();
  });
});

describe("grantBlock", () => {
  it("allows any item but milestones", () => {
    expect(grantBlock("acorn", KNICK_KNACK_FINDS)).toBeNull();
    expect(grantBlock("enoki_bunch", KNICK_KNACK_FINDS)).toBeNull();
    expect(grantBlock("gold_coin", KNICK_KNACK_FINDS)).toBe("milestone");
    expect(grantBlock("nope", KNICK_KNACK_FINDS)).toBe("unknown");
  });
});

describe("parseAdminDeleteLogRequest", () => {
  it("reuses the deleteLog validation", () => {
    expect(parseAdminDeleteLogRequest({ kind: "social", id: "g1" })).toEqual({
      kind: "social",
      id: "g1",
    });
    expect(parseAdminDeleteLogRequest({ kind: "other", id: "g1" })).toBeNull();
  });
});

describe("parseAdminDeleteAccountRequest / confirmsAccount", () => {
  it("needs a uid and a confirmation", () => {
    expect(parseAdminDeleteAccountRequest({ uid: "u1", confirm: "x" })).toEqual({
      uid: "u1",
      confirm: "x",
    });
    expect(parseAdminDeleteAccountRequest({ uid: "u1", confirm: "" })).toBeNull();
    expect(parseAdminDeleteAccountRequest({ confirm: "x" })).toBeNull();
  });

  it("confirms with the email, or the uid when there's none", () => {
    expect(confirmsAccount(" Test@Example.com ", { uid: "u1", email: "test@example.com" })).toBe(
      true,
    );
    expect(confirmsAccount("u1", { uid: "u1", email: "test@example.com" })).toBe(false);
    expect(confirmsAccount("u1", { uid: "u1", email: null })).toBe(true);
  });
});

describe("previewAccountDeletion", () => {
  it("splits logs into deleted and left-for-others", () => {
    const preview = previewAccountDeletion(
      [
        { kind: "social", id: "solo", title: "Solo", data: { members: [ref("meDoc")] } },
        {
          kind: "social",
          id: "trip",
          title: "Trip",
          data: { members: [ref("meDoc"), ref("a"), ref("b")], createdBy: "me" },
        },
        // A stale `groups` entry for an emptied log: nothing to do.
        { kind: "social", id: "stale", title: "Stale", data: { members: [] } },
        {
          kind: "financial",
          id: "personal",
          title: "Personal",
          data: { members: [ref("meDoc")], memberUids: ["me"] },
        },
        {
          kind: "financial",
          id: "shared",
          title: "Shared",
          data: { members: [ref("meDoc"), ref("a")], memberUids: ["me", "aUid"] },
        },
      ],
      "me",
      me,
    );
    expect(preview.purge.map((l) => l.id)).toEqual(["solo", "personal"]);
    expect(preview.leave).toEqual([
      { kind: "social", id: "trip", title: "Trip", others: 2 },
      { kind: "financial", id: "shared", title: "Shared", others: 1 },
    ]);
  });
});
