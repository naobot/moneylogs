import { ChangeEvent, FormEvent, useId, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

import { auth } from "@/config/firebase-config";
import { useToastContext } from "@/hooks/useToastContext";
import useValidatePassword from "@/features/auth/hooks/useValidatePassword";
import {
  getPasswordChangeErrorMessage,
  validatePasswordChange,
} from "@/features/auth/accountErrors";
import { describePasswordRequirements } from "@/features/auth/passwordRequirements";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";

import Button from "@/components/Button";
import Icon from "@/components/Icon";
import Modal from "@/components/Modal";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: "current-password" | "new-password";
  error?: string | null;
};

/** One labelled row of the form grid, with its error (if any) on its own line below. */
const PasswordField = ({ label, value, onChange, autoComplete, error }: PasswordFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <>
      <label htmlFor={id} className="ChangePassword__label">
        {label}
      </label>
      <input
        id={id}
        type="password"
        className={
          error ? "ChangePassword__input ChangePassword__input--error" : "ChangePassword__input"
        }
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="ChangePassword__error">
          <Icon type="warning" />
          <span>{error}</span>
        </p>
      )}
    </>
  );
};

type ChangePasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Change password while signed in. Firebase only lets a recent sign-in change the
 * password, so we re-authenticate with the current one first; that also proves it's
 * really the account owner at the keyboard.
 *
 * Render it only while open (or key it) so the fields start empty each time.
 */
export const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
  const { showToast } = useToastContext();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const { isValid: meetsPolicy, status } = useValidatePassword(next);

  // Decides whether the form can be submitted at all.
  const problem = validatePasswordChange({ current, next, confirm, meetsPolicy });

  // Field-level messages, each shown under its own field once there's something typed.
  const nextError = !next
    ? null
    : current && next === current
      ? "Must be different from your current password."
      : describePasswordRequirements(status);
  const confirmError = confirm && confirm !== next ? "Doesn't match the new password." : null;

  const submit = async () => {
    const firebaseUser = auth.currentUser;
    if (problem || pending || !firebaseUser?.email) return;
    setPending(true);
    setError("");
    try {
      await reauthenticateWithCredential(
        firebaseUser,
        EmailAuthProvider.credential(firebaseUser.email, current),
      );
      await updatePassword(firebaseUser, next);
      showToast("Password changed", "success");
      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      console.error("Failed to change password:", code);
      setError(getPasswordChangeErrorMessage(code));
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  const field = (setter: (value: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setError("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={pending ? undefined : onClose}
      disabled={pending}
      className="ChangePassword"
    >
      <Modal.Header title="Change password" />
      <form onSubmit={handleSubmit}>
        <Modal.Body className="ChangePassword__body">
          <div className="ChangePassword__grid">
            <PasswordField
              label="Current password"
              value={current}
              onChange={field(setCurrent)}
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              value={next}
              onChange={field(setNext)}
              autoComplete="new-password"
              error={nextError}
            />
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={field(setConfirm)}
              autoComplete="new-password"
              error={confirmError}
            />
          </div>
          <AuthErrorMessage message={error} />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton />
          <Button
            text="Change password"
            buttonStyle="primary-border"
            disabled={!!problem}
            loading={pending}
            onClick={() => void submit()}
          />
        </Modal.Actions>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
