import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { needsProfileSetup } from "@/utils/helpers";
import { useGetLedger } from "@/hooks/useGetLedger";
import { useLedgerQuery } from "@/hooks/useLedgerQuery";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

/**
 * Non-members can't read a financial log (security rules), so the invite screen can't
 * show its title or remaining spots. Joining is a blind write that the rules accept only
 * while there's room; a rejection means the log is full or the link is wrong.
 */
export const LedgerInvitePage = () => {
  const navigate = useNavigate();
  const { ledgerId } = useParams();
  const { user } = useCurrentUser();
  const { isSuccess, isDenied, isNotFound } = useGetLedger(ledgerId);
  const { joinLedger } = useLedgerQuery();

  const [joinFailed, setJoinFailed] = useState(false);
  const [showJoinedModal, setShowJoinedModal] = useState(false);

  // Already a member: the read succeeds, so go straight to the log.
  useEffect(() => {
    if (isSuccess && ledgerId && !showJoinedModal) {
      void navigate(`/l/${ledgerId}`, { replace: true });
    }
  }, [isSuccess, ledgerId, navigate, showJoinedModal]);

  const handleJoin = async () => {
    if (!user || !ledgerId) return;
    setJoinFailed(false);
    try {
      await joinLedger.mutate({ ledgerId, member: { uid: user.userId, userDocId: user.id } });
      if (needsProfileSetup(user)) {
        setShowJoinedModal(true);
      } else {
        void navigate(`/l/${ledgerId}`, { replace: true });
      }
    } catch (error) {
      console.error("Failed to join financial log:", error);
      setJoinFailed(true);
    }
  };

  const canAttemptJoin = (isDenied || isNotFound) && !showJoinedModal;

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
              buttonStyle="primary-border"
              text="Join"
              loading={joinLedger.isLoading}
              disabled={joinLedger.isLoading || !user}
            />
          )}
          <Button onClick={() => navigate("/")} buttonStyle="primary-border" text="Back" />
        </Modal.Actions>
      </Modal>
      <Modal isOpen={showJoinedModal} onClose={() => navigate(`/l/${ledgerId}`)}>
        <Modal.Header>You've joined!</Modal.Header>
        <Modal.Body>
          <p>Please set up your user profile.</p>
        </Modal.Body>
        <Modal.Actions>
          <Button
            onClick={() => navigate("/me")}
            buttonStyle="primary-border"
            text="Set up my profile"
          />
        </Modal.Actions>
      </Modal>
    </>
  );
};
