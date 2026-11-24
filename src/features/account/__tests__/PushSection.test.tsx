import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  user: { id: "doc1", userId: "a1" } as Record<string, unknown>,
  push: "on" as "on" | "off" | "blocked",
  updateUserFields: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));

vi.mock("@/contexts", () => ({ useCurrentUser: () => ({ user: state.user }) }));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));
vi.mock("@/hooks/useUserQuery", () => ({ updateUserFields: state.updateUserFields }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("@/features/push/devicePush", () => ({
  readPushState: () => Promise.resolve(state.push),
  turnPushOn: vi.fn(),
  turnPushOff: vi.fn(),
}));

import { PushSection } from "../PushSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PushSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async () => {
    await act(async () => root.render(<PushSection />));
  };
  const reminder = () => container.querySelector<HTMLInputElement>('input[type="checkbox"]');

  beforeEach(() => {
    state.user = { id: "doc1", userId: "a1" };
    state.push = "on";
    state.updateUserFields.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("names itself as push, separate from email", async () => {
    await render();
    expect(container.querySelector("h3")?.textContent).toBe("push notifications");
  });

  it("offers the evening reminder, on by default, while push is on", async () => {
    await render();
    expect(reminder()?.checked).toBe(true);
    await act(async () => reminder()!.click());
    expect(state.updateUserFields).toHaveBeenCalledWith("doc1", { checkInReminder: false });
  });

  it("shows the reminder as off once turned off", async () => {
    state.user = { ...state.user, checkInReminder: false };
    await render();
    expect(reminder()?.checked).toBe(false);
  });

  it("hides the reminder while push is off on this phone", async () => {
    state.push = "off";
    await render();
    expect(reminder()).toBeNull();
  });
});
