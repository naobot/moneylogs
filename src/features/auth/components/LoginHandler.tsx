import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/config/firebase-config";

import ControlledInput from "@/components/ControlledInput";
import Button from "@/components/Button";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";
import { getLoginErrorMessage } from "@/features/auth/loginErrors";
import { track } from "@/utils/analytics";

type LoginHandlerProps = {
  redirectTo?: string;
  /** Opens the forgot-password view, carrying over whatever email was typed. */
  onForgotPassword?: (email: string) => void;
};

const LoginHandler = ({ redirectTo, onForgotPassword }: LoginHandlerProps) => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLogin = () => {
    setLoginPending(true);
    setLoginError("");
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        track("login", { method: "email" });
        setLoginPending(false);
        void navigate(redirectTo ?? "/");
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        setLoginPending(false);
        setLoginError(getLoginErrorMessage(errorCode));
        console.log(`${errorCode}: ${errorMessage}`);
      });
  };

  return (
    <>
      <div className="InfoBox Login">
        <ControlledInput
          value={email}
          onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
          label="Email"
        />
        <ControlledInput
          type="password"
          value={password}
          onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
          label="Password"
        />
        <AuthErrorMessage message={loginError} />
        <Button
          onClick={() => handleLogin()}
          text="Login"
          loading={loginPending}
          disabled={!email || !password}
          variant="primary"
        />
        {onForgotPassword && (
          <Button
            onClick={() => onForgotPassword(email.trim())}
            text="Forgot password"
            size="sm"
            variant="secondary"
            className="Login__forgot"
          />
        )}
      </div>
    </>
  );
};

export default LoginHandler;
