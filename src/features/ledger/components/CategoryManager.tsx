import { FormEvent, ReactNode, useMemo, useState } from "react";
import cx from "classnames";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import SharedRowButton from "@/components/RowButton";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { CURRENCIES } from "@/utils/currency";
import { formatAmount, formatTotals, parseAmount } from "@/utils/ledgerEntries";
import { activeCategories, MAX_CATEGORY_NAME_LENGTH, sortCategories } from "@/utils/ledger";
import {
  applyCategoryOps,
  categoryNameError,
  CategoryOp,
  isValidBudgetAmount,
  MAX_BUDGET,
  MAX_CATEGORIES,
  newCategoryId,
} from "@/utils/ledgerCategories";
import useDragReorderEnabled from "@/hooks/useDragReorderEnabled";

import Modal from "@/components/Modal";
import Button from "@/components/Button";

type CategoryManagerProps = {
  isOpen: boolean;
  categories: ReadonlyArray<LedgerCategory>;
  /** Pre-selected currency when adding a budget. */
  defaultCurrency: Currency;
  onClose: () => void;
  onSave: (ops: CategoryOp[]) => Promise<unknown>;
  isSaving: boolean;
  /** Resolves true if any entry uses the category (so it can only be archived). */
  checkInUse: (categoryId: string) => Promise<boolean>;
};

type DeleteState =
  | { status: "idle" }
  | { status: "checking"; id: string }
  | { status: "in-use"; id: string }
  | { status: "failed"; id: string };

/**
 * Edits are recorded as operations and only written on Save, where they're replayed onto
 * the latest server copy (see useLedgerCategoryQuery).
 */
export const CategoryManager = (props: CategoryManagerProps) =>
  // Remount on open so each session starts from the current categories with no pending ops.
  props.isOpen ? <CategoryManagerDialog {...props} /> : null;

const CategoryManagerDialog = ({
  categories,
  defaultCurrency,
  onClose,
  onSave,
  isSaving,
  checkInUse,
}: CategoryManagerProps) => {
  const [ops, setOps] = useState<CategoryOp[]>([]);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle" });
  const [budgetingId, setBudgetingId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const dragEnabled = useDragReorderEnabled();

  const draft = useMemo(() => applyCategoryOps(categories, ops), [categories, ops]);
  const active = activeCategories(draft);
  const archived = sortCategories(draft.filter((c) => c.archived));
  const isDirty = ops.length > 0;

  const push = (op: CategoryOp) => {
    setSaveFailed(false);
    setOps((prev) => [...prev, op]);
  };

  const addError = newName.trim() ? categoryNameError(newName, draft) : undefined;
  const atCap = draft.length >= MAX_CATEGORIES;

  const addCategory = () => {
    if (!newName.trim() || addError || atCap) return;
    push({ type: "add", id: newCategoryId(newName, draft), name: newName });
    setNewName("");
  };

  const renameError = renaming ? categoryNameError(renaming.name, draft, renaming.id) : undefined;
  const commitRename = () => {
    if (!renaming) return;
    const current = draft.find((c) => c.id === renaming.id);
    if (!renameError && current && current.name !== renaming.name.trim()) {
      push({ type: "rename", id: renaming.id, name: renaming.name });
    }
    setRenaming(null);
  };

  const move = (id: string, toIndex: number) => push({ type: "move", id, toIndex });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return;
    move(
      String(dragged.id),
      active.findIndex((c) => c.id === over.id),
    );
  };

  const handleDelete = async (id: string) => {
    setDeleteState({ status: "checking", id });
    try {
      // Categories added in this session can't have entries yet.
      const isNew = !categories.some((c) => c.id === id);
      if (!isNew && (await checkInUse(id))) {
        setDeleteState({ status: "in-use", id });
        return;
      }
      push({ type: "delete", id });
      setDeleteState({ status: "idle" });
    } catch (err) {
      console.error("Failed to check category usage:", err);
      setDeleteState({ status: "failed", id });
    }
  };

  const handleSave = async () => {
    try {
      await onSave(ops);
      onClose();
    } catch (err) {
      console.error("Failed to save categories:", err);
      setSaveFailed(true);
    }
  };

  const lastActive = active.length <= 1;

  return (
    <Modal isOpen onClose={isSaving ? undefined : onClose} className="CategoryManager">
      <Modal.Header title="Categories">Categories</Modal.Header>
      <Modal.Body>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={active.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="CategoryManager__list" aria-label="Active categories">
              {active.map((category, index) => (
                <SortableRow key={category.id} id={category.id} dragEnabled={dragEnabled}>
                  {renaming?.id === category.id ? (
                    <form
                      className="CategoryManager__rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitRename();
                      }}
                    >
                      <input
                        aria-label={`Rename ${category.name}`}
                        value={renaming.name}
                        maxLength={MAX_CATEGORY_NAME_LENGTH + 5}
                        autoFocus
                        onChange={(e) => setRenaming({ id: category.id, name: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setRenaming(null);
                          }
                        }}
                      />
                      {renameError && (
                        <small className="CategoryManager__error">{renameError}</small>
                      )}
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="CategoryManager__name"
                      title="Rename"
                      onClick={() => setRenaming({ id: category.id, name: category.name })}
                    >
                      {category.name}
                    </button>
                  )}
                  {category.budget && (
                    <small className="CategoryManager__budgetSummary">
                      {formatTotals(category.budget)} / month
                    </small>
                  )}
                  <span className="CategoryManager__actions">
                    <RowButton
                      glyph
                      label={`Move ${category.name} up`}
                      disabled={index === 0}
                      onClick={() => move(category.id, index - 1)}
                    >
                      ↑
                    </RowButton>
                    <RowButton
                      glyph
                      label={`Move ${category.name} down`}
                      disabled={index === active.length - 1}
                      onClick={() => move(category.id, index + 1)}
                    >
                      ↓
                    </RowButton>
                    <RowButton
                      label={`Budget for ${category.name}`}
                      onClick={() =>
                        setBudgetingId((id) => (id === category.id ? null : category.id))
                      }
                    >
                      budget
                    </RowButton>
                    <RowButton
                      label={`Archive ${category.name}`}
                      disabled={lastActive}
                      title={lastActive ? "A log needs at least one category" : undefined}
                      onClick={() => push({ type: "archive", id: category.id })}
                    >
                      archive
                    </RowButton>
                  </span>
                  {budgetingId === category.id && (
                    <BudgetEditor
                      category={category}
                      defaultCurrency={defaultCurrency}
                      onSet={(currency, amount) =>
                        push({ type: "setBudget", id: category.id, currency, amount })
                      }
                    />
                  )}
                </SortableRow>
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <form
          className="CategoryManager__add"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            addCategory();
          }}
        >
          <input
            className="LineInput"
            aria-label="New category name"
            placeholder={atCap ? `Limit of ${MAX_CATEGORIES} reached` : "New category"}
            value={newName}
            disabled={atCap}
            maxLength={MAX_CATEGORY_NAME_LENGTH + 5}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button
            text="Add"
            size="sm"
            buttonStyle="primary-border-lite"
            disabled={!newName.trim() || !!addError || atCap}
            onClick={addCategory}
          />
          {addError && <small className="CategoryManager__error">{addError}</small>}
        </form>

        {archived.length > 0 && (
          <>
            <h4 className="CategoryManager__subheading">Archived</h4>
            <p className="CategoryManager__hint">
              Hidden when adding entries. Past entries keep their category.
            </p>
            <ul className="CategoryManager__list CategoryManager__list--archived">
              {archived.map((category) => (
                <li key={category.id} className="CategoryManager__row">
                  <span className="CategoryManager__name CategoryManager__name--archived">
                    {category.name}
                  </span>
                  <span className="CategoryManager__actions">
                    <RowButton
                      label={`Restore ${category.name}`}
                      onClick={() => push({ type: "unarchive", id: category.id })}
                    >
                      restore
                    </RowButton>
                    <RowButton
                      label={`Delete ${category.name}`}
                      disabled={deleteState.status === "checking"}
                      onClick={() => void handleDelete(category.id)}
                    >
                      {deleteState.status === "checking" && deleteState.id === category.id
                        ? "checking…"
                        : "delete"}
                    </RowButton>
                  </span>
                  {deleteState.status === "in-use" && deleteState.id === category.id && (
                    <small className="CategoryManager__error">
                      Some entries use this category, so it can only be archived.
                    </small>
                  )}
                  {deleteState.status === "failed" && deleteState.id === category.id && (
                    <small className="CategoryManager__error">
                      Couldn't check whether this category is in use. Try again.
                    </small>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {saveFailed && (
          <p className="error-message">Couldn't save your changes. Please try again.</p>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Button
          text="Save"
          buttonStyle="primary-border"
          disabled={!isDirty || isSaving}
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

/** Inline per-currency monthly budget editor for one category. */
const BudgetEditor = ({
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
    <div className="CategoryManager__budget">
      {existing.length > 0 && (
        <ul className="CategoryManager__budget__list" aria-label={`${category.name} budgets`}>
          {existing.map((c) => (
            <li key={c}>
              {formatAmount(category.budget![c]!, c)} / month
              <RowButton
                glyph
                label={`Remove ${c} budget for ${category.name}`}
                onClick={() => onSet(c, null)}
              >
                ×
              </RowButton>
            </li>
          ))}
        </ul>
      )}
      <form
        className="CategoryManager__budget__form"
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
          autoFocus
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
        <RowButton label={`Set budget for ${category.name}`} disabled={!valid} onClick={submit}>
          {category.budget?.[currency] !== undefined ? "update" : "set"}
        </RowButton>
        {amount.trim() !== "" && !valid && (
          <small className="CategoryManager__error">
            Enter an amount between 0 and {MAX_BUDGET.toLocaleString("en-US")}.
          </small>
        )}
      </form>
    </div>
  );
};

const RowButton = ({
  label,
  title,
  disabled,
  onClick,
  glyph,
  children,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  glyph?: boolean;
  children: ReactNode;
}) => (
  <SharedRowButton
    glyph={glyph}
    aria-label={label}
    title={title ?? label}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </SharedRowButton>
);

const SortableRow = ({
  id,
  dragEnabled,
  children,
}: {
  id: string;
  dragEnabled: boolean;
  children: ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !dragEnabled,
  });
  return (
    <li
      ref={setNodeRef}
      className={cx("CategoryManager__row", { "CategoryManager__row--dragging": isDragging })}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {dragEnabled && (
        <span
          className="CategoryManager__handle"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </span>
      )}
      {children}
    </li>
  );
};

export default CategoryManager;
