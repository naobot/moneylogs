import { useEffect } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { reportError } from "@/utils/reportError";
import { KNICK_KNACKS } from "./catalog";
import KnickKnack from "./KnickKnack";
import { KnickKnackFind, markFindSeen } from "./useUnseenFinds";

import "./KnickKnackReveal.scss";

/**
 * The pop-up that reveals a knick-knack: a find your budget buddy wants to show you, or
 * a gift from a friend. Showing it is what completes the event: the find is marked seen
 * as soon as it appears, and joins the drawer. Opened from the drawer's alerts, or from
 * the speech bubble of the buddy in the log a find came from.
 */
export const KnickKnackReveal = ({
  userDocId,
  find,
  fromName,
  remaining = 0,
  onNext,
  onClose,
}: {
  userDocId: string;
  find: KnickKnackFind;
  /** Gifts: who sent it. */
  fromName?: string;
  /** How many more are waiting after this one. */
  remaining?: number;
  onNext?: () => void;
  onClose: () => void;
}) => {
  const findId = find.id;
  const isGift = find.source === "gift";
  const alreadySeen = !!find.seenAt;
  useEffect(() => {
    // Once per find: when seenAt arrives from the live query, this does nothing.
    if (alreadySeen) return;
    markFindSeen(userDocId, findId).catch((error) =>
      reportError(error, {
        feature: isGift ? "friends" : "budget_buddy",
        action: isGift ? "unwrap_gift" : "mark_find_seen",
        level: "warning",
      }),
    );
  }, [userDocId, findId, isGift, alreadySeen]);

  const { name, found } = KNICK_KNACKS[find.item];
  const from = fromName ?? "a friend";
  const more = remaining > 0 && onNext;

  return (
    <Modal isOpen onClose={onClose} className="KnickKnackReveal">
      <Modal.Header
        title={isGift ? `a gift from ${from}` : "your budget buddy found something!"}
        className="keep-case"
      />
      <Modal.Body className="KnickKnackReveal__body">
        <KnickKnack id={find.item} size={64} />
        <strong className="KnickKnackReveal__name">{name}</strong>
        <p className="KnickKnackReveal__line keep-case">
          {isGift ? `${from} sent you a ${name}!` : found}
        </p>
      </Modal.Body>
      <Modal.Actions>
        {more ? (
          <Button text={`Next (${remaining} more)`} variant="primary" onClick={onNext} />
        ) : (
          <Button text="Keep it" variant="primary" onClick={onClose} />
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default KnickKnackReveal;
