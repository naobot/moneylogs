import {
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";

import { auth, db } from "@/config/firebase-config";
import { getRegistrationErrorMessage } from "./registrationErrors";

/**
 * Guests try moneylogs without an account: a Firebase anonymous sign-in with a user doc
 * like anyone's, so the welcome wizard and personal log work as usual. Saving the account
 * links an email and password to the same uid, so everything they logged carries over.
 *
 * Until then a guest can't reach out to anyone (they count as unconfirmed, see
 * utils/confirmedEmail.ts), can't accept invites or join someone else's log, and nothing
 * survives signing out. Guests left idle are cleaned up on the server.
 */

/** What a guest is called until the welcome wizard asks for a name. */
export const GUEST_DISPLAY_NAME = "guest";

export const isGuest = (user?: Pick<User, "isAnonymous"> | null): boolean => !!user?.isAnonymous;

type AddNewUser = (args: { userId: string; displayName: string; email: null }) => Promise<string>;

/** The signed-in person's user doc id, if they have one. */
const userDocIdOf = async (uid: string): Promise<string | null> => {
  const found = await getDocs(query(collection(db, "users"), where("userId", "==", uid), limit(1)));
  return found.empty ? null : found.docs[0].id;
};

/**
 * Sign in as a guest and make their user doc (onboarding still pending). Idempotent: a
 * guest who's already signed in carries on with the same uid and the same user doc, so
 * starting again never makes a second profile that could hide their progress.
 */
export const startGuest = async (addNewUser: AddNewUser) => {
  const current = auth.currentUser;
  const user = current?.isAnonymous ? current : (await signInAnonymously(auth)).user;
  if (!(await userDocIdOf(user.uid))) {
    await addNewUser({ userId: user.uid, displayName: GUEST_DISPLAY_NAME, email: null });
  }
  return user;
};

/**
 * Turn the signed-in guest into a real account with this email and password. Same uid,
 * so their logs stay theirs. The confirmation email is best effort: it can be resent.
 */
export const saveGuestAccount = async (userDocId: string, email: string, password: string) => {
  const guest = auth.currentUser;
  if (!guest || !guest.isAnonymous) throw new Error("Not a guest");
  const { user } = await linkWithCredential(guest, EmailAuthProvider.credential(email, password));
  await updateDoc(doc(db, "users", userDocId), { email: user.email ?? email });
  await sendEmailVerification(user).catch(() => undefined);
  return user;
};

// Mistakes they can fix themselves; anything else is worth reporting.
const EXPECTED_SAVE_CODES = new Set([
  "auth/email-already-in-use",
  "auth/credential-already-in-use",
  "auth/invalid-email",
  "auth/weak-password",
  "auth/missing-password",
  "auth/too-many-requests",
]);

export const isExpectedGuestSaveError = (code?: string): boolean =>
  !!code && EXPECTED_SAVE_CODES.has(code);

export const getGuestSaveErrorMessage = (code?: string): string => {
  switch (code) {
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
      // Signing in there would leave this guest's logs behind: say so plainly.
      return "That email already has an account. Use another, or sign out and sign in to it (what you logged as a guest won't come along).";
    case undefined:
    case "":
      return "Couldn't save your account. Please try again.";
    default: {
      const message = getRegistrationErrorMessage(code);
      return message.startsWith("Something went wrong")
        ? "Couldn't save your account. Please try again."
        : message;
    }
  }
};
