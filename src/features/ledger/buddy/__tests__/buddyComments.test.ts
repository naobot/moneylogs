import { describe, it, expect } from "vite-plus/test";
import { buddyComment } from "../buddyComments";
import type { BuddyFacts, BuddyState } from "../buddyMood";
import { FACES, MOOD_SCALE } from "../faces";

const budgetFacts: BuddyFacts = {
  currency: "CAD",
  hasBudget: true,
  used: 0.38,
  budget: 1000,
  spent: 380,
  projected: 1400,
  daysLeft: 19,
  change: 0.22,
  noSpendDays: 3,
  topCategory: "Food",
};
const bareFacts: BuddyFacts = { hasBudget: false, daysLeft: 19, noSpendDays: 0 };

const say = (mood: BuddyState["mood"], facts: BuddyFacts, nth = 0, asleep = false) =>
  buddyComment({ mood, asleep, facts, seed: 0 }, nth);

const moods = [...MOOD_SCALE, "idle"] as const;

describe("buddyComment", () => {
  it.each(moods)("always has something to say when %s", (mood) => {
    for (const facts of [budgetFacts, bareFacts]) {
      for (let nth = 0; nth < 6; nth++) {
        const line = say(mood, facts, nth);
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toMatch(/undefined|null|NaN|\{/);
      }
    }
  });

  it("talks about the actual numbers", () => {
    const lines = Array.from({ length: 4 }, (_, nth) => say("content", budgetFacts, nth));
    expect(lines).toContain("38% of the CAD budget gone, 19 days to go.");
    const worried = Array.from({ length: 4 }, (_, nth) => say("worried", budgetFacts, nth));
    expect(worried.some((l) => l.includes("about 1,400 CAD by month end"))).toBe(true);
  });

  it("moves on to another line when clicked again", () => {
    expect(say("wary", budgetFacts, 0)).not.toBe(say("wary", budgetFacts, 1));
  });

  it("suggests a budget when there isn't one", () => {
    const lines = Array.from({ length: 3 }, (_, nth) => say("content", bareFacts, nth));
    expect(lines.some((l) => l.includes("set one in categories"))).toBe(true);
  });

  it("wakes up groggy", () => {
    const line = say("happy", budgetFacts, 0, true);
    expect(line.startsWith("zzz") || line.startsWith("five") || line.startsWith("*yawn*")).toBe(
      true,
    );
  });
});

describe("faces", () => {
  it("are single short lines, so the header row never wraps oddly", () => {
    for (const set of Object.values(FACES)) {
      for (const face of [...set.resting, set.hover, set.click]) {
        expect(face).not.toMatch(/\n/);
        expect(Array.from(face).length).toBeLessThanOrEqual(16);
      }
    }
  });
});
