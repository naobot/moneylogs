import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { onIdTokenChanged, sendEmailVerification, type User } from "firebase/auth";

import { auth } from "@/config/firebase-config";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { useToastContext } from "@/hooks/useToastContext";
import { isEmailConfirmed } from "@/utils/confirmedEmail";
import { reportError } from "@/utils/reportError";
import { track } from "@/utils/analytics";
import { ConfirmEmailContext } from "./confirmEmailContext";
import { isGuest } from "@/features/auth/guest";
import SaveGuestAccount from "@/features/auth/components/SaveGuestAccount";

import "./ConfirmEmail.scss";

const confirmed = (user: User) =>
  isEmailConfirmed({
    emailVerified: user.emailVerified,
    creationTime: user.metadata.creationTime,
  });

/**
 * Fetches the account's latest state: the link may have been opened on another device.
 * A fresh ID token too, so the next callable sees email_verified without a lookup.
 */
const refreshed = async (user: User) => {
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return confirmed(user);
};

/**
 * Asks people to confirm their email before they reach out to others (friend requests,
 * invite links, gifts, log invites). One modal for the whole app.
 */
export const ConfirmEmailProvider = ({ children }: PropsWithChildren) => {
  const { showToast } = useToastContext();
  const [user] = useAuthState(auth);
  // reload() updates the user in place without an auth event, so a confirmation found by
  // checking bumps this to re-render with it.
  const [, setChecks] = useState(0);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [notYet, setNotYet] = useState(false);

  // The link is usually opened in another tab (or on the phone): check again when this
  // tab comes back, and whenever the token changes (the action page refreshes it).
  useEffect(() => {
    const recheck = () => {
      const current = auth.currentUser;
      if (!current || confirmed(current) || document.visibilityState !== "visible") return;
      refreshed(current)
        .then((ok) => ok && setChecks((n) => n + 1))
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", recheck);
    const stop = onIdTokenChanged(auth, () => setChecks((n) => n + 1));
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      stop();
    };
  }, []);

  const showConfirmEmail = useCallback(() => {
    // Signed out, there's no email to confirm: callers offer sign-in instead.
    if (!auth.currentUser) return;
    setNotYet(false);
    setOpen(true);
    track("confirm_email", { action: "prompt" });
  }, []);

  const ensureConfirmed = useCallback(
    async ({ recheck = false } = {}) => {
      const user = auth.currentUser;
      if (!user) return false;
      if (!recheck && confirmed(user)) return true;
      try {
        if (await refreshed(user)) {
          setChecks((n) => n + 1);
          return true;
        }
      } catch {
        // Offline or similar: fall through to the modal, which can check again.
      }
      showConfirmEmail();
      return false;
    },
    [showConfirmEmail],
  );

  const checkAgain = async () => {
    const user = auth.currentUser;
    if (!user || checking) return;
    setChecking(true);
    try {
      if (await refreshed(user)) {
        setChecks((n) => n + 1);
        setOpen(false);
        track("confirm_email", { action: "confirmed" });
        showToast("Email confirmed. You're all set.", "success");
      } else {
        setNotYet(true);
      }
    } catch (err) {
      reportError(err, { feature: "account", action: "check_email_confirmed" });
      showToast("Couldn't check just now. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    const user = auth.currentUser;
    if (!user || resending) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
      track("confirm_email", { action: "resend" });
      showToast(`Link sent to ${user.email ?? "your email"}`, "success");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/too-many-requests") {
        showToast("A link was sent recently. Please wait a few minutes before asking again.");
      } else {
        reportError(err, { feature: "account", action: "resend_confirm_email" });
        showToast("Couldn't send the link. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  const isConfirmed = !!user && confirmed(user);
  const value = useMemo(
    () => ({ confirmed: isConfirmed, ensureConfirmed, showConfirmEmail }),
    [isConfirmed, ensureConfirmed, showConfirmEmail],
  );
  const email = auth.currentUser?.email;

  return (
    <ConfirmEmailContext.Provider value={value}>
      {children}
      {open && isGuest(user) && (
        <Modal isOpen onClose={() => setOpen(false)} className="ConfirmEmail">
          <Modal.Header striped title="save your account" />
          <Modal.Body className="ConfirmEmail__body">
            <p>
              Adding friends, sending gifts and inviting people need an account. Save yours with an
              email and password. Everything you've logged as a guest stays.
            </p>
            <SaveGuestAccount />
          </Modal.Body>
          <Modal.Actions>
            <Modal.CancelButton text="Not now" />
          </Modal.Actions>
        </Modal>
      )}
      {open && !isGuest(user) && (
        <Modal isOpen onClose={() => setOpen(false)} className="ConfirmEmail">
          <Modal.Header striped title="confirm your email" />
          <Modal.Body className="ConfirmEmail__body">
            <p>
              Adding friends, sending gifts and inviting people need a confirmed email address. We
              sent a link to <strong className="keep-case">{email ?? "your email"}</strong> when you
              signed up. Open it, then come back here.
            </p>
            {notYet && (
              <p role="status">
                It isn't confirmed yet. Check your spam folder, or send a new link.
              </p>
            )}
          </Modal.Body>
          <Modal.Actions>
            <Button
              text="Resend link"
              size="sm"
              variant="secondary"
              loading={resending}
              onClick={() => void resend()}
            />
            <Button
              text="I've confirmed"
              size="sm"
              variant="primary"
              loading={checking}
              onClick={() => void checkAgain()}
            />
          </Modal.Actions>
        </Modal>
      )}
    </ConfirmEmailContext.Provider>
  );
};

export default ConfirmEmailProvider;
