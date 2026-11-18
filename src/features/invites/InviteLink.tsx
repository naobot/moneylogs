import { useEffect, useState } from "react";

import CopyTextArea from "@/features/layout/components/CopyTextArea";
import RowButton from "@/components/RowButton";
import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";
import { shareUrl } from "@/utils/shareUrl";
import { invitePath } from "@/utils/invites";
import { getInviteCode } from "./invites";

/**
 * Your personal invite link, made on first view. Whoever opens it becomes your friend,
 * so it can be reset if it's gone further than you meant.
 */
export const InviteLink = () => {
  const { showToast } = useToastContext();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let live = true;
    getInviteCode()
      .then((c) => live && setCode(c))
      .catch((error) => {
        reportError(error, { feature: "friends", action: "get_invite_code" });
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const reset = async () => {
    if (!window.confirm("Reset your invite link? The old one will stop working.")) return;
    setResetting(true);
    try {
      setCode(await getInviteCode(true));
      showToast("New invite link ready", "success");
    } catch (error) {
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
      {failed ? (
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
        <p aria-busy="true">making your link…</p>
      )}
    </div>
  );
};

export default InviteLink;
