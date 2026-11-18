import { FormEvent, ReactNode, useState } from "react";
import cx from "classnames";

import RowButton from "@/components/RowButton";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { track } from "@/utils/analytics";
import { CURRENCIES } from "@/utils/currency";
import { MAX_CATEGORY_NAME_LENGTH } from "@/utils/ledger";
import {
  BudgetDrafts,
  categoryNameError,
  CategoryOp,
  isFixedCategory,
} from "@/utils/ledgerCategories";
import { BudgetField } from "./BudgetManager";

export const FIXED_HELP =
  "Fixed costs like rent and bills still count toward the budget, but the buddy won't fuss over them or judge the month's pace by them.";

type CategoryDetailProps = {
  category: LedgerCategory;
  /** Every category, for name clashes. */
  all: ReadonlyArray<LedgerCategory>;
  /** The only active category left: it can't be archived or deleted. */
  lastActive: boolean;
  defaultCurrency: Currency;
  save: (op: CategoryOp) => void;
  budgetDrafts: BudgetDrafts;
  onBudgetChange: (currency: Currency, raw: string) => void;
  /** Saves this category's typed budget fields (when one is left). */
  onBudgetCommit: () => void;
  /** Removes one budget straight away, dropping anything typed into its field. */
  onBudgetRemove: (currency: Currency) => void;
  /** Resolves true if any entry uses the category. */
  checkInUse: () => Promise<boolean>;
  onDeleted: () => void;
};

type DeleteState = "idle" | "checking" | "confirm" | "in-use" | "failed";

/**
 * Everything about one category, each setting with its explanation written out (not
 * in a hover tip, which touch screens never show). Remounted per category (keyed by
 * id), so half-finished renames and delete prompts don't leak between categories.
 */
export const CategoryDetail = ({
  category,
  all,
  lastActive,
  defaultCurrency,
  save,
  budgetDrafts,
  onBudgetChange,
  onBudgetCommit,
  onBudgetRemove,
  checkInUse,
  onDeleted,
}: CategoryDetailProps) => {
  const { id, name, archived } = category;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [pickedCurrency, setPickedCurrency] = useState<Currency | null>(null);

  const renameError = renaming !== null ? categoryNameError(renaming, all, id) : undefined;
  const commitRename = () => {
    if (renaming === null) return;
    if (!renameError && renaming.trim() !== name) save({ type: "rename", id, name: renaming });
    setRenaming(null);
  };

  const fixed = isFixedCategory(category);
  const budgeted = CURRENCIES.filter((c) => category.budget?.[c] !== undefined);
  const unbudgeted = CURRENCIES.filter((c) => !budgeted.includes(c));
  const addCurrency =
    pickedCurrency && unbudgeted.includes(pickedCurrency)
      ? pickedCurrency
      : unbudgeted.includes(defaultCurrency)
        ? defaultCurrency
        : unbudgeted[0];

  const askDelete = async () => {
    setDeleteState("checking");
    try {
      setDeleteState((await checkInUse()) ? "in-use" : "confirm");
    } catch {
      // checkInUse reports its own errors.
      setDeleteState("failed");
    }
  };
  const confirmDelete = () => {
    save({ type: "delete", id });
    track("delete_category");
    onDeleted();
  };
  const archive = () => {
    setDeleteState("idle");
    save({ type: "archive", id });
  };

  return (
    <div className="CategoryDetail">
      <Section title="name">
        <form
          className="CategoryDetail__rename"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            commitRename();
          }}
        >
          <input
            className="LineInput keep-case"
            aria-label={`Rename ${name}`}
            value={renaming ?? name}
            maxLength={MAX_CATEGORY_NAME_LENGTH + 5}
            onChange={(e) => setRenaming(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Escape" && renaming !== null) {
                // Revert the typing without also closing the modal.
                e.stopPropagation();
                setRenaming(null);
              }
            }}
          />
          {renameError && <small className="CategoryManager__error">{renameError}</small>}
        </form>
      </Section>

      {!archived && (
        <Section title="fixed cost">
          <button
            type="button"
            className={cx("CategoryDetail__toggle", { "CategoryDetail__toggle--on": fixed })}
            aria-pressed={fixed}
            aria-label={`${name} is a fixed cost`}
            onClick={() => save({ type: "setFixed", id, fixed: !fixed })}
          >
            <span aria-hidden="true">{fixed ? "[■]" : "[ ]"}</span> fixed cost
          </button>
          <Help>{FIXED_HELP}</Help>
        </Section>
      )}

      {!archived && (
        <Section title="monthly budget">
          <Help>
            {budgeted.length === 0
              ? "No budget, so spending here isn't tracked against a limit. Enter a monthly amount to set one."
              : "Spending is tracked against this each month. Remove it to stop budgeting this category."}
          </Help>
          {budgeted.length > 0 && (
            <ul className="CategoryDetail__budgets" aria-label={`${name} budgets`}>
              {budgeted.map((currency) => (
                <li key={currency} className="CategoryDetail__budget">
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
                </li>
              ))}
            </ul>
          )}
          {addCurrency && (
            <div className="CategoryDetail__budget CategoryDetail__budget--add">
              {budgeted.length > 0 && (
                <small className="CategoryDetail__addLabel">another currency</small>
              )}
              <BudgetField
                category={category}
                currency={addCurrency}
                drafts={budgetDrafts}
                label={`Monthly budget for ${name}`}
                currencies={unbudgeted}
                onChange={(raw) => onBudgetChange(addCurrency, raw)}
                onBlur={onBudgetCommit}
                onCurrencyChange={setPickedCurrency}
              />
            </div>
          )}
        </Section>
      )}

      <Section title={archived ? "archived" : "archive"}>
        {archived ? (
          <>
            <Help>
              Hidden when adding entries. Past entries keep this category. Restore it to use it
              again.
            </Help>
            <RowButton
              aria-label={`Restore ${name}`}
              onClick={() => save({ type: "unarchive", id })}
            >
              restore
            </RowButton>
          </>
        ) : (
          <>
            <Help>
              {lastActive
                ? "A log needs at least one category, so this one can't be archived."
                : "Hides this category when adding entries. Past entries keep it, and you can restore it any time."}
            </Help>
            <RowButton aria-label={`Archive ${name}`} disabled={lastActive} onClick={archive}>
              archive
            </RowButton>
          </>
        )}
      </Section>

      <Section title="delete">
        {deleteState === "confirm" ? (
          <div className="CategoryDetail__confirm" role="alert">
            <p>
              Delete <span className="keep-case">{name}</span>? This can't be undone.
            </p>
            <span className="CategoryDetail__buttons">
              <RowButton aria-label={`Confirm delete ${name}`} onClick={confirmDelete}>
                delete
              </RowButton>
              <RowButton onClick={() => setDeleteState("idle")}>keep</RowButton>
            </span>
          </div>
        ) : deleteState === "in-use" ? (
          <div className="CategoryDetail__confirm" role="alert">
            <p>
              {archived
                ? "Some entries use this category, so it can't be deleted. It stays archived."
                : "Some entries use this category, so it can't be deleted. Archive it to hide it instead."}
            </p>
            <span className="CategoryDetail__buttons">
              {!archived && (
                <RowButton aria-label={`Archive ${name} instead`} onClick={archive}>
                  archive
                </RowButton>
              )}
              <RowButton onClick={() => setDeleteState("idle")}>ok</RowButton>
            </span>
          </div>
        ) : (
          <>
            <Help>
              {!archived && lastActive
                ? "A log needs at least one category, so this one can't be deleted."
                : "Removes the category for good. Only possible while no entries use it."}
            </Help>
            {deleteState === "failed" && (
              <small className="CategoryManager__error">
                Couldn't check whether this category is in use. Try again.
              </small>
            )}
            <RowButton
              aria-label={`Delete ${name}`}
              disabled={(!archived && lastActive) || deleteState === "checking"}
              onClick={() => void askDelete()}
            >
              {deleteState === "checking" ? "checking…" : "delete"}
            </RowButton>
          </>
        )}
      </Section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="CategoryDetail__section">
    <h4 className="CategoryDetail__heading">{title}</h4>
    {children}
  </section>
);

const Help = ({ children }: { children: ReactNode }) => (
  <p className="CategoryDetail__help">{children}</p>
);

export default CategoryDetail;
