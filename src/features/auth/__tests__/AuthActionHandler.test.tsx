import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act, StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import AuthActionHandler from "@/features/auth/components/AuthActionHandler";
import type { AuthAction } from "@/features/auth/passwordReset";

const mocks = vi.hoisted(() => ({
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
  applyActionCode: vi.fn(),
  checkActionCode: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
  reportError: vi.fn(),
  auth: {
    currentUser: null as null | {
      email: string;
      reload: () => Promise<void>;
      getIdToken?: (force?: boolean) => Promise<string>;
    },
  },
}));

vi.mock("firebase/auth", () => ({
  verifyPasswordResetCode: mocks.verifyPasswordResetCode,
  confirmPasswordReset: mocks.confirmPasswordReset,
  applyActionCode: mocks.applyActionCode,
  checkActionCode: mocks.checkActionCode,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  signOut: mocks.signOut,
}));
vi.mock("@/config/firebase-config", () => ({ auth: mocks.auth }));
vi.mock("@/utils/reportError", () => ({ reportError: mocks.reportError }));

// Stand-in policy: 8+ characters. The real hook asks Firebase for the project's policy.
vi.mock("@/features/auth/hooks/useValidatePassword", () => ({
  default: (password: string) => {
    const isValid = password.length >= 8;
    return { isValid, status: { isValid, meetsMinPasswordLength: isValid } };
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setInputValue = (input: HTMLInputElement, value: string) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const action = (overrides: Partial<AuthAction>): AuthAction => ({
  mode: "resetPassword",
  oobCode: "code-1",
  continuePath: "/login",
  ...overrides,
});

describe("AuthActionHandler", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.currentUser = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async (a: AuthAction) => {
    await act(async () => {
      root.render(
        <StrictMode>
          <MemoryRouter>
            <AuthActionHandler action={a} />
          </MemoryRouter>
        </StrictMode>,
      );
    });
  };

  const button = (text: string) =>
    Array.from(container.querySelectorAll<HTMLElement>("button, a")).find(
      (b) => b.textContent === text,
    );

  describe("resetPassword", () => {
    const fill = (password: string, confirm: string) => {
      const [pw, cf] = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
      act(() => {
        setInputValue(pw, password);
        setInputValue(cf, confirm);
      });
    };

    it("shows whose password is being reset", async () => {
      mocks.verifyPasswordResetCode.mockResolvedValue("a@b.co");
      await render(action({}));
      expect(mocks.verifyPasswordResetCode).toHaveBeenCalledWith(mocks.auth, "code-1");
      expect(container.textContent).toContain("Choose a new password for a@b.co");
    });

    it("explains an expired link without reporting it, and offers a new one", async () => {
      mocks.verifyPasswordResetCode.mockRejectedValue({ code: "auth/expired-action-code" });
      await render(action({}));
      expect(container.querySelector(".AuthError")!.textContent).toContain("expired");
      expect(mocks.reportError).not.toHaveBeenCalled();
      expect(button("Back to login")).toBeDefined();
    });

    it("treats a link with no code as invalid without calling Firebase", async () => {
      await render(action({ oobCode: null }));
      expect(mocks.verifyPasswordResetCode).not.toHaveBeenCalled();
      expect(container.querySelector(".AuthError")!.textContent).toContain("invalid");
    });

    it("holds the save button until the password meets the policy and matches", async () => {
      mocks.verifyPasswordResetCode.mockResolvedValue("a@b.co");
      await render(action({}));
      const save = () => button("Save password") as HTMLButtonElement;

      fill("short", "short");
      expect(save().disabled).toBe(true);
      expect(container.textContent).toContain("Needs more characters");

      fill("long-enough", "long-enoug");
      expect(save().disabled).toBe(true);
      expect(container.textContent).toContain("Doesn't match");

      fill("long-enough", "long-enough");
      expect(save().disabled).toBe(false);
    });

    it("saves the new password and offers to log in", async () => {
      mocks.verifyPasswordResetCode.mockResolvedValue("a@b.co");
      mocks.confirmPasswordReset.mockResolvedValue(undefined);
      await render(action({}));
      fill("long-enough", "long-enough");
      await act(async () => button("Save password")!.click());

      expect(mocks.confirmPasswordReset).toHaveBeenCalledWith(mocks.auth, "code-1", "long-enough");
      expect(container.textContent).toContain("Your password has been changed");
      expect(button("Log in")!.getAttribute("href")).toBe("/login");
      expect(mocks.signOut).not.toHaveBeenCalled();
    });

    it("signs out a session for the same account, whose tokens the reset revokes", async () => {
      mocks.auth.currentUser = { email: "A@b.co", reload: vi.fn() };
      mocks.verifyPasswordResetCode.mockResolvedValue("a@b.co");
      mocks.confirmPasswordReset.mockResolvedValue(undefined);
      mocks.signOut.mockResolvedValue(undefined);
      await render(action({}));
      fill("long-enough", "long-enough");
      await act(async () => button("Save password")!.click());

      expect(mocks.signOut).toHaveBeenCalled();
    });

    it("keeps the form when saving fails, with a message", async () => {
      mocks.verifyPasswordResetCode.mockResolvedValue("a@b.co");
      mocks.confirmPasswordReset.mockRejectedValue({ code: "auth/weak-password" });
      await render(action({}));
      fill("long-enough", "long-enough");
      await act(async () => button("Save password")!.click());

      expect(container.querySelector(".AuthError")!.textContent).toContain("stronger password");
      expect(button("Save password")).toBeDefined();
      expect(mocks.reportError).not.toHaveBeenCalled();
    });
  });

  describe("email links", () => {
    it("verifies an email once, even under StrictMode", async () => {
      const reload = vi.fn().mockResolvedValue(undefined);
      const getIdToken = vi.fn().mockResolvedValue("token");
      mocks.auth.currentUser = { email: "a@b.co", reload, getIdToken };
      mocks.applyActionCode.mockResolvedValue(undefined);
      await render(action({ mode: "verifyEmail", continuePath: null }));

      expect(mocks.applyActionCode).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalled();
      // A fresh token, so the app and callables see the confirmation.
      expect(getIdToken).toHaveBeenCalledWith(true);
      expect(container.textContent).toContain("Your email is verified");
      expect(button("Continue")!.getAttribute("href")).toBe("/");
    });

    it("reports an unexpected failure", async () => {
      mocks.applyActionCode.mockRejectedValue({ code: "auth/internal-error" });
      await render(action({ mode: "verifyEmail" }));

      expect(container.querySelector(".AuthError")).not.toBeNull();
      expect(mocks.reportError).toHaveBeenCalledWith(
        { code: "auth/internal-error" },
        { feature: "account", action: "apply_verifyEmail" },
      );
    });

    it("restores an email and offers a password reset for it", async () => {
      mocks.checkActionCode.mockResolvedValue({ data: { email: "old@b.co" } });
      mocks.applyActionCode.mockResolvedValue(undefined);
      mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
      await render(action({ mode: "recoverEmail" }));

      expect(container.textContent).toContain("changed back to old@b.co");
      await act(async () => button("Send reset link")!.click());
      expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
        mocks.auth,
        "old@b.co",
        expect.anything(),
      );
      expect(container.textContent).toContain("Reset link sent");
    });
  });

  it("rejects a link with an unknown mode", async () => {
    await render(action({ mode: null }));
    expect(container.querySelector(".AuthError")!.textContent).toContain("invalid");
  });
});
