import { ReactNode, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";
import cx from "classnames";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { track } from "@/utils/analytics";
import { activeCategories, sortCategories } from "@/utils/ledger";
import { CategoryOp, guessFixed, newCategoryId } from "@/utils/ledgerCategories";
import { reportError } from "@/utils/reportError";
import CategoryDetail from "./CategoryDetail";
import CategoryList from "./CategoryList";
import { AutosaveActions, ListDetail, WIDE_QUERY } from "./ListDetail";
import { useCategoryEdits } from "./useCategoryEdits";

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
  /** How many scheduled payments each category has (for the list's fixed tag). */
  scheduleCounts?: ReadonlyMap<string, number>;
  /** A fixed category's scheduled payments section, shown in its detail. */
  renderSchedules?: (category: LedgerCategory) => ReactNode;
};

/** Archive and delete are confirmed in the window first, explaining what they do. */
type Confirming =
  | { kind: "archive"; id: string }
  | { kind: "delete"; id: string; status: "checking" | "ready" | "in-use" | "failed" };

/**
 * A list of categories and one category's detail: side by side on wide screens; on
 * phones the list, then tapping a row drills into its detail with a way back. Every
 * edit saves as soon as it's made (see useCategoryEdits): no Save or Cancel.
 */
export const CategoryManager = (props: CategoryManagerProps) =>
  props.isOpen ? <CategoryManagerDialog {...props} /> : null;

const CategoryManagerDialog = ({
  categories,
  defaultCurrency,
  onClose,
  onSave,
  checkInUse,
  scheduleCounts,
  renderSchedules,
}: CategoryManagerProps) => {
  const wide = useMediaQuery(WIDE_QUERY);
  const edits = useCategoryEdits(categories, onSave);
  const { draft, save, commitBudgets } = edits;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);

  const active = activeCategories(draft);
  const archived = sortCategories(draft.filter((c) => c.archived));

  // Side by side there's always a category open (the first, until another is picked
  // or the open one is deleted); on phones none is, until a row is tapped.
  const selected = draft.find((c) => c.id === selectedId) ?? (wide ? (active[0] ?? null) : null);

  const addCategory = (name: string) => {
    const id = newCategoryId(name, draft);
    save({ type: "add", id, name, fixed: guessFixed(name) });
    // Open it, so its fixed and budget settings are right there.
    setSelectedId(id);
  };

  /** Opens the delete confirmation, which first checks whether entries use it. */
  const askDelete = async (categoryId: string) => {
    const settle = (status: "ready" | "in-use" | "failed") =>
      setConfirming((c) => (c?.kind === "delete" && c.id === categoryId ? { ...c, status } : c));
    setConfirming({ kind: "delete", id: categoryId, status: "checking" });
    if (edits.isUnsavedAdd(categoryId)) return settle("ready");
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
        scheduled={scheduleCounts?.get(confirmed.id) ?? 0}
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
        <ListDetail
          wide={wide}
          listName="categories"
          onBack={() => select(null)}
          list={
            <CategoryList
              active={active}
              archived={archived}
              all={draft}
              budgets={edits.budgetsShown}
              scheduleCounts={scheduleCounts}
              selectedId={wide ? (selected?.id ?? null) : null}
              onSelect={select}
              onMove={(id, toIndex) => save({ type: "move", id, toIndex })}
              onAdd={addCategory}
            />
          }
          detail={
            selected && (
              <CategoryDetail
                key={selected.id}
                category={selected}
                all={draft}
                lastActive={!selected.archived && active.length <= 1}
                defaultCurrency={defaultCurrency}
                save={save}
                budgetDrafts={edits.budgetDrafts}
                onBudgetChange={(currency, raw) => edits.setBudgetDraft(selected.id, currency, raw)}
                onBudgetCommit={() => commitBudgets(selected.id)}
                onBudgetRemove={(currency) => edits.removeBudget(selected.id, currency)}
                onArchive={() => setConfirming({ kind: "archive", id: selected.id })}
                onDelete={() => void askDelete(selected.id)}
                scheduled={renderSchedules?.(selected)}
              />
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
  scheduled,
}: {
  confirming: Confirming;
  /** Its scheduled payments, which stop with it. */
  scheduled: number;
  category: LedgerCategory;
  onBack: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) => {
  const name = <strong className="keep-case">{category.name}</strong>;
  const status = confirming.kind === "delete" ? confirming.status : null;
  const archiveHelp =
    "Archiving hides it when adding entries. Past entries keep it, and you can restore it any time." +
    (scheduled ? " Its scheduled payments pause until it's restored and they're resumed." : "");

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
        {status === "checking" && (
          <p role="status">
            Checking whether any entries use {name}
            <LoadingDots label="" />
          </p>
        )}
        {status === "ready" && (
          <>
            <p>Delete {name}?</p>
            <p className="CategoryManager__hint">
              No entries use it, so it can be removed for good. This can't be undone.
              {scheduled > 0 && " Its scheduled payments stop too."}
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
