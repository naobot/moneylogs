/**
 * Whether `href` points away from the app. Relative links resolve against `base` (the
 * current page by default); anything that can't be parsed counts as internal.
 */
export const isExternalUrl = (href: string, base: string = window.location.href): boolean => {
  try {
    return new URL(href, base).origin !== new URL(base).origin;
  } catch {
    return false;
  }
};

/**
 * The host other people reach the app on, for links meant to be shared (invites).
 * On the web that's wherever this page is served from. A native build serves itself from
 * localhost, so it will return the public Hosting domain instead.
 */
export const publicHost = (): string => window.location.host;
