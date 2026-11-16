import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  finds: [] as unknown[],
  isLoading: false,
  friends: [] as string[],
  markFindSeen: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-1", userId: "uid-1", timezone: "UTC" } }),
}));
vi.mock("@/features/ledger/buddy/knickknacks/useUnseenFinds", () => ({
  useKnickKnackFinds: () => ({ data: state.finds, isLoading: state.isLoading }),
  markFindSeen: (...args: unknown[]) => state.markFindSeen(...args),
}));
vi.mock("@/hooks/useFriendships", () => ({
  useFriendships: () => ({ friends: state.friends }),
}));
vi.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => new Map([["mina", { id: "mina", displayName: "Mina", avatar: null }]]),
}));
vi.mock("@/features/gifts/GiftModal", () => ({
  default: ({ item, toUserDocId }: { item: string; toUserDocId?: string }) => (
    <div className="mock-gift-modal">
      give {item} to {toUserDocId ?? "anyone"}
    </div>
  ),
}));

import { KnickKnackDrawer, KNICK_KNACK_HELP } from "../KnickKnackDrawer";
import type { Ledger } from "@/types/ledger";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ts = (ms: number) => ({ toMillis: () => ms });
const find = (id: string, item: string, seen: boolean, ledgerId = "l1") => ({
  id,
  item,
  ledgerId,
  foundAt: ts(Number(id.slice(1))),
  seenAt: seen ? ts(1) : null,
});

describe("KnickKnackDrawer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.finds = [];
    state.isLoading = false;
    state.friends = [];
    state.markFindSeen.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll(".HelpTip__panel").forEach((el) => el.remove());
  });

  const render = (ledgers: Ledger[] = [], url = "/") =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[url]}>
          <KnickKnackDrawer ledgers={ledgers} />
        </MemoryRouter>,
      ),
    );

  it("is there even when empty, with a note and a help tip", () => {
    render();
    expect(container.querySelector("h3")!.textContent).toBe("knick-knack drawer");
    expect(container.querySelector(".KnickKnackDrawer__empty")).not.toBeNull();
    act(() => container.querySelector<HTMLButtonElement>(".HelpTip")!.focus());
    expect(document.querySelector('[role="tooltip"]')!.textContent).toBe(KNICK_KNACK_HELP);
  });

  it("holds back the empty note while loading", () => {
    state.isLoading = true;
    render();
    expect(container.querySelector(".KnickKnackDrawer__empty")).toBeNull();
  });

  it("shows each kept item once, with how many", () => {
    state.finds = [find("f1", "acorn", true), find("f2", "acorn", true), find("f3", "holly", true)];
    render();
    const items = Array.from(container.querySelectorAll(".KnickKnackDrawer__item"));
    expect(items.map((li) => li.querySelector("svg")!.getAttribute("aria-label"))).toEqual([
      "acorn",
      "holly",
    ]);
    expect(items[0].textContent).toContain("×2");
    expect(items[1].textContent).not.toContain("×");
    expect(container.querySelector(".KnickKnackDrawer__empty")).toBeNull();
  });

  it("points to the log whose buddy has an unshown find, without revealing it", () => {
    state.finds = [find("f1", "tulip", false, "l9")];
    render([{ id: "l9", title: "Household" } as Ledger]);
    const link = container.querySelector<HTMLAnchorElement>(".KnickKnackDrawer__waiting")!;
    expect(link.getAttribute("href")).toBe("/l/l9");
    expect(link.textContent).toContain("in Household has something to show you");
    expect(container.querySelector('svg[aria-label="tulip"]')).toBeNull();
  });

  it("points a find from a deleted log to a log you still have", () => {
    state.finds = [find("f1", "heart_leaf", false, "personal-gone")];
    render([{ id: "l9", title: "Household" } as Ledger]);
    const link = container.querySelector<HTMLAnchorElement>(".KnickKnackDrawer__waiting")!;
    expect(link.getAttribute("href")).toBe("/l/l9");
  });

  it("opens a find in place when you have no financial log for it to point to", () => {
    state.finds = [find("f2", "heart_leaf", false, "personal-gone")];
    render([]);
    expect(container.querySelector("a.KnickKnackDrawer__waiting")).toBeNull();
    const open = container.querySelector<HTMLButtonElement>("button.KnickKnackDrawer__waiting")!;
    expect(open.textContent).toContain("left something for you");

    act(() => open.click());
    expect(state.markFindSeen).toHaveBeenCalledWith("doc-1", "f2");
    const unwrapped = container.querySelector(".KnickKnackDrawer__unwrapped")!.textContent;
    expect(unwrapped).toContain("you unwrapped heart-shaped leaf");
    expect(unwrapped).not.toContain(" from ");
  });

  it("shows a wrapped gift by who sent it, and unwraps it in place", () => {
    state.finds = [
      { ...find("f5", "holly", false), ledgerId: null, source: "gift", giftedBy: "mina" },
    ];
    render();
    const gift = container.querySelector<HTMLButtonElement>(".KnickKnackDrawer__gift")!;
    expect(gift.textContent).toContain("a gift from Mina");
    expect(container.querySelector('svg[aria-label="holly"]')).toBeNull();
    expect(container.querySelector(".KnickKnackDrawer__empty")).toBeNull();

    act(() => gift.click());
    expect(state.markFindSeen).toHaveBeenCalledWith("doc-1", "f5");
    expect(container.querySelector(".KnickKnackDrawer__unwrapped")!.textContent).toContain(
      "holly from Mina",
    );
  });

  it("makes found items giftable once you have a friend; gifts you got are not", () => {
    state.finds = [
      find("f1", "acorn", true),
      { ...find("f2", "holly", true), source: "gift", giftedBy: "mina", ledgerId: null },
    ];
    render();
    expect(container.querySelector(".KnickKnackDrawer__item--giftable")).toBeNull();

    state.friends = ["mina"];
    render();
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".KnickKnackDrawer__item--giftable"),
    );
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Give one acorn to a friend",
    ]);
    act(() => buttons[0].click());
    expect(container.querySelector(".mock-gift-modal")!.textContent).toBe("give acorn to anyone");
  });

  it("preselects the friend from a profile's send-a-gift link", () => {
    state.friends = ["mina"];
    state.finds = [find("f1", "acorn", true)];
    render([], "/?giftTo=mina#knickknacks");
    expect(container.querySelector(".KnickKnackDrawer__givingTo")!.textContent).toContain(
      "pick something to give to Mina",
    );
    act(() =>
      container.querySelector<HTMLButtonElement>(".KnickKnackDrawer__item--giftable")!.click(),
    );
    expect(container.querySelector(".mock-gift-modal")!.textContent).toBe("give acorn to mina");
  });

  it("ignores a giftTo that isn't a friend", () => {
    state.friends = ["mina"];
    state.finds = [find("f1", "acorn", true)];
    render([], "/?giftTo=stranger");
    expect(container.querySelector(".KnickKnackDrawer__givingTo")).toBeNull();
  });
});
