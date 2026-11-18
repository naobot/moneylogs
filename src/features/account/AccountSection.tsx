import { useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";

import { auth } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { getResetEmailErrorMessage, isExpectedAccountError } from "@/features/auth/accountErrors";
import { sendResetEmail } from "@/features/auth/passwordReset";
import dayjs from "@/utils/configuredDayjs";
import { useDateFormat } from "@/utils/dateFormat";

import Button from "@/components/Button";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { DeleteAccountModal } from "./DeleteAccountModal";

import "./AccountSection.scss";
import { reportError } from "@/utils/reportError";

/** Account details, then the account actions as a row of buttons. */
export const AccountSection = () => {
  const [firebaseUser] = useAuthState(auth);
  const { user } = useCurrentUser();
  const { formatDate } = useDateFormat();
  const { showToast } = useToastContext();
  const { signOut, isPending: signOutPending } = useSignOut();
  const [resetPending, setResetPending] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const email = firebaseUser?.email ?? user?.email;
  const memberSince = user?.createdAt?.seconds
    ? formatDate(dayjs.unix(user.createdAt.seconds), { weekday: false })
    : null;

  const sendReset = async () => {
    if (!email || resetPending) return;
    setResetPending(true);
    try {
      await sendResetEmail(auth, email);
      showToast(`Reset link sent to ${email}`, "success");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (!isExpectedAccountError(code)) {
        reportError(err, { feature: "account", action: "send_password_reset" });
      }
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
          variant="secondary"
          onClick={() => setChangingPassword(true)}
        />
        <Button
          text="Reset password"
          title={email ? `Email a reset link to ${email}` : "Email me a reset link"}
          size="sm"
          variant="secondary"
          disabled={!email}
          loading={resetPending}
          onClick={() => void sendReset()}
        />
        <Button
          text="Sign out"
          size="sm"
          variant="secondary"
          loading={signOutPending}
          onClick={signOut}
        />
      </div>

      <section className="AccountSection__danger">
        <h4>Delete account</h4>
        <p>Permanently delete your account and everything only you can see.</p>
        <Button
          text="Delete account"
          size="sm"
          variant="secondary"
          onClick={() => setDeletingAccount(true)}
        />
      </section>

      {changingPassword && (
        <ChangePasswordModal isOpen onClose={() => setChangingPassword(false)} />
      )}
      {deletingAccount && <DeleteAccountModal isOpen onClose={() => setDeletingAccount(false)} />}
    </>
  );
};

export default AccountSection;
