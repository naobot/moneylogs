import { describe, expect, it } from "vite-plus/test";

import {
  canSnooze,
  monthName,
  reviewedMonth,
  shouldPrompt,
  tomorrowOf,
} from "@/features/ledger/buddy/monthReview";

describe("reviewedMonth", () => {
  it("is last month on the 1st to the 3rd, and null after", () => {
    expect(reviewedMonth("2026-12-01")).toBe("2026-11");
    expect(reviewedMonth("2026-12-03")).toBe("2026-11");
    expect(reviewedMonth("2027-01-02")).toBe("2026-12");
    expect(reviewedMonth("2026-12-04")).toBeNull();
    expect(reviewedMonth("2026-11-30")).toBeNull();
  });
});

describe("canSnooze", () => {
  it("offers tomorrow only while tomorrow is in the window", () => {
    expect(canSnooze("2026-12-01")).toBe(true);
    expect(canSnooze("2026-12-02")).toBe(true);
    expect(canSnooze("2026-12-03")).toBe(false);
  });
});

describe("shouldPrompt", () => {
  it("asks in the window until answered", () => {
    expect(shouldPrompt(null, "2026-12-01")).toBe(true);
    expect(shouldPrompt(null, "2026-12-04")).toBe(false);
    expect(shouldPrompt({ status: "dismissed" }, "2026-12-02")).toBe(false);
    expect(shouldPrompt({ status: "reviewing" }, "2026-12-02")).toBe(false);
    expect(shouldPrompt({ status: "done" }, "2026-12-02")).toBe(false);
  });

  it("waits out a snooze", () => {
    const snoozed = { status: "snoozed" as const, snoozedUntil: "2026-12-02" };
    expect(shouldPrompt(snoozed, "2026-12-01")).toBe(false);
    expect(shouldPrompt(snoozed, "2026-12-02")).toBe(true);
    expect(shouldPrompt(snoozed, "2026-12-03")).toBe(true);
  });
});

describe("helpers", () => {
  it("steps to tomorrow across month ends and names months in lowercase", () => {
    expect(tomorrowOf("2026-11-30")).toBe("2026-12-01");
    expect(monthName("2026-10")).toBe("october");
  });
});
