import { describe, it, expect } from "vite-plus/test";
import { LEDGER_TOUR_STEPS, shouldShowLedgerNudge, shouldShowLedgerTour } from "../tourRules";

const user = { userId: "u1" };
const mine = "personal-u1";

describe("shouldShowLedgerTour", () => {
  it("runs on your own empty personal log", () => {
    expect(shouldShowLedgerTour({ user, ledgerId: mine, hasEntries: false })).toBe(true);
  });

  it("waits until it knows whether there are entries", () => {
    expect(shouldShowLedgerTour({ user, ledgerId: mine, hasEntries: undefined })).toBe(false);
  });

  it("skips logs already in use", () => {
    expect(shouldShowLedgerTour({ user, ledgerId: mine, hasEntries: true })).toBe(false);
  });

  it("skips other logs, including someone else's personal one", () => {
    expect(shouldShowLedgerTour({ user, ledgerId: "groceries", hasEntries: false })).toBe(false);
    expect(shouldShowLedgerTour({ user, ledgerId: "personal-u2", hasEntries: false })).toBe(false);
  });

  it("only ever runs once", () => {
    expect(
      shouldShowLedgerTour({
        user: { ...user, tutorials: { ledgerTour: { seconds: 1 } } },
        ledgerId: mine,
        hasEntries: false,
      }),
    ).toBe(false);
  });

  it("waits for the welcome wizard and signed-in users", () => {
    expect(
      shouldShowLedgerTour({
        user: { ...user, onboardingPending: true },
        ledgerId: mine,
        hasEntries: false,
      }),
    ).toBe(false);
    expect(shouldShowLedgerTour({ user: undefined, ledgerId: mine, hasEntries: false })).toBe(
      false,
    );
  });
});

describe("shouldShowLedgerNudge", () => {
  it("points at an empty personal log the user still has", () => {
    expect(shouldShowLedgerNudge({ user, ledgerIds: ["x", mine], hasEntries: false })).toBe(true);
  });

  it("stays quiet once the personal log is deleted", () => {
    expect(shouldShowLedgerNudge({ user, ledgerIds: ["x"], hasEntries: false })).toBe(false);
  });

  it("stays quiet once dismissed, toured or used", () => {
    const ledgerIds = [mine];
    expect(
      shouldShowLedgerNudge({
        user: { ...user, tutorials: { ledgerNudge: { seconds: 1 } } },
        ledgerIds,
        hasEntries: false,
      }),
    ).toBe(false);
    expect(
      shouldShowLedgerNudge({
        user: { ...user, tutorials: { ledgerTour: { seconds: 1 } } },
        ledgerIds,
        hasEntries: false,
      }),
    ).toBe(false);
    expect(shouldShowLedgerNudge({ user, ledgerIds, hasEntries: true })).toBe(false);
  });
});

describe("LEDGER_TOUR_STEPS", () => {
  it("points at each place once", () => {
    const targets = LEDGER_TOUR_STEPS.map((s) => s.target);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
