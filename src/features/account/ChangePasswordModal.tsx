import { FormEvent, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

import { auth } from "@/config/firebase-config";
import { useToastContext } from "@/hooks/useToastContext";
import useValidatePassword from "@/features/auth/hooks/useValidatePassword";
import {
  getPasswordChangeErrorMessage,
  validatePasswordChange,
} from "@/features/auth/accountErrors";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";

import Button from "@/components/Button";
import ControlledInput from "@/components/ControlledInput";
import Modal from "@/components/Modal";

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
  const { isValid: meetsPolicy } = useValidatePassword(next);

  const problem = validatePasswordChange({ current, next, confirm, meetsPolicy });
  // Only nag once the user has started on both new-password fields.
  const showProblem = !!problem && next.length > 0 && confirm.length > 0;

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

  const field = (setter: (value: string) => void) => (e: { target: EventTarget }) => {
    setter((e.target as HTMLInputElement).value);
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
          <ControlledInput
            type="password"
            label="Current password"
            value={current}
            onChange={field(setCurrent)}
          />
          <ControlledInput
            type="password"
            label="New password"
            value={next}
            onChange={field(setNext)}
            isError={!!next && !meetsPolicy}
            errorMessage="doesn't meet the requirements"
          />
          <ControlledInput
            type="password"
            label="Confirm new password"
            value={confirm}
            onChange={field(setConfirm)}
          />
          {showProblem && <p className="ChangePassword__hint">{problem}</p>}
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
