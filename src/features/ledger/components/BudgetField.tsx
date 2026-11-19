import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { BudgetDrafts, budgetFieldError, budgetFieldValue } from "@/utils/ledgerCategories";

/**
 * One category's monthly budget in one currency: a right-aligned amount with a currency
 * picker beside it, or a fixed currency label when no onCurrencyChange is given.
 */
export const BudgetField = ({
  category,
  currency,
  drafts,
  onChange,
  onCurrencyChange,
  onBlur,
  label,
  currencies = CURRENCIES,
}: {
  category: LedgerCategory;
  currency: Currency;
  drafts: BudgetDrafts;
  /** The amount field's accessible name; defaults to "Monthly budget for <name>". */
  label?: string;
  /** What the currency picker offers (e.g. leaving out ones already budgeted). */
  currencies?: ReadonlyArray<Currency>;
  onChange: (raw: string) => void;
  /** When the amount field is left (e.g. to save it). */
  onBlur?: () => void;
  onCurrencyChange?: (currency: Currency) => void;
}) => {
  const value = budgetFieldValue(drafts, category, currency);
  const error = budgetFieldError(value);
  return (
    <span className="BudgetField">
      <input
        className="LineInput BudgetField__amount"
        aria-label={label ?? `Monthly budget for ${category.name}`}
        aria-invalid={!!error}
        inputMode="decimal"
        autoComplete="off"
        placeholder="no budget"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {onCurrencyChange ? (
        <select
          aria-label={`Budget currency for ${category.name}`}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as Currency)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <span className="BudgetField__unit keep-case">{currency}</span>
      )}
      {error && <small className="BudgetField__error">{error}</small>}
    </span>
  );
};

export default BudgetField;
