import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import type { Auth } from "firebase/auth";

import {
  continuePathFrom,
  getActionLinkErrorMessage,
  getResetConfirmErrorMessage,
  isExpectedActionError,
  isExpectedResetRequestError,
  isSilentResetError,
  parseAuthAction,
  resetActionSettings,
  sendResetEmail,
} from "@/features/auth/passwordReset";

const { mockSendReset } = vi.hoisted(() => ({ mockSendReset: vi.fn() }));

vi.mock("firebase/auth", () => ({ sendPasswordResetEmail: mockSendReset }));

const auth = {} as Auth;

describe("resetActionSettings", () => {
  it("continues to the login page on this host", () => {
    expect(resetActionSettings()).toEqual({ url: `https://${window.location.host}/login` });
  });
});

describe("sendResetEmail", () => {
  beforeEach(() => mockSendReset.mockReset());

  it("sends the link with a way back to the app", async () => {
    mockSendReset.mockResolvedValueOnce(undefined);
    await sendResetEmail(auth, "a@b.co");
    expect(mockSendReset).toHaveBeenCalledTimes(1);
    expect(mockSendReset).toHaveBeenCalledWith(auth, "a@b.co", resetActionSettings());
  });

  it("retries without a continue URL when this host isn't authorised for one", async () => {
    mockSendReset
      .mockRejectedValueOnce({ code: "auth/unauthorized-continue-uri" })
      .mockResolvedValueOnce(undefined);
    await sendResetEmail(auth, "a@b.co");
    expect(mockSendReset).toHaveBeenCalledTimes(2);
    expect(mockSendReset).toHaveBeenLastCalledWith(auth, "a@b.co");
  });

  it("passes other errors through without retrying", async () => {
    mockSendReset.mockRejectedValueOnce({ code: "auth/too-many-requests" });
    await expect(sendResetEmail(auth, "a@b.co")).rejects.toEqual({
      code: "auth/too-many-requests",
    });
    expect(mockSendReset).toHaveBeenCalledTimes(1);
  });
});

describe("continuePathFrom", () => {
  it("keeps the path, query and hash of a link back to this host", () => {
    expect(continuePathFrom("https://localhost:5173/login?x=1#y", "localhost:5173")).toBe(
      "/login?x=1#y",
    );
  });

  it("accepts the public host (links sent from the native app)", () => {
    expect(continuePathFrom("https://moneylogs.app/me", "localhost")).toBe("/me");
  });

  it("rejects other hosts, other schemes and junk", () => {
    expect(continuePathFrom("https://evil.example/login", "moneylogs.app")).toBeNull();
    expect(continuePathFrom("javascript:alert(1)", "moneylogs.app")).toBeNull();
    expect(continuePathFrom("not a url", "moneylogs.app")).toBeNull();
    expect(continuePathFrom(null, "moneylogs.app")).toBeNull();
  });
});

describe("parseAuthAction", () => {
  it("reads a reset link", () => {
    const search =
      "?mode=resetPassword&oobCode=abc123&apiKey=k&continueUrl=" +
      encodeURIComponent("https://moneylogs.app/login") +
      "&lang=en";
    expect(parseAuthAction(search, "moneylogs.app")).toEqual({
      mode: "resetPassword",
      oobCode: "abc123",
      continuePath: "/login",
    });
  });

  it("knows each email mode Firebase sends", () => {
    for (const mode of ["verifyEmail", "verifyAndChangeEmail", "recoverEmail"]) {
      expect(parseAuthAction(`?mode=${mode}&oobCode=x`).mode).toBe(mode);
    }
  });

  it("returns nulls for an unknown mode or a missing code", () => {
    expect(parseAuthAction("?mode=signIn&oobCode=x").mode).toBeNull();
    expect(parseAuthAction("?mode=resetPassword")).toEqual({
      mode: "resetPassword",
      oobCode: null,
      continuePath: null,
    });
  });
});

describe("reset request errors", () => {
  it("stays silent about accounts that don't exist", () => {
    expect(isSilentResetError("auth/user-not-found")).toBe(true);
    expect(isSilentResetError("auth/too-many-requests")).toBe(false);
    expect(isSilentResetError(undefined)).toBe(false);
  });

  it("doesn't report mistakes the user can fix", () => {
    expect(isExpectedResetRequestError("auth/invalid-email")).toBe(true);
    expect(isExpectedResetRequestError("auth/too-many-requests")).toBe(true);
    expect(isExpectedResetRequestError("auth/internal-error")).toBe(false);
  });
});

describe("action link errors", () => {
  it("tells expired links apart from used ones", () => {
    expect(getActionLinkErrorMessage("auth/expired-action-code")).toContain("expired");
    expect(getActionLinkErrorMessage("auth/invalid-action-code")).toContain("already been used");
  });

  it("has a fallback for anything else", () => {
    expect(getActionLinkErrorMessage("auth/internal-error")).toContain("Couldn't open this link");
  });

  it("asks for a stronger password when saving a weak one", () => {
    expect(getResetConfirmErrorMessage("auth/weak-password")).toBe(
      "Please choose a stronger password.",
    );
    expect(getResetConfirmErrorMessage("auth/expired-action-code")).toContain("expired");
    expect(getResetConfirmErrorMessage(undefined)).toContain("Couldn't change your password");
  });

  it("only reports unexpected codes", () => {
    expect(isExpectedActionError("auth/expired-action-code")).toBe(true);
    expect(isExpectedActionError("auth/internal-error")).toBe(false);
    expect(isExpectedActionError(undefined)).toBe(false);
  });
});
