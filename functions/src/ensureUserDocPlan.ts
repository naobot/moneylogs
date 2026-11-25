/**
 * The user doc to make for a signed-in account that has none. Registration makes it on
 * the client right after creating the Auth account; if that second step never lands (the
 * app closed, the network dropped), the person is left with a login and no profile, and
 * every retry says the email is taken. This is the same doc registration would have made,
 * so they go through the welcome wizard as usual.
 *
 * Keep in step with src/hooks/useRegisterNewUser.ts and src/features/auth/authRedirect.ts
 * (placeholderDisplayName) / guest.ts (GUEST_DISPLAY_NAME).
 */
export type NewUserDocFields = {
  userId: string;
  displayName: string;
  email: string | null;
  groups: never[];
  onboardingPending: true;
};

export const GUEST_DISPLAY_NAME = "guest";

export const placeholderDisplayName = (email: string): string =>
  email.split("@")[0]?.trim() || "new user";

export const planNewUserDoc = (
  uid: string,
  token: { email?: string; firebase?: { sign_in_provider?: string } },
): NewUserDocFields => {
  const email = token.firebase?.sign_in_provider === "anonymous" ? null : (token.email ?? null);
  return {
    userId: uid,
    displayName: email ? placeholderDisplayName(email) : GUEST_DISPLAY_NAME,
    email,
    groups: [],
    onboardingPending: true,
  };
};
