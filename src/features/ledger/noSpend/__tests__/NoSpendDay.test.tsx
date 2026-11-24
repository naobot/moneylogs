import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  days: new Set<string>(),
  isSuccess: true,
  confirm: vi.fn(async () => ({ data: { ok: true } })),
  showToast: vi.fn(),
  elsewhere: null as string | null,
  elsewhereLoading: false,
  now: "2026-11-18T18:00:00Z",
}));

vi.mock("@/hooks/useNow", async () => {
  const { default: dayjs } = await import("@/utils/configuredDayjs");
  return { useNow: () => dayjs(state.now) };
});
vi.mock("@/contexts", () => ({
  useCurrentUser: () => ({ user: { timezone: "UTC" } }),
}));

vi.mock("@/hooks/useNoSpendDays", () => ({
  useNoSpendDays: () => ({ days: state.days, isSuccess: state.isSuccess }),
}));
vi.mock("@/hooks/useLoggedOnDayElsewhere", () => ({
  useLoggedOnDayElsewhere: () => ({
    elsewhere: state.elsewhere,
    isLoading: state.elsewhereLoading,
  }),
}));
vi.mock("@/hooks/useToastContext", () => ({
  useToastContext: () => ({ showToast: state.showToast }),
}));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));
vi.mock("../noSpendDays", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../noSpendDays")>()),
  confirmNoSpendDay: state.confirm,
}));

import { NoSpendDay } from "../NoSpendDay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-11-18";

describe("NoSpendDay", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    state.days = new Set();
    state.isSuccess = true;
    state.elsewhere = null;
    state.elsewhereLoading = false;
    state.now = "2026-11-18T18:00:00Z";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (loggedToday = false) =>
    act(() => root.render(<NoSpendDay ledgerId="here" today={TODAY} loggedToday={loggedToday} />));
  const button = () => container.querySelector("button");

  it("offers to confirm a day with nothing logged", async () => {
    render();
    expect(button()!.textContent).toBe("nothing spent today");
    await act(async () => button()!.click());
    expect(state.confirm).toHaveBeenCalledTimes(1);
    expect(state.showToast).not.toHaveBeenCalled();
  });

  it("isn't offered before 17:00 in the person's timezone", () => {
    state.now = "2026-11-18T16:59:00Z";
    render();
    expect(button()).toBeNull();
    state.now = "2026-11-18T17:00:00Z";
    render();
    expect(button()!.textContent).toBe("nothing spent today");
  });

  it("still shows a confirmed day before 17:00", () => {
    state.now = "2026-11-18T09:00:00Z";
    state.days = new Set([TODAY]);
    render();
    expect(container.textContent).toContain("today's a no-spend day");
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

  it("isn't offered once something's logged today in another log, or while that's checked", () => {
    state.elsewhereLoading = true;
    render();
    expect(button()).toBeNull();
    state.elsewhereLoading = false;
    state.elsewhere = "main";
    render();
    expect(button()).toBeNull();
  });

  it("names the log when the server finds an entry there after all", async () => {
    state.confirm.mockRejectedValueOnce({
      code: "functions/failed-precondition",
      details: { ledgerTitle: "main" },
    });
    render();
    await act(async () => button()!.click());
    expect(state.showToast).toHaveBeenCalledWith(
      "You logged something in main today, so it can't be a no-spend day.",
      "error",
    );
    expect(button()!.disabled).toBe(false);
  });

  it("falls back to the plain message from a server that doesn't name the log", async () => {
    state.confirm.mockRejectedValueOnce({ code: "functions/failed-precondition" });
    render();
    await act(async () => button()!.click());
    expect(state.showToast).toHaveBeenCalledWith("You've logged something today already.", "error");
  });
});
