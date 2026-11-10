import { describe, it, expect } from "vite-plus/test";
import { manageTargetForGroup, manageTargetForLedger } from "@/features/logActions/manageTarget";
import type { Group } from "@/types/user";
import type { Ledger } from "@/types/ledger";

describe("manageTarget", () => {
  it("builds a social target with the recorded creator", () => {
    const group = { id: "g1", title: "Tokyo", createdBy: "uid-1" } as unknown as Group;
    expect(manageTargetForGroup(group)).toEqual({
      id: "g1",
      title: "Tokyo",
      kind: "social",
      creatorUid: "uid-1",
    });
  });

  it("leaves the creator unknown for older social groups", () => {
    const group = { id: "g1", title: "Tokyo" } as unknown as Group;
    expect(manageTargetForGroup(group).creatorUid).toBeUndefined();
  });

  it("falls back to the first member for ledgers without createdBy", () => {
    const ledger = { id: "l1", title: "Home", memberUids: ["uid-9", "uid-2"] } as unknown as Ledger;
    expect(manageTargetForLedger(ledger)).toEqual({
      id: "l1",
      title: "Home",
      kind: "financial",
      creatorUid: "uid-9",
    });
  });
});
