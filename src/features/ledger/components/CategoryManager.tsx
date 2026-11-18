import { useEffect, useMemo, useRef, useState } from "react";
import cx from "classnames";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToastContext } from "@/hooks/useToastContext";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { track } from "@/utils/analytics";
import { activeCategories, sortCategories } from "@/utils/ledger";
import {
  applyCategoryOps,
  BudgetDrafts,
  budgetDraftKey,
  budgetDraftOps,
  budgetFieldError,
  CategoryOp,
  guessFixed,
  newCategoryId,
} from "@/utils/ledgerCategories";
import { reportError } from "@/utils/reportError";
import CategoryDetail from "./CategoryDetail";
import CategoryList from "./CategoryList";

/** List and detail side by side from here up; keep in sync with $breakpoint-md. */
const WIDE_QUERY = "(min-width: 768px)";

type CategoryManagerProps = {
  isOpen: boolean;
  categories: ReadonlyArray<LedgerCategory>;
  /** Pre-selected currency when adding a budget. */
  defaultCurrency: Currency;
  onClose: () => void;
  /** Writes edits straight away; rejects if they couldn't be saved. */
  onSave: (ops: CategoryOp[]) => Promise<unknown>;
  /** Resolves true if any entry uses the category (so it can only be archived). */
  checkInUse: (categoryId: string) => Promise<boolean>;
};

/** An edit shown straight away, kept on top of the server copy until it comes back. */
type PendingEdit = { key: number; op: CategoryOp; saved: boolean };

/**
 * A list of categories and one category's detail: side by side on wide screens; on
 * phones the list, then tapping a row drills into its detail with a way back.
 *
 * Every edit saves as soon as it's made, like the settings on /me: no Save or Cancel.
 * Edits are written one at a time, in order, each replayed onto the latest server copy
 * (see useLedgerCategoryQuery), so other members' concurrent edits survive.
 */
export const CategoryManager = (props: CategoryManagerProps) =>
  props.isOpen ? <CategoryManagerDialog {...props} /> : null;

const CategoryManagerDialog = ({
  categories,
  defaultCurrency,
  onClose,
  onSave,
  checkInUse,
}: CategoryManagerProps) => {
  const wide = useMediaQuery(WIDE_QUERY);
  const [pending, setPending] = useState<PendingEdit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // What's typed into budget fields; saved when the field is left.
  const [budgetDrafts, setBudgetDrafts] = useState<BudgetDrafts>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const nextKey = useRef(0);
  const { showToast } = useToastContext();
  // Saves can finish after Done; a failure then is reported by toast instead.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Replaying an edit the server copy already has changes nothing (ops are idempotent),
  // so saved edits only need dropping once the server copy has moved on.
  useEffect(() => {
    setPending((edits) => edits.filter((edit) => !edit.saved));
  }, [categories]);

  const draft = useMemo(
    () =>
      applyCategoryOps(
        categories,
        pending.map((edit) => edit.op),
      ),
    [categories, pending],
  );
  const active = activeCategories(draft);
  const archived = sortCategories(draft.filter((c) => c.archived));
  // Budgets including fields still being typed, for each row's summary.
  const budgetsShown = new Map(
    applyCategoryOps(draft, budgetDraftOps(draft, budgetDrafts)).map((c) => [c.id, c.budget]),
  );
  const isSaving = pending.some((edit) => !edit.saved);

  // Side by side there's always a category open (the first, until another is picked
  // or the open one is deleted); on phones none is, until a row is tapped.
  const selected = draft.find((c) => c.id === selectedId) ?? (wide ? (active[0] ?? null) : null);

  const save = (op: CategoryOp) => {
    const key = nextKey.current++;
    setSaveFailed(false);
    setPending((edits) => [...edits, { key, op, saved: false }]);
    queue.current = queue.current.then(async () => {
      try {
        await onSave([op]);
        setPending((edits) => edits.map((e) => (e.key === key ? { ...e, saved: true } : e)));
      } catch (err) {
        reportError(err, { feature: "ledger", action: "save_categories", extra: { op: op.type } });
        setPending((edits) => edits.filter((e) => e.key !== key));
        if (mounted.current) setSaveFailed(true);
        else showToast("Couldn't save your last category change. Please try again.");
      }
    });
  };

  const addCategory = (name: string) => {
    const id = newCategoryId(name, draft);
    save({ type: "add", id, name, fixed: guessFixed(name) });
    // Open it, so its fixed and budget settings are right there.
    setSelectedId(id);
  };

  /** Saves the valid, changed budget fields (all of them, or one category's). */
  const commitBudgets = (categoryId?: string) => {
    const ops = budgetDraftOps(draft, budgetDrafts).filter(
      (op) => !categoryId || op.id === categoryId,
    );
    ops.forEach(save);
    // Invalid fields keep their text (and error) so nothing typed silently vanishes.
    setBudgetDrafts((drafts) =>
      Object.fromEntries(
        Object.entries(drafts).filter(
          ([key, raw]) =>
            (categoryId && !key.startsWith(`${categoryId}:`)) || !!budgetFieldError(raw),
        ),
      ),
    );
  };

  const removeBudget = (categoryId: string, currency: Currency) => {
    const key = budgetDraftKey(categoryId, currency);
    setBudgetDrafts(({ [key]: _dropped, ...rest }) => rest);
    save({ type: "setBudget", id: categoryId, currency, amount: null });
    track("remove_budget");
  };

  const inUse = async (categoryId: string) => {
    // A category whose add is still saving can't have entries yet.
    const unsaved = pending.some((e) => !e.saved && e.op.type === "add" && e.op.id === categoryId);
    if (unsaved) return false;
    try {
      return await checkInUse(categoryId);
    } catch (err) {
      reportError(err, { feature: "ledger", action: "check_category_in_use" });
      throw err;
    }
  };

  const select = (id: string | null) => {
    if (selected) commitBudgets(selected.id);
    setSelectedId(id);
  };

  const close = () => {
    commitBudgets();
    onClose();
  };

  const list = (
    <CategoryList
      active={active}
      archived={archived}
      all={draft}
      budgets={budgetsShown}
      selectedId={wide ? (selected?.id ?? null) : null}
      onSelect={select}
      onMove={(id, toIndex) => save({ type: "move", id, toIndex })}
      onAdd={addCategory}
    />
  );

  const detail = selected && (
    <CategoryDetail
      key={selected.id}
      category={selected}
      all={draft}
      lastActive={!selected.archived && active.length <= 1}
      defaultCurrency={defaultCurrency}
      save={save}
      budgetDrafts={budgetDrafts}
      onBudgetChange={(currency, raw) => {
        setSaveFailed(false);
        setBudgetDrafts((d) => ({ ...d, [budgetDraftKey(selected.id, currency)]: raw }));
      }}
      onBudgetCommit={() => commitBudgets(selected.id)}
      onBudgetRemove={(currency) => removeBudget(selected.id, currency)}
      checkInUse={() => inUse(selected.id)}
      onDeleted={() => setSelectedId(null)}
    />
  );

  return (
    <Modal
      isOpen
      onClose={close}
      className={cx("CategoryManager", { "CategoryManager--wide": wide })}
    >
      <Modal.Header striped title="Categories">
        Categories
      </Modal.Header>
      <Modal.Body>
        {wide ? (
          <div className="CategoryManager__panes">
            {list}
            <div className="CategoryManager__detailPane" aria-label="Category settings">
              {detail}
            </div>
          </div>
        ) : selected ? (
          <div className="CategoryManager__detailPane" aria-label="Category settings">
            <RowButton
              className="CategoryManager__back"
              aria-label="Back to categories"
              onClick={() => select(null)}
            >
              ‹ categories
            </RowButton>
            {detail}
          </div>
        ) : (
          list
        )}

        {saveFailed && (
          <p className="error-message">Couldn't save that change. Please try again.</p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <small className="CategoryManager__status" role="status">
          {isSaving ? "saving…" : "changes save automatically"}
        </small>
        <Button text="Done" variant="primary" onClick={close} />
      </Modal.Actions>
    </Modal>
  );
};

export default CategoryManager;
