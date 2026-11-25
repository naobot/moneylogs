import { useState } from "react";

import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";
import { track } from "@/utils/analytics";
import { isEmailUnconfirmedError } from "@/utils/confirmedEmail";
import { useConfirmEmail } from "@/features/account/confirmEmail/confirmEmailContext";

/**
 * Run one friend callable at a time with a pending flag, and a toast if it fails. The
 * friendships listener updates the UI, so callers don't need the result. Sending a request
 * needs a confirmed email; answering one doesn't.
 */
export const useFriendAction = () => {
  const { showToast } = useToastContext();
  const { ensureConfirmed, showConfirmEmail } = useConfirmEmail();
  const [pending, setPending] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    if (pending) return;
    // Keys are "request" / "accept", or "accept-<id>" in lists.
    const kind = key.split("-")[0];
    setPending(key);
    try {
      if (kind === "request" && !(await ensureConfirmed())) return;
      await action();
      if (kind === "request") track("send_friend_request");
      else if (kind === "accept") track("accept_friend");
      if (success) showToast(success, "success");
    } catch (err) {
      if (isEmailUnconfirmedError(err)) return showConfirmEmail();
      reportError(err, { feature: "friends", action: key });
      showToast("That didn't work. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return { run, pending };
};
