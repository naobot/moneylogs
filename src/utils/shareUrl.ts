import { publicHost } from "@/platform";

/**
 * An absolute, copy-pastable link to an in-app path, e.g. `https://moneylogs.app/g/abc/invite`.
 * Always https — a bare host pastes as text that many apps won't linkify. The host comes
 * from the platform adapter, so a native build (served from localhost) links to the
 * public domain.
 */
export const shareUrl = (path: string, host: string = publicHost()): string =>
  `https://${host}${path.startsWith("/") ? path : `/${path}`}`;
