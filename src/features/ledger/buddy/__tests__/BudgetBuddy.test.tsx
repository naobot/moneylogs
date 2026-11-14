import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import dayjs from "@/utils/configuredDayjs";
import type { Ledger } from "@/types/ledger";

const state = vi.hoisted(() => ({
  now: "2026-11-15T12:00:00Z",
  byMonth: {} as Record<string, unknown>,
  isSuccess: true,
  find: null as null | { id: string; item: "acorn"; ledgerId: string; seenAt: null },
  markFindSeen: vi.fn(() => Promise.resolve()),
  requestQuietDayRoll: vi.fn(),
}));

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "u1", userId: "a1", timezone: "UTC" } }),
}));
vi.mock("@/hooks/useNow", () => ({
  useNow: () => dayjs(state.now),
}));
vi.mock("@/hooks/useLedgerMonths", () => ({
  useLedgerMonths: () => ({ byMonth: state.byMonth, isSuccess: state.isSuccess }),
}));

vi.mock("../knickknacks/quietDay", () => ({
  requestQuietDayRoll: state.requestQuietDayRoll,
}));
vi.mock("../knickknacks/useUnseenFinds", () => ({
  useUnseenFind: () => state.find,
  markFindSeen: state.markFindSeen,
}));

import { BudgetBuddy, BUDDY_HOVER_DELAY } from "../BudgetBuddy";
import { ASLEEP_HOVER_FACE, FACES, HOVER_FACES } from "../faces";
import { CHECK_IN_LINES } from "../buddyComments";
import { KNICK_KNACKS } from "../knickknacks/catalog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ledger = {
  id: "l1",
  categories: [{ id: "food", name: "Food", order: 0, budget: { CAD: 1000 } }],
} as unknown as Ledger;

const november = (spent: number) => ({
  "2026-11": {
    month: "2026-11",
    entryCount: 1,
    totals: { CAD: spent },
    byCategory: { food: { CAD: spent } },
    byMember: {},
    byDay: { "15": { CAD: spent } },
  },
});

describe("BudgetBuddy", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    state.now = "2026-11-15T12:00:00Z";
    state.byMonth = november(1200); // over budget: alarmed, whatever the day's jitter
    state.isSuccess = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll(".BuddyBubble").forEach((el) => el.remove());
    vi.useRealTimers();
  });

  const render = () => act(() => root.render(<BudgetBuddy ledger={ledger} />));
  const button = () => container.querySelector<HTMLButtonElement>(".BudgetBuddy");
  const face = () => button()!.querySelector(".BudgetBuddy__face")!.textContent;
  const point = (type: "pointerover" | "pointerout", pointerType = "mouse") =>
    act(() => {
      button()!.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType }));
    });

  it("waits for the month docs before showing a face", () => {
    state.isSuccess = false;
    render();
    expect(button()).toBeNull();
  });

  it("shows how the month is going", () => {
    render();
    expect(FACES.alarmed.resting).toContain(face());
    expect(button()!.getAttribute("aria-label")).toContain("alarmed");
  });

  it("notices a lingering mouse after a beat, and bounces into a ﾆｬｰ face", () => {
    render();
    const resting = face();
    point("pointerover");
    act(() => vi.advanceTimersByTime(BUDDY_HOVER_DELAY - 1));
    expect(face()).toBe(resting);
    act(() => vi.advanceTimersByTime(1));
    expect(face()).toBe(HOVER_FACES[0]);
    expect(button()!.querySelector(".BudgetBuddy__face--react")).not.toBeNull();
    point("pointerout");
    expect(face()).toBe(resting);
    expect(button()!.querySelector(".BudgetBuddy__face--react")).toBeNull();

    // The next hover gets the next face.
    point("pointerover");
    act(() => vi.advanceTimersByTime(BUDDY_HOVER_DELAY));
    expect(face()).toBe(HOVER_FACES[1]);
  });

  it("doesn't react to a pointer just passing over, or to touch", () => {
    render();
    const resting = face();
    point("pointerover");
    point("pointerout");
    act(() => vi.advanceTimersByTime(BUDDY_HOVER_DELAY));
    expect(face()).toBe(resting);
    point("pointerover", "touch");
    act(() => vi.advanceTimersByTime(BUDDY_HOVER_DELAY));
    expect(face()).toBe(resting);
  });

  it("holds its face while the speech bubble is open", () => {
    render();
    act(() => button()!.click());
    const reacting = face();
    expect(FACES.alarmed.click).toContain(reacting);
    const bubble = document.querySelector(".BuddyBubble");
    expect(bubble!.textContent!.length).toBeGreaterThan(0);
    expect(button()!.getAttribute("aria-expanded")).toBe("true");

    act(() => vi.advanceTimersByTime(10_000));
    point("pointerover");
    act(() => vi.advanceTimersByTime(BUDDY_HOVER_DELAY));
    expect(face()).toBe(reacting);

    act(() => button()!.click());
    expect(document.querySelector(".BuddyBubble")).toBeNull();
    expect(FACES.alarmed.resting).toContain(face());
  });

  it("sleeps at night in the viewer's timezone", () => {
    state.now = "2026-11-15T02:00:00Z";
    render();
    expect(FACES.asleep.resting).toContain(face());
    point("pointerover");
    act(() => vi.advanceTimersByTime(BUDDY_HOVER_DELAY));
    expect(face()).toBe(ASLEEP_HOVER_FACE);
    point("pointerout");
    act(() => button()!.click());
    expect(face()).toBe(FACES.asleep.click[0]);
    expect(document.querySelector(".BuddyBubble")!.textContent).toMatch(/zzz|five more|yawn/);
  });

  it("is idle in a month with nothing logged", () => {
    state.byMonth = {};
    render();
    expect(FACES.idle.resting).toContain(face());
  });
});

describe("BudgetBuddy when wary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.now = "2026-11-15T12:00:00Z";
    state.isSuccess = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll(".BuddyBubble").forEach((el) => el.remove());
  });

  it("reacts to a click with one of its wary faces, never the one it's already making", () => {
    // Pace 1.15: wary, whatever the day's wobble.
    state.byMonth = november(575);
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      act(() => root.render(<BudgetBuddy ledger={{ ...ledger, id } as Ledger} />));
      const btn = container.querySelector<HTMLButtonElement>(".BudgetBuddy")!;
      const resting = btn.textContent;
      act(() => btn.click());
      const clicked = btn.textContent!;
      expect(FACES.wary.click).toContain(clicked);
      expect(clicked).not.toBe(resting);
      act(() => btn.click());
    }
  });
});

describe("BudgetBuddy evening check-in", () => {
  let container: HTMLDivElement;
  let root: Root;

  /** Spending on each of the given November days. */
  const spending = (days: Record<string, number>) => ({
    "2026-11": {
      month: "2026-11",
      entryCount: Object.keys(days).length,
      totals: { CAD: Object.values(days).reduce((a, b) => a + b, 0) },
      byCategory: {},
      byMember: {},
      byDay: Object.fromEntries(Object.entries(days).map(([dd, v]) => [dd, { CAD: v }])),
    },
  });

  beforeEach(() => {
    localStorage.clear();
    state.isSuccess = true;
    state.byMonth = spending({ "10": 40, "12": 40 }); // nothing today (the 15th)
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll(".BuddyBubble").forEach((el) => el.remove());
  });

  const render = (id = "l1") =>
    act(() => root.render(<BudgetBuddy ledger={{ ...ledger, id } as Ledger} />));
  const bubbleText = () => document.querySelector(".BuddyBubble")?.textContent ?? null;
  const button = () => container.querySelector<HTMLButtonElement>(".BudgetBuddy")!;

  it("asks for the day's knick-knack roll on a quiet evening, and not before", () => {
    state.requestQuietDayRoll.mockClear();
    state.now = "2026-11-15T16:00:00Z";
    render();
    expect(state.requestQuietDayRoll).not.toHaveBeenCalled();
    state.now = "2026-11-15T18:00:00Z";
    render();
    expect(state.requestQuietDayRoll).toHaveBeenCalledWith({
      userDocId: "u1",
      ledgerId: "l1",
      today: "2026-11-15",
    });
  });

  it("doesn't ask on an evening with spending logged", () => {
    state.requestQuietDayRoll.mockClear();
    state.byMonth = spending({ "15": 5 });
    state.now = "2026-11-15T18:00:00Z";
    render();
    expect(state.requestQuietDayRoll).not.toHaveBeenCalled();
  });

  it("speaks up by itself in the evening when nothing's been spent today", () => {
    state.now = "2026-11-15T18:00:00Z";
    render();
    expect(CHECK_IN_LINES.quiet).toContain(bubbleText());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(FACES.happy.click).toContain(button().textContent);
  });

  it("keeps quiet before 5pm", () => {
    state.now = "2026-11-15T16:59:00Z";
    render();
    expect(bubbleText()).toBeNull();
  });

  it("only checks in once a day per log", () => {
    state.now = "2026-11-15T18:00:00Z";
    render();
    act(() => button().click()); // close it
    expect(bubbleText()).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    render();
    expect(bubbleText()).toBeNull();
    // Another log still gets its own.
    render("l2");
    expect(CHECK_IN_LINES.quiet).toContain(bubbleText());
  });

  it("cheers a day well under the usual", () => {
    state.now = "2026-11-15T19:00:00Z";
    state.byMonth = spending({ "08": 90, "09": 90, "10": 90, "12": 90, "14": 90, "15": 20 });
    render();
    expect(CHECK_IN_LINES.light).toContain(bubbleText());
    expect(FACES.delighted.click).toContain(button().textContent);
  });

  it("says nothing on an ordinary day", () => {
    state.now = "2026-11-15T19:00:00Z";
    state.byMonth = spending({ "08": 90, "09": 90, "10": 90, "12": 90, "14": 90, "15": 80 });
    render();
    expect(bubbleText()).toBeNull();
  });

  it("goes back to its usual comments once the check-in is closed", () => {
    state.now = "2026-11-15T18:00:00Z";
    render();
    act(() => button().click());
    act(() => button().click());
    const text = bubbleText();
    expect(text).not.toBeNull();
    expect(CHECK_IN_LINES.quiet).not.toContain(text);
  });
});

describe("BudgetBuddy finds", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.now = "2026-11-15T12:00:00Z";
    state.byMonth = november(100);
    state.isSuccess = true;
    state.find = { id: "f1", item: "acorn", ledgerId: "l1", seenAt: null };
    state.markFindSeen.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll(".BuddyBubble").forEach((el) => el.remove());
    state.find = null;
  });

  const render = () => act(() => root.render(<BudgetBuddy ledger={ledger} />));
  const button = () => container.querySelector<HTMLButtonElement>(".BudgetBuddy")!;
  const bubble = () => document.querySelector<HTMLElement>(".BuddyBubble");

  it("shows a ! beside the buddy when it has found something", () => {
    render();
    expect(button().querySelector(".BudgetBuddy__found")).not.toBeNull();
    expect(button().getAttribute("aria-label")).toContain("found something");
  });

  it("shows the find in an inverted bubble on click, and marks it seen", () => {
    render();
    act(() => button().click());
    expect(bubble()!.classList.contains("BuddyBubble--find")).toBe(true);
    expect(bubble()!.querySelector('svg[aria-label="acorn"]')).not.toBeNull();
    expect(bubble()!.textContent).toContain(KNICK_KNACKS.acorn.found);
    expect(state.markFindSeen).toHaveBeenCalledWith("u1", "f1");
    expect(button().querySelector(".BudgetBuddy__found")).toBeNull();
  });

  it("talks about the month as usual with nothing found", () => {
    state.find = null;
    render();
    expect(button().querySelector(".BudgetBuddy__found")).toBeNull();
    act(() => button().click());
    expect(bubble()!.classList.contains("BuddyBubble--find")).toBe(false);
    expect(bubble()!.querySelector("svg")).toBeNull();
    expect(state.markFindSeen).not.toHaveBeenCalled();
  });
});
