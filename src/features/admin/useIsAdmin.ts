import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase-config";

/**
 * Whether the signed-in account carries the `admin` custom claim (functions/scripts/
 * set-admin.ts); undefined while checking. `forceRefresh` fetches a fresh ID token, so a
 * claim granted after sign-in shows up without signing out. Only the UI is gated here;
 * the callables check the claim themselves.
 */
export const useIsAdmin = ({ forceRefresh = false } = {}): boolean | undefined => {
  const [authUser] = useAuthState(auth);
  // Keyed by uid, so switching accounts never shows the previous account's answer.
  const [checked, setChecked] = useState<{ uid: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    const done = (isAdmin: boolean) => {
      if (!cancelled) setChecked({ uid: authUser.uid, isAdmin });
    };
    authUser
      .getIdTokenResult(forceRefresh)
      .then((result) => done(result.claims.admin === true))
      .catch(() => done(false));
    return () => {
      cancelled = true;
    };
  }, [authUser, forceRefresh]);

  if (!authUser) return false;
  return checked?.uid === authUser.uid ? checked.isAdmin : undefined;
};
