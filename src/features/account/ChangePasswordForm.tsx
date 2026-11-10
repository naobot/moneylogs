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

/**
 * Change password while signed in. Firebase only lets a recent sign-in change the
 * password, so we re-authenticate with the current one first; that also proves it's
 * really the account owner at the keyboard.
 */
export const ChangePasswordForm = () => {
  const { showToast } = useToastContext();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const { isValid: meetsPolicy } = useValidatePassword(next);

  const problem = validatePasswordChange({ current, next, confirm, meetsPolicy });
  // Only nag about a field once the user has started on the new password.
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
      setCurrent("");
      setNext("");
      setConfirm("");
      showToast("Password changed", "success");
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
    <form className="AccountSection__password" onSubmit={handleSubmit}>
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
      {showProblem && <p className="AccountSection__hint">{problem}</p>}
      <AuthErrorMessage message={error} />
      <div className="Menu">
        <Button
          text="Change password"
          size="sm"
          buttonStyle="primary-border"
          disabled={!!problem}
          loading={pending}
          onClick={() => void submit()}
        />
      </div>
    </form>
  );
};

export default ChangePasswordForm;
