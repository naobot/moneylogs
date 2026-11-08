import { describe, it, expect } from "vite-plus/test";
import { archivedAtMillis, isArchived, partitionArchived } from "@/utils/archivedLogs";

const ts = (ms: number) => ({ toMillis: () => ms });
const user = {
  archivedLogs: {
    old: ts(1_000),
    recent: ts(5_000),
    cached: { seconds: 3 }, // shape after a round-trip through the localStorage cache
    pending: null, // serverTimestamp not yet resolved in the local snapshot
  },
};

describe("isArchived", () => {
  it("checks membership of the archived map, including pending stamps", () => {
    expect(isArchived(user, "old")).toBe(true);
    expect(isArchived(user, "pending")).toBe(true);
    expect(isArchived(user, "nope")).toBe(false);
    expect(isArchived(undefined, "old")).toBe(false);
    expect(isArchived({}, "old")).toBe(false);
  });
});

describe("archivedAtMillis", () => {
  it("reads Timestamps, cached {seconds} and treats pending as now", () => {
    expect(archivedAtMillis(user, "old")).toBe(1_000);
    expect(archivedAtMillis(user, "cached")).toBe(3_000);
    expect(archivedAtMillis(user, "pending")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("partitionArchived", () => {
  it("splits logs and orders archived newest first, without mutating", () => {
    const logs = [{ id: "a" }, { id: "old" }, { id: "pending" }, { id: "b" }, { id: "recent" }];
    const { active, archived } = partitionArchived(logs, user);
    expect(active.map((l) => l.id)).toEqual(["a", "b"]);
    expect(archived.map((l) => l.id)).toEqual(["pending", "recent", "old"]);
    expect(logs.map((l) => l.id)).toEqual(["a", "old", "pending", "b", "recent"]);
  });

  it("keeps everything active when nothing is archived", () => {
    expect(partitionArchived([{ id: "a" }], undefined)).toEqual({
      active: [{ id: "a" }],
      archived: [],
    });
  });
});
