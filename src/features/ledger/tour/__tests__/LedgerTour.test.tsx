import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const { recordLedgerTour } = vi.hoisted(() => ({
  recordLedgerTour: vi.fn(async () => undefined),
}));

let user: Record<string, unknown> | undefined;

vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user }) }));
vi.mock("@/hooks/useUserQuery", () => ({ recordLedgerTour }));

import { LedgerTourProvider, useLedgerTour } from "@/features/ledger/tour/LedgerTour";
import { ledgerTourSteps, TOUR_NEW_LOGS_SINCE } from "@/features/ledger/tour/tourRules";

const STEPS = ledgerTourSteps(true);
const OLD = { toMillis: () => TOUR_NEW_LOGS_SINCE - 1 };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Targets = () => {
  const { tip } = useLedgerTour();
  return (
    <>
      {STEPS.map(({ target }) => (
        <div key={target} data-target={target}>
          {tip(target)}
        </div>
      ))}
    </>
  );
};

describe("LedgerTourProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (ledgerId = "personal-u1", enabled = true) =>
    act(() =>
      root.render(
        <LedgerTourProvider ledger={{ id: ledgerId, createdAt: OLD as never }} enabled={enabled}>
          <Targets />
        </LedgerTourProvider>,
      ),
    );

  // The bubble is portalled to <body>; the marker it leaves behind shows which target owns it.
  const shownAt = () =>
    Array.from(container.querySelectorAll("[data-target]"))
      .filter((el) => el.querySelector("span[hidden]"))
      .map((el) => el.getAttribute("data-target"));

  const clickTip = () =>
    act(() => document.querySelector<HTMLElement>(".TutorialTooltip")!.click());

  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: "doc-1", userId: "u1" };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows one tip at a time, in order, then records the tour for that log once", () => {
    render();
    for (const step of STEPS) {
      expect(shownAt()).toEqual([step.target]);
      clickTip();
    }
    expect(shownAt()).toEqual([]);
    expect(recordLedgerTour).toHaveBeenCalledTimes(1);
    expect(recordLedgerTour).toHaveBeenCalledWith("doc-1", "personal-u1");
  });

  it("renders one bubble, outside any clipping container", () => {
    render();
    const bubbles = document.querySelectorAll(".TutorialTooltip");
    expect(bubbles).toHaveLength(1);
    expect(container.contains(bubbles[0])).toBe(false);
  });

  it("can be skipped from any tip", () => {
    render();
    clickTip();
    act(() => document.querySelector<HTMLElement>(".TutorialTooltip__skip")!.click());
    expect(shownAt()).toEqual([]);
    expect(recordLedgerTour).toHaveBeenCalledTimes(1);
  });

  it("stays off for older shared logs, other views and logs already toured", () => {
    render("groceries");
    expect(shownAt()).toEqual([]);

    render("personal-u1", false);
    expect(shownAt()).toEqual([]);

    user = { id: "doc-1", userId: "u1", tutorials: { ledgerTours: { "personal-u1": 1 } } };
    render();
    expect(shownAt()).toEqual([]);
  });

  it("runs for people who finished the old one-per-account tour", () => {
    user = { id: "doc-1", userId: "u1", tutorials: { ledgerTour: { seconds: 1 } } };
    render();
    expect(shownAt()).toEqual([STEPS[0].target]);
  });
});
