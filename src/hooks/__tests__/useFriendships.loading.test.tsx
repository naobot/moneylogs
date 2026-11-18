import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  user: undefined as { id: string; userId: string } | undefined,
  userLoading: true,
}));
vi.mock("@/config/firebase-config", () => ({ db: {}, functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn(() => vi.fn()) }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: state.user, isLoading: state.userLoading }),
}));
// Idle without a uid, like the real hook when disabled.
vi.mock("@/hooks/useFirebase", () => ({
  useFirebaseCollection: ({ enabled }: { enabled: boolean }) => ({
    data: [],
    isLoading: enabled,
    isSuccess: false,
    isError: false,
    error: null,
  }),
}));

import { useFriendships } from "@/hooks/useFriendships";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReturnType<typeof useFriendships>;
const Probe = () => {
  latest = useFriendships();
  return null;
};

describe("useFriendships", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.createElement("div"));
  });
  afterEach(() => act(() => root.unmount()));

  it("is loading while the current user is, not an empty friends list", () => {
    state.user = undefined;
    state.userLoading = true;
    act(() => root.render(<Probe />));
    expect(latest.isLoading).toBe(true);
  });

  it("isn't loading when signed out", () => {
    state.user = undefined;
    state.userLoading = false;
    act(() => root.render(<Probe />));
    expect(latest.isLoading).toBe(false);
    expect(latest.friends).toEqual([]);
  });
});
