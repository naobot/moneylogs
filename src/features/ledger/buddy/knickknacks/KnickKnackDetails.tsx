import { ReactNode } from "react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { KNICK_KNACKS, KnickKnackId, RARITY_LABELS } from "./catalog";
import KnickKnack from "./KnickKnack";

import "./KnickKnackDetails.scss";

/**
 * A closer look at one knick-knack: its art blown up, its rarity, and what the buddy
 * said on finding one. Opened from the drawer (your own, with how many you have and the
 * way into gifting) and from anyone's shelf (with how they first got it).
 */
export const KnickKnackDetails = ({
  item,
  note,
  onGive,
  onClose,
}: {
  item: KnickKnackId;
  /** A line under the description: how many you have, how they got it. */
  note?: ReactNode;
  /** Shown as a "give one" button when there's a copy to give and a friend to give it to. */
  onGive?: () => void;
  onClose: () => void;
}) => {
  const { name, rarity, found } = KNICK_KNACKS[item];
  return (
    <Modal isOpen onClose={onClose} className="KnickKnackDetails">
      <Modal.Header title={name} showCloseButton />
      <Modal.Body className="KnickKnackDetails__body">
        <span className="KnickKnackDetails__art">
          <KnickKnack id={item} size={128} />
        </span>
        <span className={`KnickKnackDetails__rarity KnickKnackDetails__rarity--${rarity}`}>
          <span className="sr-only">rarity: </span>
          {RARITY_LABELS[rarity]}
        </span>
        <blockquote className="KnickKnackDetails__found keep-case">“{found}”</blockquote>
        {note && <p className="KnickKnackDetails__note keep-case">{note}</p>}
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton text="Close" />
        {onGive && <Button text="Give one" icon="gift" variant="primary" onClick={onGive} />}
      </Modal.Actions>
    </Modal>
  );
};

export default KnickKnackDetails;
