import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";

import { auth } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { getResetEmailErrorMessage } from "@/features/auth/accountErrors";
import dayjs from "@/utils/configuredDayjs";
import { useDateFormat } from "@/utils/dateFormat";

import Button from "@/components/Button";
import { ChangePasswordModal } from "./ChangePasswordModal";

import "./AccountSection.scss";

/** Account details, then the account actions as a row of buttons. */
export const AccountSection = () => {
  const [firebaseUser] = useAuthState(auth);
  const { user } = useCurrentUser();
  const { formatDate } = useDateFormat();
  const { showToast } = useToastContext();
  const { signOut, isPending: signOutPending } = useSignOut();
  const [resetPending, setResetPending] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const email = firebaseUser?.email ?? user?.email;
  const memberSince = user?.createdAt?.seconds
    ? formatDate(dayjs.unix(user.createdAt.seconds), { weekday: false })
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
      </dl>

      <div className="AccountSection__actions">
        <Button
          text="Change password"
          size="sm"
          buttonStyle="primary-border"
          onClick={() => setChangingPassword(true)}
        />
        <Button
          text="Reset password"
          title={email ? `Email a reset link to ${email}` : "Email me a reset link"}
          size="sm"
          buttonStyle="primary-border"
          disabled={!email}
          loading={resetPending}
          onClick={() => void sendReset()}
        />
        <Button
          text="Sign out"
          size="sm"
          buttonStyle="primary-border"
          className="AccountSection__signOut"
          loading={signOutPending}
          onClick={signOut}
        />
      </div>

      {changingPassword && (
        <ChangePasswordModal isOpen onClose={() => setChangingPassword(false)} />
      )}
    </>
  );
};

export default AccountSection;
