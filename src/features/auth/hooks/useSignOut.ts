import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { auth } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";
import { useCurrentUser } from "@/contexts";
import { turnPushOff } from "@/features/push/devicePush";
import { clearPostDraft } from "@/utils/postDraft";
import { isGuest } from "@/features/auth/guest";
import type { AuthLocationState } from "@/features/auth/authRedirect";

/** What a guest is asked before signing out: nothing of theirs can be found again. */
export const GUEST_SIGN_OUT_WARNING =
  "You're a guest, so signing out loses everything you've logged. Save your account first to keep it. Sign out anyway?";

/**
 * Signs out and returns to /login. Shared by the nav and the /me Account drawer. A guest
 * is asked first; their account is cleaned up on the server later. `loginState` is the
 * login page's router state, e.g. an invite to land back on after signing in to another
 * account.
 */
export const useSignOut = ({ loginState }: { loginState?: AuthLocationState } = {}) => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [isPending, setIsPending] = useState(false);

  const handleSignOut = () => {
    if (isGuest(auth.currentUser) && !window.confirm(GUEST_SIGN_OUT_WARNING)) return;
    setIsPending(true);
    // Stop this device's pushes while still signed in (the rules need the owner).
    void turnPushOff(user?.id)
      .catch(() => undefined)
      .then(() => signOut(auth))
      .then(() => {
        // An unsent post can hold private spending pulled from financial logs.
        clearPostDraft();
        setIsPending(false);
        void navigate("/login", { state: loginState });
      })
      .catch((error: unknown) => {
        setIsPending(false);
        reportError(error, { feature: "account", action: "sign_out" });
      });
  };

  return { signOut: handleSignOut, isPending };
};

export default useSignOut;
