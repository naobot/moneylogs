import { describe, it, expect } from "vite-plus/test";
import { aggregateMonth } from "./ledgerAggregate";
import {
  addLinkedCategory,
  hasSublogCategories,
  LinkableLedger,
  linkedCategoryName,
  markCategoryUnlinked,
  MAX_LEDGER_CATEGORIES,
  mergeRollups,
  monthsSince,
  parseLinkRequest,
  rollupDocId,
  rollupFor,
  validateLink,
} from "./ledgerRollup";

const e = (
  amount: number,
  currency: string,
  categoryId: string,
  authorUid: string,
  date: string,
) => ({
  amount,
  currency,
  categoryId,
  authorUid,
  date,
});

describe("rollupFor", () => {
  it("counts only entries by parent members, all under the linked category", () => {
    const r = rollupFor(
      [
        e(40, "CAD", "software", "alice", "2026-11-03"),
        e(2, "CAD", "supplies", "alice", "2026-11-03"),
        e(100, "CAD", "travel", "sam", "2026-11-03"),
        e(5, "USD", "travel", "alice", "2026-11-09"),
      ],
      ["alice", "jo"],
      "sublog-biz",
    );
    expect(r).toEqual({
      entryCount: 3,
      totals: { CAD: 42, USD: 5 },
      byCategory: { "sublog-biz": { CAD: 42, USD: 5 } },
      byMember: { alice: { CAD: 42, USD: 5 } },
      byDay: { "03": { CAD: 42 }, "09": { USD: 5 } },
      countByDay: { "03": 2, "09": 1 },
    });
  });

  it("is empty when no author is in the parent", () => {
    const r = rollupFor([e(10, "CAD", "a", "sam", "2026-11-01")], ["alice"], "x");
    expect(r.entryCount).toBe(0);
    expect(r.countByDay).toEqual({});
  });

  it("leaves malformed entries out of the day counts too", () => {
    const r = rollupFor(
      [e(10, "CAD", "a", "alice", "2026-11-01"), e(-1, "CAD", "a", "alice", "2026-11-01")],
      ["alice"],
      "x",
    );
    expect(r.countByDay).toEqual({ "01": 1 });
  });
});

describe("mergeRollups", () => {
  it("adds roll-ups per currency and counts their entries apart", () => {
    const own = aggregateMonth([
      e(1450, "CAD", "housing", "alice", "2026-11-01"),
      e(12, "CAD", "transport", "jo", "2026-11-03"),
    ]);
    const merged = mergeRollups(own, [
      {
        categoryId: "sublog-biz",
        ...rollupFor([e(42, "CAD", "s", "alice", "2026-11-03")], ["alice"], "sublog-biz"),
      },
      {
        categoryId: "sublog-bali",
        ...rollupFor([e(5000, "JPY", "f", "jo", "2026-11-03")], ["jo"], "sublog-bali"),
      },
    ]);
    expect(merged.entryCount).toBe(2);
    expect(merged.rolledUp).toEqual({ "sublog-biz": 1, "sublog-bali": 1 });
    expect(merged.totals).toEqual({ CAD: 1504, JPY: 5000 });
    expect(merged.byCategory["sublog-biz"]).toEqual({ CAD: 42 });
    expect(merged.byMember).toEqual({ alice: { CAD: 1492 }, jo: { CAD: 12, JPY: 5000 } });
    expect(merged.byDay["03"]).toEqual({ CAD: 54, JPY: 5000 });
  });

  it("doesn't change the own aggregate it was given", () => {
    const own = aggregateMonth([e(10, "CAD", "food", "alice", "2026-11-01")]);
    mergeRollups(own, [
      { categoryId: "c", ...rollupFor([e(1, "CAD", "x", "alice", "2026-11-01")], ["alice"], "c") },
    ]);
    expect(own.totals).toEqual({ CAD: 10 });
    expect(own.byDay["01"]).toEqual({ CAD: 10 });
  });

  it("skips empty roll-ups", () => {
    const merged = mergeRollups(aggregateMonth([]), [
      { categoryId: "c", ...rollupFor([], ["a"], "c") },
    ]);
    expect(merged.rolledUp).toEqual({});
    expect(merged.totals).toEqual({});
  });
});

describe("validateLink", () => {
  const ledger = (over: Partial<LinkableLedger>): LinkableLedger => ({
    id: "x",
    memberUids: ["alice"],
    categories: [{ id: "food", name: "food", order: 0 }],
    ...over,
  });
  const parent = ledger({ id: "personal-alice" });
  const child = ledger({ id: "biz" });

  it("allows a member of both to link", () => {
    expect(validateLink({ parent, child, callerUid: "alice" })).toBeNull();
  });

  it("needs the caller in both logs", () => {
    expect(
      validateLink({
        parent,
        child: ledger({ id: "biz", memberUids: ["sam"] }),
        callerUid: "alice",
      }),
    ).toBe("not-member");
  });

  it("refuses a log linking to itself", () => {
    expect(validateLink({ parent: child, child, callerUid: "alice" })).toBe("same-log");
  });

  it("never makes a personal log a sublog", () => {
    expect(
      validateLink({ parent: ledger({ id: "home" }), child: parent, callerUid: "alice" }),
    ).toBe("personal-child");
  });

  it("keeps it to one level", () => {
    const linked = { ledgerId: "p", categoryId: "c", since: "2026-11", linkedBy: "alice" };
    expect(
      validateLink({
        parent,
        child: ledger({ id: "biz", parentLink: linked }),
        callerUid: "alice",
      }),
    ).toBe("child-already-linked");
    const aParent = ledger({
      id: "biz",
      categories: [{ id: "c", name: "c", order: 0, sublog: { ledgerId: "pets" } }],
    });
    expect(validateLink({ parent, child: aParent, callerUid: "alice" })).toBe("child-is-parent");
    expect(
      validateLink({
        parent: ledger({ id: "home", parentLink: linked }),
        child,
        callerUid: "alice",
      }),
    ).toBe("parent-is-sublog");
  });

  it("lets a log whose links have all ended become a sublog", () => {
    const former = ledger({
      id: "biz",
      categories: [{ id: "c", name: "c", order: 0, sublog: { ledgerId: "pets", unlinkedAt: 1 } }],
    });
    expect(validateLink({ parent, child: former, callerUid: "alice" })).toBeNull();
  });

  it("refuses while either log is being deleted, or when the parent is full", () => {
    expect(
      validateLink({ parent, child: ledger({ id: "biz", deleting: true }), callerUid: "alice" }),
    ).toBe("deleting");
    const full = ledger({
      id: "home",
      categories: Array.from({ length: MAX_LEDGER_CATEGORIES }, (_, i) => ({
        id: `c${i}`,
        name: `c${i}`,
        order: i,
      })),
    });
    expect(validateLink({ parent: full, child, callerUid: "alice" })).toBe("too-many-categories");
  });
});

describe("linked category", () => {
  it("is named after the child unless a name was given, within the name limit", () => {
    expect(linkedCategoryName(undefined, "bali 2026")).toBe("bali 2026");
    expect(linkedCategoryName("  trip ", "bali 2026")).toBe("trip");
    expect(linkedCategoryName("", "")).toBe("sublog");
    expect(linkedCategoryName("a".repeat(30), "x")).toHaveLength(20);
  });

  it("goes at the end of the active list, before archived ones", () => {
    const { categories, categoryId } = addLinkedCategory(
      [
        { id: "food", name: "food", order: 0 },
        { id: "old", name: "old", order: 1, archived: true },
        { id: "rent", name: "rent", order: 2 },
      ],
      { childId: "biz", name: "business", linkedAt: 1 },
    );
    expect(categoryId).toBe("sublog-biz");
    expect(categories.map((c) => [c.id, c.order])).toEqual([
      ["food", 0],
      ["rent", 1],
      ["sublog-biz", 2],
      ["old", 3],
    ]);
    expect(categories[2].sublog).toEqual({ ledgerId: "biz", linkedAt: 1 });
  });

  it("gets a fresh id when an earlier link to the same log is still there", () => {
    const { categoryId } = addLinkedCategory(
      [
        {
          id: "sublog-biz",
          name: "business",
          order: 0,
          sublog: { ledgerId: "biz", unlinkedAt: 1 },
        },
      ],
      { childId: "biz", name: "business", linkedAt: 2 },
    );
    expect(categoryId).toBe("sublog-biz-2");
  });

  it("marks only the live link to that child as ended", () => {
    const out = markCategoryUnlinked(
      [
        { id: "a", name: "a", order: 0, sublog: { ledgerId: "biz", unlinkedAt: 1 } },
        { id: "b", name: "b", order: 1, sublog: { ledgerId: "biz" } },
        { id: "c", name: "c", order: 2, sublog: { ledgerId: "pets" } },
      ],
      "biz",
      9,
    );
    expect(out.map((c) => c.sublog?.unlinkedAt)).toEqual([1, 9, undefined]);
    expect(hasSublogCategories(out)).toBe(true);
    expect(hasSublogCategories([{ id: "food" }])).toBe(false);
  });
});

describe("helpers", () => {
  it("lists the months a link covers, in order", () => {
    expect(monthsSince(["2026-12", "2026-09", "2026-11", "junk"], "2026-11")).toEqual([
      "2026-11",
      "2026-12",
    ]);
  });

  it("ids roll-ups by month then child", () => {
    expect(rollupDocId("2026-11", "biz")).toBe("2026-11__biz");
  });

  it("parses a link request", () => {
    expect(parseLinkRequest({ childId: "c", parentId: "p", since: "2026-11" })).toEqual({
      childId: "c",
      parentId: "p",
      since: "2026-11",
    });
    expect(
      parseLinkRequest({ childId: "c", parentId: "p", since: "2026-11", name: "trip" })?.name,
    ).toBe("trip");
    expect(parseLinkRequest({ childId: "c", parentId: "p", since: "nov" })).toBeNull();
    expect(parseLinkRequest({ childId: "c", parentId: "p", since: "2026-11", name: 3 })).toBeNull();
    expect(parseLinkRequest(null)).toBeNull();
  });
});
