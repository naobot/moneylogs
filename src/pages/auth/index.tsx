import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LoginHandler from "@/features/auth/components/LoginHandler";
import RegistrationHandler from "@/features/auth/components/RegistrationHandler";
import ForgotPasswordHandler from "@/features/auth/components/ForgotPasswordHandler";
import Button from "@/components/Button";
import { AuthLocationState, initialAuthView, sanitizeRedirect } from "@/features/auth/authRedirect";

export const Auth = () => {
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
    </div>
  );
};
