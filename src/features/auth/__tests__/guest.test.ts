import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

const fb = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string; isAnonymous: boolean } | null },
  signInAnonymously: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock("@/config/firebase-config", () => ({ auth: fb.auth, db: {} }));
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: vi.fn() },
  linkWithCredential: vi.fn(),
  sendEmailVerification: vi.fn(),
  signInAnonymously: fb.signInAnonymously,
}));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: fb.getDocs,
  limit: vi.fn(),
  query: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

import { getGuestSaveErrorMessage, isExpectedGuestSaveError, isGuest, startGuest } from "../guest";

describe("startGuest", () => {
  const addNewUser = vi.fn(async () => "doc-1");
  beforeEach(() => {
    vi.clearAllMocks();
    fb.auth.currentUser = null;
    fb.getDocs.mockResolvedValue({ empty: true, docs: [] });
    fb.signInAnonymously.mockImplementation(async () => {
      fb.auth.currentUser = { uid: "anon-1", isAnonymous: true };
      return { user: fb.auth.currentUser };
    });
  });

  it("signs in a new guest and makes their user doc", async () => {
    await startGuest(addNewUser);
    expect(fb.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(addNewUser).toHaveBeenCalledWith({
      userId: "anon-1",
      displayName: "guest",
      email: null,
    });
  });

  it("carries on with a signed-in guest and their user doc, never a second profile", async () => {
    fb.auth.currentUser = { uid: "anon-1", isAnonymous: true };
    fb.getDocs.mockResolvedValue({ empty: false, docs: [{ id: "doc-1" }] });
    const user = await startGuest(addNewUser);
    expect(user.uid).toBe("anon-1");
    expect(fb.signInAnonymously).not.toHaveBeenCalled();
    expect(addNewUser).not.toHaveBeenCalled();
  });

  it("never replaces a signed-in account with a guest", async () => {
    fb.auth.currentUser = { uid: "real-1", isAnonymous: false };
    await expect(startGuest(addNewUser)).rejects.toThrow("Already signed in");
    expect(fb.signInAnonymously).not.toHaveBeenCalled();
    expect(addNewUser).not.toHaveBeenCalled();
  });
});

describe("isGuest", () => {
  it("is an anonymous sign-in", () => {
    expect(isGuest({ isAnonymous: true })).toBe(true);
    expect(isGuest({ isAnonymous: false })).toBe(false);
    expect(isGuest(null)).toBe(false);
  });
});

describe("getGuestSaveErrorMessage", () => {
  it("explains a taken email without promising their guest logs come along", () => {
    for (const code of ["auth/email-already-in-use", "auth/credential-already-in-use"]) {
      expect(getGuestSaveErrorMessage(code)).toMatch(/already has an account/);
      expect(getGuestSaveErrorMessage(code)).toMatch(/won't come along/);
    }
  });

  it("reuses registration's wording for fixable mistakes", () => {
    expect(getGuestSaveErrorMessage("auth/invalid-email")).toBe(
      "Please enter a valid email address.",
    );
  });

  it("falls back to a save-specific message", () => {
    expect(getGuestSaveErrorMessage("auth/internal-error")).toBe(
      "Couldn't save your account. Please try again.",
    );
    expect(getGuestSaveErrorMessage()).toBe("Couldn't save your account. Please try again.");
  });

  it("treats taken emails as expected, not as bugs", () => {
    expect(isExpectedGuestSaveError("auth/credential-already-in-use")).toBe(true);
    expect(isExpectedGuestSaveError("auth/internal-error")).toBe(false);
  });
});
