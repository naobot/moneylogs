import { describe, expect, it } from "vite-plus/test";
import {
  CATCH_UP_CAP,
  dueDays,
  dueInstant,
  firstDue,
  isScheduledCreate,
  nextOccurrence,
  occurrenceOn,
  parseSchedule,
  scheduleCategoryState,
  scheduleEntryId,
  scheduleInputError,
  ScheduleRepeat,
} from "./schedulePlan";

const monthly = (day: number): ScheduleRepeat => ({ every: "month", day });
const yearly = (month: number, day: number): ScheduleRepeat => ({ every: "year", month, day });

describe("occurrenceOn", () => {
  it("clamps the 31st to the month's last day", () => {
    expect(occurrenceOn(monthly(31), 2026, 4)).toBe("2026-04-30");
    expect(occurrenceOn(monthly(31), 2026, 2)).toBe("2026-02-28");
    expect(occurrenceOn(monthly(31), 2028, 2)).toBe("2028-02-29");
    expect(occurrenceOn(monthly(31), 2026, 12)).toBe("2026-12-31");
  });

  it("puts 29 Feb on the 28th outside leap years", () => {
    expect(occurrenceOn(yearly(2, 29), 2027, 2)).toBe("2027-02-28");
    expect(occurrenceOn(yearly(2, 29), 2028, 2)).toBe("2028-02-29");
  });

  it("has no day for a yearly schedule in other months", () => {
    expect(occurrenceOn(yearly(3, 12), 2026, 4)).toBeNull();
  });
});

describe("firstDue / nextOccurrence", () => {
  it("is on or after the day", () => {
    expect(firstDue(monthly(5), "2026-11-05")).toBe("2026-11-05");
    expect(firstDue(monthly(5), "2026-11-06")).toBe("2026-12-05");
    expect(firstDue(monthly(5), "2026-12-24")).toBe("2027-01-05");
  });

  it("is strictly after the day for nextOccurrence", () => {
    expect(nextOccurrence(monthly(5), "2026-11-05")).toBe("2026-12-05");
    expect(nextOccurrence(monthly(5), "2026-11-04")).toBe("2026-11-05");
  });

  it("moves through short months without skipping one", () => {
    expect(nextOccurrence(monthly(31), "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence(monthly(31), "2026-02-28")).toBe("2026-03-31");
  });

  it("finds a yearly day up to a year ahead", () => {
    expect(firstDue(yearly(3, 12), "2026-11-24")).toBe("2027-03-12");
    expect(nextOccurrence(yearly(3, 12), "2027-03-12")).toBe("2028-03-12");
  });
});

describe("dueInstant", () => {
  it("is 8am in the owner's zone", () => {
    expect(new Date(dueInstant("2026-11-24", "Asia/Tokyo")).toISOString()).toBe(
      "2026-11-23T23:00:00.000Z",
    );
  });

  it("follows daylight saving", () => {
    // Toronto: EDT (UTC-4) in July, EST (UTC-5) in December.
    expect(new Date(dueInstant("2026-07-01", "America/Toronto")).toISOString()).toBe(
      "2026-07-01T12:00:00.000Z",
    );
    expect(new Date(dueInstant("2026-12-01", "America/Toronto")).toISOString()).toBe(
      "2026-12-01T13:00:00.000Z",
    );
  });

  it("falls back to UTC for a missing or unknown zone", () => {
    const utc = "2026-11-24T08:00:00.000Z";
    expect(new Date(dueInstant("2026-11-24")).toISOString()).toBe(utc);
    expect(new Date(dueInstant("2026-11-24", "Mars/Olympus")).toISOString()).toBe(utc);
  });
});

describe("dueDays", () => {
  it("logs the day it's due and books the next", () => {
    expect(dueDays(monthly(5), "2026-11-05", "2026-11-05")).toEqual({
      days: ["2026-11-05"],
      next: "2026-12-05",
    });
  });

  it("does nothing before the day", () => {
    expect(dueDays(monthly(5), "2026-12-05", "2026-11-30")).toEqual({
      days: [],
      next: "2026-12-05",
    });
  });

  it("catches up missed days, keeping only the latest few", () => {
    const { days, next } = dueDays(monthly(1), "2026-01-01", "2026-06-15");
    expect(days).toHaveLength(CATCH_UP_CAP);
    expect(days).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
    expect(next).toBe("2026-07-01");
  });
});

describe("scheduleEntryId / isScheduledCreate", () => {
  it("is fixed per schedule and day", () => {
    expect(scheduleEntryId("abc", "2026-11-05")).toBe("abc_2026-11-05");
  });

  it("is only a scheduled entry's creation", () => {
    expect(isScheduledCreate(undefined, { scheduleId: "abc" })).toBe(true);
    expect(isScheduledCreate({ amount: 1 }, { scheduleId: "abc" })).toBe(false);
    expect(isScheduledCreate(undefined, {})).toBe(false);
    expect(isScheduledCreate(undefined, undefined)).toBe(false);
  });
});

describe("scheduleInputError / parseSchedule", () => {
  const input = {
    categoryId: "housing",
    label: "rent",
    amount: 1200,
    currency: "CAD",
    repeat: monthly(1),
  };

  it("accepts a complete schedule", () => {
    expect(scheduleInputError(input)).toBeUndefined();
    expect(scheduleInputError({ ...input, repeat: yearly(2, 29) })).toBeUndefined();
  });

  it("says what's missing", () => {
    expect(scheduleInputError({ ...input, label: "  " })).toBe("give it a name");
    expect(scheduleInputError({ ...input, amount: 0 })).toBe("enter an amount");
    expect(scheduleInputError({ ...input, currency: "cad" })).toBe("pick a currency");
    expect(scheduleInputError({ ...input, repeat: monthly(32) })).toBe("pick when it repeats");
    expect(scheduleInputError({ ...input, repeat: yearly(2, 30) })).toBe("pick when it repeats");
    expect(scheduleInputError({ ...input, repeat: { every: "week", day: 1 } as never })).toBe(
      "pick when it repeats",
    );
  });

  it("reads a stored schedule, trimming the label", () => {
    expect(
      parseSchedule({
        ...input,
        label: " rent ",
        ownerUid: "u",
        ownerDocId: "d",
        nextDue: "2026-12-01",
      }),
    ).toEqual({
      ...input,
      ownerUid: "u",
      ownerDocId: "d",
      paused: false,
      nextDue: "2026-12-01",
    });
    expect(parseSchedule({ ...input, ownerDocId: "d" })).toBeNull();
    expect(parseSchedule(null)).toBeNull();
  });
});

describe("scheduleCategoryState", () => {
  it("logs into a fixed category", () => {
    expect(scheduleCategoryState([{ id: "housing" }], "housing")).toBe("log");
    expect(scheduleCategoryState([{ id: "gym", fixed: true }], "gym")).toBe("log");
  });

  it("pauses when it's archived, no longer fixed or now a sublog", () => {
    expect(scheduleCategoryState([{ id: "housing", archived: true }], "housing")).toBe("pause");
    expect(scheduleCategoryState([{ id: "housing", fixed: false }], "housing")).toBe("pause");
    expect(scheduleCategoryState([{ id: "food" }], "food")).toBe("pause");
    expect(
      scheduleCategoryState([{ id: "gym", fixed: true, sublog: { linkId: "x" } }], "gym"),
    ).toBe("pause");
  });

  it("drops when the category is gone", () => {
    expect(scheduleCategoryState([{ id: "food" }], "housing")).toBe("drop");
  });
});
