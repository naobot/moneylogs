import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  friends: [] as string[],
  friendsLoading: false,
  call: vi.fn<() => Promise<{ data: { friends: string[] } }>>(),
}));
vi.mock("@/config/firebase-config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => () => state.call() }));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "me", userId: "meUid" } }),
}));
vi.mock("@/hooks/useFriendships", () => ({
  useFriendships: () => ({
    friends: state.friends,
    uidOf: () => null,
    isLoading: state.friendsLoading,
  }),
}));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));

import {
  ORDER_FRESH_MS,
  orderCacheKey,
  readCachedOrder,
  useFriendsByActivity,
} from "../useFriendsByActivity";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let seen: ReturnType<typeof useFriendsByActivity>;
const Probe = () => {
  seen = useFriendsByActivity();
  return null;
};

let container: HTMLDivElement;
let root: Root;
const render = async () => {
  await act(async () => root.render(<Probe />));
};
const setCache = (at: number, order: string[]) =>
  window.localStorage.setItem(orderCacheKey("meUid"), JSON.stringify({ at, order }));

beforeEach(() => {
  window.localStorage.clear();
  state.friends = ["a", "b", "c"];
  state.friendsLoading = false;
  state.call.mockReset();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
});

describe("useFriendsByActivity", () => {
  it("with no cache, waits for the server order and stores it", async () => {
    let resolve!: (v: { data: { friends: string[] } }) => void;
    state.call.mockReturnValue(new Promise((r) => (resolve = r)));
    await render();
    expect(seen.isLoading).toBe(true);
    await act(async () => resolve({ data: { friends: ["c", "a", "b"] } }));
    expect(seen.isLoading).toBe(false);
    expect(seen.friends).toEqual(["c", "a", "b"]);
    expect(readCachedOrder("meUid")?.order).toEqual(["c", "a", "b"]);
    expect(state.call).toHaveBeenCalledTimes(1);
  });

  it("uses a fresh cache without calling the server", async () => {
    setCache(Date.now() - 60_000, ["b", "c", "a"]);
    await render();
    expect(seen.isLoading).toBe(false);
    expect(seen.friends).toEqual(["b", "c", "a"]);
    expect(state.call).not.toHaveBeenCalled();
  });

  it("shows a stale cache at once and refreshes it for next time without reshuffling", async () => {
    setCache(Date.now() - ORDER_FRESH_MS - 1, ["b", "c", "a"]);
    state.call.mockResolvedValue({ data: { friends: ["a", "b", "c"] } });
    await render();
    expect(seen.isLoading).toBe(false);
    expect(seen.friends).toEqual(["b", "c", "a"]);
    expect(state.call).toHaveBeenCalledTimes(1);
    expect(readCachedOrder("meUid")?.order).toEqual(["a", "b", "c"]);
  });

  it("with a cache, asks while friendships are still loading", async () => {
    setCache(Date.now() - ORDER_FRESH_MS - 1, ["b"]);
    state.friends = [];
    state.friendsLoading = true;
    state.call.mockResolvedValue({ data: { friends: ["b"] } });
    await render();
    expect(state.call).toHaveBeenCalledTimes(1);
  });

  it("never asks for someone with no friends and no cache", async () => {
    state.friends = [];
    await render();
    expect(seen.isLoading).toBe(false);
    expect(state.call).not.toHaveBeenCalled();
  });

  it("falls back to the usual order when the call fails", async () => {
    state.call.mockRejectedValue(new Error("down"));
    await render();
    expect(seen.isLoading).toBe(false);
    expect(seen.friends).toEqual(["a", "b", "c"]);
  });

  it("ignores a malformed cache", () => {
    window.localStorage.setItem(orderCacheKey("meUid"), JSON.stringify({ at: "x", order: [1] }));
    expect(readCachedOrder("meUid")).toBeUndefined();
  });
});
