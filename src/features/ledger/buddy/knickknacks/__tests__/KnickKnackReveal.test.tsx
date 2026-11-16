import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  markFindSeen: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));
vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("../useUnseenFinds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../useUnseenFinds")>()),
  markFindSeen: (...args: unknown[]) => state.markFindSeen(...args),
}));

import KnickKnackReveal from "../KnickKnackReveal";
import { isLogFind, KnickKnackFind } from "../useUnseenFinds";
import { KNICK_KNACKS } from "../catalog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const find = (item: string, extra: Partial<KnickKnackFind> = {}) =>
  ({ id: `f-${item}`, item, ledgerId: "l1", seenAt: null, ...extra }) as KnickKnackFind;

describe("KnickKnackReveal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.markFindSeen.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const modal = () => document.querySelector(".KnickKnackReveal")!;
  const action = () => modal().querySelector<HTMLButtonElement>(".Modal__footer button")!;

  it("reveals a find with the buddy's line, and marks it seen once shown", () => {
    const onClose = vi.fn();
    act(() =>
      root.render(<KnickKnackReveal userDocId="u1" find={find("acorn")} onClose={onClose} />),
    );
    expect(modal().textContent).toContain("your budget buddy found something!");
    expect(modal().querySelector('svg[aria-label="acorn"]')).not.toBeNull();
    expect(modal().textContent).toContain(KNICK_KNACKS.acorn.found);
    expect(state.markFindSeen).toHaveBeenCalledTimes(1);
    expect(state.markFindSeen).toHaveBeenCalledWith("u1", "f-acorn");

    expect(action().textContent).toMatch(/keep it/i);
    act(() => action().click());
    expect(onClose).toHaveBeenCalled();
  });

  it("names who a gift is from", () => {
    act(() =>
      root.render(
        <KnickKnackReveal
          userDocId="u1"
          find={find("holly", { source: "gift", ledgerId: null })}
          fromName="Mina"
          onClose={() => {}}
        />,
      ),
    );
    expect(modal().textContent).toContain("a gift from Mina");
    expect(modal().textContent).toContain("Mina sent you a holly!");
  });

  it("offers the next one while more are waiting", () => {
    const onNext = vi.fn();
    act(() =>
      root.render(
        <KnickKnackReveal
          userDocId="u1"
          find={find("acorn")}
          remaining={2}
          onNext={onNext}
          onClose={() => {}}
        />,
      ),
    );
    expect(action().textContent).toMatch(/next \(2 more\)/i);
    act(() => action().click());
    expect(onNext).toHaveBeenCalled();
  });

  it("doesn't mark a find that's already been seen", () => {
    act(() =>
      root.render(
        <KnickKnackReveal
          userDocId="u1"
          find={find("acorn", { seenAt: { toMillis: () => 1 } as KnickKnackFind["seenAt"] })}
          onClose={() => {}}
        />,
      ),
    );
    expect(state.markFindSeen).not.toHaveBeenCalled();
  });
});

describe("isLogFind", () => {
  it("is true for seasonal finds and coins, which a log's buddy can show", () => {
    expect(isLogFind(find("acorn"))).toBe(true);
    expect(isLogFind(find("silver_coin", { source: "milestone" }))).toBe(true);
  });

  it("is false for app-wide milestones, special items and gifts", () => {
    expect(isLogFind(find("friendship_bracelet", { source: "milestone" }))).toBe(false);
    expect(isLogFind(find("heart_leaf", { source: "milestone" }))).toBe(false);
    expect(isLogFind(find("mini_robot_charm", { source: "special" }))).toBe(false);
    expect(isLogFind(find("acorn", { source: "gift" }))).toBe(false);
  });
});
