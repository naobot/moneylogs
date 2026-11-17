import cx from "classnames";

import { CurrencyAmounts } from "@/types/ledger";
import { formatAmount, orderedCurrencies } from "@/utils/ledgerEntries";

/**
 * Per-currency totals, one span each, stacked in a smaller-type column when there's
 * more than one, so several currencies don't push the page wide (see `.Totals` in
 * Ledger.scss). Plain-text spots use formatTotals instead.
 */
export const Totals = ({ totals, className }: { totals: CurrencyAmounts; className?: string }) => {
  const currencies = orderedCurrencies(totals);
  return (
    <span className={cx("Totals", { "Totals--multi": currencies.length > 1 }, className)}>
      {currencies.map((c) => (
        <span key={c} className="Totals__amount">
          {formatAmount(totals[c]!, c)}
        </span>
      ))}
    </span>
  );
};

export default Totals;
