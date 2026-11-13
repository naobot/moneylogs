import { describe, it, expect, beforeEach } from "vite-plus/test";
import type { CurrencyAmounts, LedgerMonth } from "@/types/ledger";
import {
  CHECK_IN_FROM_HOUR,
  checkedInToday,
  dayAmounts,
  eveningCheckIn,
  markCheckedIn,
} from "../buddyCheckIn";

type Doc = Pick<LedgerMonth, "month" | "byDay">;

/** Month docs from "YYYY-MM-DD" → amounts. */
const docs = (days: Record<string, CurrencyAmounts>): Record<string, Doc> => {
  const out: Record<string, Doc> = {};
  for (const [date, amounts] of Object.entries(days)) {
    const month = date.slice(0, 7);
    out[month] ??= { month, byDay: {} };
    out[month].byDay[date.slice(8, 10)] = amounts;
  }
  return out;
};

const check = (today: string, days: Record<string, CurrencyAmounts>, localHour = 18) => {
  const byMonth = docs(days);
  const month = today.slice(0, 7);
  const prev = `${month.slice(0, 5)}${String(Number(month.slice(5)) - 1).padStart(2, "0")}`;
  return eveningCheckIn({ today, localHour, current: byMonth[month], previous: byMonth[prev] });
};

/** `n` spending days of `amount` CAD, on the days just before the 20th of November. */
const history = (n: number, amount: number, currency: "CAD" | "JPY" = "CAD") =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `2026-11-${String(19 - i).padStart(2, "0")}`,
      { [currency]: amount },
    ]),
  );

describe("dayAmounts", () => {
  it("reads from whichever month doc holds the date", () => {
    const byMonth = docs({ "2026-10-31": { CAD: 5 }, "2026-11-01": { CAD: 7 } });
    const pair = { current: byMonth["2026-11"], previous: byMonth["2026-10"] };
    expect(dayAmounts("2026-10-31", pair)).toEqual({ CAD: 5 });
    expect(dayAmounts("2026-11-01", pair)).toEqual({ CAD: 7 });
    expect(dayAmounts("2026-11-02", pair)).toEqual({});
    expect(dayAmounts("2026-09-30", pair)).toEqual({});
  });
});

describe("eveningCheckIn", () => {
  it("stays quiet before the evening", () => {
    expect(check("2026-11-20", {}, CHECK_IN_FROM_HOUR - 1)).toBeNull();
    expect(check("2026-11-20", {}, CHECK_IN_FROM_HOUR)).toBe("quiet");
  });

  it("cheers a day with nothing spent yet, whatever the history", () => {
    expect(check("2026-11-20", {})).toBe("quiet");
    expect(check("2026-11-20", { ...history(10, 50), "2026-11-20": { CAD: 0 } })).toBe("quiet");
  });

  it("needs five days with spending in the last two weeks to call a day light", () => {
    expect(check("2026-11-20", { ...history(4, 90), "2026-11-20": { CAD: 1 } })).toBeNull();
    expect(check("2026-11-20", { ...history(5, 90), "2026-11-20": { CAD: 1 } })).toBe("light");
  });

  it("ignores spending from before the two weeks", () => {
    const days = {
      ...history(4, 90),
      "2026-11-05": { CAD: 90 }, // 15 days back
      "2026-11-20": { CAD: 1 },
    };
    expect(check("2026-11-20", days)).toBeNull();
    expect(check("2026-11-20", { ...days, "2026-11-06": { CAD: 90 } })).toBe("light");
  });

  it("calls it light at a third of a typical spending day or less", () => {
    expect(check("2026-11-20", { ...history(5, 90), "2026-11-20": { CAD: 30 } })).toBe("light");
    expect(check("2026-11-20", { ...history(5, 90), "2026-11-20": { CAD: 30.01 } })).toBeNull();
  });

  it("averages over the days with spending, not the whole two weeks", () => {
    // 5 days of 90: a typical spending day is 90, not 450 / 14 ≈ 32.
    expect(check("2026-11-20", { ...history(5, 90), "2026-11-20": { CAD: 25 } })).toBe("light");
  });

  it("reaches back into last month", () => {
    const days = {
      "2026-10-28": { CAD: 60 },
      "2026-10-30": { CAD: 60 },
      "2026-10-31": { CAD: 60 },
      "2026-11-01": { CAD: 60 },
      "2026-11-02": { CAD: 60 },
      "2026-11-03": { CAD: 10 },
    };
    expect(check("2026-11-03", days)).toBe("light");
  });

  it("only calls it light when every currency spent today is light", () => {
    const base = { ...history(5, 90), "2026-11-18": { CAD: 90, JPY: 3000 } };
    expect(check("2026-11-20", { ...base, "2026-11-20": { CAD: 5, JPY: 500 } })).toBe("light");
    expect(check("2026-11-20", { ...base, "2026-11-20": { CAD: 5, JPY: 2000 } })).toBeNull();
    // Nothing to compare a new currency against.
    expect(check("2026-11-20", { ...history(5, 90), "2026-11-20": { CAD: 5, EUR: 1 } })).toBeNull();
  });
});

describe("check-in record", () => {
  beforeEach(() => localStorage.clear());

  it("remembers the day per log", () => {
    expect(checkedInToday("l1", "2026-11-20")).toBe(false);
    markCheckedIn("l1", "2026-11-20");
    expect(checkedInToday("l1", "2026-11-20")).toBe(true);
    expect(checkedInToday("l2", "2026-11-20")).toBe(false);
    expect(checkedInToday("l1", "2026-11-21")).toBe(false);
  });
});
