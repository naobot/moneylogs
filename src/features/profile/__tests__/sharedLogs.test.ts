import { describe, it, expect } from "vite-plus/test";
import type { Timestamp } from "firebase/firestore";
import type { Group } from "@/types/user";
import { sharedGroups } from "../sharedLogs";

const ts = (ms: number) => ({ toMillis: () => ms }) as Timestamp;
const group = (id: string, members: string[], start: number) =>
  ({
    id,
    members: members.map((m) => ({ id: m, path: `users/${m}` })),
    start: ts(start),
  }) as unknown as Group;

describe("sharedGroups", () => {
  it("keeps only logs the other person is in, newest first", () => {
    const groups = [
      group("old", ["me", "mina"], 1),
      group("solo", ["me"], 5),
      group("new", ["me", "mina", "bo"], 9),
    ];
    expect(sharedGroups(groups, "mina").map((g) => g.id)).toEqual(["new", "old"]);
    expect(sharedGroups(groups, "nobody")).toEqual([]);
  });

  it("matches refs that only carry a path", () => {
    const g = { id: "x", members: [{ path: "users/mina" }], start: ts(1) } as unknown as Group;
    expect(sharedGroups([g], "mina")).toHaveLength(1);
  });
});
