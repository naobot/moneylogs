import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import ForgotPasswordHandler from "@/features/auth/components/ForgotPasswordHandler";

const { mockSendReset, mockReportError } = vi.hoisted(() => ({
  mockSendReset: vi.fn(),
  mockReportError: vi.fn(),
}));

vi.mock("@/utils/reportError", () => ({ reportError: mockReportError }));
vi.mock("firebase/auth", () => ({ sendPasswordResetEmail: mockSendReset }));
vi.mock("@/config/firebase-config", () => ({ auth: {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setInputValue = (input: HTMLInputElement, value: string) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const buttonByText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === text)!;

describe("ForgotPasswordHandler", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const send = async () => {
    await act(async () => {
      buttonByText(container, "Send reset link").click();
    });
  };

  it("starts with the email carried over from the login form", () => {
    act(() => root.render(<ForgotPasswordHandler initialEmail="a@b.co" onBack={onBack} />));
    expect(container.querySelector("input")!.value).toBe("a@b.co");
  });

  it("can't send without an email", () => {
    act(() => root.render(<ForgotPasswordHandler onBack={onBack} />));
    expect(buttonByText(container, "Send reset link").disabled).toBe(true);
  });

  it("sends a trimmed address with a way back to the app, then confirms neutrally", async () => {
    mockSendReset.mockResolvedValueOnce(undefined);
    act(() => root.render(<ForgotPasswordHandler onBack={onBack} />));
    act(() => setInputValue(container.querySelector("input")!, "  a@b.co "));
    await send();

    expect(mockSendReset).toHaveBeenCalledWith(
      {},
      "a@b.co",
      expect.objectContaining({ url: expect.stringContaining("/login") }),
    );
    const status = container.querySelector("[role=status]")!;
    expect(status.textContent).toContain("If an account exists for a@b.co");
  });

  it("shows the same confirmation when there's no such account", async () => {
    mockSendReset.mockRejectedValueOnce({ code: "auth/user-not-found" });
    act(() => root.render(<ForgotPasswordHandler initialEmail="nobody@b.co" onBack={onBack} />));
    await send();

    expect(container.querySelector("[role=status]")!.textContent).toContain("If an account exists");
    expect(container.querySelector(".AuthError")).toBeNull();
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it("explains fixable mistakes without reporting them", async () => {
    mockSendReset.mockRejectedValueOnce({ code: "auth/invalid-email" });
    act(() => root.render(<ForgotPasswordHandler initialEmail="nope" onBack={onBack} />));
    await send();

    expect(container.querySelector(".AuthError")!.textContent).toContain("valid email");
    expect(mockReportError).not.toHaveBeenCalled();
    expect(buttonByText(container, "Send reset link").disabled).toBe(false);
  });

  it("reports anything unexpected", async () => {
    mockSendReset.mockRejectedValueOnce({ code: "auth/internal-error" });
    act(() => root.render(<ForgotPasswordHandler initialEmail="a@b.co" onBack={onBack} />));
    await send();

    expect(container.querySelector(".AuthError")!.textContent).toContain("Couldn't send");
    expect(mockReportError).toHaveBeenCalledWith(
      { code: "auth/internal-error" },
      { feature: "account", action: "forgot_password" },
    );
  });

  it("goes back to login, and can send again after confirming", async () => {
    mockSendReset.mockResolvedValueOnce(undefined);
    act(() => root.render(<ForgotPasswordHandler initialEmail="a@b.co" onBack={onBack} />));
    await send();

    act(() => buttonByText(container, "Send again").click());
    expect(container.querySelector("input")!.value).toBe("a@b.co");

    act(() => buttonByText(container, "Back to login").click());
    expect(onBack).toHaveBeenCalled();
  });
});
