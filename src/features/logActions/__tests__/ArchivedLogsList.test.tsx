import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { id: "doc-1", userId: "uid-1", archivedLogs: { g1: null } } }),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));
vi.mock("@/hooks/useUserQuery", () => ({
  useUserQuery: () => ({ unarchiveLog: { mutate: vi.fn(async () => {}), isLoading: false } }),
}));

import ArchivedLogsList from "@/features/logActions/ArchivedLogsList";
import type { Group } from "@/types/user";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const group = { id: "g1", title: "Tokyo", createdBy: "uid-1" } as unknown as Group;

describe("ArchivedLogsList", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (onManage?: () => void) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <ArchivedLogsList groups={[group]} ledgers={[]} onManage={onManage} />
        </MemoryRouter>,
      ),
    );
  const buttons = () => Array.from(container.querySelectorAll("button")).map((b) => b.textContent);

  it("offers a plain unarchive button when it can't manage", () => {
    render();
    expect(buttons()).toEqual(["unarchive"]);
  });

  it("shows only manage when it can manage, since manage covers unarchiving", () => {
    const onManage = vi.fn();
    render(onManage);
    expect(buttons()).toEqual(["manage"]);
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(onManage).toHaveBeenCalledWith(expect.objectContaining({ id: "g1", kind: "social" }));
  });
});
