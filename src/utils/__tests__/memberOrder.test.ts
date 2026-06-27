import { describe, it, expect } from "vite-plus/test";
import { applyMemberOrder } from "@/utils/memberOrder";

const members = [{ id: "alice" }, { id: "bob" }, { id: "carol" }];

describe("applyMemberOrder", () => {
  it("applies the saved order when savedIds are present", () => {
    const result = applyMemberOrder(members, ["carol", "alice", "bob"]);
    expect(result.map((m) => m.id)).toEqual(["carol", "alice", "bob"]);
  });

  it("puts the current user first by default when there is no saved order", () => {
    const result = applyMemberOrder(members, [], "bob");
    expect(result[0].id).toBe("bob");
    expect(result.map((m) => m.id)).toContain("alice");
    expect(result.map((m) => m.id)).toContain("carol");
  });

  it("returns members unchanged when there is no saved order and no current user", () => {
    const result = applyMemberOrder(members, []);
    expect(result.map((m) => m.id)).toEqual(["alice", "bob", "carol"]);
  });

  it("appends new members not in the saved order at the end", () => {
    const result = applyMemberOrder([...members, { id: "dave" }], ["bob", "alice"]);
    expect(result.map((m) => m.id)).toEqual(["bob", "alice", "carol", "dave"]);
  });

  it("gracefully drops ids in savedIds that no longer have a corresponding member", () => {
    const result = applyMemberOrder(members, ["ghost", "alice", "bob"]);
    expect(result.map((m) => m.id)).toEqual(["alice", "bob", "carol"]);
  });

  it("preserves extra properties on member objects", () => {
    const richMembers = [
      { id: "alice", displayName: "Alice" },
      { id: "bob", displayName: "Bob" },
    ];
    const result = applyMemberOrder(richMembers, ["bob", "alice"]);
    expect(result[0].displayName).toBe("Bob");
    expect(result[1].displayName).toBe("Alice");
  });
});
