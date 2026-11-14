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
import { placeholderDisplayName, welcomePath } from "@/features/auth/authRedirect";

const RegistrationHandler = ({ redirectTo }: { redirectTo?: string }) => {
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

      // A placeholder until the welcome wizard asks for a real display name.
      const displayName = placeholderDisplayName(email);
      await addNewUser.mutate({
        userId: user.uid,
        displayName,
        email: email,
      });

      await sendEmailVerification(auth.currentUser!);
      await updateProfile(auth.currentUser!, { displayName });
      const loggedInUser = await signInWithEmailAndPassword(auth, email, password);

      setRegistrationPending(false);

      if (loggedInUser.user) {
        // The welcome wizard sets up the profile, then carries on to where they were headed.
        window.location.href = welcomePath(redirectTo);
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
