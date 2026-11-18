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

/** Archive and delete are confirmed in the window first, explaining what they do. */
type Confirming =
  | { kind: "archive"; id: string }
  | { kind: "delete"; id: string; status: "checking" | "ready" | "in-use" | "failed" };

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
  const [confirming, setConfirming] = useState<Confirming | null>(null);
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

  /** Opens the delete confirmation, which first checks whether entries use it. */
  const askDelete = async (categoryId: string) => {
    const settle = (status: "ready" | "in-use" | "failed") =>
      setConfirming((c) => (c?.kind === "delete" && c.id === categoryId ? { ...c, status } : c));
    setConfirming({ kind: "delete", id: categoryId, status: "checking" });
    // A category whose add is still saving can't have entries yet.
    const unsaved = pending.some((e) => !e.saved && e.op.type === "add" && e.op.id === categoryId);
    if (unsaved) return settle("ready");
    try {
      settle((await checkInUse(categoryId)) ? "in-use" : "ready");
    } catch (err) {
      reportError(err, { feature: "ledger", action: "check_category_in_use" });
      settle("failed");
    }
  };

  const archive = (categoryId: string) => {
    save({ type: "archive", id: categoryId });
    setConfirming(null);
  };

  const confirmDelete = (categoryId: string) => {
    save({ type: "delete", id: categoryId });
    track("delete_category");
    setConfirming(null);
    setSelectedId(null);
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
      onArchive={() => setConfirming({ kind: "archive", id: selected.id })}
      onDelete={() => void askDelete(selected.id)}
    />
  );

  // Gone (e.g. deleted by another member) while confirming: nothing left to confirm.
  const confirmed = confirming && draft.find((c) => c.id === confirming.id);
  if (confirming && confirmed) {
    return (
      <ConfirmView
        confirming={confirming}
        category={confirmed}
        onBack={() => setConfirming(null)}
        onArchive={() => archive(confirmed.id)}
        onDelete={() => confirmDelete(confirmed.id)}
        onRetry={() => void askDelete(confirmed.id)}
      />
    );
  }

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

/**
 * The window's confirm step for archive and delete (in place, like deleting a log from
 * its manage window): what the action does, then Back or go ahead.
 */
const ConfirmView = ({
  confirming,
  category,
  onBack,
  onArchive,
  onDelete,
  onRetry,
}: {
  confirming: Confirming;
  category: LedgerCategory;
  onBack: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) => {
  const name = <strong className="keep-case">{category.name}</strong>;
  const status = confirming.kind === "delete" ? confirming.status : null;
  const archiveHelp =
    "Archiving hides it when adding entries. Past entries keep it, and you can restore it any time.";

  return (
    <Modal isOpen onClose={onBack} className="CategoryManager CategoryManager--confirm">
      <Modal.Header striped title={`${confirming.kind} category`}>
        {confirming.kind} category
      </Modal.Header>
      <Modal.Body>
        {confirming.kind === "archive" && (
          <>
            <p>Archive {name}?</p>
            <p className="CategoryManager__hint">{archiveHelp}</p>
          </>
        )}
        {status === "checking" && <p role="status">Checking whether any entries use {name}…</p>}
        {status === "ready" && (
          <>
            <p>Delete {name}?</p>
            <p className="CategoryManager__hint">
              No entries use it, so it can be removed for good. This can't be undone.
            </p>
          </>
        )}
        {status === "in-use" && (
          <>
            <p>Some entries use {name}, so it can't be deleted.</p>
            <p className="CategoryManager__hint">
              {category.archived ? "It's already archived. " : "Archive it instead. "}
              {archiveHelp}
            </p>
          </>
        )}
        {status === "failed" && (
          <p className="error-message">Couldn't check whether this category is in use.</p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button text="Back" variant="secondary" onClick={onBack} />
        {confirming.kind === "archive" && <Button text="Archive" onClick={onArchive} />}
        {(status === "checking" || status === "ready") && (
          <Button
            text="Delete"
            loading={status === "checking"}
            disabled={status === "checking"}
            onClick={onDelete}
          />
        )}
        {status === "in-use" && !category.archived && (
          <Button text="Archive instead" onClick={onArchive} />
        )}
        {status === "failed" && <Button text="Try again" onClick={onRetry} />}
      </Modal.Actions>
    </Modal>
  );
};

export default CategoryManager;
