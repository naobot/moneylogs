import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

type Snap = { empty: boolean; docs: unknown[]; metadata: { fromCache: boolean } };
let emit: (snap: Snap) => void = () => {};

const mockAuth = vi.hoisted(() => ({
  currentUser: null as null | { uid: string; metadata: { creationTime?: string } },
}));
const mockEnsureUserDoc = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/config/firebase-config", () => ({ db: {}, auth: mockAuth }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("@/features/auth/ensureUserDoc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/ensureUserDoc")>()),
  ensureUserDoc: mockEnsureUserDoc,
}));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  Timestamp: class {},
  onSnapshot: vi.fn((_q: unknown, next: (snap: Snap) => void) => {
    emit = next;
    return () => {};
  }),
  waitForPendingWrites: vi.fn(() => Promise.resolve()),
}));

import { useGetUserInfo } from "@/hooks/useGetUserInfo";
import { USER_DOC_GRACE_MS } from "@/features/auth/ensureUserDoc";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const emptySnap = (fromCache = false): Snap => ({ empty: true, docs: [], metadata: { fromCache } });
const userSnap: Snap = {
  empty: false,
  metadata: { fromCache: false },
  docs: [
    {
      id: "doc-1",
      metadata: { hasPendingWrites: false },
      data: () => ({ userId: "uid-1", displayName: "New" }),
    },
  ],
};

let root: Root;

const Probe = () => {
  useGetUserInfo("uid-1");
  return null;
};

const signedInSince = (msAgo: number) => {
  mockAuth.currentUser = {
    uid: "uid-1",
    metadata: { creationTime: new Date(NOW - msAgo).toUTCString() },
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockEnsureUserDoc.mockClear();
  localStorage.clear();
  root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe("useGetUserInfo missing user doc", () => {
  it("asks the server to make it when an older account has none", () => {
    signedInSince(3600_000);
    act(() => emit(emptySnap()));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(mockEnsureUserDoc).toHaveBeenCalledTimes(1);

    // Only once, however many empty snapshots follow.
    act(() => emit(emptySnap()));
    act(() => {
      vi.advanceTimersByTime(USER_DOC_GRACE_MS);
    });
    expect(mockEnsureUserDoc).toHaveBeenCalledTimes(1);
  });

  it("gives a brand-new account's own registration write time to land", () => {
    signedInSince(1000);
    act(() => emit(emptySnap()));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockEnsureUserDoc).not.toHaveBeenCalled();

    // Registration's doc arrives in time: nothing to make.
    act(() => emit(userSnap));
    act(() => {
      vi.advanceTimersByTime(USER_DOC_GRACE_MS);
    });
    expect(mockEnsureUserDoc).not.toHaveBeenCalled();
  });

  it("doesn't trust an empty answer from the cache", () => {
    signedInSince(3600_000);
    act(() => emit(emptySnap(true)));
    act(() => {
      vi.advanceTimersByTime(USER_DOC_GRACE_MS);
    });
    expect(mockEnsureUserDoc).not.toHaveBeenCalled();
  });

  it("leaves it alone when a different account is signed in", () => {
    signedInSince(3600_000);
    mockAuth.currentUser!.uid = "someone-else";
    act(() => emit(emptySnap()));
    act(() => {
      vi.advanceTimersByTime(USER_DOC_GRACE_MS);
    });
    expect(mockEnsureUserDoc).not.toHaveBeenCalled();
  });
});
