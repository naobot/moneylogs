import { FormEvent, ReactNode, useId, useState } from "react";

import Button from "@/components/Button";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { MAX_CATEGORY_NAME_LENGTH } from "@/utils/ledger";
import {
  BudgetDrafts,
  categoryNameError,
  CategoryOp,
  isFixedCategory,
} from "@/utils/ledgerCategories";
import CategoryBudget from "./CategoryBudget";
import { Link } from "react-router-dom";
import { isActiveSublog } from "@/utils/sublogs";
import { useSublogLinks } from "@/features/ledger/sublogs/useSublogLinks";

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
  /** The scheduled payments section (a fixed, active category only). */
  scheduled?: ReactNode;
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
  scheduled,
}: CategoryDetailProps) => {
  const { id, name, archived } = category;
  const [renaming, setRenaming] = useState<string | null>(null);
  const nameId = useId();
  const fixedId = useId();

  const renameError = renaming !== null ? categoryNameError(renaming, all, id) : undefined;
  const commitRename = () => {
    if (renaming === null) return;
    if (!renameError && renaming.trim() !== name) save({ type: "rename", id, name: renaming });
    setRenaming(null);
  };

  const fixed = isFixedCategory(category);
  const linked = isActiveSublog(category);
  const sublogLinks = useSublogLinks(all);
  const sublogId = sublogLinks.get(id);

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
          <div className="CategoryDetail__field">
            <label className="CategoryDetail__label" htmlFor={fixedId}>
              fixed cost
            </label>
            <input
              id={fixedId}
              type="checkbox"
              className="CategoryDetail__check"
              aria-label={`${name} is a fixed cost`}
              checked={fixed}
              onChange={(e) => save({ type: "setFixed", id, fixed: e.target.checked })}
            />
          </div>
        </Section>
      )}

      {!archived && fixed && !linked && scheduled}

      {!archived && (
        <CategoryBudget
          category={category}
          defaultCurrency={defaultCurrency}
          budgetDrafts={budgetDrafts}
          onBudgetChange={onBudgetChange}
          onBudgetCommit={onBudgetCommit}
          onBudgetRemove={onBudgetRemove}
        />
      )}

      {linked ? (
        <Section>
          <p className="CategoryDetail__help">
            Spending here comes from the{" "}
            {sublogId ? (
              <Link to={`/l/${sublogId}`} className="keep-case">
                {name} ›
              </Link>
            ) : (
              <strong className="keep-case">{name}</strong>
            )}{" "}
            log: entries by people who are in both logs. You log it there, and this line shows its
            total. To stop counting it here, unlink it in that log&apos;s actions; past months keep
            their totals.
          </p>
        </Section>
      ) : (
        <Section
          help={
            lastActive
              ? "A log needs at least one category, so this one has to stay."
              : category.sublog
                ? "This line was a sublog, and its past months still hold that log's totals, so it can be archived but not deleted."
                : undefined
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
                className="CategoryDetail__archive"
                aria-label={`Archive ${name}`}
                disabled={lastActive}
                onClick={onArchive}
              />
            )}
            <Button
              text="Delete"
              size="sm"
              variant="secondary"
              className="CategoryDetail__delete"
              aria-label={`Delete ${name}`}
              disabled={lastActive || !!category.sublog}
              onClick={onDelete}
            />
          </div>
        </Section>
      )}
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
