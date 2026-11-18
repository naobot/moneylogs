import { describe, it, expect } from "vite-plus/test";
import {
  ledgerTourSteps,
  shouldShowLedgerNudge,
  shouldShowLedgerTour,
  TOUR_NEW_LOGS_SINCE,
} from "../tourRules";

const user = { userId: "u1" };
const mine = "personal-u1";
const at = (ms: number) => ({ toMillis: () => ms });
const OLD = at(TOUR_NEW_LOGS_SINCE - 1);
const NEW = at(TOUR_NEW_LOGS_SINCE + 1);
const toured = (ledgerId: string) => ({ ...user, tutorials: { ledgerTours: { [ledgerId]: 1 } } });

describe("shouldShowLedgerTour", () => {
  it("runs on your personal log, however old", () => {
    expect(shouldShowLedgerTour({ user, ledger: { id: mine, createdAt: OLD } })).toBe(true);
  });

  it("runs on any log made since it went per-log, including one just created", () => {
    expect(shouldShowLedgerTour({ user, ledger: { id: "trip", createdAt: NEW } })).toBe(true);
    expect(shouldShowLedgerTour({ user, ledger: { id: "trip", createdAt: null } })).toBe(true);
  });

  it("skips shared logs from before", () => {
    expect(shouldShowLedgerTour({ user, ledger: { id: "home", createdAt: OLD } })).toBe(false);
  });

  it("runs once per log", () => {
    expect(shouldShowLedgerTour({ user: toured(mine), ledger: { id: mine } })).toBe(false);
    expect(
      shouldShowLedgerTour({ user: toured(mine), ledger: { id: "trip", createdAt: NEW } }),
    ).toBe(true);
  });

  it("runs again for people who finished the old one-per-account tour", () => {
    const before = { ...user, tutorials: { ledgerTour: { seconds: 1 } } };
    expect(shouldShowLedgerTour({ user: before, ledger: { id: mine, createdAt: OLD } })).toBe(true);
  });

  it("waits for the welcome wizard and signed-in users", () => {
    const ledger = { id: mine };
    expect(shouldShowLedgerTour({ user: { ...user, onboardingPending: true }, ledger })).toBe(
      false,
    );
    expect(shouldShowLedgerTour({ user: undefined, ledger })).toBe(false);
  });
});

describe("shouldShowLedgerNudge", () => {
  it("points at an empty personal log the user still has", () => {
    expect(shouldShowLedgerNudge({ user, ledgerIds: ["x", mine], hasEntries: false })).toBe(true);
  });

  it("waits until it knows the log is empty", () => {
    expect(shouldShowLedgerNudge({ user, ledgerIds: [mine], hasEntries: undefined })).toBe(false);
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
    expect(shouldShowLedgerNudge({ user: toured(mine), ledgerIds, hasEntries: false })).toBe(false);
    expect(shouldShowLedgerNudge({ user, ledgerIds, hasEntries: true })).toBe(false);
  });
});

describe("ledgerTourSteps", () => {
  it("points at each place once, in the same order for every log", () => {
    const personal = ledgerTourSteps(true).map((s) => s.target);
    expect(new Set(personal).size).toBe(personal.length);
    expect(ledgerTourSteps(false).map((s) => s.target)).toEqual(personal);
  });

  it("only calls it your personal log on your personal log", () => {
    expect(ledgerTourSteps(true)[0].text).toMatch(/personal log/);
    expect(ledgerTourSteps(false)[0].text).not.toMatch(/personal/);
    expect(ledgerTourSteps(false)[1].text).toMatch(/this log's currency/);
  });
});
