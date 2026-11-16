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
vi.mock("@/features/gifts/GiftModal", () => ({ default: () => <div>gift modal</div> }));

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

  const render = (ledgers: Ledger[] = []) =>
    act(() =>
      root.render(
        <MemoryRouter>
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

  it("offers giving only with a friend and something giftable", () => {
    state.finds = [find("f1", "acorn", true)];
    render();
    expect(container.querySelector(".KnickKnackDrawer__give")).toBeNull();

    state.friends = ["mina"];
    render();
    act(() => container.querySelector<HTMLButtonElement>(".KnickKnackDrawer__give")!.click());
    expect(container.textContent).toContain("gift modal");
  });
});
