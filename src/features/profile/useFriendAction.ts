import { useState } from "react";

import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";

/**
 * Run one friend callable at a time with a pending flag, and a toast if it fails. The
 * friendships listener updates the UI, so callers don't need the result.
 */
export const useFriendAction = () => {
  const { showToast } = useToastContext();
  const [pending, setPending] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    if (pending) return;
    setPending(key);
    try {
      await action();
      if (success) showToast(success, "success");
    } catch (err) {
      reportError(err, { feature: "friends", action: key });
      showToast("That didn't work. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return { run, pending };
};
