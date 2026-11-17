import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";
import { acceptInvite } from "@/features/invites/invites";
import { isInviteNotFound } from "@/utils/invites";

type Status = "working" | "self" | "invalid" | "failed";

/**
 * /invite/:code — someone's personal invite. Opening it makes you friends with them
 * (signing up first if you need to: CheckAuth and /welcome carry the link through),
 * then shows you their profile.
 */
export const InviteFriendPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const [status, setStatus] = useState<Status>("working");
  // StrictMode runs effects twice in dev; accept once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    acceptInvite(code)
      .then(({ state, inviterId }) => {
        if (state === "self") {
          setStatus("self");
          return;
        }
        showToast("You're friends now", "success");
        void navigate(`/u/${inviterId}`, { replace: true });
      })
      .catch((error) => {
        if (isInviteNotFound(error)) {
          setStatus("invalid");
          return;
        }
        reportError(error, { feature: "friends", action: "accept_invite" });
        setStatus("failed");
      });
  }, [code, navigate, showToast]);

  if (status === "working") return <div className="InfoBox">opening your invite…</div>;

  const copy = {
    self: {
      header: "This is your invite link",
      body: "Send it to someone you'd like to invite. When they open it, you'll be friends.",
    },
    invalid: {
      header: "Invite not found",
      body: "This invite link is no longer valid. Ask whoever sent it for a new one.",
    },
    failed: {
      header: "Couldn't open invite",
      body: "Something went wrong. Please try the link again in a moment.",
    },
  }[status];

  return (
    <Modal isOpen onClose={() => navigate("/")}>
      <Modal.Header>{copy.header}</Modal.Header>
      <Modal.Body>
        <p>{copy.body}</p>
      </Modal.Body>
      <Modal.Actions>
        <Button onClick={() => navigate("/")} variant="secondary" text="Back" />
      </Modal.Actions>
    </Modal>
  );
};
