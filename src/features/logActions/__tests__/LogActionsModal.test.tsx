import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const archive = vi.fn(async () => {});
const unarchive = vi.fn(async () => {});
const showToast = vi.fn();
let archivedLogs: Record<string, unknown> = {};

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-1", userId: "uid-1", archivedLogs } }),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast }) }));
vi.mock("@/hooks/useUserQuery", () => ({
  useUserQuery: () => ({
    archiveLog: { mutate: archive, isLoading: false },
    unarchiveLog: { mutate: unarchive, isLoading: false },
  }),
}));

import LogActionsModal from "@/features/logActions/LogActionsModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LogActionsModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();

  beforeEach(() => {
    archive.mockClear();
    unarchive.mockClear();
    onClose.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const render = () =>
    act(() =>
      root.render(
        <LogActionsModal isOpen onClose={onClose} logId="g1" logTitle="Tokyo" kind="social" />,
      ),
    );
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text);

  it("archives for the current user only", async () => {
    archivedLogs = {};
    render();
    expect(document.body.textContent).toContain("Only you are affected");
    await act(async () => button("Archive for me")!.click());
    expect(archive).toHaveBeenCalledWith({ userId: "doc-1", logId: "g1" });
    expect(unarchive).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("offers unarchive when already archived", async () => {
    archivedLogs = { g1: null };
    render();
    expect(button("Archive for me")).toBeUndefined();
    await act(async () => button("Unarchive")!.click());
    expect(unarchive).toHaveBeenCalledWith({ userId: "doc-1", logId: "g1" });
  });

  it("keeps the modal open with an error if the write fails", async () => {
    archivedLogs = {};
    archive.mockRejectedValueOnce(new Error("offline"));
    render();
    await act(async () => button("Archive for me")!.click());
    expect(document.body.textContent).toContain("Couldn't update that");
    expect(onClose).not.toHaveBeenCalled();
  });
});
