import { useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import { Link } from "react-router-dom";

import Button from "@/components/Button";
import Modal from "@/components/Modal";
import RowButton from "@/components/RowButton";
import { useMutation } from "@/hooks/useFirebase";
import { useToastContext } from "@/hooks/useToastContext";
import { confirmsDeletion } from "@/utils/logOwnership";
import { reportError } from "@/utils/reportError";

import { AdminLog, adminDeleteLog, adminErrorMessage, isExpectedAdminError } from "./adminApi";

const kindLabel = (log: AdminLog) => (log.kind === "financial" ? "financial log" : "log group");

const DeleteLogModal = ({
  log,
  onClose,
  onDeleted,
}: {
  log: AdminLog;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToastContext();
  const deletion = useMutation(async () => adminDeleteLog({ kind: log.kind, id: log.id }));
  const canDelete = confirmsDeletion(typed, log.title) && !deletion.isLoading;
  const others = Math.max(0, log.members - 1);

  const handleDelete = async () => {
    if (!canDelete) return;
    setError(null);
    try {
      await deletion.mutate(undefined);
      showToast(`Deleted ${log.title}`, "success");
      onDeleted();
    } catch (err) {
      if (!isExpectedAdminError(err)) {
        reportError(err, { feature: "admin", action: "delete_log", tags: { kind: log.kind } });
      }
      setError(adminErrorMessage(err));
    }
  };

  return (
    <Modal
      isOpen
      onClose={deletion.isLoading ? undefined : onClose}
      disabled={deletion.isLoading}
      className="Admin__modal"
    >
      <Modal.Header striped title={`Delete ${kindLabel(log)}`} />
      <Modal.Body>
        <p>
          Delete <strong className="keep-case">{log.title}</strong> with all its entries, comments,
          images and everyone's references to it, as its creator would.{" "}
          <strong>This can't be undone.</strong>
        </p>
        {others > 0 && (
          <p className="Admin__warning">
            It's shared: this deletes it for {others} other member{others === 1 ? "" : "s"} too.
          </p>
        )}
        <label className="Admin__confirm">
          <span>
            Type <strong className="keep-case">{log.title}</strong> to confirm:
          </span>
          <input
            className="LineInput keep-case"
            value={typed}
            autoComplete="off"
            autoFocus
            disabled={deletion.isLoading}
            onChange={(e) => {
              setTyped(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleDelete();
            }}
          />
        </label>
        {deletion.isLoading && (
          <p role="status">
            Removing everything
            <LoadingDots label="" />
          </p>
        )}
        {error && <p className="error-message">{error}</p>}
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton text="Back" />
        <Button
          text={deletion.isLoading ? "Deleting" : "Delete"}
          size="sm"
          loading={deletion.isLoading}
          disabled={!canDelete}
          onClick={() => void handleDelete()}
        />
      </Modal.Actions>
    </Modal>
  );
};

export const LogsSection = ({ logs, onDeleted }: { logs: AdminLog[]; onDeleted: () => void }) => {
  const [deleting, setDeleting] = useState<AdminLog | null>(null);

  return (
    <section className="Admin__section" aria-label="logs">
      <h3>logs</h3>
      {logs.length ? (
        <ul className="Admin__logs">
          {logs.map((log) => (
            <li key={`${log.kind}-${log.id}`}>
              <span className="Admin__logTitle">
                {log.kind === "social" ? (
                  <Link className="keep-case" to={`/g/${log.id}`}>
                    {log.title}
                  </Link>
                ) : (
                  <span className="keep-case">{log.title}</span>
                )}{" "}
                <small>
                  {kindLabel(log)} · {log.members} member{log.members === 1 ? "" : "s"}
                  {log.isCreator && " · creator"}
                  {log.archived && " · archived"}
                </small>
              </span>
              <RowButton aria-label={`Delete ${log.title}`} onClick={() => setDeleting(log)}>
                delete
              </RowButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="Admin__muted">no logs.</p>
      )}
      {deleting && (
        <DeleteLogModal
          log={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            onDeleted();
          }}
        />
      )}
    </section>
  );
};
