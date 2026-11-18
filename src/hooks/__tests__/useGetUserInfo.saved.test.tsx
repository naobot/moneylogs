import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

type Snap = { empty: boolean; docs: unknown[] };
let emit: (snap: Snap) => void = () => {};
let landPendingWrites: () => void = () => {};

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  Timestamp: class {},
  onSnapshot: vi.fn((_q: unknown, next: (snap: Snap) => void) => {
    emit = next;
    return () => {};
  }),
  waitForPendingWrites: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        landPendingWrites = resolve;
      }),
  ),
}));

import { useGetUserInfo } from "@/hooks/useGetUserInfo";

const userSnap = (hasPendingWrites: boolean, extra: Record<string, unknown> = {}): Snap => ({
  empty: false,
  docs: [
    {
      id: "doc-1",
      metadata: { hasPendingWrites },
      data: () => ({ userId: "uid-1", displayName: "New", ...extra }),
    },
  ],
});

let root: Root;
let container: HTMLDivElement;
let latest: ReturnType<typeof useGetUserInfo>;

const Probe = () => {
  latest = useGetUserInfo("uid-1");
  return null;
};

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
});

describe("useGetUserInfo isUserDocSaved", () => {
  it("waits for a just-created user doc to reach the server", async () => {
    act(() => emit(userSnap(true)));
    expect(latest.user?.id).toBe("doc-1");
    expect(latest.isUserDocSaved).toBe(false);

    await act(async () => landPendingWrites());
    expect(latest.isUserDocSaved).toBe(true);
  });

  it("counts a doc the server already has as saved straight away", () => {
    act(() => emit(userSnap(false)));
    expect(latest.isUserDocSaved).toBe(true);
  });

  it("stays saved while later edits are pending", () => {
    act(() => emit(userSnap(false)));
    act(() => emit(userSnap(true, { displayName: "Renamed" })));
    expect(latest.user?.displayName).toBe("Renamed");
    expect(latest.isUserDocSaved).toBe(true);
  });
});
