import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import GroupArchive from "@/features/moneylog/components/GroupArchive";
import type { Group } from "@/types/user";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ts = (iso: string) => ({ toDate: () => new Date(iso), seconds: Date.parse(iso) / 1000 });
const group = {
  id: "g1",
  title: "Tokyo",
  createdBy: "uid-1",
  start: ts("2024-01-01T00:00:00Z"),
  end: ts("2024-01-10T00:00:00Z"),
} as unknown as Group;

describe("GroupArchive", () => {
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

  const render = (onManage?: Parameters<typeof GroupArchive>[0]["onManage"]) =>
    act(() =>
      root.render(
        <MemoryRouter>
          <GroupArchive groups={[group]} onManage={onManage} />
        </MemoryRouter>,
      ),
    );

  it("has no manage button unless asked for one", () => {
    render();
    expect(container.querySelector(".RowButton")).toBeNull();
    expect(container.textContent).toContain("Tokyo");
  });

  it("calls onManage with the group's target", () => {
    const onManage = vi.fn();
    render(onManage);
    const button = container.querySelector<HTMLButtonElement>(".RowButton")!;
    expect(button.getAttribute("aria-label")).toBe("Manage Tokyo");
    act(() => button.click());
    expect(onManage).toHaveBeenCalledWith({
      id: "g1",
      title: "Tokyo",
      kind: "social",
      creatorUid: "uid-1",
    });
  });
});
