import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act, useMemo } from "react";
import { createRoot, Root } from "react-dom/client";

import type { Group as GroupType } from "@/types/user";

// Mutable fixtures the mocked hooks read from, so a test can swap in a fresh Firestore
// snapshot mid-render the way useGetGroupUsers does when its listener fires.
const state = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  viewTracking: undefined as unknown,
  updateViewTrackingFn: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({
    user: { id: "meDoc", userId: "authMe", timezone: "UTC", viewTracking: state.viewTracking },
  }),
}));
vi.mock("@/contexts/TutorialContext", () => ({
  useTutorial: () => ({
    showNewEntryTip: false,
    dismissNewEntryTip: vi.fn(),
    onNewEntryClicked: vi.fn(),
  }),
}));
vi.mock("@/hooks/useReadTracking", () => ({
  useReadTracking: () => ({ trackUserAction: vi.fn() }),
}));
vi.mock("@/hooks/useUserQuery", () => ({
  useUserQuery: () => ({ updateViewTrackingFn: state.updateViewTrackingFn }),
}));
vi.mock("@/hooks/useGetLogPosts", () => ({
  useGetLogPosts: () => ({ posts: [], isLoading: false, isSuccess: true, isError: false }),
}));
vi.mock("@/hooks/useGetGroupUsers", () => ({
  useGetGroupUsers: () => {
    const users = state.users;
    // Mirrors the real hook: the map is memoized on the users array, so its identity
    // changes exactly when the member data does.
    const userIdToDocRefMap = useMemo(
      () => new Map(users.map((u) => [u.userId as string, u.id as string])),
      [users],
    );
    return { users, isLoading: false, userIdToDocRefMap, error: null };
  },
}));

// Stand in for the nav so a test can pick a member without dnd-kit in the way.
vi.mock("@/features/moneylog/components/LogsMenu", () => ({
  default: ({
    logMembers,
    onChangeUser,
  }: {
    logMembers: Array<{ id: string }>;
    onChangeUser: (u: unknown) => void;
  }) => (
    <div>
      {logMembers.map((m) => (
        <button key={m.id} data-testid={`view-${m.id}`} onClick={() => onChangeUser(m)}>
          {m.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/features/moneylog/components/ActiveLog", () => ({ ActiveLog: () => null }));
vi.mock("@/features/moneylog/components/LogsSummary/LogsSummary", () => ({ default: () => null }));
vi.mock("@/components/Modal", () => ({ default: () => null }));
vi.mock("@/components/TutorialTooltip", () => ({ default: () => null }));
vi.mock("@/features/layout/components/CopyTextArea", () => ({ default: () => null }));
vi.mock("@/components/Icon", () => ({
  default: () => null,
  IconText: () => null,
}));

import { Group } from "@/features/moneylog/components/Group";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GROUP_ID = "g1";
const DAY = 86_400_000;
const stamp = (date: Date) => ({
  toDate: () => date,
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

// An active group: started yesterday, ends well beyond the "ending soon" warning window.
const group = {
  start: stamp(new Date(Date.now() - DAY)),
  end: stamp(new Date(Date.now() + 30 * DAY)),
  members: [{ id: "meDoc" }, { id: "m2Doc" }],
  max_participants: 5,
} as unknown as GroupType;

const me = { id: "meDoc", userId: "authMe", displayName: "Me" };
// The shape useGetGroupUsers puts in state on a localStorage cache hit: CacheableUserData
// omits lastUpdated, so nothing looks unread yet.
const cachedMember2 = { id: "m2Doc", userId: "auth2", displayName: "Two" };
// The shape once the real Firestore snapshot lands.
const freshMember2 = { ...cachedMember2, lastUpdated: { [GROUP_ID]: { seconds: 1000 } } };

describe("Group — view tracking writes", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = () =>
    act(() => {
      root.render(<Group group={group} groupId={GROUP_ID} isSpectator={false} />);
    });

  const clickMember2 = () =>
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="view-m2Doc"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

  beforeEach(() => {
    state.updateViewTrackingFn = vi.fn(() => Promise.resolve());
    state.viewTracking = {};
    state.users = [me, freshMember2];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("marks a member's log as viewed when it has unread posts", () => {
    render();
    clickMember2();

    expect(state.updateViewTrackingFn).toHaveBeenCalledTimes(1);
    expect(state.updateViewTrackingFn).toHaveBeenCalledWith({
      userId: "meDoc",
      logGroupId: GROUP_ID,
      viewedUserId: "m2Doc",
    });
  });

  it("does not write when the user is already caught up on that member", () => {
    state.viewTracking = { [GROUP_ID]: { m2Doc: { lastViewedAt: { seconds: 2000 } } } };
    render();
    clickMember2();

    expect(state.updateViewTrackingFn).not.toHaveBeenCalled();
  });

  it("does not write again while a previous mark-as-viewed is still pending", () => {
    // Firestore surfaces the not-yet-acked serverTimestamp() as null.
    state.viewTracking = { [GROUP_ID]: { m2Doc: { lastViewedAt: null } } };
    render();
    clickMember2();

    expect(state.updateViewTrackingFn).not.toHaveBeenCalled();
  });

  it("never writes for the user's own log", () => {
    render();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="view-meDoc"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(state.updateViewTrackingFn).not.toHaveBeenCalled();
  });

  // The regression. Tapping a member during the cache-paint window used to skip the
  // write — lastUpdated is absent, so the guard reads "nothing new" — and the effect
  // never retried once the real snapshot arrived, leaving the bell lit on a log the
  // user had already read.
  it("retries the write when the real member snapshot lands after a cached paint", () => {
    state.users = [me, cachedMember2];
    render();
    clickMember2();

    // Cached members carry no lastUpdated, so there is nothing to mark as read yet.
    expect(state.updateViewTrackingFn).not.toHaveBeenCalled();

    // The Firestore listener fires with the real member docs. displayUser is unchanged,
    // so only the `members` dependency can drive the retry.
    state.users = [me, freshMember2];
    render();

    expect(state.updateViewTrackingFn).toHaveBeenCalledTimes(1);
    expect(state.updateViewTrackingFn).toHaveBeenCalledWith({
      userId: "meDoc",
      logGroupId: GROUP_ID,
      viewedUserId: "m2Doc",
    });
  });
});
