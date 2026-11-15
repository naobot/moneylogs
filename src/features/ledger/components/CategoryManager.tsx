import { FormEvent, ReactNode, useId, useMemo, useState } from "react";
import cx from "classnames";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import SharedRowButton from "@/components/RowButton";
import Icon, { IconType } from "@/components/Icon";
import Popover from "@/components/Popover";
import { isMousePointer, useHoverIntent } from "@/hooks/useHoverIntent";
import { LedgerCategory } from "@/types/ledger";
import { Currency } from "@/types/user";
import { formatTotals } from "@/utils/ledgerEntries";
import { activeCategories, MAX_CATEGORY_NAME_LENGTH, sortCategories } from "@/utils/ledger";
import {
  applyCategoryOps,
  categoryNameError,
  CategoryOp,
  MAX_CATEGORIES,
  newCategoryId,
} from "@/utils/ledgerCategories";
import { BudgetEditor } from "./BudgetManager";

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

  // Dragging is the only way to reorder, so it's on everywhere here (unlike the nav's
  // LogsMenu): only the ⋮⋮ handle starts a drag, so it can't fight scrolling or taps,
  // and the keyboard sensor (Space on a focused handle, then arrows) keeps it accessible.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
      <Modal.Header striped title="Categories">
        Categories
      </Modal.Header>
      <Modal.Body>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={active.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="CategoryManager__list" aria-label="Active categories">
              {active.map((category) => (
                <SortableRow key={category.id} id={category.id} name={category.name}>
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
                    <ActionButton
                      icon="wallet"
                      label={`Budget for ${category.name}`}
                      expanded={budgetingId === category.id}
                      onClick={() =>
                        setBudgetingId((id) => (id === category.id ? null : category.id))
                      }
                    >
                      budget
                    </ActionButton>
                    <ActionButton
                      icon="folder"
                      label={`Archive ${category.name}`}
                      disabled={lastActive}
                      tip={
                        lastActive
                          ? "A log needs at least one category, so this one can't be archived."
                          : "Archiving hides this category when adding entries. Past entries keep it, and you can restore it any time."
                      }
                      onClick={() => push({ type: "archive", id: category.id })}
                    >
                      archive
                    </ActionButton>
                  </span>
                  {budgetingId === category.id && (
                    <div className="CategoryManager__budget">
                      <BudgetEditor
                        category={category}
                        defaultCurrency={defaultCurrency}
                        onSet={(currency, amount) =>
                          push({ type: "setBudget", id: category.id, currency, amount })
                        }
                      />
                    </div>
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

/**
 * A row action with an icon and a one-word label. An optional tip explains it on hover
 * or keyboard focus (touch goes straight to the action).
 */
const ActionButton = ({
  icon,
  label,
  tip,
  expanded,
  disabled,
  onClick,
  children,
}: {
  icon: IconType;
  label: string;
  tip?: string;
  expanded?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => {
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const { openAfterDelay, cancelOpen } = useHoverIntent();
  const tipId = useId();

  const close = () => {
    cancelOpen();
    setOpen(false);
  };

  return (
    // The tip hangs off a wrapper, since a disabled button gets no pointer events.
    <span
      ref={setAnchor}
      className="CategoryManager__action"
      onPointerEnter={(e) => tip && isMousePointer(e) && openAfterDelay(() => setOpen(true))}
      onPointerLeave={(e) => isMousePointer(e) && close()}
    >
      <SharedRowButton
        className="RowButton--icon"
        aria-label={label}
        aria-expanded={expanded}
        aria-describedby={tip && open ? tipId : undefined}
        disabled={disabled}
        onClick={() => {
          close();
          onClick();
        }}
        onFocus={() => tip && setOpen(true)}
        onBlur={close}
        onKeyDown={(e) => {
          // Escape dismisses the tip first, without also closing the modal.
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            close();
          }
        }}
      >
        <Icon type={icon} size={20} />
        {children}
      </SharedRowButton>
      {tip && (
        <Popover
          anchor={anchor}
          open={open}
          onClose={close}
          interactive={false}
          className="HelpTip__panel"
          role="tooltip"
        >
          <p id={tipId} className="HelpTip__text">
            {tip}
          </p>
        </Popover>
      )}
    </span>
  );
};

const SortableRow = ({ id, name, children }: { id: string; name: string; children: ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      className={cx("CategoryManager__row", { "CategoryManager__row--dragging": isDragging })}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span
        className="CategoryManager__handle"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}`}
        title="Drag to reorder"
      >
        ⋮⋮
      </span>
      {children}
    </li>
  );
};

export default CategoryManager;
