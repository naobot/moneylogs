import { createContext, useContext } from "react";

export interface ConfirmEmailContextValue {
  /** Whether the signed-in person may reach out to others now (false when signed out). */
  confirmed: boolean;
  /**
   * True when the signed-in person may reach out to others (confirmed email, or an account
   * old enough to be grandfathered). Otherwise opens the "confirm your email" modal and
   * resolves false, so the caller just stops. Pass `recheck` after the server turned them
   * away: the cached account said confirmed, so check the account again instead of trusting it.
   */
  ensureConfirmed: (options?: { recheck?: boolean }) => Promise<boolean>;
  /** Open the modal, e.g. when a callable turned them away (isEmailUnconfirmedError). */
  showConfirmEmail: () => void;
}

export const ConfirmEmailContext = createContext<ConfirmEmailContextValue | null>(null);

export const useConfirmEmail = () => {
  const ctx = useContext(ConfirmEmailContext);
  if (!ctx) throw new Error("useConfirmEmail must be used within ConfirmEmailProvider");
  return ctx;
};
