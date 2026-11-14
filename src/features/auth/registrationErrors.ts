// Mistakes the user can fix themselves; anything else is worth reporting.
const EXPECTED_REGISTRATION_CODES = new Set([
  "auth/email-already-in-use",
  "auth/invalid-email",
  "auth/weak-password",
  "auth/missing-password",
  "auth/too-many-requests",
]);

export const isExpectedRegistrationError = (code?: string): boolean =>
  !!code && EXPECTED_REGISTRATION_CODES.has(code);

export const getRegistrationErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Please choose a stronger password.";
    case "auth/operation-not-allowed":
      return "Registration is currently unavailable. Please try again later.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "Something went wrong creating your account. Please try again.";
  }
};
