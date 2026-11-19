import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  friends: [] as string[],
  isLoading: false,
}));
vi.mock("../useFriendsByActivity", () => ({
  useFriendsByActivity: () => ({ friends: state.friends, isLoading: state.isLoading }),
}));
vi.mock("@/hooks/useProfiles", () => ({
  useProfiles: (ids: string[]) => ({
    profiles: new Map(ids.map((id) => [id, { id, displayName: id.toUpperCase(), avatar: null }])),
    isLoading: false,
  }),
}));
vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user: { id: "me" } }) }));

import { DASHBOARD_FRIENDS, DashboardFriends } from "../DashboardFriends";
import { orderFriends } from "@/utils/friends";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("orderFriends", () => {
  it("follows the server's order, adding new friends at the end and dropping old ones", () => {
    expect(orderFriends(["a", "b", "c", "d"], ["c", "x", "a"])).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps the usual order without one", () => {
    expect(orderFriends(["a", "b"], null)).toEqual(["a", "b"]);
  });
});

describe("DashboardFriends", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.friends = [];
    state.isLoading = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = () =>
    act(() =>
      root.render(
        <MemoryRouter>
          <DashboardFriends />
        </MemoryRouter>,
      ),
    );
  const names = () =>
    [...container.querySelectorAll(".DashboardFriends__list .ProfileLink__name")].map(
      (n) => n.textContent,
    );

  it("lists friends in the order given, without saying what the order is", () => {
    state.friends = ["b", "a", "c"];
    render();
    expect(names()).toEqual(["B", "A", "C"]);
    expect(container.textContent).not.toMatch(/recent|signed|active|last/i);
  });

  it("caps the list and links to the rest", () => {
    state.friends = Array.from({ length: DASHBOARD_FRIENDS + 3 }, (_, i) => `f${i}`);
    render();
    expect(names()).toHaveLength(DASHBOARD_FRIENDS);
    expect(container.textContent).toContain("and 3 more");
  });

  it("invites someone when there are no friends yet", () => {
    render();
    expect(container.textContent).toContain("no friends yet");
    expect(container.querySelector('a[href="/me#friends"]')).not.toBeNull();
  });

  it("holds back until the order is in, so the list doesn't jump", () => {
    state.friends = ["a", "b"];
    state.isLoading = true;
    render();
    expect(names()).toEqual([]);
  });
});
