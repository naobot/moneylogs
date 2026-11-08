import { describe, it, expect } from "vite-plus/test";
import { sortLedgersNewestFirst, spotsLeft } from "@/utils/ledger";

describe("spotsLeft", () => {
  it("counts remaining member slots", () => {
    expect(spotsLeft({ max_participants: 4, memberUids: ["a"] })).toBe(3);
  });

  it("never goes negative if a log is over capacity", () => {
    expect(spotsLeft({ max_participants: 1, memberUids: ["a", "b"] })).toBe(0);
  });
});

describe("sortLedgersNewestFirst", () => {
  const at = (ms: number | null) => ({
    createdAt: (ms === null ? null : { toMillis: () => ms }) as never,
  });

  it("orders by createdAt descending without mutating the input", () => {
    const [one, three, two] = [at(1), at(3), at(2)];
    const input = [one, three, two];
    expect(sortLedgersNewestFirst(input)).toEqual([three, two, one]);
    expect(input).toEqual([one, three, two]);
  });

  it("keeps a just-created ledger (pending timestamp) on top", () => {
    const pending = at(null);
    expect(sortLedgersNewestFirst([at(5), pending])[0]).toBe(pending);
  });
});
