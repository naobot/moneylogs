import { useId } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { KNICK_KNACKS, KnickKnackId, RARITY_LABELS } from "./catalog";
import KnickKnack from "./KnickKnack";

import "./KnickKnackDetails.scss";

/**
 * A closer look at one knick-knack, as a toast-like card that stays until clicked away
 * (or Escape): its art blown up, name, rarity and what the buddy said on finding one.
 * Opened from the drawer (your own: with how many you have, and the way into gifting)
 * and from anyone's shelf.
 */
export const KnickKnackDetails = ({
  item,
  count,
  onGive,
  onClose,
}: {
  item: KnickKnackId;
  /** How many you have; shown as ×N after the name when more than one. */
  count?: number;
  /** Shown as a "give one" button when there's a copy to give and a friend to give it to. */
  onGive?: () => void;
  onClose: () => void;
}) => {
  const { name, rarity, found } = KNICK_KNACKS[item];
  const titleId = useId();
  return (
    <Modal isOpen onClose={onClose} className="KnickKnackDetails">
      <div
        className="KnickKnackDetails__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <KnickKnack id={item} size={128} />
        <h2 id={titleId} className="KnickKnackDetails__name">
          {name}
          {count != null && count > 1 && (
            <span className="KnickKnackDetails__count"> ×{count}</span>
          )}
        </h2>
        <span className={`KnickKnackDetails__rarity KnickKnackDetails__rarity--${rarity}`}>
          <span className="sr-only">rarity: </span>
          {RARITY_LABELS[rarity]}
        </span>
        <p className="KnickKnackDetails__found keep-case">“{found}”</p>
        {onGive && <Button text="Give one" icon="gift" variant="primary" onClick={onGive} />}
      </div>
    </Modal>
  );
};

export default KnickKnackDetails;
