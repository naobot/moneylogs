import { useLocation } from "react-router-dom";

import RowButton from "@/components/RowButton";
import useSignOut from "../hooks/useSignOut";
import SaveGuestAccount from "./SaveGuestAccount";

/**
 * What a guest sees at an invite link instead of joining: accepting needs a real account
 * (anything a guest joined would vanish with them). Saving reloads this same page, so the
 * invite carries on as for anyone.
 */
export const GuestInvite = () => {
  const location = useLocation();
  // Signing in to an existing account instead: through the guest sign-out warning, and
  // back to this invite afterwards (the login page doesn't offer guest mode on the way).
  const { signOut, isPending } = useSignOut({
    loginState: { view: "login", from: location.pathname + location.search },
  });
  return (
    <div className="Window GuestInvite">
      <h2>save your account to accept</h2>
      <p>
        You're trying moneylogs as a guest. Save your account with an email and password to accept
        this invite. Everything you've logged so far stays.
      </p>
      <SaveGuestAccount />
      <p>
        Already have an account? Sign in to it to accept, and you'll come back here. What you've
        logged as a guest won't come along.
      </p>
      <RowButton disabled={isPending} onClick={() => signOut()}>
        sign in instead
      </RowButton>
    </div>
  );
};

export default GuestInvite;
