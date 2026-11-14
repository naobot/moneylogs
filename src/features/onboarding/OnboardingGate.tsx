import { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useCurrentUser } from "@/contexts";

import { onboardingRedirect } from "./welcomeSteps";

/** Sends a new account to /welcome until they've finished it, remembering where they were headed. */
export const OnboardingGate = ({ children }: PropsWithChildren) => {
  const { user } = useCurrentUser();
  const location = useLocation();
  const to = onboardingRedirect(user, location);
  if (to) return <Navigate to={to} replace />;
  return <>{children}</>;
};

export default OnboardingGate;
