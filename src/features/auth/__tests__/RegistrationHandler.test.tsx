import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import RegistrationHandler from "@/features/auth/components/RegistrationHandler";

const { mockCreateUser, mockSendVerification, mockSignIn, mockUpdateProfile, mockMutate } =
  vi.hoisted(() => ({
    mockCreateUser: vi.fn(),
    mockSendVerification: vi.fn(),
    mockSignIn: vi.fn(),
    mockUpdateProfile: vi.fn(),
    mockMutate: vi.fn(),
  }));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: mockCreateUser,
  sendEmailVerification: mockSendVerification,
  signInWithEmailAndPassword: mockSignIn,
  updateProfile: mockUpdateProfile,
}));

vi.mock("@/config/firebase-config", () => ({
  auth: { currentUser: {} },
}));

// The password validator hits Firebase in production; stub it to "valid" so the
// submit button is enabled and we can exercise the account-creation path.
vi.mock("@/features/auth/hooks/useValidatePassword", () => ({
  default: () => ({ isValid: true }),
}));

vi.mock("@/hooks/useRegisterNewUser", () => ({
  useRegisterNewUser: () => ({ addNewUser: { mutate: mockMutate } }),
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

describe("RegistrationHandler", () => {
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
    const [nameInput, emailInput, passwordInput] = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    );
    act(() => {
      setInputValue(nameInput, "Ada");
      setInputValue(emailInput, "user@example.com");
      setInputValue(passwordInput, "hunter2");
    });
    await act(async () => {
      container.querySelector("button")!.click();
    });
  };

  it("shows a helpful message when the email is already in use", async () => {
    mockCreateUser.mockRejectedValueOnce({
      code: "auth/email-already-in-use",
      message: "EMAIL_EXISTS",
    });

    act(() => root.render(<RegistrationHandler />));
    await fillAndSubmit();

    const alert = container.querySelector(".AuthError");
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain("already exists");
  });

  it("re-enables the register button after a failed attempt", async () => {
    mockCreateUser.mockRejectedValueOnce({ code: "auth/email-already-in-use" });

    act(() => root.render(<RegistrationHandler />));
    await fillAndSubmit();

    expect(container.querySelector("button")!.disabled).toBe(false);
  });

  it("replaces a stale error message on the next attempt", async () => {
    mockCreateUser
      .mockRejectedValueOnce({ code: "auth/email-already-in-use" })
      .mockRejectedValueOnce({ code: "auth/network-request-failed" });

    act(() => root.render(<RegistrationHandler />));
    await fillAndSubmit();
    expect(container.querySelector(".AuthError")!.textContent).toContain("already exists");

    await act(async () => {
      container.querySelector("button")!.click();
    });
    const alert = container.querySelector(".AuthError")!;
    expect(alert.textContent).not.toContain("already exists");
    expect(alert.textContent).toContain("Something went wrong");
  });

  it("shows no error and creates the account on success", async () => {
    mockCreateUser.mockResolvedValueOnce({ user: { uid: "abc" } });
    mockMutate.mockResolvedValueOnce(undefined);
    mockSendVerification.mockResolvedValueOnce(undefined);
    mockUpdateProfile.mockResolvedValueOnce(undefined);
    mockSignIn.mockResolvedValueOnce({ user: {} });

    const originalLocation = window.location;
    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSetter(value);
        },
      },
    });

    try {
      act(() => root.render(<RegistrationHandler redirectTo="/me" />));
      await fillAndSubmit();

      expect(container.querySelector(".AuthError")).toBeNull();
      expect(mockCreateUser).toHaveBeenCalled();
      expect(hrefSetter).toHaveBeenCalledWith("/me");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
