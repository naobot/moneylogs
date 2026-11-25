import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

const state = vi.hoisted(() => ({
  confirmed: true,
  ensureConfirmed: vi.fn(() => Promise.resolve(true)),
  getInviteCode: vi.fn((..._args: unknown[]) => Promise.resolve("code-1")),
  reportError: vi.fn(),
}));
vi.mock("@/hooks/useToastContext", () => ({ useToastContext: () => ({ showToast: vi.fn() }) }));
vi.mock("@/utils/reportError", () => ({ reportError: state.reportError }));
vi.mock("@/utils/shareUrl", () => ({ shareUrl: (path: string) => `https://x${path}` }));
vi.mock("@/features/layout/components/CopyTextArea", () => ({
  default: ({ value }: { value: string }) => <output>{value}</output>,
}));
vi.mock("@/features/account/confirmEmail/confirmEmailContext", () => ({
  useConfirmEmail: () => ({
    confirmed: state.confirmed,
    ensureConfirmed: state.ensureConfirmed,
    showConfirmEmail: vi.fn(),
  }),
}));
vi.mock("../invites", () => ({ getInviteCode: state.getInviteCode }));

import { InviteLink } from "../InviteLink";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UNCONFIRMED = {
  code: "functions/failed-precondition",
  details: { reason: "email_unconfirmed" },
};

describe("InviteLink", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.confirmed = true;
    vi.clearAllMocks();
    state.ensureConfirmed.mockImplementation(() => Promise.resolve(true));
    state.getInviteCode.mockImplementation(() => Promise.resolve("code-1"));
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => act(() => root.unmount()));

  const render = async () => {
    await act(async () => root.render(<InviteLink />));
  };
  const confirmButton = () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === "confirm email");

  it("doesn't ask for a link before the email is confirmed", async () => {
    state.confirmed = false;
    await render();
    expect(state.getInviteCode).not.toHaveBeenCalled();
    expect(confirmButton()).toBeDefined();
  });

  it("asks to confirm, not 'couldn't be loaded', when the server says so, then tries again", async () => {
    state.getInviteCode.mockImplementationOnce(() => Promise.reject(UNCONFIRMED));
    await render();
    expect(container.textContent).toContain("Confirm your email address");
    expect(container.textContent).not.toContain("couldn't be loaded");
    expect(state.reportError).not.toHaveBeenCalled();

    await act(async () => confirmButton()!.click());
    expect(state.ensureConfirmed).toHaveBeenCalledWith({ recheck: true });
    expect(state.getInviteCode).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("https://x/invite/code-1");
  });

  it("stays put when they still haven't confirmed", async () => {
    state.getInviteCode.mockImplementationOnce(() => Promise.reject(UNCONFIRMED));
    state.ensureConfirmed.mockImplementation(() => Promise.resolve(false));
    await render();
    await act(async () => confirmButton()!.click());
    expect(state.getInviteCode).toHaveBeenCalledTimes(1);
    expect(confirmButton()).toBeDefined();
  });
});
