/**
 * Platform adapter: the browser APIs the app relies on, behind one seam so a native
 * (Capacitor) build can supply its own implementations without touching components.
 * Reach for these instead of localStorage, navigator.clipboard or window.location.host.
 */
export { storage } from "./storage";
export { copyText } from "./clipboard";
export { isExternalUrl, publicHost, publicUrl, PUBLIC_HOST } from "./links";
export { canShare, shareLink, type ShareResult } from "./share";
export { isNative, nativePlatform, type NativePlatform } from "./native";
