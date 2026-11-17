import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  unreadPostsFor: new Set<string>(),
  unreadCommentsOn: new Set<string>(),
  dragEnabled: true,
}));

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "me", viewTracking: {} } }),
}));
vi.mock("@/utils/unread", () => ({
  memberHasUnreadPosts: ({ member }: { member: { id: string } }) =>
    state.unreadPostsFor.has(member.id),
  postHasUnreadComments: (post: { id: string }) => state.unreadCommentsOn.has(post.id),
}));
vi.mock("@/hooks/useDragReorderEnabled", () => ({ default: () => state.dragEnabled }));
vi.mock("@/platform", () => ({ storage: { getJSON: () => null, setJSON: () => {} } }));
vi.mock("@/features/profile/MemberAvatarLink", () => ({
  default: ({ name }: { name?: string }) => <span className="mock-avatar">{name}</span>,
}));

import LogsMenu from "../LogsMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const members = [
  { id: "me", displayName: "Me" },
  { id: "mina", displayName: "Mina" },
  { id: "sam", displayName: "Sam" },
] as never[];
const posts = [
  { id: "p-me", author: { id: "me" } },
  { id: "p-mina", author: { id: "mina" } },
  { id: "p-sam", author: { id: "sam" } },
] as never[];

describe("LogsMenu member rows", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.unreadPostsFor = new Set();
    state.unreadCommentsOn = new Set();
    state.dragEnabled = true;
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
        <LogsMenu
          displaySummary={false}
          displayAll
          logMembers={members}
          logPosts={posts}
          onChangeUser={() => {}}
          onViewSummary={() => {}}
          groupId="g1"
          isReadOnly={false}
        />,
      ),
    );
  const row = (name: string) =>
    Array.from(container.querySelectorAll<HTMLElement>(".LogsMenu__item")).find((el) =>
      el.querySelector(".mock-avatar")?.textContent?.includes(name),
    )!;
  const badge = (name: string) => row(name).querySelector(".LogsMenu__item__badge");

  it("shows new activity as a chip on the avatar and the fresh frame, nothing beside it", () => {
    state.unreadPostsFor = new Set(["mina"]);
    state.unreadCommentsOn = new Set(["p-sam"]);
    render();

    expect(row("Mina").querySelector(".LogsMenu__item__avatar .LogsMenu__item__badge")).not.toBe(
      null,
    );
    expect(badge("Mina")!.textContent).toBe("new posts");
    expect(row("Mina").classList).toContain("LogsMenu__item--fresh");

    expect(badge("Sam")!.textContent).toBe("new comments");
    expect(row("Sam").classList).toContain("LogsMenu__item--fresh");

    // No loose icons left in the row itself.
    expect(row("Mina").querySelectorAll(":scope > .Icon")).toHaveLength(0);
  });

  it("shows one chip when a member has both new posts and new comments", () => {
    state.unreadPostsFor = new Set(["mina"]);
    state.unreadCommentsOn = new Set(["p-mina"]);
    render();
    expect(row("Mina").querySelectorAll(".LogsMenu__item__badge")).toHaveLength(1);
    expect(badge("Mina")!.textContent).toBe("new posts");
  });

  it("leaves quiet rows plain", () => {
    render();
    expect(badge("Mina")).toBeNull();
    expect(row("Mina").classList).not.toContain("LogsMenu__item--fresh");
  });

  it("only renders the drag grip when reordering is possible", () => {
    render();
    expect(row("Mina").querySelector(".LogsMenu__item__dragHandle")).not.toBeNull();

    state.dragEnabled = false;
    render();
    expect(row("Mina").querySelector(".LogsMenu__item__dragHandle")).toBeNull();
  });
});
