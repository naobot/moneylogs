import { Directory, Filesystem } from "@capacitor/filesystem";
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

const toBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

/**
 * Opens the system share sheet for an image (a share card). In the app the image goes
 * through a cache file, since the native sheet takes file URIs; in a browser it needs
 * file sharing (most phones, few desktops). "unavailable" means the caller should offer
 * saving it instead (downloadBlob).
 */
export const shareImage = async ({
  blob,
  filename,
  title,
}: {
  blob: Blob;
  filename: string;
  title: string;
}): Promise<ShareResult> => {
  if (isNative()) {
    let uri: string;
    try {
      ({ uri } = await Filesystem.writeFile({
        path: filename,
        data: await toBase64(blob),
        directory: Directory.Cache,
      }));
    } catch {
      return "unavailable";
    }
    try {
      await Share.share({ title, files: [uri], dialogTitle: title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const share = webShare();
  if (!share || typeof navigator.canShare !== "function") return "unavailable";
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (!navigator.canShare({ files: [file] })) return "unavailable";
  try {
    await share({ files: [file], title });
    return "shared";
  } catch (err) {
    return (err as { name?: string })?.name === "AbortError" ? "cancelled" : "unavailable";
  }
};

/** Whether this device can share an image file (so the button says SHARE, not DOWNLOAD). */
export const canShareImages = (): boolean => {
  if (isNative()) return true;
  if (!webShare() || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "card.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

/** Saves a blob as a download (the browser fallback when there's no share sheet). */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a moment to start before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
