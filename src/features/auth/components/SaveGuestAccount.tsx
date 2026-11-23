import { useState } from "react";

import ControlledInput from "@/components/ControlledInput";
import Button from "@/components/Button";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";
import useValidatePassword from "@/features/auth/hooks/useValidatePassword";
import { useCurrentUser } from "@/contexts";
import { getGuestSaveErrorMessage, isExpectedGuestSaveError, saveGuestAccount } from "../guest";
import { reportError } from "@/utils/reportError";
import { track } from "@/utils/analytics";

/**
 * A guest's email + password form: saves their account in place (same logs, same
 * everything), sends the confirmation email, then reloads so every screen sees a real
 * account.
 */
export const SaveGuestAccount = () => {
  const { user } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { isValid } = useValidatePassword(password);

  const save = async () => {
    if (!user?.id || pending) return;
    setPending(true);
    setError("");
    try {
      await saveGuestAccount(user.id, email.trim(), password);
      track("sign_up", { method: "guest" });
      // Stays pending through the reload.
      window.location.reload();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (!isExpectedGuestSaveError(code)) {
        reportError(err, { feature: "account", action: "save_guest_account" });
      }
      setError(getGuestSaveErrorMessage(code));
      setPending(false);
    }
  };

  return (
    <form
      className="InfoBox SaveGuestAccount"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
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
      <AuthErrorMessage message={error} />
      <Button
        onClick={() => void save()}
        text="Save account"
        disabled={!email.trim() || !password || !isValid || !user?.id}
        loading={pending}
        variant="primary"
      />
    </form>
  );
};

export default SaveGuestAccount;
