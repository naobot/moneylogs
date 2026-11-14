export interface AuthLocationState {
  view?: string;
  from?: string;
}

// Only allow internal paths as a post-auth destination. Rejects absolute URLs
// and protocol-relative URLs ("//evil.com"), which window.location.href would
// otherwise follow off-site.
export const sanitizeRedirect = (from?: string): string | undefined => {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return undefined;
  return from;
};

// Invited users are most likely new, so land them on the registration view
// unless a view was explicitly requested.
export const initialAuthView = (state?: AuthLocationState | null): string => {
  if (state?.view) return state.view;
  return sanitizeRedirect(state?.from)?.includes("/invite") ? "register" : "login";
};

// After registering, everyone goes through /welcome; an internal destination rides along
// as ?next= so e.g. an invite link still lands once they're set up.
export const welcomePath = (redirectTo?: string): string => {
  const next = sanitizeRedirect(redirectTo);
  return next && next !== "/" ? `/welcome?next=${encodeURIComponent(next)}` : "/welcome";
};

// Something to show until the welcome wizard asks for a real name: the email's local part.
export const placeholderDisplayName = (email: string): string =>
  email.split("@")[0]?.trim() || "new user";
