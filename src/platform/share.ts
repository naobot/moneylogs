import { Share } from "@capacitor/share";
import { isNative } from "./native";

export type ShareResult = "shared" | "cancelled" | "unavailable";

const webShare = (): ((data: ShareData) => Promise<void>) | null =>
  typeof navigator !== "undefined" && typeof navigator.share === "function"
    ? navigator.share.bind(navigator)
    : null;

/** Whether this device has a share sheet: always in the app, sometimes in a browser. */
export const canShare = (): boolean => isNative() || webShare() !== null;

/**
 * Opens the system share sheet for a link. Closing the sheet without sharing is
 * "cancelled", not a failure; "unavailable" means the caller should offer copying.
 */
export const shareLink = async ({
  title,
  url,
}: {
  title: string;
  url: string;
}): Promise<ShareResult> => {
  if (isNative()) {
    try {
      await Share.share({ title, url, dialogTitle: title });
      return "shared";
    } catch {
      // The plugin rejects when the sheet is dismissed.
      return "cancelled";
    }
  }
  const share = webShare();
  if (!share) return "unavailable";
  try {
    await share({ title, url });
    return "shared";
  } catch (err) {
    return (err as { name?: string })?.name === "AbortError" ? "cancelled" : "unavailable";
  }
};
