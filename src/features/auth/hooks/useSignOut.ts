import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { auth } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";

/** Signs out and returns to /login. Shared by the nav and the /me Account drawer. */
export const useSignOut = () => {
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);

  const handleSignOut = () => {
    setIsPending(true);
    void signOut(auth)
      .then(() => {
        setIsPending(false);
        void navigate("/login");
      })
      .catch((error: unknown) => {
        setIsPending(false);
        reportError(error, { feature: "account", action: "sign_out" });
      });
  };

  return { signOut: handleSignOut, isPending };
};

export default useSignOut;
