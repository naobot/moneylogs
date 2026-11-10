import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";

import { auth } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { getResetEmailErrorMessage } from "@/features/auth/accountErrors";
import dayjs from "@/utils/configuredDayjs";

import Button from "@/components/Button";
import { ChangePasswordForm } from "./ChangePasswordForm";

// .LogRowButton (the reset-link button) lives with the other small row buttons.
import "@/features/logActions/LogActions.scss";
import "./AccountSection.scss";

declare const __APP_VERSION__: string;

/** Account details and credentials: email, member since, password, sign out. */
export const AccountSection = () => {
  const [firebaseUser] = useAuthState(auth);
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const { signOut, isPending: signOutPending } = useSignOut();
  const [resetPending, setResetPending] = useState(false);

  const email = firebaseUser?.email ?? user?.email;
  const memberSince = user?.createdAt?.seconds
    ? dayjs.unix(user.createdAt.seconds).format("D MMM YYYY")
    : null;

  const sendReset = async () => {
    if (!email || resetPending) return;
    setResetPending(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Reset link sent to ${email}`, "success");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      console.error("Failed to send password reset email:", code);
      showToast(getResetEmailErrorMessage(code));
    } finally {
      setResetPending(false);
    }
  };

  return (
    <>
      <dl className="AccountSection__details">
        <dt>Email</dt>
        <dd>
          {email ?? "…"}
          {firebaseUser && !firebaseUser.emailVerified && <small> (unverified)</small>}
        </dd>
        {memberSince && (
          <>
            <dt>Member since</dt>
            <dd>{memberSince}</dd>
          </>
        )}
        <dt>App version</dt>
        <dd>{__APP_VERSION__}</dd>
      </dl>

      <div>
        <h4>Change password</h4>
        <ChangePasswordForm />
        <p className="AccountSection__hint">
          Forgot your current password?{" "}
          <button
            type="button"
            className="LogRowButton"
            disabled={!email || resetPending}
            onClick={() => void sendReset()}
          >
            {resetPending ? "sending…" : "email me a reset link"}
          </button>
        </p>
      </div>

      <div className="Menu">
        <Button
          text="Sign out"
          size="sm"
          buttonStyle="primary-border"
          icon="exit"
          loading={signOutPending}
          onClick={signOut}
        />
      </div>
    </>
  );
};

export default AccountSection;
