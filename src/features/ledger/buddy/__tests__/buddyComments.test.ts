import { describe, it, expect } from "vite-plus/test";
import { buddyComment, daysLeftInWords, shareInWords } from "../buddyComments";
import type { BuddyFacts, BuddyState } from "../buddyMood";
import { ASLEEP_HOVER_FACE, FACES, HOVER_FACES, MOOD_SCALE } from "../faces";

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

  it("talks about the month in words, not exact numbers", () => {
    const lines = Array.from({ length: 5 }, (_, nth) => say("content", budgetFacts, nth));
    expect(lines).toContain(
      "we've used about a third of the budget, and there's lots of month left.",
    );
    for (const line of lines) expect(line).not.toMatch(/\d+%|CAD/);
    const worried = Array.from({ length: 4 }, (_, nth) => say("worried", budgetFacts, nth));
    expect(worried.some((l) => l.includes("run past the budget"))).toBe(true);
  });

  it("rounds shares and days into words", () => {
    expect(shareInWords(0.05)).toBe("barely a nibble of");
    expect(shareInWords(0.5)).toBe("about half of");
    expect(shareInWords(0.95)).toBe("nearly all of");
    expect(shareInWords(1.2)).toBe("more than all of");
    expect(daysLeftInWords(1)).toBe("it's the last day of the month");
    expect(daysLeftInWords(7)).toBe("there's about a week left");
    expect(daysLeftInWords(25)).toBe("there's lots of month left");
  });

  it("moves on to another line when clicked again", () => {
    expect(say("wary", budgetFacts, 0)).not.toBe(say("wary", budgetFacts, 1));
  });

  it("suggests a budget when there isn't one", () => {
    const lines = Array.from({ length: 3 }, (_, nth) => say("content", bareFacts, nth));
    expect(lines.some((l) => l.includes("set a budget in categories"))).toBe(true);
  });

  it("includes the requested faces", () => {
    expect(FACES.asleep.resting).toContain("(^-人-^)..zZ");
    expect(FACES.happy.resting).toContain("ฅ^>ω<^ฅ");
    expect(FACES.content.resting).toContain("ฅ(ﾐ・ﻌ・ﾐ)ฅ");
    expect(FACES.alarmed.resting).toEqual(expect.arrayContaining(["(^ ; ᯅ ; ^)", "☜(ΦωΦ )へ"]));
    expect(FACES.wary.resting).toContain("ฅ(◍ •̀ω• ́◍)ฅ");
    expect(FACES.wary.click).toEqual(["ฅ(◍ •̀ω• ́◍)ฅ", "(=ච ﻌ ච=)"]);
    expect(FACES.idle.resting).toEqual(["=• · • =", "ヾ(⌒(_´,,−﹃−,,`)_ｺﾞﾛｺﾞﾛ"]);
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
    const all = [
      ...Object.values(FACES).flatMap((set) => [...set.resting, ...set.click]),
      ...HOVER_FACES,
      ASLEEP_HOVER_FACE,
    ];
    for (const face of all) {
      expect(face).not.toMatch(/\n/);
      expect(Array.from(face).length).toBeLessThanOrEqual(24);
    }
  });
});
