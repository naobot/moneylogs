/**
 * Platform adapter: the browser APIs the app relies on, behind one seam so a native
 * (Capacitor) build can supply its own implementations without touching components.
 * Reach for these instead of localStorage, navigator.clipboard or window.location.host.
 */
export { storage } from "./storage";
export { copyText } from "./clipboard";
export { isExternalUrl, publicHost } from "./links";
