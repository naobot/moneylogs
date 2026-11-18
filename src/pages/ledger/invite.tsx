import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { needsProfileSetup } from "@/utils/helpers";
import { useLedgerAccess } from "@/hooks/useLedgerAccess";
import { useLedgerQuery } from "@/hooks/useLedgerQuery";
import { writeSelfNotification } from "@/hooks/useNotifications";
import { clearLogInvite } from "@/features/invites/logInvites";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { reportError } from "@/utils/reportError";
import { track } from "@/utils/analytics";

/**
 * Non-members can't read a financial log (security rules), so the invite screen can't
 * show its title or remaining spots. Joining is a blind write that the rules accept only
 * while there's room; a rejection means the log is full or the link is wrong.
 */
export const LedgerInvitePage = () => {
  const navigate = useNavigate();
  const { ledgerId } = useParams();
  const { user } = useCurrentUser();
  // A one-time check, not a listener: see useLedgerAccess for why.
  const access = useLedgerAccess(ledgerId, user?.userId);
  const { joinLedger } = useLedgerQuery();

  const [joinFailed, setJoinFailed] = useState(false);
  const [showJoinedModal, setShowJoinedModal] = useState(false);

  // Already a member: the read succeeds, so go straight to the log.
  useEffect(() => {
    if (access === "member" && ledgerId && !showJoinedModal) {
      void navigate(`/l/${ledgerId}`, { replace: true });
    }
  }, [access, ledgerId, navigate, showJoinedModal]);

  const handleJoin = async () => {
    if (!user || !ledgerId) return;
    setJoinFailed(false);
    try {
      const title = await joinLedger.mutate({
        ledgerId,
        member: { uid: user.userId, userDocId: user.id },
      });
      track("join_log", { log_kind: "financial" });
      void writeSelfNotification({
        userDocId: user.id,
        prefs: user.notificationPrefs,
        type: "log_joined",
        groupId: ledgerId,
        groupName: title,
        logKind: "ledger",
      });
      clearLogInvite(user.id, ledgerId).catch((err) =>
        reportError(err, { feature: "log_invites", action: "clear_invite" }),
      );
      if (needsProfileSetup(user)) {
        setShowJoinedModal(true);
      } else {
        void navigate(`/l/${ledgerId}`, { replace: true });
      }
    } catch (error) {
      reportError(error, { feature: "ledger", action: "join_ledger" });
      setJoinFailed(true);
    }
  };

  const canAttemptJoin = (access === "not-member" || access === "not-found") && !showJoinedModal;

  // Not a blank page when the access check itself failed.
  if (access === "error") {
    return (
      <div className="InfoBox">
        Couldn't open this invite. Please check your connection and reload.
      </div>
    );
  }

  return (
    <>
      <Modal isOpen={canAttemptJoin}>
        <Modal.Header>{joinFailed ? "Couldn't join" : "Join a financial log"}</Modal.Header>
        <Modal.Body>
          {joinFailed ? (
            <>
              <p>This financial log is full, or the invite link is no longer valid.</p>
              <p>Ask whoever sent it for a new link.</p>
            </>
          ) : (
            <>
              <p>You've been invited to share a financial log.</p>
              <p>Members can see every entry in the log, including yours.</p>
            </>
          )}
        </Modal.Body>
        <Modal.Actions>
          {!joinFailed && (
            <Button
              onClick={handleJoin}
              variant="primary"
              text="Join"
              loading={joinLedger.isLoading}
              disabled={joinLedger.isLoading || !user}
            />
          )}
          <Button onClick={() => navigate("/")} variant="secondary" text="Back" />
        </Modal.Actions>
      </Modal>
      <Modal isOpen={showJoinedModal} onClose={() => navigate(`/l/${ledgerId}`)}>
        <Modal.Header>You've joined!</Modal.Header>
        <Modal.Body>
          <p>Please set up your user profile.</p>
        </Modal.Body>
        <Modal.Actions>
          <Button onClick={() => navigate("/me")} variant="primary" text="Set up my profile" />
        </Modal.Actions>
      </Modal>
    </>
  );
};
