import { describe, expect, it } from "vite-plus/test";
import {
  appendPulled,
  buildPulledMarkdown,
  entryLine,
  escapeMarkdown,
  initialSelection,
  logSelection,
  mergeIntoRows,
  PullGroup,
  pulledIdsIn,
  pullKey,
  selectedIds,
  selectedTotals,
  toggleEntry,
  toggleLog,
  toPullGroup,
} from "../pullLines";
import { LogPost } from "@/types/user";
import { Ledger } from "@/types/ledger";

const trip: PullGroup = {
  ledgerId: "l1",
  title: "kyoto trip",
  entries: [
    { id: "a", amount: 1200, currency: "JPY", note: "ramen", categoryName: "food" },
    { id: "b", amount: 300, currency: "JPY", categoryName: "transit" },
  ],
};
const home: PullGroup = {
  ledgerId: "l2",
  title: "personal",
  entries: [{ id: "c", amount: 12.5, currency: "CAD", note: "phone", categoryName: "bills" }],
};
const groups = [trip, home];

describe("toPullGroup", () => {
  it("resolves category names and falls back for unknown ones", () => {
    const ledger = {
      id: "l1",
      title: "trip",
      categories: [{ id: "food", name: "food", order: 0 }],
    } as unknown as Ledger;
    const group = toPullGroup(ledger, [
      { id: "a", amount: 1, currency: "JPY", categoryId: "food", note: "" },
      { id: "b", amount: 2, currency: "JPY", categoryId: "gone" },
    ]);
    expect(group.entries).toEqual([
      { id: pullKey("l1", "a"), amount: 1, currency: "JPY", categoryName: "food" },
      { id: pullKey("l1", "b"), amount: 2, currency: "JPY", categoryName: "uncategorised" },
    ]);
  });

  it("keeps the same imported entry in two logs apart", () => {
    const entry = { id: "import-row-7", amount: 500, currency: "JPY", categoryId: "x" } as const;
    const personal = toPullGroup({ id: "l1", title: "personal", categories: [] }, [entry]);
    const trip = toPullGroup({ id: "l2", title: "trip", categories: [] }, [entry]);
    const both = [personal, trip];
    const onlyTrip = toggleEntry(personal.entries[0].id, initialSelection(both, new Set()));
    expect(logSelection(personal, onlyTrip)).toBe("none");
    expect(logSelection(trip, onlyTrip)).toBe("all");
    expect(selectedTotals(both, onlyTrip)).toEqual({ JPY: 500 });
  });
});

describe("pullKey", () => {
  it("is stable, ledger-qualified, and doesn't contain the ledger id", () => {
    expect(pullKey("ledgerA", "e1")).toBe(pullKey("ledgerA", "e1"));
    expect(pullKey("ledgerA", "e1")).not.toBe(pullKey("ledgerB", "e1"));
    expect(pullKey("ledgerA", "e1")).not.toContain("ledgerA");
  });
});

describe("selection", () => {
  it("ticks everything except entries already pulled", () => {
    expect([...initialSelection(groups, new Set(["b"]))]).toEqual(["a", "c"]);
  });

  it("reports a log as all, some or none", () => {
    expect(logSelection(trip, new Set(["a", "b"]))).toBe("all");
    expect(logSelection(trip, new Set(["a"]))).toBe("some");
    expect(logSelection(trip, new Set(["c"]))).toBe("none");
  });

  it("ticks a partly ticked log fully, and unticks a fully ticked one", () => {
    expect([...toggleLog(trip, new Set(["a", "c"]))].sort()).toEqual(["a", "b", "c"]);
    expect([...toggleLog(trip, new Set(["a", "b", "c"]))]).toEqual(["c"]);
  });

  it("toggles a single entry without mutating", () => {
    const before = new Set(["a"]);
    expect([...toggleEntry("b", before)]).toEqual(["a", "b"]);
    expect([...toggleEntry("a", before)]).toEqual([]);
    expect([...before]).toEqual(["a"]);
  });

  it("totals and lists only the ticked entries", () => {
    const selected = new Set(["a", "c"]);
    expect(selectedTotals(groups, selected)).toEqual({ JPY: 1200, CAD: 12.5 });
    expect(selectedIds(groups, selected)).toEqual(["a", "c"]);
  });
});

describe("markdown", () => {
  it("writes note · category, or just the category", () => {
    expect(entryLine(trip.entries[0])).toBe("- ramen · food · 1,200 JPY");
    expect(entryLine(trip.entries[1])).toBe("- transit · 300 JPY");
  });

  it("writes ledger text as text, not markdown", () => {
    expect(escapeMarkdown("![x](https://e.vil/p.png)")).toBe("\\!\\[x\\]\\(https://e.vil/p.png\\)");
    expect(escapeMarkdown("<img src=x>")).toBe("\\<img src=x\\>");
    expect(escapeMarkdown("two\nlines")).toBe("two lines");
    const line = entryLine({ id: "x", amount: 5, currency: "CAD", categoryName: "![a](b)" });
    expect(line).toBe("- \\!\\[a\\]\\(b\\) · 5 CAD");
  });

  it("groups lines under each log with ticked entries only", () => {
    expect(buildPulledMarkdown(groups, new Set(["a", "c"]))).toBe(
      "**kyoto trip**\n- ramen · food · 1,200 JPY\n\n**personal**\n- phone · bills · 12.5 CAD",
    );
  });

  it("leaves out logs with nothing ticked", () => {
    expect(buildPulledMarkdown(groups, new Set(["c"]))).toBe(
      "**personal**\n- phone · bills · 12.5 CAD",
    );
  });

  it("appends after existing text, or stands alone", () => {
    expect(appendPulled("", "x")).toBe("x");
    expect(appendPulled("a good day\n\n", "x")).toBe("a good day\n\nx");
  });
});

describe("pulledIdsIn", () => {
  it("collects ids from the author's posts only", () => {
    const posts = [
      { author: { id: "me" }, pulledEntryIds: ["a", "b"] },
      { author: { id: "me" } },
      { author: { id: "them" }, pulledEntryIds: ["z"] },
    ] as unknown as LogPost[];
    expect([...pulledIdsIn(posts, "me")]).toEqual(["a", "b"]);
    expect([...pulledIdsIn(posts, undefined)]).toEqual([]);
  });
});

describe("mergeIntoRows", () => {
  it("adds onto a row in the same currency and appends new ones", () => {
    expect(mergeIntoRows([{ currency: "JPY", amount: 500 }], { JPY: 1200, CAD: 12.5 })).toEqual([
      { currency: "JPY", amount: 1700 },
      { currency: "CAD", amount: 12.5 },
    ]);
  });

  it("replaces a lone empty row in another currency", () => {
    expect(mergeIntoRows([{ currency: "JPY", amount: 0 }], { CAD: 3 })).toEqual([
      { currency: "CAD", amount: 3 },
    ]);
  });

  it("keeps a lone row that already has an amount", () => {
    expect(mergeIntoRows([{ currency: "JPY", amount: 10 }], { CAD: 3 })).toEqual([
      { currency: "JPY", amount: 10 },
      { currency: "CAD", amount: 3 },
    ]);
  });

  it("does nothing for empty totals", () => {
    const rows = [{ currency: "JPY" as const, amount: 0 }];
    expect(mergeIntoRows(rows, {})).toEqual(rows);
  });
});
