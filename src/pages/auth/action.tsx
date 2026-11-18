import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

import AuthActionHandler from "@/features/auth/components/AuthActionHandler";
import { parseAuthAction } from "@/features/auth/passwordReset";

/** /auth/action: the custom handler for Firebase's emailed links (reset, verify, recover). */
export const AuthAction = () => {
  const { search } = useLocation();
  const action = useMemo(() => parseAuthAction(search), [search]);

  return (
    <div className="LoginPage Window AuthAction">
      <h1>
        moneylogs
        <small>
          <Link to="/about">[?]</Link>
        </small>
      </h1>
      <AuthActionHandler action={action} />
    </div>
  );
};

export default AuthAction;
