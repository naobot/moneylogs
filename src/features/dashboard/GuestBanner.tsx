import { Link } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";

import { auth } from "@/config/firebase-config";
import { isGuest } from "@/features/auth/guest";

import "./GuestBanner.scss";

/**
 * Home's reminder that a guest's logs live only in this browser until they save
 * their account. Not dismissible: losing everything is the one thing they should know.
 */
export const GuestBanner = () => {
  const [user] = useAuthState(auth);
  if (!isGuest(user)) return null;

  return (
    <aside className="GuestBanner" aria-label="Guest account">
      <p>
        <strong>you're trying moneylogs as a guest.</strong> Save your account to keep what you log,
        use it on other devices, and add friends.
      </p>
      <Link to="/me#account">save my account ›</Link>
    </aside>
  );
};

export default GuestBanner;
