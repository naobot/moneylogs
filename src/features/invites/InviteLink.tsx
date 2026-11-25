import { useEffect, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";

import CopyTextArea from "@/features/layout/components/CopyTextArea";
import RowButton from "@/components/RowButton";
import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";
import { shareUrl } from "@/utils/shareUrl";
import { invitePath } from "@/utils/invites";
import { useConfirmEmail } from "@/features/account/confirmEmail/confirmEmailContext";
import { isEmailUnconfirmedError } from "@/utils/confirmedEmail";
import { getInviteCode } from "./invites";

/**
 * Your personal invite link, made on first view. Whoever opens it becomes your friend,
 * so it can be reset if it's gone further than you meant. Needs a confirmed email: until
 * then there's no link, just the way to confirm.
 */
export const InviteLink = () => {
  const { showToast } = useToastContext();
  const { confirmed, ensureConfirmed } = useConfirmEmail();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // The server said "confirm first" though the app thought they had (e.g. a stale
  // account): ask, and try again once they have.
  const [serverUnconfirmed, setServerUnconfirmed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!confirmed) return;
    let live = true;
    getInviteCode()
      .then((c) => live && setCode(c))
      .catch((error) => {
        if (isEmailUnconfirmedError(error)) {
          if (live) setServerUnconfirmed(true);
          return;
        }
        reportError(error, { feature: "friends", action: "get_invite_code" });
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [confirmed, attempt]);

  const confirmThenRetry = async () => {
    // After a server rejection the cached "confirmed" can't be trusted: check again.
    if (!(await ensureConfirmed({ recheck: serverUnconfirmed }))) return;
    setServerUnconfirmed(false);
    setAttempt((n) => n + 1);
  };

  const reset = async () => {
    if (!window.confirm("Reset your invite link? The old one will stop working.")) return;
    setResetting(true);
    try {
      setCode(await getInviteCode(true));
      showToast("New invite link ready", "success");
    } catch (error) {
      if (isEmailUnconfirmedError(error)) {
        setServerUnconfirmed(true);
        return;
      }
      reportError(error, { feature: "friends", action: "reset_invite_code" });
      showToast("That didn't work. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="InviteLink">
      <h4>invite a friend</h4>
      <p>Send this link to someone you'd like to invite. When they open it, you'll be friends.</p>
      {!confirmed || serverUnconfirmed ? (
        <>
          <p>Confirm your email address to get your invite link.</p>
          <div className="InviteLink__actions">
            <RowButton onClick={() => void confirmThenRetry()}>confirm email</RowButton>
          </div>
        </>
      ) : failed ? (
        <p>Your invite link couldn't be loaded. Please try again later.</p>
      ) : code ? (
        <>
          <CopyTextArea value={shareUrl(invitePath(code))} shareContent="friend_invite" />
          <div className="InviteLink__actions">
            <RowButton disabled={resetting} onClick={() => void reset()}>
              reset link
            </RowButton>
          </div>
        </>
      ) : (
        <p aria-busy="true">
          making your link
          <LoadingDots label="" />
        </p>
      )}
    </div>
  );
};

export default InviteLink;
