import { useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useLedgerQuery } from "@/hooks/useLedgerQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { Ledger } from "@/types/ledger";
import { Currency } from "@/types/user";
import { personalLedgerId } from "@/utils/personalLedger";
import { reportError } from "@/utils/reportError";

import CurrencySelect from "@/components/CurrencySelect";

/**
 * The currency new entries start in, in the log's Manage modal. Any member can change it
 * and it applies to everyone. Picking saves straight away, like the modal's other actions.
 * The personal log follows the user's own default instead, so that's changed under /me.
 */
export const LedgerCurrencySection = ({
  ledger,
}: {
  ledger: Pick<Ledger, "id" | "defaultCurrency">;
}) => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const { updateLedgerCurrency } = useLedgerQuery();
  const [failed, setFailed] = useState(false);
  const isPersonal = !!user && ledger.id === personalLedgerId(user.userId);

  const save = async (defaultCurrency: Currency) => {
    if (defaultCurrency === ledger.defaultCurrency) return;
    setFailed(false);
    try {
      await updateLedgerCurrency.mutate({ ledgerId: ledger.id, defaultCurrency });
      showToast(`New entries now start in ${defaultCurrency}`, "success");
    } catch (err) {
      reportError(err, { feature: "ledger", action: "update_ledger_currency" });
      setFailed(true);
    }
  };

  return (
    <section className="LogActions__section">
      <h4>Currency</h4>
      {isPersonal ? (
        <p>
          Your personal log starts new entries in your default currency ({ledger.defaultCurrency}).
          Change it in <Link to="/me#profile">your profile</Link>.
        </p>
      ) : (
        <>
          <p>
            New entries start in this currency, for everyone in this log. Entries already logged
            keep theirs.
          </p>
          <CurrencySelect
            id={`ledger-currency-${ledger.id}`}
            label="Default currency"
            value={ledger.defaultCurrency}
            disabled={updateLedgerCurrency.isLoading}
            onChange={(c) => void save(c)}
          />
          {failed && (
            <p className="error-message">Couldn't change the currency. Please try again.</p>
          )}
        </>
      )}
    </section>
  );
};

export default LedgerCurrencySection;
