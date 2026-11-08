import { describe, it, expect, vi } from "vite-plus/test";

vi.mock("@/config/firebase-config", () => ({ db: {} }));

import { buildNewLedgerDoc } from "@/hooks/useLedgerQuery";
import { DEFAULT_CATEGORIES } from "@/utils/ledger";

const base = {
  title: "  Home  ",
  max_participants: 2,
  defaultCurrency: "CAD" as const,
  member: { uid: "auth-uid", userDocId: "user-doc" },
  userDocRef: { path: "users/user-doc" },
  createdAt: "SERVER_TS",
};

describe("buildNewLedgerDoc", () => {
  it("produces exactly the fields the security rules allow on create", () => {
    const docData = buildNewLedgerDoc(base);
    expect(Object.keys(docData).sort()).toEqual(
      [
        "categories",
        "createdAt",
        "createdBy",
        "defaultCurrency",
        "max_participants",
        "memberUids",
        "members",
        "title",
      ].sort(),
    );
  });

  it("makes the creator the sole member by auth uid and doc ref", () => {
    const docData = buildNewLedgerDoc(base);
    expect(docData.memberUids).toEqual(["auth-uid"]);
    expect(docData.createdBy).toBe("auth-uid");
    expect(docData.members).toEqual([{ path: "users/user-doc" }]);
  });

  it("trims the title and seeds default categories without sharing references", () => {
    const docData = buildNewLedgerDoc(base);
    expect(docData.title).toBe("Home");
    expect(docData.categories).toEqual(DEFAULT_CATEGORIES);
    expect(docData.categories[0]).not.toBe(DEFAULT_CATEGORIES[0]);
  });
});
