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
// Hoisted: the modal creates its callable at import time.
const { deleteCall, navigate } = vi.hoisted(() => ({
  deleteCall: vi.fn(async () => ({ data: { deleted: true } })),
  navigate: vi.fn(),
}));
vi.mock("@/config/firebase-config", () => ({ functions: {} }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => deleteCall }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
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

  const render = (creatorUid?: string) =>
    act(() =>
      root.render(
        <LogActionsModal
          isOpen
          onClose={onClose}
          logId="g1"
          logTitle="Tokyo"
          kind="social"
          creatorUid={creatorUid}
        />,
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

  describe("delete", () => {
    const confirmInput = () =>
      document.querySelector(".LogActions__confirm input") as HTMLInputElement;
    const deleteButton = () => button("Delete log group")!;
    const type = (value: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
      act(() => {
        descriptor.set?.call(confirmInput(), value);
        confirmInput().dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    /** Step one: the Manage modal's button, which opens the confirmation. */
    const startDelete = () => act(() => deleteButton().click());

    beforeEach(() => {
      archivedLogs = {};
      deleteCall.mockClear();
      navigate.mockClear();
    });

    it("is hidden from members who didn't create the log, and when the creator is unknown", () => {
      render("someone-else");
      expect(document.body.textContent).not.toContain("Delete this log group");
      act(() => root.unmount());
      root = createRoot(container);
      render(undefined);
      expect(document.body.textContent).not.toContain("Delete this log group");
    });

    it("warns that it affects everyone, with the button ready and no field to type in yet", () => {
      render("uid-1");
      expect(document.body.textContent).toContain("can't be undone");
      expect(document.body.textContent).toContain("achievements");
      expect(deleteButton().disabled).toBe(false);
      expect(confirmInput()).toBeNull();
    });

    it("asks for the title in a second modal, which replaces Manage", () => {
      render("uid-1");
      startDelete();
      expect(document.body.textContent).toContain("Delete Tokyo? This can't be undone.");
      expect(document.body.textContent).not.toContain("Archive for me");
      expect(deleteButton().disabled).toBe(true);
      type("Toky");
      expect(deleteButton().disabled).toBe(true);
      type("tokyo ");
      expect(deleteButton().disabled).toBe(false);
      expect(deleteCall).not.toHaveBeenCalled();
    });

    it("goes back to Manage, cleared, without deleting", () => {
      render("uid-1");
      startDelete();
      type("Tokyo");
      act(() => button("Back")!.click());
      expect(document.body.textContent).toContain("Archive for me");
      expect(onClose).not.toHaveBeenCalled();
      startDelete();
      expect(confirmInput().value).toBe("");
      expect(deleteCall).not.toHaveBeenCalled();
    });

    it("starts at Manage again after being closed and reopened", () => {
      render("uid-1");
      startDelete();
      act(() =>
        root.render(
          <LogActionsModal
            isOpen={false}
            onClose={onClose}
            logId="g1"
            logTitle="Tokyo"
            kind="social"
            creatorUid="uid-1"
          />,
        ),
      );
      render("uid-1");
      expect(document.body.textContent).toContain("Archive for me");
      expect(confirmInput()).toBeNull();
    });

    it("calls the function, then goes home", async () => {
      render("uid-1");
      startDelete();
      type("Tokyo");
      await act(async () => deleteButton().click());
      expect(deleteCall).toHaveBeenCalledWith({ kind: "social", id: "g1" });
      expect(navigate).toHaveBeenCalledWith("/", { replace: true });
    });

    it("calls onDeleted instead of going home when managed from a list", async () => {
      const onDeleted = vi.fn();
      act(() =>
        root.render(
          <LogActionsModal
            isOpen
            onClose={onClose}
            onDeleted={onDeleted}
            logId="g1"
            logTitle="Tokyo"
            kind="social"
            creatorUid="uid-1"
          />,
        ),
      );
      startDelete();
      type("Tokyo");
      await act(async () => deleteButton().click());
      expect(deleteCall).toHaveBeenCalledWith({ kind: "social", id: "g1" });
      expect(onDeleted).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
    });

    it("explains a refusal and stays put", async () => {
      const { FirebaseError } = await import("firebase/app");
      deleteCall.mockRejectedValueOnce(new FirebaseError("functions/permission-denied", "no"));
      render("uid-1");
      startDelete();
      type("Tokyo");
      await act(async () => deleteButton().click());
      expect(document.body.textContent).toContain("Only the person who created this log");
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
