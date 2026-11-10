import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import dayjs from "@/utils/configuredDayjs";
import type { Ledger } from "@/types/ledger";

const state = vi.hoisted(() => ({
  now: "2026-11-15T12:00:00Z",
  byMonth: {} as Record<string, unknown>,
  isSuccess: true,
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

import { BudgetBuddy, CLICK_FACE_MS } from "../BudgetBuddy";
import { FACES } from "../faces";

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

  it("perks up on mouse hover, not on touch", () => {
    render();
    point("pointerover", "touch");
    expect(FACES.alarmed.resting).toContain(face());
    point("pointerover");
    expect(face()).toBe(FACES.alarmed.hover);
    point("pointerout");
    expect(FACES.alarmed.resting).toContain(face());
  });

  it("reacts to a click and says something in a speech bubble", () => {
    render();
    act(() => button()!.click());
    expect(face()).toBe(FACES.alarmed.click);
    const bubble = document.querySelector(".BuddyBubble");
    expect(bubble).not.toBeNull();
    expect(bubble!.textContent!.length).toBeGreaterThan(0);
    expect(button()!.getAttribute("aria-expanded")).toBe("true");

    act(() => vi.advanceTimersByTime(CLICK_FACE_MS));
    expect(FACES.alarmed.resting).toContain(face());

    act(() => button()!.click());
    expect(document.querySelector(".BuddyBubble")).toBeNull();
  });

  it("sleeps at night in the viewer's timezone", () => {
    state.now = "2026-11-15T02:00:00Z";
    render();
    expect(face()).toBe(FACES.asleep.resting[0]);
    act(() => button()!.click());
    expect(face()).toBe(FACES.asleep.click);
    expect(document.querySelector(".BuddyBubble")!.textContent).toMatch(/zzz|five more|yawn/);
  });

  it("is idle in a month with nothing logged", () => {
    state.byMonth = {};
    render();
    expect(face()).toBe(FACES.idle.resting[0]);
  });
});
