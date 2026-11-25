import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  showToast: vi.fn(),
}));
vi.mock("@/hooks/useToastContext", () => ({
  useToastContext: () => ({ showToast: state.showToast }),
}));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("../adminApi", () => ({
  adminCleanupList: state.list,
  adminCleanupDelete: state.remove,
  adminErrorMessage: () => "failed",
  isExpectedAdminError: () => false,
}));

import { CleanupSection } from "../CleanupSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const candidate = (uid: string, email: string | null) => ({
  uid,
  email,
  reason: email ? "idle_unconfirmed" : "idle_guest",
  createdAt: "2026-09-01T00:00:00.000Z",
  lastActiveAt: "2026-10-01T00:00:00.000Z",
});

describe("CleanupSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    state.list.mockResolvedValue({
      data: {
        candidates: [candidate("u1", "fake@example.com"), candidate("u2", null)],
        total: 2,
        inactiveDays: 30,
        listedAt: "2026-11-25T12:00:00.000Z",
      },
    });
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.restoreAllMocks();
  });

  const render = async () => {
    await act(async () => root.render(<CleanupSection onLookUp={vi.fn()} />));
  };
  const button = (label: string) =>
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it("shows the stored daily list without rebuilding or deleting anything", async () => {
    await render();
    expect(state.list).toHaveBeenCalledWith({});
    expect(container.textContent).toContain("fake@example.com");
    expect(container.textContent).toContain("2 accounts");
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("deletes nothing when the confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await render();
    await act(async () => button("Delete fake@example.com").click());
    expect(state.remove).not.toHaveBeenCalled();
    expect(container.textContent).toContain("fake@example.com");
  });

  it("deletes one account on confirmation and takes it off the list", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    state.remove.mockResolvedValue({ data: { deleted: true, reason: "idle_unconfirmed" } });
    await render();
    await act(async () => button("Delete fake@example.com").click());
    expect(state.remove).toHaveBeenCalledWith({ uid: "u1" });
    expect(container.textContent).not.toContain("fake@example.com");
    expect(container.textContent).toContain("(guest)");
    expect(state.showToast).toHaveBeenCalledWith("Deleted fake@example.com", "success");
  });

  it("says so when the server kept someone who came back", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    state.remove.mockResolvedValue({ data: { deleted: false, reason: "kept" } });
    await render();
    await act(async () => button("Delete fake@example.com").click());
    expect(state.showToast).toHaveBeenCalledWith(expect.stringContaining("Kept fake@example.com"));
    expect(container.textContent).not.toContain("fake@example.com");
  });

  it("marks a deletion that stopped partway and offers to finish it", async () => {
    state.list.mockResolvedValue({
      data: {
        candidates: [{ ...candidate("u3", "half@example.com"), unfinished: true }],
        total: 0,
        inactiveDays: 30,
        listedAt: "2026-11-25T12:00:00.000Z",
      },
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    state.remove.mockResolvedValue({ data: { deleted: true, reason: "idle_unconfirmed" } });
    await render();
    expect(container.textContent).toContain("deletion stopped partway");
    expect(button("Delete half@example.com").textContent).toBe("finish deleting");
    await act(async () => button("Delete half@example.com").click());
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Finish deleting"));
    expect(state.remove).toHaveBeenCalledWith({ uid: "u3" });
  });
});
