import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  days: new Set<string>(),
  isSuccess: true,
  confirm: vi.fn(async () => ({ data: { ok: true } })),
  showToast: vi.fn(),
}));

vi.mock("@/hooks/useNoSpendDays", () => ({
  useNoSpendDays: () => ({ days: state.days, isSuccess: state.isSuccess }),
}));
vi.mock("@/hooks/useToastContext", () => ({
  useToastContext: () => ({ showToast: state.showToast }),
}));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("../noSpendDays", () => ({
  confirmNoSpendDay: state.confirm,
  isAlreadyLogged: (e: { code?: string }) => e?.code === "functions/failed-precondition",
}));

import { ALREADY_LOGGED_MESSAGE, NoSpendDay } from "../NoSpendDay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-11-18";

describe("NoSpendDay", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    state.days = new Set();
    state.isSuccess = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (loggedToday = false) =>
    act(() => root.render(<NoSpendDay today={TODAY} loggedToday={loggedToday} />));
  const button = () => container.querySelector("button");

  it("offers to confirm a day with nothing logged", async () => {
    render();
    expect(button()!.textContent).toBe("nothing spent today");
    await act(async () => button()!.click());
    expect(state.confirm).toHaveBeenCalledTimes(1);
    expect(state.showToast).not.toHaveBeenCalled();
  });

  it("shows a confirmed day instead of the button", () => {
    state.days = new Set([TODAY]);
    render();
    expect(button()).toBeNull();
    expect(container.textContent).toContain("today's a no-spend day");
  });

  it("stays out of the way once something's logged today, or while loading", () => {
    render(true);
    expect(container.textContent).toBe("");
    state.isSuccess = false;
    render();
    expect(container.textContent).toBe("");
  });

  it("says so when something was logged today in another log", async () => {
    state.confirm.mockRejectedValueOnce({ code: "functions/failed-precondition" });
    render();
    await act(async () => button()!.click());
    expect(state.showToast).toHaveBeenCalledWith(ALREADY_LOGGED_MESSAGE, "error");
    expect(button()!.disabled).toBe(false);
  });
});
