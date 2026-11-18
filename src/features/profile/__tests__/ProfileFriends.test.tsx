import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  friends: null as string[] | null,
}));
vi.mock("../useFriendList", () => ({
  useFriendList: () => ({ friends: state.friends, isLoading: false }),
}));
vi.mock("@/hooks/useProfiles", () => ({
  useProfiles: (ids: string[]) => ({
    profiles: new Map(ids.map((id) => [id, { id, displayName: id.toUpperCase(), avatar: null }])),
    isLoading: false,
  }),
}));
vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user: { id: "viewer" } }) }));

import { ProfileFriends } from "../ProfileFriends";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ProfileFriends", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (isMe: boolean) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <ProfileFriends userDocId="owner" isMe={isMe} />
        </MemoryRouter>,
      ),
    );

  it("shows nothing to others when the list is hidden", () => {
    state.friends = null;
    render(false);
    expect(container.textContent).toBe("");
  });

  it("tells the owner their list is hidden, with a link to the setting", () => {
    state.friends = null;
    render(true);
    expect(container.textContent).toContain("hidden from others");
    expect(container.querySelector('a[href="/me#friends"]')).not.toBeNull();
  });

  it("shows avatars only, each linking to the friend's profile", () => {
    state.friends = ["amy", "bo"];
    render(false);
    const links = [...container.querySelectorAll(".ProfileFriends a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/u/amy", "/u/bo"]);
    expect(container.querySelectorAll(".ProfileFriends .Avatar")).toHaveLength(2);
    expect(container.querySelector(".ProfileLink__name")).toBeNull();
    expect(container.textContent).not.toContain("AMY");
  });

  it("says when a shown list is empty", () => {
    state.friends = [];
    render(false);
    expect(container.textContent).toContain("no friends to show yet");
  });
});
