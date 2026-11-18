import { FormEvent, useState } from "react";

import { auth } from "@/config/firebase-config";
import ControlledInput from "@/components/ControlledInput";
import Button from "@/components/Button";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";
import { getResetEmailErrorMessage } from "@/features/auth/accountErrors";
import {
  isExpectedResetRequestError,
  isSilentResetError,
  sendResetEmail,
} from "@/features/auth/passwordReset";
import { reportError } from "@/utils/reportError";

type ForgotPasswordHandlerProps = {
  /** Carried over from the login form so it needn't be typed twice. */
  initialEmail?: string;
  onBack: () => void;
};

/**
 * "Forgot password" on the login page: emails a reset link. The confirmation never says
 * whether an account exists, so the form can't be used to probe for registered emails.
 */
const ForgotPasswordHandler = ({ initialEmail = "", onBack }: ForgotPasswordHandlerProps) => {
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const address = email.trim();
    if (!address || pending) return;
    setPending(true);
    setError("");
    try {
      await sendResetEmail(auth, address);
      setSentTo(address);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (isSilentResetError(code)) {
        setSentTo(address);
      } else {
        if (!isExpectedResetRequestError(code)) {
          reportError(err, { feature: "account", action: "forgot_password" });
        }
        setError(getResetEmailErrorMessage(code));
      }
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  if (sentTo) {
    return (
      <div className="InfoBox ForgotPassword">
        <p className="ForgotPassword__sent" role="status">
          If an account exists for <span className="keep-case">{sentTo}</span>, a reset link is on
          its way. Check your inbox (and spam folder).
        </p>
        <div className="ForgotPassword__actions">
          <Button text="Back to login" variant="primary" onClick={onBack} />
          <Button text="Send again" size="sm" variant="secondary" onClick={() => setSentTo(null)} />
        </div>
      </div>
    );
  }

  return (
    <form className="InfoBox ForgotPassword" onSubmit={handleSubmit}>
      <p className="ForgotPassword__hint">Enter your email and we'll send you a reset link.</p>
      <ControlledInput
        value={email}
        onChange={(e) => {
          setEmail((e.target as HTMLInputElement).value);
          setError("");
        }}
        label="Email"
      />
      <AuthErrorMessage message={error} />
      <div className="ForgotPassword__actions">
        <Button
          text="Send reset link"
          variant="primary"
          loading={pending}
          disabled={!email.trim()}
          onClick={() => void submit()}
        />
        <Button text="Back to login" size="sm" variant="secondary" onClick={onBack} />
      </div>
    </form>
  );
};

export default ForgotPasswordHandler;
