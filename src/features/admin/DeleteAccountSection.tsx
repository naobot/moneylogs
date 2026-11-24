import { useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";

import Button from "@/components/Button";
import { useMutation } from "@/hooks/useFirebase";
import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";

import { AdminUser, adminDeleteAccount, adminErrorMessage, isExpectedAdminError } from "./adminApi";
import { accountConfirmPhrase, confirmsAccount } from "./adminConfirm";

/**
 * Delete the account exactly as the person would from /me: solo logs go, shared logs stay
 * for the others with this person's content shown as "deleted user".
 */
export const DeleteAccountSection = ({
  user,
  onDeleted,
}: {
  user: AdminUser;
  onDeleted: () => void;
}) => {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToastContext();
  const phrase = accountConfirmPhrase(user);
  const deletion = useMutation(async () => adminDeleteAccount({ uid: user.uid, confirm: typed }));
  const canDelete = confirmsAccount(typed, user) && !deletion.isLoading;
  const { purge, leave } = user.preview;

  const handleDelete = async () => {
    if (!canDelete) return;
    setError(null);
    try {
      const { data } = await deletion.mutate(undefined);
      showToast(
        `Deleted ${phrase}: ${data.logsDeleted} logs deleted, ${data.logsLeft} left`,
        "success",
      );
      onDeleted();
    } catch (err) {
      if (!isExpectedAdminError(err)) {
        reportError(err, { feature: "admin", action: "delete_account" });
      }
      setError(adminErrorMessage(err));
    }
  };

  return (
    <section className="Admin__section Admin__danger" aria-label="delete account">
      <h3>delete account</h3>
      <p>Same as deleting it from /me. It can't be undone.</p>
      <h4>will be deleted</h4>
      {purge.length ? (
        <ul>
          {purge.map((log) => (
            <li key={`${log.kind}-${log.id}`} className="keep-case">
              {log.title} <small>({log.kind})</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="Admin__muted">no logs.</p>
      )}
      <h4>stays for others, anonymised as "deleted user"</h4>
      {leave.length ? (
        <ul>
          {leave.map((log) => (
            <li key={`${log.kind}-${log.id}`} className="keep-case">
              {log.title}{" "}
              <small>
                ({log.kind}, {log.others} other{log.others === 1 ? "" : "s"})
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="Admin__muted">no shared logs.</p>
      )}
      <p className="Admin__muted">
        Also removed: friendships, invite links, their shelf, inbox and the sign-in account. Gifts
        they gave stay with the recipients.
      </p>

      <label className="Admin__confirm">
        <span>
          Type <strong className="keep-case">{phrase}</strong> to confirm:
        </span>
        <input
          className="LineInput keep-case"
          value={typed}
          autoComplete="off"
          disabled={deletion.isLoading}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
          }}
        />
      </label>
      {deletion.isLoading && (
        <p role="status">
          Deleting the account. This can take a minute
          <LoadingDots label="" />
        </p>
      )}
      {error && <p className="error-message">{error}</p>}
      <div className="Admin__actions">
        <Button
          text={deletion.isLoading ? "Deleting…" : "Delete account"}
          size="sm"
          loading={deletion.isLoading}
          disabled={!canDelete}
          onClick={() => void handleDelete()}
        />
      </div>
    </section>
  );
};
