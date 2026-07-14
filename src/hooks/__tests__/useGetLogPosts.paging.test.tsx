import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { onSnapshot } from "firebase/firestore";
import { useGetLogPosts } from "@/hooks/useGetLogPosts";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("@/hooks/useGetLogPostComments", () => ({ invalidateCommentCache: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  // Carry the requested window size through the query so the onSnapshot mock can
  // report back how many posts a listener at that limit would see.
  limit: vi.fn((n: number) => ({ __limit: n })),
  query: vi.fn((_col, _where, _order, limitRes: { __limit: number }) => ({
    limitValue: limitRes.__limit,
  })),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(() => ({})),
  Unsubscribe: class {},
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Listener = { limit: number; cb: (snapshot: unknown) => void };

// A snapshot of `count` synthetic posts, ordered newest-first like the real query.
const makeSnapshot = (count: number) => ({
  size: count,
  docs: Array.from({ length: count }, (_, i) => ({
    id: `post_${i}`,
    data: () => ({ content: `post ${i}`, latestCommentAt: null }),
  })),
});

let latest: ReturnType<typeof useGetLogPosts>;
const Probe = ({ groupId }: { groupId: string }) => {
  latest = useGetLogPosts({ groupId });
  return null;
};

describe("useGetLogPosts lazy paging", () => {
  let container: HTMLDivElement;
  let root: Root;
  let listeners: Listener[];
  let unsubscribes: number;

  beforeEach(() => {
    listeners = [];
    unsubscribes = 0;

    vi.mocked(onSnapshot).mockImplementation((ref: unknown, cb: unknown) => {
      listeners.push({
        limit: (ref as { limitValue: number }).limitValue,
        cb: cb as Listener["cb"],
      });
      return () => {
        unsubscribes += 1;
      };
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const mount = () => act(() => root.render(<Probe groupId="g1" />));
  const currentListener = () => listeners[listeners.length - 1];

  it("subscribes at the initial 200-post window", () => {
    mount();
    expect(currentListener().limit).toBe(200);
  });

  it("reports hasMore when the window fills, and no more when it doesn't", () => {
    mount();

    act(() => currentListener().cb(makeSnapshot(200)));
    expect(latest.posts).toHaveLength(200);
    expect(latest.hasMore).toBe(true);

    act(() => currentListener().cb(makeSnapshot(180)));
    expect(latest.hasMore).toBe(false);
  });

  it("loadMore expands the window by a page and resubscribes", () => {
    mount();
    act(() => currentListener().cb(makeSnapshot(200)));

    act(() => latest.loadMore());
    expect(latest.isLoadingMore).toBe(true);
    // Old listener torn down, a new one opened at the larger window.
    expect(unsubscribes).toBe(1);
    expect(currentListener().limit).toBe(400);

    act(() => currentListener().cb(makeSnapshot(320)));
    expect(latest.posts).toHaveLength(320);
    expect(latest.hasMore).toBe(false);
    expect(latest.isLoadingMore).toBe(false);
  });

  it("ignores loadMore when there is nothing more to load", () => {
    mount();
    act(() => currentListener().cb(makeSnapshot(50)));
    expect(latest.hasMore).toBe(false);

    const before = listeners.length;
    act(() => latest.loadMore());
    expect(listeners.length).toBe(before);
    expect(latest.isLoadingMore).toBe(false);
  });

  it("does not stack windows when loadMore fires repeatedly in one tick", () => {
    mount();
    act(() => currentListener().cb(makeSnapshot(200)));

    act(() => {
      latest.loadMore();
      latest.loadMore();
      latest.loadMore();
    });

    // Only one expansion, to a single 400-post window.
    expect(currentListener().limit).toBe(400);
    expect(unsubscribes).toBe(1);
  });
});
