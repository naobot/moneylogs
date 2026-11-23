import { describe, expect, it } from "vite-plus/test";
import {
  addAmounts,
  normaliseAmounts,
  postAmountIn,
  postAmounts,
  primaryOf,
  rowsFor,
  sameRows,
} from "./postAmounts";

describe("postAmounts", () => {
  it("reads a legacy single-currency post", () => {
    expect(postAmounts({ amount: 1200, currency: "JPY" })).toEqual({ JPY: 1200 });
  });

  it("coerces a string legacy amount and treats junk as 0", () => {
    expect(postAmounts({ amount: "45.5", currency: "CAD" })).toEqual({ CAD: 45.5 });
    expect(postAmounts({ amount: "x", currency: "CAD" })).toEqual({ CAD: 0 });
  });

  it("prefers the amounts map over the legacy fields", () => {
    expect(
      postAmounts<string>({ amount: 1200, currency: "JPY", amounts: { JPY: 1200, CAD: 12 } }),
    ).toEqual({ JPY: 1200, CAD: 12 });
  });

  it("lets an old client's amount edit replace the primary entry", () => {
    expect(
      postAmounts<string>({
        amount: 1500,
        currency: "JPY",
        amountsPrimary: "JPY",
        amounts: { CAD: 12, JPY: 1200 },
      }),
    ).toEqual({ CAD: 12, JPY: 1500 });
  });

  it("drops the old primary when an old client switches to a new currency", () => {
    expect(
      postAmounts<string>({
        amount: 20,
        currency: "USD",
        amountsPrimary: "JPY",
        amounts: { CAD: 12, JPY: 1200 },
      }),
    ).toEqual({ CAD: 12, USD: 20 });
  });

  it("keeps the exact amount when switching to a currency not on the post", () => {
    expect(
      postAmounts<string>({
        amount: 12.345,
        currency: "CAD",
        amountsPrimary: "JPY",
        amounts: { JPY: 1000, USD: 10 },
      }),
    ).toEqual({ CAD: 12.345, USD: 10 });
  });

  it("adds to a secondary when an old client switches to its currency", () => {
    const post = { currency: "CAD", amountsPrimary: "JPY", amounts: { CAD: 12, JPY: 1200 } };
    expect(postAmounts<string>({ ...post, amount: 20 })).toEqual({ CAD: 32 });
    // The same amount as the secondary is still a switch, not a match.
    expect(postAmounts<string>({ ...post, amount: 12 })).toEqual({ CAD: 24 });
  });

  it("treats the legacy currency as primary when none is recorded", () => {
    expect(
      postAmounts<string>({ amount: 5, currency: "CAD", amounts: { CAD: 12, JPY: 1200 } }),
    ).toEqual({ CAD: 5, JPY: 1200 });
  });

  it("returns the map when there are no legacy fields", () => {
    expect(postAmounts<string>({ amounts: { JPY: 1 } })).toEqual({ JPY: 1 });
  });

  it("falls back to legacy fields when the map is empty", () => {
    expect(postAmounts({ amount: 5, currency: "USD", amounts: {} })).toEqual({ USD: 5 });
  });

  it("returns an empty map when there's nothing", () => {
    expect(postAmounts({})).toEqual({});
  });

  it("postAmountIn gives 0 for a missing currency", () => {
    const post = { amounts: { JPY: 100 } };
    expect(postAmountIn(post, "JPY")).toBe(100);
    expect(postAmountIn<string>(post, "CAD")).toBe(0);
  });
});

describe("normaliseAmounts", () => {
  it("keeps the primary row at 0 and drops later zero rows", () => {
    expect(
      normaliseAmounts([
        { currency: "JPY", amount: 0 },
        { currency: "CAD", amount: 0 },
      ]),
    ).toEqual({ JPY: 0 });
  });

  it("keeps a single row's exact value", () => {
    expect(normaliseAmounts([{ currency: "CAD", amount: 12.345 }])).toEqual({ CAD: 12.345 });
  });

  it("merges duplicate currencies and rounds the sum", () => {
    expect(
      normaliseAmounts([
        { currency: "CAD", amount: 0.1 },
        { currency: "JPY", amount: 500 },
        { currency: "CAD", amount: 0.2 },
      ]),
    ).toEqual({ CAD: 0.3, JPY: 500 });
  });

  it("keeps row order so the first row stays primary", () => {
    const map = normaliseAmounts([
      { currency: "CAD", amount: 3 },
      { currency: "JPY", amount: 500 },
    ]);
    expect(Object.keys(map)).toEqual(["CAD", "JPY"]);
  });
});

describe("primaryOf", () => {
  it("uses the preferred currency when present", () => {
    expect(primaryOf<string>({ JPY: 1, CAD: 2 }, "JPY", "CAD")).toEqual({
      currency: "CAD",
      amount: 2,
    });
  });

  it("uses the first entry otherwise", () => {
    expect(primaryOf<string>({ JPY: 1, CAD: 2 }, "USD", "EUR")).toEqual({
      currency: "JPY",
      amount: 1,
    });
  });

  it("falls back for an empty map", () => {
    expect(primaryOf({}, "JPY")).toEqual({ currency: "JPY", amount: 0 });
  });
});

describe("addAmounts", () => {
  it("adds per currency without mutating", () => {
    const base = { JPY: 100 };
    expect(addAmounts(base, { JPY: 50, CAD: 1.1 })).toEqual({ JPY: 150, CAD: 1.1 });
    expect(base).toEqual({ JPY: 100 });
  });
});

describe("rowsFor", () => {
  it("puts the primary first whatever the map's key order", () => {
    expect(rowsFor<string>({ CAD: 12, JPY: 1200 }, "JPY")).toEqual([
      { currency: "JPY", amount: 1200 },
      { currency: "CAD", amount: 12 },
    ]);
  });

  it("keeps the map's order without a primary in it", () => {
    expect(rowsFor<string>({ CAD: 12, JPY: 1200 }, "USD").map((r) => r.currency)).toEqual([
      "CAD",
      "JPY",
    ]);
  });
});

describe("sameRows", () => {
  it("compares currencies, amounts and order", () => {
    const a = [
      { currency: "JPY", amount: 1200 },
      { currency: "CAD", amount: 12.345 },
    ];
    expect(
      sameRows(
        a,
        a.map((r) => ({ ...r })),
      ),
    ).toBe(true);
    expect(sameRows(a, [a[1], a[0]])).toBe(false);
    expect(sameRows(a, [a[0], { currency: "CAD", amount: 12.35 }])).toBe(false);
    expect(sameRows(a, [a[0]])).toBe(false);
  });
});
