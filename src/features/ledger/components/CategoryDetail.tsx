import { FormEvent, ReactNode, useId, useState } from "react";

import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
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
  /** Asks to archive or delete it (the manager confirms, explaining what happens). */
  onArchive: () => void;
  onDelete: () => void;
};

/**
 * One category's settings: each title on the line with its input, and any fine print
 * written out at the end of its section (not in a hover tip, which touch screens never
 * show). Remounted per category (keyed by id), so a half-typed rename doesn't leak.
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
  onArchive,
  onDelete,
}: CategoryDetailProps) => {
  const { id, name, archived } = category;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [mixedOpen, setMixedOpen] = useState(false);
  const [pickedCurrency, setPickedCurrency] = useState<Currency | null>(null);
  const nameId = useId();
  const mixedId = useId();

  const renameError = renaming !== null ? categoryNameError(renaming, all, id) : undefined;
  const commitRename = () => {
    if (renaming === null) return;
    if (!renameError && renaming.trim() !== name) save({ type: "rename", id, name: renaming });
    setRenaming(null);
  };

  const fixed = isFixedCategory(category);
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
    <div className="CategoryDetail">
      <Section>
        <form
          className="CategoryDetail__field"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            commitRename();
          }}
        >
          <label className="CategoryDetail__label" htmlFor={nameId}>
            name
          </label>
          <input
            id={nameId}
            className="LineInput keep-case CategoryDetail__name"
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
        <Section help={FIXED_HELP}>
          <label className="CategoryDetail__check">
            <input
              type="checkbox"
              aria-label={`${name} is a fixed cost`}
              checked={fixed}
              onChange={(e) => save({ type: "setFixed", id, fixed: e.target.checked })}
            />
            <span>fixed cost</span>
          </label>
        </Section>
      )}

      {!archived && (
        <Section
          help={
            budgeted.length === 0
              ? "Empty means no budget: spending here isn't tracked against a limit."
              : "Spending is tracked against this each month. Remove it to stop budgeting this category."
          }
        >
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
        </Section>
      )}

      <Section
        help={
          lastActive ? "A log needs at least one category, so this one has to stay." : undefined
        }
      >
        <div className="CategoryDetail__buttons">
          {archived ? (
            <Button
              text="Restore"
              size="sm"
              variant="secondary"
              aria-label={`Restore ${name}`}
              onClick={() => save({ type: "unarchive", id })}
            />
          ) : (
            <Button
              text="Archive"
              size="sm"
              variant="secondary"
              aria-label={`Archive ${name}`}
              disabled={lastActive}
              onClick={onArchive}
            />
          )}
          <Button
            text="Delete"
            size="sm"
            variant="secondary"
            aria-label={`Delete ${name}`}
            disabled={lastActive}
            onClick={onDelete}
          />
        </div>
      </Section>
    </div>
  );
};

/** A block of settings, with its fine print (if any) at the end. */
const Section = ({ help, children }: { help?: ReactNode; children: ReactNode }) => (
  <section className="CategoryDetail__section">
    {children}
    {help && <p className="CategoryDetail__help">{help}</p>}
  </section>
);

export default CategoryDetail;
