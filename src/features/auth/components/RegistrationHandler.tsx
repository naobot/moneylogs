import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/config/firebase-config";
import useValidatePassword from "@/features/auth/hooks/useValidatePassword";
import { useRegisterNewUser } from "@/hooks/useRegisterNewUser";
import ControlledInput from "@/components/ControlledInput";
import Button from "@/components/Button";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";
import { getRegistrationErrorMessage } from "@/features/auth/registrationErrors";

const RegistrationHandler = ({ redirectTo }: { redirectTo?: string }) => {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const { isValid } = useValidatePassword(password);
  const { addNewUser } = useRegisterNewUser();

  const handleRegister = async () => {
    setRegistrationPending(true);
    setRegistrationError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await addNewUser.mutate({
        userId: user.uid,
        displayName: displayName,
        email: email,
      });

      await sendEmailVerification(auth.currentUser!);
      await updateProfile(auth.currentUser!, { displayName: displayName });
      const loggedInUser = await signInWithEmailAndPassword(auth, email, password);

      setRegistrationPending(false);

      if (loggedInUser.user) {
        window.location.href = redirectTo ?? "/me";
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      setRegistrationPending(false);
      setRegistrationError(getRegistrationErrorMessage(err.code));
      console.log(`${err.code}: ${err.message}`);
    }
  };

  return (
    <>
      <div className="InfoBox Registration">
        <ControlledInput
          value={displayName}
          onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
          label="Name"
        />
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
          isError={!!password && !isValid}
          errorMessage={"password problem"}
        />
        <AuthErrorMessage message={registrationError} />
        <Button
          onClick={() => handleRegister()}
          text="Register"
          disabled={!email || !password || !isValid}
          loading={registrationPending}
          buttonStyle="primary-border"
        />
      </div>
    </>
  );
};

export default RegistrationHandler;
