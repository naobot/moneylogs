import { FormEvent, useEffect, useRef, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  signOut,
  verifyPasswordResetCode,
} from "firebase/auth";

import { auth } from "@/config/firebase-config";
import Button from "@/components/Button";
import ControlledInput from "@/components/ControlledInput";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";
import useValidatePassword from "@/features/auth/hooks/useValidatePassword";
import { describePasswordRequirements } from "@/features/auth/passwordRequirements";
import { getResetEmailErrorMessage } from "@/features/auth/accountErrors";
import {
  AuthAction,
  getActionLinkErrorMessage,
  getResetConfirmErrorMessage,
  isExpectedActionError,
  isExpectedResetRequestError,
  sendResetEmail,
} from "@/features/auth/passwordReset";
import { reportError } from "@/utils/reportError";

const errorCode = (err: unknown) => (err as { code?: string })?.code;

const reportUnexpected = (err: unknown, action: string) => {
  if (!isExpectedActionError(errorCode(err))) {
    reportError(err, { feature: "account", action });
  }
};

/** Back to login after a reset, still headed wherever the reset link said (not /login itself). */
const loginState = (continuePath: string | null) => {
  const from = continuePath && !continuePath.startsWith("/login") ? continuePath : undefined;
  return { view: "login", from };
};

const missingCode = () =>
  ({ step: "invalid", message: getActionLinkErrorMessage("auth/invalid-action-code") }) as const;

const LinkProblem = ({ message }: { message: string }) => (
  <div className="InfoBox AuthAction__problem">
    <AuthErrorMessage message={message} />
    <Button text="Back to login" variant="secondary" to="/login" state={{ view: "forgot" }} />
  </div>
);

const Checking = () => (
  <p className="AuthAction__status" role="status">
    Checking your link
    <LoadingDots label="" />
  </p>
);

type ResetState =
  | { step: "checking" }
  | { step: "invalid"; message: string }
  | { step: "form"; email: string }
  | { step: "done" };

/** Choose a new password from an emailed reset link. */
export const ResetPassword = ({ oobCode, continuePath }: Omit<AuthAction, "mode">) => {
  const [state, setState] = useState<ResetState>(() =>
    oobCode ? { step: "checking" } : missingCode(),
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { isValid, status } = useValidatePassword(password);

  useEffect(() => {
    if (!oobCode) return;
    let cancelled = false;
    // Only checks the code; it isn't used up until the new password is saved.
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => !cancelled && setState({ step: "form", email }))
      .catch((err) => {
        if (cancelled) return;
        reportUnexpected(err, "verify_reset_code");
        setState({ step: "invalid", message: getActionLinkErrorMessage(errorCode(err)) });
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const passwordError = password ? describePasswordRequirements(status) : null;
  const confirmError = confirm && confirm !== password ? "Doesn't match the new password." : null;
  const canSubmit = !!password && isValid && confirm === password;

  const submit = async () => {
    if (state.step !== "form" || !oobCode || !canSubmit || pending) return;
    setPending(true);
    setError("");
    try {
      await confirmPasswordReset(auth, oobCode, password);
      // Changing the password revokes existing sessions; sign this one out now rather
      // than let it fail later, so they log in fresh with the new password.
      if (auth.currentUser?.email?.toLowerCase() === state.email.toLowerCase()) {
        await signOut(auth).catch(() => {});
      }
      setState({ step: "done" });
    } catch (err) {
      reportUnexpected(err, "confirm_password_reset");
      setError(getResetConfirmErrorMessage(errorCode(err)));
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  switch (state.step) {
    case "checking":
      return <Checking />;
    case "invalid":
      return <LinkProblem message={state.message} />;
    case "done":
      return (
        <div className="InfoBox AuthAction__done">
          <p role="status">Your password has been changed.</p>
          <Button text="Log in" variant="primary" to="/login" state={loginState(continuePath)} />
        </div>
      );
    case "form":
      return (
        <form className="InfoBox AuthAction__form" onSubmit={handleSubmit}>
          <p className="AuthAction__hint">
            Choose a new password for <span className="keep-case">{state.email}</span>.
          </p>
          <ControlledInput
            type="password"
            value={password}
            onChange={(e) => {
              setPassword((e.target as HTMLInputElement).value);
              setError("");
            }}
            label="New password"
            isError={!!passwordError}
            errorMessage={passwordError ?? undefined}
          />
          <ControlledInput
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm((e.target as HTMLInputElement).value);
              setError("");
            }}
            label="Confirm password"
            isError={!!confirmError}
            errorMessage={confirmError ?? undefined}
          />
          <AuthErrorMessage message={error} />
          <Button
            text="Save password"
            variant="primary"
            disabled={!canSubmit}
            loading={pending}
            onClick={() => void submit()}
          />
        </form>
      );
  }
};

type EmailActionState =
  | { step: "checking" }
  | { step: "invalid"; message: string }
  | { step: "done"; restoredEmail?: string };

/**
 * Applies a one-shot email link: verifying an address, confirming a change of address,
 * or undoing one (recoverEmail). Codes are single-use, so this runs once per mount even
 * under StrictMode's double effect.
 */
export const EmailAction = ({
  mode,
  oobCode,
  continuePath,
}: AuthAction & { mode: "verifyEmail" | "verifyAndChangeEmail" | "recoverEmail" }) => {
  const [state, setState] = useState<EmailActionState>(() =>
    oobCode ? { step: "checking" } : missingCode(),
  );
  const started = useRef(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!oobCode) return;
    const run = async () => {
      try {
        let restoredEmail: string | undefined;
        if (mode === "recoverEmail") {
          const info = await checkActionCode(auth, oobCode);
          restoredEmail = info.data.email ?? undefined;
        }
        await applyActionCode(auth, oobCode);
        // Picks up emailVerified / the new address for a session on this device.
        await auth.currentUser?.reload().catch(() => {});
        setState({ step: "done", restoredEmail });
      } catch (err) {
        reportUnexpected(err, `apply_${mode}`);
        setState({ step: "invalid", message: getActionLinkErrorMessage(errorCode(err)) });
      }
    };
    void run();
  }, [mode, oobCode]);

  const sendReset = async (email: string) => {
    if (resetPending) return;
    setResetPending(true);
    setResetError("");
    try {
      await sendResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      const code = errorCode(err);
      if (!isExpectedResetRequestError(code)) {
        reportError(err, { feature: "account", action: "recover_email_reset" });
      }
      setResetError(getResetEmailErrorMessage(code));
    } finally {
      setResetPending(false);
    }
  };

  if (state.step === "checking") return <Checking />;
  if (state.step === "invalid") return <LinkProblem message={state.message} />;

  if (mode === "recoverEmail") {
    return (
      <div className="InfoBox AuthAction__done">
        <p role="status">
          Your sign-in email has been changed back
          {state.restoredEmail && (
            <>
              {" "}
              to <span className="keep-case">{state.restoredEmail}</span>
            </>
          )}
          .
        </p>
        {state.restoredEmail && (
          <>
            <p className="AuthAction__hint">
              If you didn't ask for it to change, reset your password too.
            </p>
            {resetSent ? (
              <p role="status">Reset link sent.</p>
            ) : (
              <Button
                text="Send reset link"
                variant="secondary"
                loading={resetPending}
                onClick={() => void sendReset(state.restoredEmail!)}
              />
            )}
            <AuthErrorMessage message={resetError} />
          </>
        )}
        <Button text="Log in" variant="primary" to="/login" state={{ view: "login" }} />
      </div>
    );
  }

  return (
    <div className="InfoBox AuthAction__done">
      <p role="status">
        {mode === "verifyEmail"
          ? "Your email is verified."
          : "Your sign-in email has been updated."}
      </p>
      <Button text="Continue" variant="primary" to={continuePath ?? "/"} />
    </div>
  );
};

const TITLES = {
  resetPassword: "reset password",
  verifyEmail: "verify email",
  verifyAndChangeEmail: "change email",
  recoverEmail: "restore email",
} as const;

/** Firebase's emailed links (reset, verify, recover) land here via the custom action URL. */
const AuthActionHandler = ({ action }: { action: AuthAction }) => {
  const { mode } = action;
  return (
    <>
      <h2 className="AuthAction__title">{mode ? TITLES[mode] : "email link"}</h2>
      {mode === "resetPassword" && (
        <ResetPassword oobCode={action.oobCode} continuePath={action.continuePath} />
      )}
      {(mode === "verifyEmail" || mode === "verifyAndChangeEmail" || mode === "recoverEmail") && (
        <EmailAction {...action} mode={mode} />
      )}
      {!mode && <LinkProblem message={getActionLinkErrorMessage("auth/invalid-action-code")} />}
    </>
  );
};

export default AuthActionHandler;
