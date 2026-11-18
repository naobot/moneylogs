import { useId, useState } from "react";

import RowButton from "@/components/RowButton";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { BudgetDrafts } from "@/utils/ledgerCategories";
import BudgetField from "./BudgetField";

type CategoryBudgetProps = {
  category: LedgerCategory;
  /** What a first budget starts in. */
  defaultCurrency: Currency;
  budgetDrafts: BudgetDrafts;
  onBudgetChange: (currency: Currency, raw: string) => void;
  /** Saves this category's typed budget fields (when one is left). */
  onBudgetCommit: () => void;
  /** Removes one budget straight away. */
  onBudgetRemove: (currency: Currency) => void;
};

/**
 * One category's monthly budget section, shared by the Categories and Budgets windows:
 * a line per currency it budgets in (each removable), budgets in further currencies
 * behind [+ mixed currency budget], and the fine print at the end.
 */
export const CategoryBudget = ({
  category,
  defaultCurrency,
  budgetDrafts,
  onBudgetChange,
  onBudgetCommit,
  onBudgetRemove,
}: CategoryBudgetProps) => {
  const { name } = category;
  const [mixedOpen, setMixedOpen] = useState(false);
  const [pickedCurrency, setPickedCurrency] = useState<Currency | null>(null);
  const mixedId = useId();

  const budgeted = CURRENCIES.filter((c) => category.budget?.[c] !== undefined);
  const unbudgeted = CURRENCIES.filter((c) => !budgeted.includes(c));
  // The currency a new budget field starts in: the picked one, else the log's.
  const newCurrency =
    pickedCurrency && unbudgeted.includes(pickedCurrency)
      ? pickedCurrency
      : unbudgeted.includes(defaultCurrency)
        ? defaultCurrency
        : unbudgeted[0];

  const newBudgetField = (label: string) => (
    <BudgetField
      category={category}
      currency={newCurrency}
      drafts={budgetDrafts}
      label={label}
      currencies={unbudgeted}
      onChange={(raw) => onBudgetChange(newCurrency, raw)}
      onBlur={onBudgetCommit}
      onCurrencyChange={setPickedCurrency}
    />
  );

  return (
    <section className="CategoryDetail__section">
      {budgeted.length === 0 ? (
        <div className="CategoryDetail__field">
          <span className="CategoryDetail__label">monthly budget</span>
          {newBudgetField(`Monthly budget for ${name}`)}
        </div>
      ) : (
        <ul className="CategoryDetail__budgets" aria-label={`${name} budgets`}>
          {budgeted.map((currency, i) => (
            <li key={currency} className="CategoryDetail__field">
              <span className="CategoryDetail__label">{i === 0 ? "monthly budget" : ""}</span>
              <span className="CategoryDetail__budget">
                <BudgetField
                  category={category}
                  currency={currency}
                  drafts={budgetDrafts}
                  label={`${name} budget in ${currency}`}
                  onChange={(raw) => onBudgetChange(currency, raw)}
                  onBlur={onBudgetCommit}
                />
                <RowButton
                  aria-label={`Remove ${name} budget in ${currency}`}
                  onClick={() => onBudgetRemove(currency)}
                >
                  remove
                </RowButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      {budgeted.length > 0 && newCurrency && (
        <>
          <button
            type="button"
            className="CategoryDetail__drawerToggle"
            aria-expanded={mixedOpen}
            aria-controls={mixedId}
            onClick={() => setMixedOpen((open) => !open)}
          >
            {mixedOpen ? "[− mixed currency budget]" : "[+ mixed currency budget]"}
          </button>
          {mixedOpen && (
            <div id={mixedId} className="CategoryDetail__field CategoryDetail__drawer">
              <span className="CategoryDetail__label">also</span>
              {newBudgetField(`Monthly budget for ${name} in another currency`)}
            </div>
          )}
        </>
      )}
      <p className="CategoryDetail__help">
        {budgeted.length === 0
          ? "Empty means no budget: spending here isn't tracked against a limit."
          : "Spending is tracked against this each month. Remove it to stop budgeting this category."}
      </p>
    </section>
  );
};

export default CategoryBudget;
