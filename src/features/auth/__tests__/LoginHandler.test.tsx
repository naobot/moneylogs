import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import LoginHandler from "@/features/auth/components/LoginHandler";

const { mockNavigate, mockSignIn } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignIn: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: mockSignIn,
}));

vi.mock("@/config/firebase-config", () => ({
  auth: {},
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// React ignores value assignments that don't go through the native setter,
// so controlled inputs need this to register a change from a test
const setInputValue = (input: HTMLInputElement, value: string) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("LoginHandler", () => {
  let container: HTMLDivElement;
  let root: Root;

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

  const fillAndSubmit = async () => {
    const [emailInput, passwordInput] = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    );
    act(() => {
      setInputValue(emailInput, "user@example.com");
      setInputValue(passwordInput, "hunter2");
    });
    await act(async () => {
      container.querySelector("button")!.click();
    });
  };

  it("shows an error message when the password is incorrect", async () => {
    mockSignIn.mockRejectedValueOnce({
      code: "auth/invalid-credential",
      message: "INVALID_LOGIN_CREDENTIALS",
    });

    act(() => root.render(<LoginHandler />));
    await fillAndSubmit();

    const alert = container.querySelector(".AuthError");
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain("Incorrect email or password");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("re-enables the login button after a failed attempt", async () => {
    mockSignIn.mockRejectedValueOnce({ code: "auth/invalid-credential" });

    act(() => root.render(<LoginHandler />));
    await fillAndSubmit();

    expect(container.querySelector("button")!.disabled).toBe(false);
  });

  it("clears the previous error when retrying", async () => {
    mockSignIn
      .mockRejectedValueOnce({ code: "auth/invalid-credential" })
      .mockResolvedValueOnce({ user: {} });

    act(() => root.render(<LoginHandler />));
    await fillAndSubmit();
    expect(container.querySelector(".AuthError")).not.toBeNull();

    await act(async () => {
      container.querySelector("button")!.click();
    });
    expect(container.querySelector(".AuthError")).toBeNull();
  });

  it("shows no error and navigates on successful login", async () => {
    mockSignIn.mockResolvedValueOnce({ user: {} });

    act(() => root.render(<LoginHandler redirectTo="/me" />));
    await fillAndSubmit();

    expect(container.querySelector(".AuthError")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/me");
  });
});
