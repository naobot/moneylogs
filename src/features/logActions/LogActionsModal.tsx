import { ReactNode, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";

import { useCurrentUser } from "@/contexts";
import { useUserQuery } from "@/hooks/useUserQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { functions } from "@/config/firebase-config";
import { isArchived } from "@/utils/archivedLogs";
import { confirmsDeletion } from "@/utils/logOwnership";
import { useMutation } from "@/hooks/useFirebase";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

import LogTitleSection from "./LogTitleSection";

import "./LogActions.scss";
import { reportError } from "@/utils/reportError";
import { logKindParam, track } from "@/utils/analytics";

export type LogKind = "social" | "financial";

type LogActionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  logId: string;
  logTitle: string;
  kind: LogKind;
  /** Auth uid of the log's creator, when known (see utils/logOwnership). */
  creatorUid?: string;
  /**
   * Called after a successful delete. Defaults to leaving for Home, which is right when
   * managing from inside the log; list pages pass this to stay where they are.
   */
  onDeleted?: () => void;
  /** Log-specific settings, shown between Archive and Delete (e.g. a ledger's currency). */
  settings?: ReactNode;
};

const deleteLogCallable = httpsCallable<{ kind: LogKind; id: string }, { deleted: boolean }>(
  functions,
  "deleteLog",
);

const deleteErrorMessage = (err: unknown): string => {
  const code = err instanceof FirebaseError ? err.code.replace("functions/", "") : "";
  switch (code) {
    case "permission-denied":
      return "Only the person who created this log can delete it.";
    case "not-found":
      return "This log has already been deleted.";
    case "failed-precondition":
      return "This log's creator isn't recorded yet, so it can't be deleted.";
    default:
      return "Couldn't delete the log. Nothing you can see has changed, so please try again.";
  }
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
  creatorUid,
  onDeleted,
  settings,
}: LogActionsModalProps) => {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  // Deleting is two steps: the button here, then typing the title in a second modal
  // that takes this one's place (not stacked, so Escape only backs out one step).
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  // Some callers keep this mounted while closed: reopening starts back at Manage.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setConfirming(false);
      setConfirmText("");
    }
  }
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletion = useMutation(async () => deleteLogCallable({ kind, id: logId }));
  const isCreator = !!user && !!creatorUid && user.userId === creatorUid;
  const canDelete = confirmsDeletion(confirmText, logTitle) && !deletion.isLoading;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleteError(null);
    try {
      await deletion.mutate(undefined);
      track("delete_log", { log_kind: logKindParam(kind) });
      showToast(`Deleted ${logTitle}`, "success");
      if (onDeleted) onDeleted();
      else void navigate("/", { replace: true });
    } catch (err) {
      // Who may delete, or a log already gone, is explained in the modal; not a bug.
      const code = err instanceof FirebaseError ? err.code.replace("functions/", "") : "";
      if (!["permission-denied", "not-found", "failed-precondition"].includes(code)) {
        reportError(err, { feature: "log_actions", action: "delete_log", tags: { kind } });
      }
      setDeleteError(deleteErrorMessage(err));
    }
  };
  const { showToast } = useToastContext();
  const { archiveLog, unarchiveLog } = useUserQuery();
  const [failed, setFailed] = useState(false);

  const archived = isArchived(user, logId);
  const pending = archiveLog.isLoading || unarchiveLog.isLoading || deletion.isLoading;
  const noun = kind === "financial" ? "financial log" : "log group";

  const toggleArchive = async () => {
    if (!user) return;
    setFailed(false);
    try {
      if (archived) {
        await unarchiveLog.mutate({ userId: user.id, logId });
        track("archive_log", { log_kind: logKindParam(kind), archived: false });
        showToast(`Unarchived ${logTitle}`, "success");
      } else {
        await archiveLog.mutate({ userId: user.id, logId });
        track("archive_log", { log_kind: logKindParam(kind), archived: true });
        showToast(`Archived ${logTitle}`, "success");
      }
      onClose();
    } catch (err) {
      reportError(err, {
        feature: "log_actions",
        action: archived ? "unarchive" : "archive",
        tags: { kind },
      });
      setFailed(true);
    }
  };

  const backToManage = () => {
    setConfirming(false);
    setConfirmText("");
    setDeleteError(null);
  };

  if (confirming) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={deletion.isLoading ? undefined : backToManage}
        disabled={deletion.isLoading}
        className="LogActions"
      >
        <Modal.Header striped title={`Delete ${noun}`} />
        <Modal.Body>
          <section className="LogActions__section">
            <p>
              Delete <strong className="keep-case">{logTitle}</strong>?{" "}
              <strong>This can't be undone.</strong> It's removed for <em>everyone</em> in it.
            </p>
            <label className="LogActions__confirm">
              <span>
                Type <strong className="keep-case">{logTitle}</strong> to confirm:
              </span>
              <input
                className="LineInput"
                value={confirmText}
                autoComplete="off"
                autoFocus
                disabled={deletion.isLoading}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  setDeleteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleDelete();
                }}
              />
            </label>
            {deletion.isLoading && (
              <p role="status">
                Removing everything. This can take a few seconds
                <LoadingDots label="" />
              </p>
            )}
            {deleteError && <p className="error-message">{deleteError}</p>}
          </section>
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Back" />
          <Button
            text={deletion.isLoading ? "Deleting" : `Delete ${noun}`}
            size="sm"
            loading={deletion.isLoading}
            disabled={!canDelete}
            onClick={() => void handleDelete()}
          />
        </Modal.Actions>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} disabled={pending} className="LogActions">
      <Modal.Header
        striped
        title={
          <>
            Manage <span className="keep-case">{logTitle}</span>
          </>
        }
      />
      <Modal.Body>
        {isCreator && <LogTitleSection logId={logId} logTitle={logTitle} kind={kind} />}

        <section className="LogActions__section">
          <h4>{archived ? "Archived" : "Archive"}</h4>
          <p>
            {archived
              ? `This ${noun} is archived for you. Unarchive it to show it in your navigation and lists again.`
              : `Hide this ${noun} from your navigation and lists. It moves to the "Archived" list under "my logs" on your profile page. Only you are affected, and you can still open it.`}
          </p>
          <Button
            text={archived ? "Unarchive" : "Archive for me"}
            size="sm"
            className="LogActions__action"
            variant="secondary"
            loading={pending}
            disabled={!user || pending}
            onClick={() => void toggleArchive()}
          />
          {failed && <p className="error-message">Couldn't update that. Please try again.</p>}
        </section>

        {settings}

        {isCreator && (
          <section className="LogActions__section LogActions__danger">
            <h4>Delete this {noun}</h4>
            <p>
              <strong>This can't be undone.</strong> Deleting removes it for <em>everyone</em>:
            </p>
            <ul>
              {kind === "financial" ? (
                <li>every entry, category and monthly stat</li>
              ) : (
                <li>every post, comment and uploaded image</li>
              )}
              <li>it disappears from all members' navigation, lists and history</li>
              <li>any achievements earned in it are removed from members' profiles</li>
            </ul>
            <Button
              text={`Delete ${noun}`}
              size="sm"
              className="LogActions__action"
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirming(true)}
            />
          </section>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton text="Close" />
      </Modal.Actions>
    </Modal>
  );
};

export default LogActionsModal;
