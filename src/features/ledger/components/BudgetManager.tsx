import { useState } from "react";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { activeCategories } from "@/utils/ledger";
import {
  BudgetDrafts,
  budgetDraftKey,
  budgetDraftOps,
  budgetFieldError,
  budgetFieldValue,
  CategoryOp,
  preferredBudgetCurrency,
} from "@/utils/ledgerCategories";

type BudgetManagerProps = {
  isOpen: boolean;
  categories: ReadonlyArray<LedgerCategory>;
  /** Shown first when no budgets exist yet. */
  defaultCurrency: Currency;
  onClose: () => void;
  onSave: (ops: CategoryOp[]) => Promise<unknown>;
  isSaving: boolean;
};

/**
 * Monthly budgets per category, each with its own currency. Fields are drafts until
 * Save, where the changed ones become category ops replayed onto the latest server copy.
 */
export const BudgetManager = (props: BudgetManagerProps) =>
  // Remount on open so each session starts from the saved budgets with no drafts.
  props.isOpen ? <BudgetManagerDialog {...props} /> : null;

const BudgetManagerDialog = ({
  categories,
  defaultCurrency,
  onClose,
  onSave,
  isSaving,
}: BudgetManagerProps) => {
  // Each row's picked currency; unpicked rows show the one they already budget in.
  const [picked, setPicked] = useState<Record<string, Currency>>({});
  // Kept across currency switches, so edits in one currency survive a look at another.
  const [drafts, setDrafts] = useState<BudgetDrafts>({});
  const [saveFailed, setSaveFailed] = useState(false);

  const active = activeCategories(categories);
  const currencyFor = (category: LedgerCategory) =>
    picked[category.id] ?? preferredBudgetCurrency([category], defaultCurrency);
  const ops = budgetDraftOps(categories, drafts);
  const hasErrors = Object.values(drafts).some((raw) => budgetFieldError(raw));

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
          Monthly limits per category. Leave one empty for no budget.
        </p>
        <ul className="BudgetManager__list" aria-label="Category budgets">
          {active.map((category) => (
            <li key={category.id} className="BudgetManager__row">
              <span className="BudgetManager__name keep-case">{category.name}</span>
              <BudgetField
                category={category}
                currency={currencyFor(category)}
                drafts={drafts}
                onChange={(raw) => {
                  setSaveFailed(false);
                  setDrafts((d) => ({
                    ...d,
                    [budgetDraftKey(category.id, currencyFor(category))]: raw,
                  }));
                }}
                onCurrencyChange={(currency) =>
                  setPicked((p) => ({ ...p, [category.id]: currency }))
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
          disabled={ops.length === 0 || hasErrors || isSaving}
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
}: {
  category: LedgerCategory;
  currency: Currency;
  drafts: BudgetDrafts;
  onChange: (raw: string) => void;
  onCurrencyChange?: (currency: Currency) => void;
}) => {
  const value = budgetFieldValue(drafts, category, currency);
  const error = budgetFieldError(value);
  return (
    <span className="BudgetField">
      <input
        className="LineInput BudgetField__amount"
        aria-label={`Monthly budget for ${category.name}`}
        aria-invalid={!!error}
        inputMode="decimal"
        autoComplete="off"
        placeholder="no budget"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {onCurrencyChange ? (
        <select
          aria-label={`Budget currency for ${category.name}`}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as Currency)}
        >
          {CURRENCIES.map((c) => (
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

export default BudgetManager;
