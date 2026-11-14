import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

let activity: Record<string, number> = {};
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-1", userId: "uid-1", timezone: "UTC" } }),
}));
vi.mock("@/hooks/useLogActivity", () => ({
  useLogActivity: () => ({ activity, isLoading: false }),
}));
vi.mock("@/hooks/useLedgerMonthTotals", () => ({
  useLedgerMonthTotals: () => ({ l1: { JPY: 12000 } }),
}));

import { Dashboard } from "@/features/dashboard/Dashboard";
import type { Group } from "@/types/user";
import type { Ledger } from "@/types/ledger";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 86_400_000;
const at = (ms: number) => ({ toDate: () => new Date(ms), seconds: ms / 1000 });
const group = (id: string, startOffsetDays: number, endOffsetDays: number) =>
  ({
    id,
    title: id,
    members: [{ id: "doc-1" }, { id: "doc-2" }],
    start: at(Date.now() + startOffsetDays * DAY),
    end: at(Date.now() + endOffsetDays * DAY),
  }) as unknown as Group;
const ledger = { id: "l1", title: "Household", memberUids: ["uid-1"] } as unknown as Ledger;

describe("Dashboard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    activity = {};
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (groups: Group[], ledgers: Ledger[] = []) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <Dashboard groups={groups} ledgers={ledgers} />
        </MemoryRouter>,
      ),
    );
  const cards = (size: string) =>
    Array.from(container.querySelectorAll<HTMLAnchorElement>(`.LogCard--${size}`));

  it("sizes cards by how current they are", () => {
    const past = [1, 2, 3, 4].map((n) => group(`past${n}`, -30 - n, -10 - n));
    render([group("tokyo", -2, 5), group("seoul", 10, 20), ...past], [ledger]);

    expect(cards("large").map((c) => c.getAttribute("href"))).toEqual(["/g/tokyo", "/l/l1"]);
    expect(cards("small").map((c) => c.getAttribute("href"))).toEqual(["/g/seoul"]);
    expect(cards("compact")).toHaveLength(3);
    const seeAll = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("see all 4 in my logs"),
    );
    expect(seeAll?.getAttribute("href")).toBe("/me#logs");
  });

  it("previews this month's spending and members on a financial card", () => {
    render([], [ledger]);
    const [card] = cards("large");
    expect(card.textContent).toContain("12,000 JPY");
    expect(card.textContent).toContain("just you");
  });

  it("badges and highlights logs with new activity from others", () => {
    activity = { tokyo: 3 };
    render([group("tokyo", -2, 5), group("osaka", -1, 6)]);
    const [tokyo, osaka] = cards("large");
    expect(tokyo.className).toContain("LogCard--fresh");
    expect(tokyo.querySelector(".LogCard__badge")?.textContent).toBe("3 new posts");
    expect(tokyo.getAttribute("aria-label")).toBe("tokyo — 3 new posts");
    expect(osaka.querySelector(".LogCard__badge")).toBeNull();
  });

  it("hides empty optional sections", () => {
    render([group("tokyo", -2, 5)]);
    expect(container.textContent).not.toContain("Coming up");
    expect(container.textContent).not.toContain("Recently ended");
  });
});
