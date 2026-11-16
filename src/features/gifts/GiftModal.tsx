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

import "./GiftModal.scss";

type GiftModalProps = {
  onClose: () => void;
  /** Preselect the friend (from their profile). */
  toUserDocId?: string;
};

/**
 * Give one of your knick-knacks to a friend. It leaves your drawer and arrives wrapped
 * in theirs. Only things you found yourself can be given: gifts stay with you.
 * Render it only while open, so it starts fresh each time.
 */
export const GiftModal = ({ onClose, toUserDocId }: GiftModalProps) => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const { data: finds } = useKnickKnackFinds(user?.id);
  const { friends } = useFriendships();
  const profiles = useProfiles(friends);
  const ids = { item: useId(), friend: useId() };

  const giftable = useMemo(() => giftableByItem(finds), [finds]);
  const [item, setItem] = useState<KnickKnackId | "">("");
  const [friend, setFriend] = useState(toUserDocId ?? "");
  const [pending, setPending] = useState(false);

  const chosenItem = item || giftable[0]?.item || "";
  const chosenFriend = friend || friends[0] || "";
  const nameOf = (id: string) => profiles.get(id)?.displayName ?? "…";

  const give = async () => {
    const find = giftable.find((g) => g.item === chosenItem)?.finds[0];
    if (!find || !chosenFriend || pending) return;
    setPending(true);
    try {
      await giftKnickKnack(find.id, chosenFriend);
      showToast(`Gift sent to ${nameOf(chosenFriend)}`, "success");
      onClose();
    } catch (err) {
      reportError(err, { feature: "friends", action: "gift_knickknack" });
      const message = (err as { message?: string })?.message;
      showToast(message || "Couldn't send the gift. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const nothingToGive = !giftable.length;
  const noFriends = !friends.length;

  return (
    <Modal isOpen onClose={pending ? undefined : onClose} disabled={pending} className="GiftModal">
      <Modal.Header title="Give a gift" striped />
      <Modal.Body className="GiftModal__body">
        {nothingToGive ? (
          <p>
            Nothing to give yet. Only knick-knacks you found yourself can be given; gifts stay with
            you.
          </p>
        ) : noFriends ? (
          <p>Add a friend first. Gifts can only go to friends.</p>
        ) : (
          <>
            {chosenItem && <KnickKnack id={chosenItem} size={64} />}
            <div className="GiftModal__rows">
              <label htmlFor={ids.item}>what</label>
              <select
                id={ids.item}
                value={chosenItem}
                onChange={(e) => setItem(e.target.value as KnickKnackId)}
              >
                {giftable.map(({ item: id, finds: copies }) => (
                  <option key={id} value={id}>
                    {KNICK_KNACKS[id].name}
                    {copies.length > 1 ? ` (×${copies.length})` : ""}
                  </option>
                ))}
              </select>

              <label htmlFor={ids.friend}>to</label>
              <select
                id={ids.friend}
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
              it leaves your drawer and arrives wrapped in theirs. gifts can't be passed on.
            </p>
          </>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton />
        {!nothingToGive && !noFriends && (
          <Button
            text="Give"
            buttonStyle="primary-border"
            disabled={!chosenItem || !chosenFriend}
            loading={pending}
            onClick={() => void give()}
          />
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default GiftModal;
