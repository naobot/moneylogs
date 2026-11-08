import { useState } from "react";

import { useCurrentUser } from "@/contexts";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { isArchived } from "@/utils/archivedLogs";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

import "./LogActions.scss";

export type LogKind = "social" | "financial";

type LogActionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  logId: string;
  logTitle: string;
  kind: LogKind;
};

/**
 * Per-log actions for a member. Archiving is personal: it only hides the log from this
 * member's own lists (nav, Home, /me) and can be undone at any time.
 */
export const LogActionsModal = ({
  isOpen,
  onClose,
  logId,
  logTitle,
  kind,
}: LogActionsModalProps) => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const { archiveLog, unarchiveLog } = useUserQuery();
  const [failed, setFailed] = useState(false);

  const archived = isArchived(user, logId);
  const pending = archiveLog.isLoading || unarchiveLog.isLoading;
  const noun = kind === "financial" ? "financial log" : "log group";

  const toggleArchive = async () => {
    if (!user) return;
    setFailed(false);
    try {
      if (archived) {
        await unarchiveLog.mutate({ userId: user.id, logId });
        showToast(`Unarchived ${logTitle}`, "success");
      } else {
        await archiveLog.mutate({ userId: user.id, logId });
        showToast(`Archived ${logTitle}`, "success");
      }
      onClose();
    } catch (err) {
      console.error("Failed to update archive:", err);
      setFailed(true);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={pending ? undefined : onClose} className="LogActions">
      <Modal.Header title="Manage">Manage {logTitle}</Modal.Header>
      <Modal.Body>
        <section className="LogActions__section">
          <h4>{archived ? "Archived" : "Archive"}</h4>
          <p>
            {archived
              ? `This ${noun} is archived for you. Unarchive it to show it in your navigation and lists again.`
              : `Hide this ${noun} from your navigation and lists. It moves to the collapsed "Archived" list on your home and profile pages. Only you are affected, and you can still open it.`}
          </p>
          <Button
            text={archived ? "Unarchive" : "Archive for me"}
            size="sm"
            buttonStyle="primary-border"
            loading={pending}
            disabled={!user || pending}
            onClick={() => void toggleArchive()}
          />
          {failed && <p className="error-message">Couldn't update that. Please try again.</p>}
        </section>
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton text="Close" />
      </Modal.Actions>
    </Modal>
  );
};

export default LogActionsModal;
