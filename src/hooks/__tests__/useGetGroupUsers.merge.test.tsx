import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { onSnapshot } from "firebase/firestore";
import { useGetGroupUsers, getCachedUsers, type FullUserData } from "@/hooks/useGetGroupUsers";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  // Carry the queried chunk through so the onSnapshot mock knows which members it covers
  where: vi.fn((_field: string, _op: string, value: string[]) => ({ value })),
  query: vi.fn((_col: unknown, whereRes: { value: string[] }) => ({ chunk: whereRes.value })),
  onSnapshot: vi.fn(),
  // Tag the group doc ref so the onSnapshot mock can tell the group listener apart
  // from the per-chunk user listeners.
  doc: vi.fn(() => ({ __group: true })),
  DocumentSnapshot: class {},
}));

const GROUP_ID = "group_big";

// 12 members => two chunks (10 + 2). "m0" stands in for "my own log".
const MEMBER_IDS = Array.from({ length: 12 }, (_, i) => `m${i}`);

type ChunkListener = { chunk: string[]; cb: (snapshot: unknown) => void };

const makeSnapshot = (chunk: string[], extra?: (id: string) => Record<string, unknown>) => ({
  forEach: (fn: (doc: { id: string; data: () => unknown }) => void) => {
    chunk.forEach((id) =>
      fn({
        id,
        data: () => ({
          userId: `auth_${id}`,
          displayName: id,
          email: `${id}@example.com`,
          groups: [GROUP_ID],
          ...(extra ? extra(id) : {}),
        }),
      }),
    );
  },
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latestUsers: FullUserData[] = [];
let renderCount = 0;
const Probe = ({ groupId }: { groupId: string }) => {
  const { users } = useGetGroupUsers(groupId);
  latestUsers = users;
  renderCount += 1;
  return null;
};

describe("useGetGroupUsers chunk merge", () => {
  let container: HTMLDivElement;
  let root: Root;
  let chunkListeners: ChunkListener[];
  let groupListener: ((snapshot: unknown) => void) | null;

  beforeEach(() => {
    localStorage.clear();
    latestUsers = [];
    renderCount = 0;
    chunkListeners = [];
    groupListener = null;

    vi.mocked(onSnapshot).mockImplementation((ref: unknown, cb: unknown) => {
      if ((ref as { __group?: boolean })?.__group) {
        groupListener = cb as (snapshot: unknown) => void;
      } else {
        chunkListeners.push({
          chunk: (ref as { chunk: string[] }).chunk,
          cb: cb as ChunkListener["cb"],
        });
      }
      return vi.fn();
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

  const mount = () => {
    act(() => {
      root.render(<Probe groupId={GROUP_ID} />);
    });
  };

  // Simulate the group document reporting a membership list; this synchronously
  // (re)registers the per-chunk user listeners.
  const deliverMembers = (members: string[]) => {
    chunkListeners = [];
    act(() => groupListener!({ data: () => ({ members }) }));
  };

  const fireChunks = (listeners: ChunkListener[]) => {
    listeners.forEach((l) => act(() => l.cb(makeSnapshot(l.chunk))));
  };

  it("keeps all members when a later chunk's snapshot arrives before an earlier one", () => {
    mount();
    deliverMembers(MEMBER_IDS);

    const firstChunk = chunkListeners.find((l) => l.chunk.includes("m0"))!;
    const secondChunk = chunkListeners.find((l) => l.chunk.includes("m11"))!;

    // Reverse arrival: the second chunk (with m10, m11) reports first
    act(() => secondChunk.cb(makeSnapshot(secondChunk.chunk)));
    act(() => firstChunk.cb(makeSnapshot(firstChunk.chunk)));

    expect(latestUsers.map((u) => u.id).sort()).toEqual([...MEMBER_IDS].sort());
    // The second-chunk members must survive the first chunk landing afterwards
    expect(latestUsers.some((u) => u.id === "m11")).toBe(true);
  });

  it("does not cache a partial member list before every chunk has reported", () => {
    mount();
    deliverMembers(MEMBER_IDS);

    const secondChunk = chunkListeners.find((l) => l.chunk.includes("m11"))!;
    act(() => secondChunk.cb(makeSnapshot(secondChunk.chunk)));

    // Only one of two chunks has reported — nothing should be cached yet
    expect(getCachedUsers(GROUP_ID)).toBeNull();

    const firstChunk = chunkListeners.find((l) => l.chunk.includes("m0"))!;
    act(() => firstChunk.cb(makeSnapshot(firstChunk.chunk)));

    const cached = getCachedUsers(GROUP_ID);
    expect(cached).not.toBeNull();
    expect(cached!.map((u) => u.id).sort()).toEqual([...MEMBER_IDS].sort());
  });

  it("adds a member that a stale initial read omitted, without a remount", () => {
    mount();

    // The initial group read is missing the current user's own log ("m0")
    const staleMembers = MEMBER_IDS.filter((id) => id !== "m0");
    deliverMembers(staleMembers);
    fireChunks(chunkListeners);
    expect(latestUsers.some((u) => u.id === "m0")).toBe(false);

    // The live group listener later reports the full membership; the hook must pick
    // up the newly present own-log without the component remounting.
    deliverMembers(MEMBER_IDS);
    fireChunks(chunkListeners);
    expect(latestUsers.some((u) => u.id === "m0")).toBe(true);
    expect(latestUsers.map((u) => u.id).sort()).toEqual([...MEMBER_IDS].sort());
  });

  it("ignores snapshots that only change churny fields, but reflects real changes", () => {
    mount();
    deliverMembers(["m0", "m1"]);
    const chunk = chunkListeners[0];

    act(() => chunk.cb(makeSnapshot(["m0", "m1"], () => ({ viewTracking: { g: 1 } }))));
    const usersAfterFirst = latestUsers;
    const rendersAfterFirst = renderCount;

    // Same profile data, only viewTracking differs — no re-render, same array
    act(() => chunk.cb(makeSnapshot(["m0", "m1"], () => ({ viewTracking: { g: 2 } }))));
    expect(latestUsers).toBe(usersAfterFirst);
    expect(renderCount).toBe(rendersAfterFirst);

    // A real profile change (displayName) must still propagate
    act(() =>
      chunk.cb(
        makeSnapshot(["m0", "m1"], (id) => ({
          viewTracking: { g: 2 },
          displayName: id === "m0" ? "Renamed" : id,
        })),
      ),
    );
    expect(latestUsers).not.toBe(usersAfterFirst);
    expect(latestUsers.find((u) => u.id === "m0")!.displayName).toBe("Renamed");
    expect(renderCount).toBeGreaterThan(rendersAfterFirst);
  });
});
