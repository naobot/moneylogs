import { useState } from "react";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { activeCategories } from "@/utils/ledger";
import { AcceptedPlan, BudgetWizard } from "@/features/ledger/budgetWizard/BudgetWizard";
import {
  applyCategoryOps,
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
  const [mode, setMode] = useState<"budgets" | "wizard">("budgets");
  // Category changes a budget-helper plan needs (reset to the defaults), saved with Save.
  const [pendingOps, setPendingOps] = useState<CategoryOp[]>([]);

  const planned = pendingOps.length ? applyCategoryOps(categories, pendingOps) : categories;
  const active = activeCategories(planned);
  const currencyFor = (category: LedgerCategory) =>
    picked[category.id] ?? preferredBudgetCurrency([category], defaultCurrency);
  const ops = [...pendingOps, ...budgetDraftOps(planned, drafts)];
  const hasErrors = Object.values(drafts).some((raw) => budgetFieldError(raw));

  // Fill the fields from the plan (as unsaved drafts) and queue the category reset.
  const applyPlan = ({ resetOps, currency, amounts }: AcceptedPlan) => {
    setPendingOps(resetOps);
    setDrafts((d) => ({
      ...d,
      ...Object.fromEntries(
        Object.entries(amounts).map(([id, amount]) => [
          budgetDraftKey(id, currency),
          amount > 0 ? String(amount) : "",
        ]),
      ),
    }));
    setPicked((p) => ({
      ...p,
      ...Object.fromEntries(Object.keys(amounts).map((id) => [id, currency])),
    }));
    setSaveFailed(false);
    setMode("budgets");
  };

  if (mode === "wizard") {
    return (
      <Modal isOpen onClose={onClose} className="BudgetManager">
        <Modal.Header striped title="Budget helper">
          Budget helper
        </Modal.Header>
        <Modal.Body>
          <BudgetWizard
            categories={planned}
            defaultCurrency={preferredBudgetCurrency(categories, defaultCurrency)}
            onCancel={() => setMode("budgets")}
            onUse={applyPlan}
          />
        </Modal.Body>
      </Modal>
    );
  }

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
        <button type="button" className="BudgetManager__helper" onClick={() => setMode("wizard")}>
          Need help setting a budget?
        </button>
        {pendingOps.length > 0 && (
          <p className="BudgetManager__notice" role="status">
            Filled in from the budget helper. Adjust anything you like. Your categories will be
            reset to the defaults when you save.
          </p>
        )}
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
