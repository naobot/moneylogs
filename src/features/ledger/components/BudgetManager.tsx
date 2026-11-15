import { FormEvent, useMemo, useState } from "react";

import RowButton from "@/components/RowButton";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { formatAmount, parseAmount } from "@/utils/ledgerEntries";
import { activeCategories } from "@/utils/ledger";
import {
  applyCategoryOps,
  CategoryOp,
  isValidBudgetAmount,
  MAX_BUDGET,
} from "@/utils/ledgerCategories";

type BudgetManagerProps = {
  isOpen: boolean;
  categories: ReadonlyArray<LedgerCategory>;
  /** Pre-selected currency when adding a budget. */
  defaultCurrency: Currency;
  onClose: () => void;
  onSave: (ops: CategoryOp[]) => Promise<unknown>;
  isSaving: boolean;
};

/**
 * Monthly budgets per category. Budgets live on the categories, so edits are recorded as
 * the same category operations and replayed onto the latest server copy on Save.
 */
export const BudgetManager = (props: BudgetManagerProps) =>
  // Remount on open so each session starts from the current budgets with no pending ops.
  props.isOpen ? <BudgetManagerDialog {...props} /> : null;

const BudgetManagerDialog = ({
  categories,
  defaultCurrency,
  onClose,
  onSave,
  isSaving,
}: BudgetManagerProps) => {
  const [ops, setOps] = useState<CategoryOp[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);

  const draft = useMemo(() => applyCategoryOps(categories, ops), [categories, ops]);
  const active = activeCategories(draft);

  const push = (op: CategoryOp) => {
    setSaveFailed(false);
    setOps((prev) => [...prev, op]);
  };

  const handleSave = async () => {
    try {
      await onSave(ops);
      onClose();
    } catch (err) {
      console.error("Failed to save budgets:", err);
      setSaveFailed(true);
    }
  };

  return (
    <Modal isOpen onClose={isSaving ? undefined : onClose} className="BudgetManager">
      <Modal.Header striped title="Budgets">
        Budgets
      </Modal.Header>
      <Modal.Body>
        <p className="BudgetManager__hint">
          Monthly limits per category. The running total and stats track your progress.
        </p>
        <ul className="BudgetManager__list" aria-label="Category budgets">
          {active.map((category) => (
            <li key={category.id} className="BudgetManager__row">
              <span className="BudgetManager__name keep-case">{category.name}</span>
              <BudgetEditor
                category={category}
                defaultCurrency={defaultCurrency}
                onSet={(currency, amount) =>
                  push({ type: "setBudget", id: category.id, currency, amount })
                }
              />
            </li>
          ))}
        </ul>

        {saveFailed && (
          <p className="error-message">Couldn't save your changes. Please try again.</p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button
          text="Save"
          buttonStyle="primary-border"
          disabled={ops.length === 0 || isSaving}
          loading={isSaving}
          onClick={() => void handleSave()}
        />
        <Button
          text="Cancel"
          buttonStyle="primary-border-lite"
          disabled={isSaving}
          onClick={onClose}
        />
      </Modal.Actions>
    </Modal>
  );
};

/** Per-currency monthly budget editor for one category (also used inline in Categories). */
export const BudgetEditor = ({
  category,
  defaultCurrency,
  onSet,
}: {
  category: LedgerCategory;
  defaultCurrency: Currency;
  onSet: (currency: Currency, amount: number | null) => void;
}) => {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const parsed = parseAmount(amount);
  const valid = isValidBudgetAmount(parsed);
  const existing = CURRENCIES.filter((c) => category.budget?.[c] !== undefined);

  const submit = () => {
    if (!valid) return;
    onSet(currency, parsed);
    setAmount("");
  };

  return (
    <div className="BudgetManager__editor">
      {existing.length > 0 && (
        <ul className="BudgetManager__amounts" aria-label={`${category.name} budgets`}>
          {existing.map((c) => (
            <li key={c}>
              {formatAmount(category.budget![c]!, c)} / month
              <RowButton
                glyph
                aria-label={`Remove ${c} budget for ${category.name}`}
                title={`Remove ${c} budget for ${category.name}`}
                onClick={() => onSet(c, null)}
              >
                ×
              </RowButton>
            </li>
          ))}
        </ul>
      )}
      <form
        className="BudgetManager__form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="LineInput"
          aria-label={`Monthly budget for ${category.name}`}
          inputMode="decimal"
          placeholder="Monthly budget"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          aria-label={`Budget currency for ${category.name}`}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <RowButton
          aria-label={`Set budget for ${category.name}`}
          title={`Set budget for ${category.name}`}
          disabled={!valid}
          onClick={submit}
        >
          {category.budget?.[currency] !== undefined ? "update" : "set"}
        </RowButton>
        {amount.trim() !== "" && !valid && (
          <small className="BudgetManager__error">
            Enter an amount between 0 and {MAX_BUDGET.toLocaleString("en-US")}.
          </small>
        )}
      </form>
    </div>
  );
};

export default BudgetManager;
