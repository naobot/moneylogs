/**
 * Turns Firebase's PasswordValidationStatus into plain-language requirements the
 * password still misses. Each `contains…`/`meets…` flag is undefined when the project
 * policy doesn't require it, false when required but unmet.
 */
type StatusLike = {
  isValid: boolean;
  meetsMinPasswordLength?: boolean;
  meetsMaxPasswordLength?: boolean;
  containsLowercaseLetter?: boolean;
  containsUppercaseLetter?: boolean;
  containsNumericCharacter?: boolean;
  containsNonAlphanumericCharacter?: boolean;
  passwordPolicy?: {
    customStrengthOptions?: { minPasswordLength?: number; maxPasswordLength?: number };
  };
};

export const unmetPasswordRequirements = (status?: StatusLike): string[] => {
  if (!status || status.isValid) return [];
  const options = status.passwordPolicy?.customStrengthOptions;
  const unmet: string[] = [];
  if (status.meetsMinPasswordLength === false) {
    unmet.push(
      options?.minPasswordLength
        ? `at least ${options.minPasswordLength} characters`
        : "more characters",
    );
  }
  if (status.meetsMaxPasswordLength === false) {
    unmet.push(
      options?.maxPasswordLength
        ? `at most ${options.maxPasswordLength} characters`
        : "fewer characters",
    );
  }
  if (status.containsLowercaseLetter === false) unmet.push("a lowercase letter");
  if (status.containsUppercaseLetter === false) unmet.push("an uppercase letter");
  if (status.containsNumericCharacter === false) unmet.push("a number");
  if (status.containsNonAlphanumericCharacter === false) unmet.push("a symbol (e.g. ! or #)");
  return unmet;
};

/** "Needs at least 8 characters, an uppercase letter and a number." */
export const describePasswordRequirements = (status?: StatusLike): string | null => {
  if (!status || status.isValid) return null;
  const unmet = unmetPasswordRequirements(status);
  if (unmet.length === 0) return "Doesn't meet the password requirements.";
  const list =
    unmet.length === 1
      ? unmet[0]
      : `${unmet.slice(0, -1).join(", ")} and ${unmet[unmet.length - 1]}`;
  return `Needs ${list}.`;
};
