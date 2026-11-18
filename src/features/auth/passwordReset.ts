import { ActionCodeSettings, Auth, sendPasswordResetEmail } from "firebase/auth";

import { PUBLIC_HOST, publicUrl } from "@/platform";

/** Where the custom email action handler lives (set as the action URL in the Firebase console). */
export const AUTH_ACTION_PATH = "/auth/action";

/**
 * Where a reset link sends the user once the new password is saved: back to the login
 * page on the host they asked from (the public host from a native build, which serves
 * itself from localhost).
 */
export const resetActionSettings = (): ActionCodeSettings => ({ url: publicUrl("/login") });

/**
 * Emails a reset link that leads back to the app. A host Firebase hasn't authorised as a
 * continue URL (e.g. a PR preview channel) would fail the whole request, so we retry
 * without one: the link still works, it just doesn't offer the way back.
 */
export const sendResetEmail = async (auth: Auth, email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email, resetActionSettings());
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "auth/unauthorized-continue-uri" && code !== "auth/invalid-continue-uri") {
      throw err;
    }
    await sendPasswordResetEmail(auth, email);
  }
};

// Firebase's enumeration protection hides whether an account exists; with it off,
// "user-not-found" would leak that. Either way the user sees the same neutral message.
const SILENT_RESET_CODES = new Set(["auth/user-not-found"]);

export const isSilentResetError = (code?: string): boolean =>
  !!code && SILENT_RESET_CODES.has(code);

const EXPECTED_RESET_CODES = new Set([
  "auth/invalid-email",
  "auth/missing-email",
  "auth/too-many-requests",
  "auth/network-request-failed",
  "auth/user-not-found",
]);

/** Requesting a reset link: mistakes the user can fix, not worth reporting. */
export const isExpectedResetRequestError = (code?: string): boolean =>
  !!code && EXPECTED_RESET_CODES.has(code);

export type AuthActionMode =
  | "resetPassword"
  | "verifyEmail"
  | "verifyAndChangeEmail"
  | "recoverEmail";

const AUTH_ACTION_MODES: AuthActionMode[] = [
  "resetPassword",
  "verifyEmail",
  "verifyAndChangeEmail",
  "recoverEmail",
];

export type AuthAction = {
  mode: AuthActionMode | null;
  oobCode: string | null;
  /** The in-app path to offer once done, if the link carried a continue URL of ours. */
  continuePath: string | null;
};

/**
 * An internal path from a continue URL, or null. Only links back to this host or the
 * public one count, so a crafted link can't bounce someone off-site after resetting.
 */
export const continuePathFrom = (
  continueUrl: string | null,
  currentHost: string = window.location.host,
): string | null => {
  if (!continueUrl) return null;
  let url: URL;
  try {
    url = new URL(continueUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.host !== currentHost && url.host !== PUBLIC_HOST) return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
};

/** Reads Firebase's email action link (`?mode=…&oobCode=…&continueUrl=…`). */
export const parseAuthAction = (
  search: string,
  currentHost: string = window.location.host,
): AuthAction => {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  return {
    mode: AUTH_ACTION_MODES.includes(mode as AuthActionMode) ? (mode as AuthActionMode) : null,
    oobCode: params.get("oobCode") || null,
    continuePath: continuePathFrom(params.get("continueUrl"), currentHost),
  };
};

/** The link itself is bad: used, expired, or mangled. Nothing to report. */
const EXPECTED_ACTION_CODES = new Set([
  "auth/expired-action-code",
  "auth/invalid-action-code",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/weak-password",
  "auth/password-does-not-meet-requirements",
  "auth/too-many-requests",
  "auth/network-request-failed",
]);

export const isExpectedActionError = (code?: string): boolean =>
  !!code && EXPECTED_ACTION_CODES.has(code);

/** Opening an emailed link, before anything is asked of the user. */
export const getActionLinkErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/expired-action-code":
      return "This link has expired. Please ask for a new one.";
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used. Please ask for a new one.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
      return "This account no longer exists.";
    case "auth/network-request-failed":
      return "You appear to be offline. Please try again when connected.";
    default:
      return "Couldn't open this link. Please try again or ask for a new one.";
  }
};

/** Saving the new password from a reset link. */
export const getResetConfirmErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Please choose a stronger password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
    case "auth/user-disabled":
    case "auth/user-not-found":
    case "auth/network-request-failed":
      return getActionLinkErrorMessage(code);
    default:
      return "Couldn't change your password. Please try again.";
  }
};
