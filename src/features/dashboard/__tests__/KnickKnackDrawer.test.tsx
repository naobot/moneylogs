import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  finds: [] as unknown[],
  isLoading: false,
  friends: [] as string[],
  markFindSeen: vi.fn((..._args: unknown[]) => Promise.resolve()),
  luck: null as string | null,
}));
vi.mock("@/features/ledger/buddy/knickknacks/luck", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/ledger/buddy/knickknacks/luck")>()),
  useLuck: () => state.luck,
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
vi.mock("@/hooks/useProfiles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useProfiles")>()),
  // Like the real hook: only the profiles asked for.
  useProfiles: (ids: ReadonlyArray<string>) => ({
    profiles: new Map(
      ids.includes("mina") ? [["mina", { id: "mina", displayName: "Mina", avatar: null }]] : [],
    ),
    isLoading: false,
  }),
}));
vi.mock("@/features/gifts/GiftModal", () => ({
  default: ({ item, toUserDocId }: { item: string; toUserDocId?: string }) => (
    <div className="mock-gift-modal">
      give {item} to {toUserDocId ?? "anyone"}
    </div>
  ),
}));

import { KnickKnackDrawer, KNICK_KNACK_HELP } from "../KnickKnackDrawer";

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
    state.luck = null;
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

  const render = (url = "/") =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[url]}>
          <KnickKnackDrawer />
        </MemoryRouter>,
      ),
    );
  const alerts = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>(".KnickKnackDrawer__alert"));
  const reveal = () => document.querySelector(".KnickKnackReveal");
  const revealButton = () => reveal()!.querySelector<HTMLButtonElement>(".Modal__footer button")!;

  it("is there even when empty, with a note and a help tip", () => {
    render();
    expect(container.querySelector("h3")!.textContent).toBe("knick-knack drawer");
    expect(container.querySelector(".KnickKnackDrawer__empty")).not.toBeNull();
    act(() => container.querySelector<HTMLButtonElement>(".HelpTip")!.focus());
    expect(document.querySelector('[role="tooltip"]')!.textContent).toBe(KNICK_KNACK_HELP);
  });

  it("shows your luck in words, once there is some", () => {
    render();
    expect(container.querySelector(".KnickKnackDrawer__luck")).toBeNull();
    state.luck = "pretty_lucky";
    render();
    expect(container.querySelector(".KnickKnackDrawer__luck")!.textContent).toBe(
      "luck: pretty lucky",
    );
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

  it("shows one centred alert for everything your buddy has to show, without revealing it", () => {
    state.finds = [find("f1", "tulip", false, "l9")];
    render();
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0].textContent).toBe("your budget buddy has something to show you");
    expect(alerts()[0].closest(".KnickKnackDrawer__alerts")).not.toBeNull();
    expect(alerts()[0].querySelector(".KnickKnackDrawer__alertMark")).not.toBeNull();
    // The buddy's alert hops as a whole.
    expect(alerts()[0].classList.contains("KnickKnackDrawer__alert--bounce")).toBe(true);
    expect(container.querySelector('svg[aria-label="tulip"]')).toBeNull();
  });

  it("reveals finds in a pop-up, marking each seen as it appears, one after another", () => {
    // From a deleted log, and from no log at all: neither matters to the drawer.
    state.finds = [
      find("f1", "heart_leaf", false, "personal-gone"),
      { ...find("f2", "friendship_bracelet", false), ledgerId: null },
    ];
    render();
    expect(alerts()[0].textContent).toBe("your budget buddy has 2 things to show you");

    act(() => alerts()[0].click());
    expect(reveal()!.textContent).toContain("heart-shaped leaf");
    expect(state.markFindSeen).toHaveBeenCalledWith("doc-1", "f1");
    expect(revealButton().textContent).toMatch(/next \(1 more\)/i);

    act(() => revealButton().click());
    expect(reveal()!.textContent).toContain("friendship bracelet");
    expect(state.markFindSeen).toHaveBeenCalledWith("doc-1", "f2");
    expect(revealButton().textContent).toMatch(/keep it/i);

    act(() => revealButton().click());
    expect(reveal()).toBeNull();
  });

  it("shows a gift as an alert naming the friend, and unwraps it in the pop-up", () => {
    state.finds = [
      { ...find("f5", "holly", false), ledgerId: null, source: "gift", giftedBy: "mina" },
    ];
    render();
    expect(alerts().map((a) => a.textContent)).toEqual(["Mina has sent you something!"]);
    expect(alerts()[0].classList.contains("KnickKnackDrawer__alert--bounce")).toBe(false);
    expect(container.querySelector('svg[aria-label="holly"]')).toBeNull();
    expect(container.querySelector(".KnickKnackDrawer__empty")).toBeNull();

    act(() => alerts()[0].click());
    expect(state.markFindSeen).toHaveBeenCalledWith("doc-1", "f5");
    expect(reveal()!.textContent).toContain("a gift from Mina");
    expect(reveal()!.textContent).toContain("Mina sent you a holly!");
  });

  it("keeps naming the friend once the unwrapped gift is marked seen", () => {
    const gift = {
      ...find("f5", "holly", false),
      ledgerId: null,
      source: "gift",
      giftedBy: "mina",
    };
    state.finds = [gift];
    render();
    act(() => alerts()[0].click());

    // The live query delivers seenAt: the gift leaves the unwrapped-gifts list.
    state.finds = [{ ...gift, seenAt: ts(2) }];
    render();
    expect(reveal()!.textContent).toContain("a gift from Mina");
    expect(reveal()!.textContent).not.toContain("deleted user");
  });

  it("makes opened items giftable once you have a friend, gifts included but not milestones", () => {
    state.finds = [
      find("f1", "acorn", true),
      { ...find("f2", "holly", true), source: "gift", giftedBy: "mina", ledgerId: null },
      { ...find("f3", "copper_coin", true), source: "milestone" },
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
      "Give one holly to a friend",
    ]);
    act(() => buttons[0].click());
    expect(container.querySelector(".mock-gift-modal")!.textContent).toBe("give acorn to anyone");
  });

  it("preselects the friend from a profile's send-a-gift link", () => {
    state.friends = ["mina"];
    state.finds = [find("f1", "acorn", true)];
    render("/?giftTo=mina#knickknacks");
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
    render("/?giftTo=stranger");
    expect(container.querySelector(".KnickKnackDrawer__givingTo")).toBeNull();
  });
});
