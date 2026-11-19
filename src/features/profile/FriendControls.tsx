import { useState } from "react";

import { removeFriend, requestFriend, respondFriend, useFriendships } from "@/hooks/useFriendships";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import Popover from "@/components/Popover";
import RowButton from "@/components/RowButton";
import NudgeActions from "@/features/nudges/NudgeActions";

import { useFriendAction } from "./useFriendAction";

type FriendControlsProps = { userDocId: string; name: string };

/** Add, answer, cancel or undo a friendship from someone's profile. */
export const FriendControls = ({ userDocId, name }: FriendControlsProps) => {
  const { stateWith, uidOf, isLoading } = useFriendships();
  const { run, pending } = useFriendAction();
  const [confirmingUnfriend, setConfirmingUnfriend] = useState(false);
  // "friends ▾" tucks unfriend away in a menu, so it's never one stray tap away.
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const state = stateWith(userDocId);
  const friendUid = uidOf(userDocId);

  if (isLoading) return null;

  return (
    <div className="FriendControls">
      {state === "none" && (
        <Button
          text="Add friend"
          size="sm"
          variant="primary"
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
            variant="primary"
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
          <button
            ref={setMenuAnchor}
            type="button"
            className="FriendControls__friends"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ✓ friends ▾
          </button>
          <Popover
            anchor={menuAnchor}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            placement="bottom"
            align="start"
            role="menu"
            className="FriendControls__menu"
          >
            <button
              type="button"
              role="menuitem"
              className="FriendControls__menuItem"
              disabled={!!pending}
              onClick={() => {
                setMenuOpen(false);
                setConfirmingUnfriend(true);
              }}
            >
              unfriend
            </button>
          </Popover>
          <Button
            text="Send a gift"
            size="sm"
            variant="secondary"
            icon="gift"
            to={`/?giftTo=${userDocId}#knickknacks`}
          />
          {friendUid && <NudgeActions userDocId={userDocId} toUid={friendUid} name={name} />}
        </>
      )}

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
              variant="primary"
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
