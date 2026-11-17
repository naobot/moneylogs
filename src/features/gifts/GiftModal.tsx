import { useId, useMemo, useState } from "react";

import { useCurrentUser } from "@/contexts";
import { useFriendships } from "@/hooks/useFriendships";
import { useProfiles } from "@/hooks/useProfiles";
import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";

import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { KNICK_KNACKS, KnickKnackId } from "@/features/ledger/buddy/knickknacks/catalog";
import { giftableByItem, giftKnickKnack } from "@/features/ledger/buddy/knickknacks/gifts";
import KnickKnack from "@/features/ledger/buddy/knickknacks/KnickKnack";
import { useKnickKnackFinds } from "@/features/ledger/buddy/knickknacks/useUnseenFinds";

import { giftLeftLine } from "./giftCopy";
import "./GiftModal.scss";

type GiftModalProps = {
  /** The knick-knack picked in the drawer; one copy of it is given. */
  item: KnickKnackId;
  onClose: () => void;
  /** Called after the gift went through. */
  onGiven?: () => void;
  /** Preselect the friend (when giving from their profile). */
  toUserDocId?: string;
};

/**
 * Confirm giving one copy of a knick-knack to a friend. That copy leaves your drawer
 * and arrives wrapped in theirs; your oldest copy you found yourself is the one that
 * goes. Render it only while open, so it starts fresh each time.
 */
export const GiftModal = ({ item, onClose, onGiven, toUserDocId }: GiftModalProps) => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const { data: finds } = useKnickKnackFinds(user?.id);
  const { friends } = useFriendships();
  const profiles = useProfiles(friends);
  const friendSelectId = useId();

  const [friend, setFriend] = useState(
    toUserDocId && friends.includes(toUserDocId) ? toUserDocId : "",
  );
  const [pending, setPending] = useState(false);

  const owned = finds.filter((f) => f.item === item && f.seenAt).length;
  const giftable = useMemo(
    () => giftableByItem(finds).find((g) => g.item === item)?.finds ?? [],
    [finds, item],
  );
  const chosenFriend = friend || friends[0] || "";
  const nameOf = (id: string) => profiles.get(id)?.displayName ?? "…";
  const itemName = KNICK_KNACKS[item].name.toLowerCase();

  const give = async () => {
    const find = giftable[0];
    if (!find || !chosenFriend || pending) return;
    setPending(true);
    try {
      await giftKnickKnack(find.id, chosenFriend);
      showToast(`Gave 1 ${itemName} to ${nameOf(chosenFriend)}`, "success");
      onGiven?.();
      onClose();
    } catch (err) {
      reportError(err, { feature: "friends", action: "gift_knickknack" });
      const message = (err as { message?: string })?.message;
      showToast(message || "Couldn't send the gift. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const canGive = giftable.length > 0 && friends.length > 0;

  return (
    <Modal isOpen onClose={pending ? undefined : onClose} disabled={pending} className="GiftModal">
      <Modal.Header title={`Give 1 ${itemName}`} />
      <Modal.Body className="GiftModal__body">
        <KnickKnack id={item} size={64} />
        {!giftable.length ? (
          <p>
            Every {itemName} you have was a gift, and gifts can't be passed on. Only knick-knacks
            you found yourself can be given.
          </p>
        ) : !friends.length ? (
          <p>Add a friend first. Gifts can only go to friends.</p>
        ) : (
          <>
            <div className="GiftModal__rows">
              <label htmlFor={friendSelectId}>to</label>
              <select
                id={friendSelectId}
                value={chosenFriend}
                onChange={(e) => setFriend(e.target.value)}
              >
                {friends.map((id) => (
                  <option key={id} value={id}>
                    {nameOf(id)}
                  </option>
                ))}
              </select>
            </div>
            <p className="GiftModal__note">
              {giftLeftLine(itemName, owned)} it arrives wrapped in their drawer, and they can't
              pass it on.
            </p>
          </>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton />
        {canGive && (
          <Button
            text={`Give 1 ${itemName}`}
            variant="primary"
            disabled={!chosenFriend}
            loading={pending}
            onClick={() => void give()}
          />
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default GiftModal;
