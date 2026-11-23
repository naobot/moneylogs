import { useState } from "react";

import Button from "@/components/Button";
import AuthErrorMessage from "@/features/auth/components/AuthErrorMessage";
import { useRegisterNewUser } from "@/hooks/useRegisterNewUser";
import { reportError } from "@/utils/reportError";
import { track } from "@/utils/analytics";
import { startGuest } from "../guest";

/** Start as a guest, then the welcome wizard like any new account. */
export const TryAsGuest = ({ size }: { size?: "sm" | "md" }) => {
  const { addNewUserFn } = useRegisterNewUser();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await startGuest(addNewUserFn);
      track("try_as_guest");
      // A full load, like registration: every provider starts from the new account.
      window.location.href = "/welcome";
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/operation-not-allowed" && code !== "auth/too-many-requests") {
        reportError(err, { feature: "registration", action: "try_as_guest" });
      }
      setError(
        code === "auth/operation-not-allowed"
          ? "Trying without an account isn't available right now. Please create an account instead."
          : "Couldn't start that just now. Please try again.",
      );
      setPending(false);
    }
  };

  return (
    <>
      <Button
        text="Try without an account"
        variant="secondary"
        size={size}
        loading={pending}
        onClick={() => void start()}
      />
      <AuthErrorMessage message={error} />
    </>
  );
};

export default TryAsGuest;
