import { useState } from "react";

import { Ledger as LedgerType } from "@/types/ledger";
import { spotsLeft } from "@/utils/ledger";
import CopyTextArea from "@/features/layout/components/CopyTextArea";
import { IconText } from "@/components/Icon";
import Modal from "@/components/Modal";

import "./Ledger.scss";

type LedgerProps = {
  ledger: LedgerType;
};

export const Ledger = ({ ledger }: LedgerProps) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const spots = spotsLeft(ledger);
  const isShared = (ledger.memberUids?.length ?? 0) > 1;

  return (
    <>
      <div className="Group Ledger">
        <div className="Group__header">
          <div className="Group__header__left">
            <div className="Group__header__item">
              {isShared ? `shared · ${ledger.memberUids.length} members` : "personal"}
            </div>
          </div>
          <div className="Group__header__center">
            <div className="Group__header__item Group__header__title">{ledger.title}</div>
          </div>
          <div className="Group__header__right">
            {spots > 0 && (
              <>
                <div
                  className="handler Group__header__item"
                  onClick={() => setShowInviteModal(true)}
                >
                  <IconText type={"plus"} fill={"white"} text="invite" />
                </div>
                <div className="Group__header__item">
                  <small>
                    ({spots} spot{spots > 1 && "s"} left)
                  </small>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="Ledger__body">
          <p className="Ledger__empty">No entries yet.</p>
        </div>
      </div>
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header title={"Invite"}>Invite</Modal.Header>
        <Modal.Body>
          <p>Send the following URL to anyone you want to share this financial log with.</p>
          <p>Members can see every entry in this log, and add their own.</p>
          <CopyTextArea value={`${window.location.host}/l/${ledger.id}/invite`} />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Close" />
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default Ledger;
