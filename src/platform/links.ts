import { isNative } from "./native";

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

/** Where the app is served publicly; native builds link here (and open its links). */
export const PUBLIC_HOST = "moneylogs.app";

/**
 * The host other people reach the app on, for links meant to be shared (invites).
 * On the web that's wherever this page is served from, so previews and local dev share
 * their own links. A native build serves itself from localhost, so it uses PUBLIC_HOST.
 */
export const publicHost = (): string => (isNative() ? PUBLIC_HOST : window.location.host);

/** A full link to `path` that works for someone else, e.g. in a share sheet. */
export const publicUrl = (path: string): string =>
  isNative() ? `https://${PUBLIC_HOST}${path}` : `${window.location.origin}${path}`;
