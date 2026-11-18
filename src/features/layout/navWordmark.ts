/**
 * Pages that show a signed-out visitor their own big "moneylogs" heading: the login page,
 * and the landing page that `/` and the invite links fall back to (see App.tsx). The nav's
 * corner wordmark would only repeat it there. Everywhere else (a public log, /about) it's
 * the only branding on the page, so it stays.
 */
const OWN_HEADING = [/^\/login\/?$/, /^\/$/, /^\/invite\/[^/]+\/?$/, /^\/[gl]\/[^/]+\/invite\/?$/];

export const showNavWordmark = (isLoggedIn: boolean, pathname: string): boolean =>
  isLoggedIn || !OWN_HEADING.some((page) => page.test(pathname));
