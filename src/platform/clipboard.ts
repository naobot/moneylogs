/**
 * Copies text to the system clipboard. Resolves false instead of throwing when the
 * clipboard is unavailable (insecure context, denied permission, old WebView).
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
