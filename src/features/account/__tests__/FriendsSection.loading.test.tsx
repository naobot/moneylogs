import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  profiles: new Map<string, { id: string; displayName: string; avatar: null }>(),
  profilesLoading: true,
}));
vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));
vi.mock("@/hooks/useUserQuery", () => ({ updateUserFields: vi.fn() }));
vi.mock("@/hooks/useFriendships", () => ({
  useFriendships: () => ({
    friends: ["mina", "gone"],
    incoming: [],
    outgoing: [],
    entries: [
      { userDocId: "mina", state: "friends" },
      { userDocId: "gone", state: "friends" },
    ],
    isLoading: false,
  }),
  removeFriend: vi.fn(),
  respondFriend: vi.fn(),
}));
vi.mock("@/hooks/useProfiles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useProfiles")>()),
  useProfiles: () => ({ profiles: state.profiles, isLoading: state.profilesLoading }),
}));
vi.mock("@/features/profile/useFriendAction", () => ({
  useFriendAction: () => ({ run: vi.fn(), pending: null }),
}));
vi.mock("@/features/invites/InviteLink", () => ({ default: () => null }));
vi.mock("@/features/profile/ProfileLink", () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { FriendsSection } from "../FriendsSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("FriendsSection names", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => act(() => root.unmount()));

  const render = () =>
    act(() =>
      root.render(
        <MemoryRouter>
          <FriendsSection />
        </MemoryRouter>,
      ),
    );
  const names = () =>
    [...container.querySelectorAll(".ProfileLink__name")].map((el) => el.textContent);

  it('shows a placeholder, not "deleted user", while profiles load', () => {
    state.profiles = new Map();
    state.profilesLoading = true;
    render();
    expect(container.querySelectorAll(".ProfileLink__name .LoadingDots")).toHaveLength(2);
    expect(names().join(" ")).not.toContain("deleted user");
  });

  it('names a missing profile "deleted user" once they\'ve loaded', () => {
    state.profiles = new Map([["mina", { id: "mina", displayName: "Mina", avatar: null }]]);
    state.profilesLoading = false;
    render();
    expect(names()).toEqual(["Mina", "deleted user"]);
  });
});
