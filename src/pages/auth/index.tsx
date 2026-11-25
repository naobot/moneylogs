import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/config/firebase-config";
import { LoadingDots } from "@/components/LoadingDots";
import RowButton from "@/components/RowButton";
import { isGuest } from "@/features/auth/guest";
import SaveGuestAccount from "@/features/auth/components/SaveGuestAccount";
import useSignOut from "@/features/auth/hooks/useSignOut";
import LoginHandler from "@/features/auth/components/LoginHandler";
import RegistrationHandler from "@/features/auth/components/RegistrationHandler";
import ForgotPasswordHandler from "@/features/auth/components/ForgotPasswordHandler";
import Button from "@/components/Button";
import TryAsGuest from "@/features/auth/components/TryAsGuest";
import { AuthLocationState, initialAuthView, sanitizeRedirect } from "@/features/auth/authRedirect";

/**
 * /login for someone already trying moneylogs as a guest (e.g. back here through the
 * browser history). Signing in or registering would swap their session and strand what
 * they've logged, so they get the save form instead, and switching accounts goes through
 * sign-out's guest warning.
 */
const GuestOnLogin = () => {
  const { signOut, isPending } = useSignOut();
  return (
    <div className="LoginPage Window">
      <h1>moneylogs</h1>
      <p>
        You're trying moneylogs as a guest. Save your account to keep what you've logged and sign in
        from anywhere.
      </p>
      <SaveGuestAccount />
      <p>
        <Link to="/">keep going as a guest</Link>
      </p>
      <p>
        <RowButton disabled={isPending} onClick={signOut}>
          sign in to another account
        </RowButton>
      </p>
    </div>
  );
};

export const Auth = () => {
  const [authUser, authLoading] = useAuthState(auth);
  if (authLoading) {
    return (
      <div className="LoginPage Window" aria-busy="true">
        <LoadingDots />
      </div>
    );
  }
  if (isGuest(authUser)) return <GuestOnLogin />;
  return <AuthForms signedIn={!!authUser} />;
};

const AuthForms = ({ signedIn }: { signedIn: boolean }) => {
  const location = useLocation();
  const state = location.state as AuthLocationState | null;

  const redirectTo = sanitizeRedirect(state?.from);
  const [currentView, setCurrentView] = useState(initialAuthView(state));
  const [resetEmail, setResetEmail] = useState("");

  return (
    <div className="LoginPage Window">
      <h1>
        moneylogs
        <small>
          <Link to="/about">[?]</Link>
        </small>
      </h1>
      <div className="Menu">
        <Button
          onClick={() => setCurrentView("register")}
          isSelected={currentView === "register"}
          variant="toggle"
          size="sm"
          text="I'm a new user"
        />
        <Button
          onClick={() => setCurrentView("login")}
          isSelected={currentView === "login" || currentView === "forgot"}
          variant="toggle"
          size="sm"
          text="I have an account"
        />
      </div>
      {currentView === "login" && (
        <LoginHandler
          redirectTo={redirectTo}
          onForgotPassword={(email) => {
            setResetEmail(email);
            setCurrentView("forgot");
          }}
        />
      )}
      {currentView === "forgot" && (
        <ForgotPasswordHandler initialEmail={resetEmail} onBack={() => setCurrentView("login")} />
      )}
      {currentView === "register" && <RegistrationHandler redirectTo={redirectTo} />}
      {/* Not on the way to an invite (accepting one needs a real account), and not over a
          signed-in account (e.g. back here through the history): it would replace it. */}
      {!signedIn && !redirectTo?.includes("/invite") && (
        <div className="LoginPage__guest">
          <p>Just looking? Try it first, and save your account later if you like it.</p>
          <TryAsGuest size="sm" />
        </div>
      )}
    </div>
  );
};
