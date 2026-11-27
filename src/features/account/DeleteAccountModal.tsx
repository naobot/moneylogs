import { FormEvent, useId, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import { useNavigate } from "react-router-dom";
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { auth, functions } from "@/config/firebase-config";
import { useToastContext } from "@/hooks/useToastContext";
import {
  confirmsAccountDeletion,
  DELETE_ACCOUNT_CONFIRMATION,
  getDeleteAccountErrorMessage,
  isExpectedAccountError,
} from "@/features/auth/accountErrors";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";

import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { reportError } from "@/utils/reportError";
import { turnPushOff } from "@/features/push/devicePush";
import { clearPostDraft } from "@/utils/postDraft";

const deleteAccountCallable = httpsCallable<void, { deleted: boolean }>(functions, "deleteAccount");

type DeleteAccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Permanently delete the signed-in account. The password is checked first: Firebase
 * wants a recent sign-in for this, and the deleteAccount function enforces it too. The
 * function does the cascade (see functions/src/deleteAccount.ts), then we sign out here.
 *
 * Render it only while open (or key it) so the fields start empty each time.
 */
export const DeleteAccountModal = ({ isOpen, onClose }: DeleteAccountModalProps) => {
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const canSubmit = !!password && confirmsAccountDeletion(confirmText) && !pending;

  const submit = async () => {
    const firebaseUser = auth.currentUser;
    if (!canSubmit || !firebaseUser?.email) return;
    setPending(true);
    setError("");
    try {
      await reauthenticateWithCredential(
        firebaseUser,
        EmailAuthProvider.credential(firebaseUser.email, password),
      );
      await deleteAccountCallable();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (!isExpectedAccountError(code)) {
        reportError(err, { feature: "account", action: "delete_account" });
      }
      setError(getDeleteAccountErrorMessage(code));
      setPending(false);
      return;
    }
    // The Auth account is gone server-side (with its device tokens); clear the local
    // session and this device's push registration too.
    await turnPushOff(undefined).catch(() => undefined);
    await signOut(auth).catch((err) =>
      reportError(err, { feature: "account", action: "sign_out_after_delete", level: "warning" }),
    );
    clearPostDraft();
    showToast("Your account has been deleted.", "success");
    void navigate("/login", { replace: true });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={pending ? undefined : onClose}
      disabled={pending}
      className="DeleteAccount"
    >
      <Modal.Header title="Delete account" />
      <form onSubmit={handleSubmit}>
        <Modal.Body className="DeleteAccount__body">
          <p>
            <strong>This can't be undone.</strong> Deleting your account:
          </p>
          <ul>
            <li>deletes every log you're the only member of, including your personal log</li>
            <li>
              removes you from shared logs. They stay for the other members, with your posts,
              comments and entries shown as from a "deleted user"
            </li>
            <li>removes your reactions, achievements, notifications and settings</li>
            <li>signs you out and frees up your email address</li>
          </ul>

          <label htmlFor={passwordId} className="DeleteAccount__field">
            <span>Password</span>
            <input
              id={passwordId}
              type="password"
              className="DeleteAccount__input"
              value={password}
              autoComplete="current-password"
              disabled={pending}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
            />
          </label>
          <label className="DeleteAccount__field">
            <span>
              Type <strong>{DELETE_ACCOUNT_CONFIRMATION}</strong> to confirm:
            </span>
            <input
              className="LineInput"
              value={confirmText}
              autoComplete="off"
              disabled={pending}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError("");
              }}
            />
          </label>

          {pending && (
            <p role="status">
              Deleting your account. This can take up to a minute
              <LoadingDots label="" />
            </p>
          )}
          <AuthErrorMessage message={error} />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton />
          <Button
            text={pending ? "Deleting" : "Delete account"}
            variant="primary"
            disabled={!canSubmit}
            loading={pending}
            onClick={() => void submit()}
          />
        </Modal.Actions>
      </form>
    </Modal>
  );
};

export default DeleteAccountModal;
