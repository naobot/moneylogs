import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const { updateUserFields, hasEntries } = vi.hoisted(() => ({
  updateUserFields: vi.fn(async () => undefined),
  hasEntries: { value: false as boolean | undefined },
}));

let user: Record<string, unknown> | undefined;

vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user }) }));
vi.mock("@/hooks/useUserQuery", () => ({ updateUserFields }));
vi.mock("@/hooks/useLedgerHasEntries", () => ({ useLedgerHasEntries: () => hasEntries.value }));
vi.mock("firebase/firestore", () => ({ serverTimestamp: () => "<now>" }));

import { LedgerTourProvider, useLedgerTour } from "@/features/ledger/tour/LedgerTour";
import { LEDGER_TOUR_STEPS } from "@/features/ledger/tour/tourRules";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Targets = () => {
  const { tip } = useLedgerTour();
  return (
    <>
      {LEDGER_TOUR_STEPS.map(({ target }) => (
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
        <LedgerTourProvider ledgerId={ledgerId} enabled={enabled}>
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
    hasEntries.value = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows one tip at a time, in order, then records the tour once", () => {
    render();
    for (const step of LEDGER_TOUR_STEPS) {
      expect(shownAt()).toEqual([step.target]);
      clickTip();
    }
    expect(shownAt()).toEqual([]);
    expect(updateUserFields).toHaveBeenCalledTimes(1);
    expect(updateUserFields).toHaveBeenCalledWith("doc-1", { "tutorials.ledgerTour": "<now>" });
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
    expect(updateUserFields).toHaveBeenCalledTimes(1);
  });

  it("stays off for logs with entries, other logs, other views and finished tours", () => {
    hasEntries.value = true;
    render();
    expect(shownAt()).toEqual([]);

    hasEntries.value = false;
    render("groceries");
    expect(shownAt()).toEqual([]);

    render("personal-u1", false);
    expect(shownAt()).toEqual([]);

    user = { id: "doc-1", userId: "u1", tutorials: { ledgerTour: { seconds: 1 } } };
    render();
    expect(shownAt()).toEqual([]);
  });
});
