/**
 * An absolute, copy-pastable link to an in-app path, e.g. `https://moneylogs.app/g/abc/invite`.
 * Always https — `window.location.host` alone pastes as a bare host that many apps won't linkify.
 */
export const shareUrl = (path: string, host: string = window.location.host): string =>
  `https://${host}${path.startsWith("/") ? path : `/${path}`}`;
