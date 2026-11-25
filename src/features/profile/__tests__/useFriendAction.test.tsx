import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  confirmed: true,
  showConfirmEmail: vi.fn(),
  showToast: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock("@/hooks/useToastContext", () => ({
  useToastContext: () => ({ showToast: state.showToast }),
}));
vi.mock("@/utils/reportError", () => ({ reportError: state.reportError }));
vi.mock("@/utils/analytics", () => ({ track: vi.fn() }));
vi.mock("@/features/account/confirmEmail/confirmEmailContext", () => ({
  useConfirmEmail: () => ({
    confirmed: state.confirmed,
    ensureConfirmed: () => Promise.resolve(state.confirmed),
    showConfirmEmail: state.showConfirmEmail,
  }),
}));

import { useFriendAction } from "../useFriendAction";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useFriendAction", () => {
  let container: HTMLDivElement;
  let root: Root;
  let run: ReturnType<typeof useFriendAction>["run"];

  const Probe = () => {
    run = useFriendAction().run;
    return null;
  };

  beforeEach(() => {
    state.confirmed = true;
    vi.clearAllMocks();
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(<Probe />));
  });

  afterEach(() => act(() => root.unmount()));

  it("doesn't send a request until the email is confirmed", async () => {
    state.confirmed = false;
    const action = vi.fn(() => Promise.resolve());
    await act(() => run("request", action, "Friend request sent"));
    expect(action).not.toHaveBeenCalled();
    expect(state.showToast).not.toHaveBeenCalled();
  });

  it("still lets them answer a request", async () => {
    state.confirmed = false;
    const action = vi.fn(() => Promise.resolve());
    await act(() => run("accept-mina", action));
    expect(action).toHaveBeenCalled();
  });

  it("shows the confirm modal, not a failure, when the server says to confirm", async () => {
    const action = vi.fn(() =>
      Promise.reject({
        code: "functions/failed-precondition",
        details: { reason: "email_unconfirmed" },
      }),
    );
    await act(() => run("request", action, "Friend request sent"));
    expect(state.showConfirmEmail).toHaveBeenCalled();
    expect(state.reportError).not.toHaveBeenCalled();
    expect(state.showToast).not.toHaveBeenCalled();
  });
});
