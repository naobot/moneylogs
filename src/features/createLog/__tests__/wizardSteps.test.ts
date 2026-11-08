import { describe, it, expect } from "vite-plus/test";
import {
  isStepValid,
  participantsError,
  reachableStepIndex,
  scheduleError,
  stepsFor,
  titleError,
  WizardState,
} from "@/features/createLog/wizardSteps";

const base: WizardState = {
  mode: null,
  title: "",
  maxParticipants: 10,
  startDate: "2026-11-01",
  startTime: "00:00",
  endDate: "2026-11-30",
  endTime: "23:59",
  defaultCurrency: "JPY",
};

describe("stepsFor", () => {
  it("only offers the type step before a mode is chosen", () => {
    expect(stepsFor(null)).toEqual(["type"]);
  });

  it("asks for dates in social mode and a currency in financial mode", () => {
    expect(stepsFor("social")).toEqual(["type", "basics", "schedule", "review"]);
    expect(stepsFor("financial")).toEqual(["type", "basics", "currency", "review"]);
  });
});

describe("field errors", () => {
  it("limits title length", () => {
    expect(titleError("x".repeat(20))).toBeUndefined();
    expect(titleError("x".repeat(21))).toMatch(/20 characters/);
  });

  it("bounds participants to whole numbers from 1 to 30", () => {
    expect(participantsError(1)).toBeUndefined();
    expect(participantsError(30)).toBeUndefined();
    expect(participantsError(0)).toBeDefined();
    expect(participantsError(31)).toBeDefined();
    expect(participantsError(2.5)).toBeDefined();
  });

  it("keeps the original social date rules", () => {
    expect(scheduleError("2026-11-01", "2026-12-01")).toBeUndefined();
    expect(scheduleError("2026-11-02", "2026-11-01")).toMatch(/before/);
    expect(scheduleError("2026-11-01", "2026-12-03")).toMatch(/within a month/);
  });
});

describe("isStepValid", () => {
  it("requires a non-blank title on the basics step", () => {
    expect(isStepValid("basics", { ...base, title: "   " })).toBe(false);
    expect(isStepValid("basics", { ...base, title: "Trip" })).toBe(true);
  });

  it("validates review against every earlier step for the chosen mode", () => {
    const financial = { ...base, mode: "financial" as const, title: "Home" };
    expect(isStepValid("review", financial)).toBe(true);
    // Bad social dates don't matter for a financial log...
    expect(isStepValid("review", { ...financial, endDate: "2020-01-01" })).toBe(true);
    // ...but they do for a social one.
    expect(isStepValid("review", { ...financial, mode: "social", endDate: "2020-01-01" })).toBe(
      false,
    );
  });
});

describe("reachableStepIndex", () => {
  it("clamps a deep link to the first incomplete step", () => {
    expect(reachableStepIndex(3, base)).toBe(0);
    expect(reachableStepIndex(3, { ...base, mode: "financial" })).toBe(1);
    expect(reachableStepIndex(3, { ...base, mode: "financial", title: "Home" })).toBe(3);
  });

  it("clamps out-of-range and junk values", () => {
    const ready = { ...base, mode: "social" as const, title: "Trip" };
    expect(reachableStepIndex(99, ready)).toBe(3);
    expect(reachableStepIndex(-4, ready)).toBe(0);
    expect(reachableStepIndex(NaN, ready)).toBe(0);
  });
});
