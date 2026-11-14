/** Routes where the one-time "set your default currency" prompt never shows. */
const QUIET_PATHS = ["/login", "/welcome", "/about"];

/**
 * Existing accounts predate the default currency, so they're asked for one once. New
 * accounts pick theirs in the welcome wizard, so they're never asked while it's pending.
 */
export const needsDefaultCurrencyPrompt = (
  user: { defaultCurrency?: string; onboardingPending?: boolean } | undefined,
  pathname: string,
): boolean =>
  !!user &&
  !user.defaultCurrency &&
  !user.onboardingPending &&
  !QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
