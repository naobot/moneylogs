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
