import { useState } from "react";

import { removeFriend, requestFriend, respondFriend, useFriendships } from "@/hooks/useFriendships";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import RowButton from "@/components/RowButton";
import GiftModal from "@/features/gifts/GiftModal";

import { useFriendAction } from "./useFriendAction";

type FriendControlsProps = { userDocId: string; name: string };

/** Add, answer, cancel or undo a friendship from someone's profile. */
export const FriendControls = ({ userDocId, name }: FriendControlsProps) => {
  const { stateWith, isLoading } = useFriendships();
  const { run, pending } = useFriendAction();
  const [confirmingUnfriend, setConfirmingUnfriend] = useState(false);
  const [giving, setGiving] = useState(false);
  const state = stateWith(userDocId);

  if (isLoading) return null;

  return (
    <div className="FriendControls">
      {state === "none" && (
        <Button
          text="Add friend"
          size="sm"
          buttonStyle="primary-border"
          loading={pending === "request"}
          onClick={() => void run("request", () => requestFriend(userDocId), "Friend request sent")}
        />
      )}

      {state === "outgoing" && (
        <>
          <span className="FriendControls__status">request sent</span>
          <RowButton
            disabled={!!pending}
            onClick={() => void run("cancel", () => removeFriend(userDocId))}
          >
            cancel
          </RowButton>
        </>
      )}

      {state === "incoming" && (
        <>
          <span className="FriendControls__status keep-case">{name} wants to be friends</span>
          <Button
            text="Accept"
            size="sm"
            buttonStyle="primary-border"
            loading={pending === "accept"}
            disabled={!!pending}
            onClick={() =>
              void run("accept", () => respondFriend(userDocId, true), "You're friends now")
            }
          />
          <RowButton
            disabled={!!pending}
            onClick={() => void run("decline", () => respondFriend(userDocId, false))}
          >
            decline
          </RowButton>
        </>
      )}

      {state === "friends" && (
        <>
          <span className="FriendControls__status FriendControls__status--friends">friends</span>
          <Button
            text="Send a gift"
            size="sm"
            buttonStyle="primary-border-lite"
            onClick={() => setGiving(true)}
          />
          <RowButton disabled={!!pending} onClick={() => setConfirmingUnfriend(true)}>
            unfriend
          </RowButton>
        </>
      )}

      {giving && <GiftModal toUserDocId={userDocId} onClose={() => setGiving(false)} />}

      {confirmingUnfriend && (
        <Modal isOpen onClose={() => setConfirmingUnfriend(false)} disabled={!!pending}>
          <Modal.Header title="Unfriend" />
          <Modal.Body>
            <p>
              Stop being friends with <strong className="keep-case">{name}</strong>? They won't be
              told, and you can add each other again later.
            </p>
          </Modal.Body>
          <Modal.Actions>
            <Modal.CancelButton />
            <Button
              text="Unfriend"
              buttonStyle="primary-border"
              loading={pending === "unfriend"}
              onClick={() =>
                void run("unfriend", async () => {
                  await removeFriend(userDocId);
                  setConfirmingUnfriend(false);
                })
              }
            />
          </Modal.Actions>
        </Modal>
      )}
    </div>
  );
};

export default FriendControls;
