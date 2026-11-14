import { Capacitor } from "@capacitor/core";

export type NativePlatform = "ios" | "android";

/** True inside the Capacitor shell (iOS or Android app), false in any browser. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Which app this is, or null on the web. */
export const nativePlatform = (): NativePlatform | null => {
  if (!isNative()) return null;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : null;
};
