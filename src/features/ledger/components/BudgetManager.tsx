import { useState } from "react";
import cx from "classnames";

import Modal from "@/components/Modal";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import RowButton from "@/components/RowButton";
import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { activeCategories } from "@/utils/ledger";
import { formatTotals } from "@/utils/ledgerEntries";
import { AcceptedPlan, BudgetWizard } from "@/features/ledger/budgetWizard/BudgetWizard";
import {
  applyCategoryOps,
  budgetDraftKey,
  budgetDraftOps,
  CategoryOp,
  preferredBudgetCurrency,
} from "@/utils/ledgerCategories";
import CategoryBudget from "./CategoryBudget";
import { SelectButton } from "./CategoryList";
import { AutosaveActions, ListDetail, WIDE_QUERY } from "./ListDetail";
import { useCategoryEdits } from "./useCategoryEdits";

type BudgetManagerProps = {
  isOpen: boolean;
  categories: ReadonlyArray<LedgerCategory>;
  /** What a first budget starts in. */
  defaultCurrency: Currency;
  onClose: () => void;
  /** Writes edits straight away; rejects if they couldn't be saved. */
  onSave: (ops: CategoryOp[]) => Promise<unknown>;
  /** The log's monthly totals (Ledger.monthlyBudget). */
  totals?: CurrencyAmounts;
  /** Opens the monthly total, on one currency. */
  onEditTotal?: (currency: Currency) => void;
};

/**
 * Monthly budgets per category: the Categories window pared down to the budget part.
 * A list showing each budget, and one category's budget lines (one per currency, each
 * removable); side by side on wide screens, drill-in on phones. Saves as you go, like
 * Categories (see useCategoryEdits), and leads into the budget helper.
 */
export const BudgetManager = (props: BudgetManagerProps) =>
  // Remount on open so each session starts from the saved budgets with no drafts.
  props.isOpen ? <BudgetManagerDialog {...props} /> : null;

const BudgetManagerDialog = ({
  categories,
  defaultCurrency,
  onClose,
  onSave,
  totals,
  onEditTotal,
}: BudgetManagerProps) => {
  const wide = useMediaQuery(WIDE_QUERY);
  const edits = useCategoryEdits(categories, onSave);
  const { draft, save, commitBudgets } = edits;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"budgets" | "wizard">("budgets");
  const [planSaved, setPlanSaved] = useState(false);

  const active = activeCategories(draft);
  const selected = active.find((c) => c.id === selectedId) ?? (wide ? (active[0] ?? null) : null);
  const budgetCurrency = preferredBudgetCurrency(draft, defaultCurrency);

  const select = (id: string | null) => {
    if (selected) commitBudgets(selected.id);
    setSelectedId(id);
  };

  const close = () => {
    commitBudgets();
    onClose();
  };

  // The helper's plan is saved as one write: the category reset, then its budgets.
  const applyPlan = ({ resetOps, currency, amounts }: AcceptedPlan) => {
    const planned = applyCategoryOps(draft, resetOps);
    const planDrafts = Object.fromEntries(
      Object.entries(amounts).map(([id, amount]) => [
        budgetDraftKey(id, currency),
        amount > 0 ? String(amount) : "",
      ]),
    );
    save([...resetOps, ...budgetDraftOps(planned, planDrafts)]);
    setPlanSaved(true);
    setSelectedId(null);
    setMode("budgets");
  };

  if (mode === "wizard") {
    return (
      <Modal isOpen onClose={close} className="BudgetManager BudgetManager--wizard">
        <Modal.Header title="Budget helper">Budget helper</Modal.Header>
        <Modal.Body>
          <BudgetWizard
            categories={draft}
            defaultCurrency={budgetCurrency}
            onCancel={() => setMode("budgets")}
            onUse={applyPlan}
          />
        </Modal.Body>
      </Modal>
    );
  }

  const list = (
    <div className="CategoryManager__listPane">
      {onEditTotal && (
        <div className="BudgetManager__total">
          <span className="CategoryDetail__label">monthly total</span>
          <RowButton
            className="keep-case"
            aria-label="edit the monthly total"
            onClick={() => {
              commitBudgets();
              onEditTotal(budgetCurrency);
            }}
          >
            {totals && Object.values(totals).some((n) => (n ?? 0) > 0)
              ? `${formatTotals(totals)}/mo`
              : "set a total"}
          </RowButton>
        </div>
      )}
      <p className="CategoryManager__hint">
        Monthly limits per category. Tap one to set, change or remove its budget.
      </p>
      <button
        type="button"
        className="BudgetManager__helper"
        onClick={() => {
          commitBudgets();
          setMode("wizard");
        }}
      >
        Need help setting a budget?
      </button>
      {planSaved && (
        <p className="BudgetManager__notice" role="status">
          The helper's plan is saved. Adjust any budget below.
        </p>
      )}
      <ul className="CategoryManager__list" aria-label="Category budgets">
        {active.map((category) => {
          const budget = edits.budgetsShown.get(category.id);
          const isSelected = wide && selected?.id === category.id;
          return (
            <li
              key={category.id}
              className={cx("CategoryManager__row", {
                "CategoryManager__row--selected": isSelected,
              })}
            >
              <SelectButton category={category} selected={isSelected} onSelect={select}>
                <small className="CategoryManager__tag keep-case">
                  {budget && Object.keys(budget).length > 0
                    ? `${formatTotals(budget)}/mo`
                    : "no budget"}
                </small>
              </SelectButton>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Modal
      isOpen
      onClose={close}
      className={cx("CategoryManager BudgetManager", { "CategoryManager--wide": wide })}
    >
      <Modal.Header title="Budgets">Budgets</Modal.Header>
      <Modal.Body>
        <ListDetail
          wide={wide}
          listName="budgets"
          onBack={() => select(null)}
          list={list}
          detail={
            selected && (
              <div className="CategoryDetail" key={selected.id}>
                <h3 className="CategoryDetail__title keep-case">{selected.name}</h3>
                <CategoryBudget
                  category={selected}
                  defaultCurrency={budgetCurrency}
                  budgetDrafts={edits.budgetDrafts}
                  onBudgetChange={(currency, raw) =>
                    edits.setBudgetDraft(selected.id, currency, raw)
                  }
                  onBudgetCommit={() => commitBudgets(selected.id)}
                  onBudgetRemove={(currency) => edits.removeBudget(selected.id, currency)}
                />
              </div>
            )
          }
        />

        {edits.saveFailed && (
          <p className="error-message">Couldn't save that change. Please try again.</p>
        )}
      </Modal.Body>
      <AutosaveActions isSaving={edits.isSaving} onDone={close} />
    </Modal>
  );
};

export default BudgetManager;
