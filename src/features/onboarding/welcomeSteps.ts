import { Currency } from "@/types/user";
import { isCurrency } from "@/utils/currency";

export type WelcomeStep = "name" | "location" | "timezone" | "display" | "currency";

export const WELCOME_STEPS: WelcomeStep[] = ["name", "location", "timezone", "display", "currency"];

export const WELCOME_STEP_LABELS: Record<WelcomeStep, string> = {
  name: "Name",
  location: "Location",
  timezone: "Timezone",
  display: "Display",
  currency: "Currency",
};

export type WelcomeState = {
  displayName: string;
  displayLocation: string;
  timezone: string;
  defaultCurrency: Currency;
};

export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_DISPLAY_LOCATION_LENGTH = 40;

export const displayNameError = (name: string): string | undefined => {
  if (!name.trim()) return "Pick a name to show everyone";
  if (name.trim().length > MAX_DISPLAY_NAME_LENGTH)
    return `Keep it to ${MAX_DISPLAY_NAME_LENGTH} characters or fewer`;
  return undefined;
};

export const displayLocationError = (location: string): string | undefined =>
  location.trim().length > MAX_DISPLAY_LOCATION_LENGTH
    ? `Keep it to ${MAX_DISPLAY_LOCATION_LENGTH} characters or fewer`
    : undefined;

export const isWelcomeStepValid = (step: WelcomeStep, s: WelcomeState): boolean => {
  switch (step) {
    case "name":
      return !displayNameError(s.displayName);
    case "location":
      // Optional: an empty location is fine.
      return !displayLocationError(s.displayLocation);
    case "timezone":
      return !!s.timezone;
    case "display":
      return true;
    case "currency":
      return isCurrency(s.defaultCurrency);
  }
};

/**
 * Clamp a requested step index (e.g. from the URL after a refresh) to the furthest step
 * the user can actually reach, so nobody lands past a step that still needs an answer.
 */
export const reachableWelcomeStep = (requested: number, s: WelcomeState): number => {
  const target = Math.max(
    0,
    Math.min(Number.isFinite(requested) ? Math.floor(requested) : 0, WELCOME_STEPS.length - 1),
  );
  for (let i = 0; i < target; i++) {
    if (!isWelcomeStepValid(WELCOME_STEPS[i], s)) return i;
  }
  return target;
};

/** Paths a user with an unfinished welcome wizard may still visit. */
const ONBOARDING_OPEN_PATHS = ["/welcome", "/login", "/about"];

/**
 * Where to send a user who hasn't finished the welcome wizard, or null to let them be.
 * The place they were headed rides along as `next`, so an invite link still works once
 * they're set up.
 */
export const onboardingRedirect = (
  user: { onboardingPending?: boolean } | undefined,
  location: { pathname: string; search?: string; hash?: string },
): string | null => {
  if (!user?.onboardingPending) return null;
  const { pathname, search = "", hash = "" } = location;
  if (ONBOARDING_OPEN_PATHS.includes(pathname)) return null;
  const from = `${pathname}${search}${hash}`;
  return from === "/" ? "/welcome" : `/welcome?next=${encodeURIComponent(from)}`;
};
