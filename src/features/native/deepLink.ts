import { PUBLIC_HOST } from "@/platform";

/** Path prefixes the OS hands to the app (the same list as .well-known and the manifest). */
const APP_PATHS = [
  /^\/g\/[^/]+(\/invite)?\/?$/,
  /^\/l\/[^/]+(\/(stats|invite))?\/?$/,
  /^\/notifications\/?$/,
];

/**
 * The in-app route for a universal / app link, with its query and hash, or null for
 * anything the app shouldn't open: another host, a non-https scheme, or an unknown path.
 */
export const deepLinkPath = (url: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.host !== PUBLIC_HOST) return null;
  if (!APP_PATHS.some((pattern) => pattern.test(parsed.pathname))) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};
