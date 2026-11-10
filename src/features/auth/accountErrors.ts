/**
 * Messages for account changes made while signed in (/me). Kept apart from the login
 * messages because "incorrect email or password" would be wrong here: only the current
 * password is being checked.
 */
export const getPasswordChangeErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Your current password is incorrect.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Please choose a stronger new password.";
    case "auth/requires-recent-login":
      return "For your security, please sign out, sign back in, and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "You appear to be offline. Please try again when connected.";
    default:
      return "Couldn't change your password. Please try again.";
  }
};

export const getResetEmailErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/too-many-requests":
      return "Too many requests. Please wait a while before asking for another link.";
    case "auth/network-request-failed":
      return "You appear to be offline. Please try again when connected.";
    default:
      return "Couldn't send the reset email. Please try again.";
  }
};

/**
 * Client-side checks before asking Firebase to change the password. Returns the first
 * problem to show, or null when the form can be submitted. `meetsPolicy` comes from the
 * project's password policy (useValidatePassword).
 */
export const validatePasswordChange = ({
  current,
  next,
  confirm,
  meetsPolicy,
}: {
  current: string;
  next: string;
  confirm: string;
  meetsPolicy: boolean;
}): string | null => {
  if (!current || !next || !confirm) return "Fill in all three fields.";
  if (next === current) return "Your new password must be different from the current one.";
  if (!meetsPolicy) return "Your new password doesn't meet the password requirements.";
  if (next !== confirm) return "The new passwords don't match.";
  return null;
};
