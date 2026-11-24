import { useState } from "react";

import Button from "@/components/Button";
import Modal from "@/components/Modal";
import RowButton from "@/components/RowButton";
import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { track } from "@/utils/analytics";
import { CURRENCIES } from "@/utils/currency";
import { budgetFieldError, roundBudget } from "@/utils/ledgerCategories";
import { formatAmount, parseAmount } from "@/utils/ledgerEntries";
import { allocationOf, TotalOp } from "@/utils/monthlyBudget";
import { reportError } from "@/utils/reportError";

type MonthlyTotalModalProps = {
  isOpen: boolean;
  /** The currency to start on (the one the stats page shows). */
  currency: Currency;
  totals: CurrencyAmounts | undefined;
  categories: ReadonlyArray<LedgerCategory>;
  onClose: () => void;
  /** Writes the change; rejects if it couldn't be saved. */
  onSave: (ops: TotalOp[]) => Promise<unknown>;
  /** Opens the per-category budgets instead. */
  onEditCategories: () => void;
};

/**
 * The month's total budget in one currency: expected income, or a cap on spending. All
 * spending counts against it; category budgets are carved out of it, and what they don't
 * claim covers everything else. Opened from the budget amount on the stats page.
 */
export const MonthlyTotalModal = (props: MonthlyTotalModalProps) =>
  // Remount on open so each visit starts from the saved total.
  props.isOpen ? <MonthlyTotalDialog {...props} /> : null;

const MonthlyTotalDialog = ({
  currency: initialCurrency,
  totals,
  categories,
  onClose,
  onSave,
  onEditCategories,
}: MonthlyTotalModalProps) => {
  const [currency, setCurrency] = useState(initialCurrency);
  const saved = totals?.[currency];
  const [raw, setRaw] = useState(saved ? String(saved) : "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const error = budgetFieldError(raw);
  const amount = raw.trim() === "" ? null : roundBudget(parseAmount(raw));
  const changed = !error && amount !== (saved ?? null);
  const { allocated, unallocated, over } = allocationOf(amount ?? 0, categories, currency);

  const pickCurrency = (next: Currency) => {
    setCurrency(next);
    setRaw(totals?.[next] ? String(totals[next]) : "");
    setSaveFailed(false);
  };

  const save = async () => {
    // Enter submits the form even while Save is disabled; keep the field open to fix.
    if (error) return;
    if (!changed) {
      onClose();
      return;
    }
    setIsSaving(true);
    setSaveFailed(false);
    try {
      await onSave([{ currency, amount }]);
      track("monthly_total", { action: amount === null ? "remove" : "set" });
      onClose();
    } catch (err) {
      reportError(err, { feature: "ledger", action: "save_monthly_total" });
      setSaveFailed(true);
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} className="MonthlyTotal" disabled={isSaving}>
      <Modal.Header striped title="monthly total">
        monthly total
      </Modal.Header>
      <Modal.Body>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="MonthlyTotal__intro">
            What you have for the month: your expected income, or a cap on spending. All spending
            counts against it.
          </p>
          <div className="CategoryDetail__field">
            <span className="CategoryDetail__label">monthly total</span>
            <span className="BudgetField">
              <input
                className="LineInput BudgetField__amount"
                aria-label="monthly total"
                aria-invalid={!!error}
                inputMode="decimal"
                autoComplete="off"
                placeholder="no total"
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setSaveFailed(false);
                }}
              />
              <select
                aria-label="monthly total currency"
                value={currency}
                onChange={(e) => pickCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {error && <small className="BudgetField__error">{error}</small>}
            </span>
          </div>

          <p className="CategoryDetail__help" role="status">
            {allocationLine({ amount, allocated, unallocated, over, currency })}{" "}
            <RowButton
              onClick={() => {
                onClose();
                onEditCategories();
              }}
            >
              category budgets
            </RowButton>
          </p>
          {saved !== undefined && amount !== null && (
            <p className="CategoryDetail__help">
              <RowButton
                aria-label={`remove the ${currency} monthly total`}
                onClick={() => setRaw("")}
              >
                remove total
              </RowButton>
            </p>
          )}
          {saveFailed && (
            <p className="error-message">Couldn't save the total. Please try again.</p>
          )}
          {/* Lets Enter on the phone keyboard save. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton />
        <Button
          variant="primary"
          text={isSaving ? "Saving" : "Save"}
          disabled={!!error}
          loading={isSaving}
          onClick={() => void save()}
        />
      </Modal.Actions>
    </Modal>
  );
};

/** How the category budgets sit within the total being typed. */
export const allocationLine = ({
  amount,
  allocated,
  unallocated,
  over,
  currency,
}: {
  amount: number | null;
  allocated: number;
  unallocated: number;
  over: number;
  currency: Currency;
}): string => {
  if (amount === null) {
    return allocated > 0
      ? `Without a total, your budget is what your category budgets add up to (${formatAmount(allocated, currency)}).`
      : "Without a total or category budgets, nothing is budgeted.";
  }
  if (allocated <= 0) return "No category budgets yet, so it's all one pot.";
  if (over > 0) {
    return `Your category budgets add up to ${formatAmount(allocated, currency)}, ${formatAmount(over, currency)} more than this.`;
  }
  return `${formatAmount(allocated, currency)} is set aside in category budgets, leaving ${formatAmount(unallocated, currency)} for everything else.`;
};

export default MonthlyTotalModal;
