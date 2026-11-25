import { FormEvent, ReactNode, useState } from "react";
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

import Button from "@/components/Button";
import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { formatTotals } from "@/utils/ledgerEntries";
import { MAX_CATEGORY_NAME_LENGTH } from "@/utils/ledger";
import { categoryNameError, isFixedCategory, MAX_CATEGORIES } from "@/utils/ledgerCategories";
import { isActiveSublog } from "@/utils/sublogs";
import { SublogMark, SublogName } from "@/features/ledger/sublogs/SublogName";
import "@/features/ledger/sublogs/sublogs.scss";

type CategoryListProps = {
  active: ReadonlyArray<LedgerCategory>;
  archived: ReadonlyArray<LedgerCategory>;
  /** Every category (active and archived), for name clashes and the cap. */
  all: ReadonlyArray<LedgerCategory>;
  /** Budgets including fields still being typed, for each row's summary. */
  budgets: ReadonlyMap<string, CurrencyAmounts | undefined>;
  /** How many scheduled payments each category has, when they're known. */
  scheduleCounts?: ReadonlyMap<string, number>;
  /** Highlighted row (side-by-side layout only). */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, toIndex: number) => void;
  onAdd: (name: string) => void;
  /** Shows the "make it a sublog" line under the add form. */
  onSublogHelp?: () => void;
};

/**
 * The categories, each row a button that opens its detail. Status (fixed, budget) is
 * spelled out on the row so it reads at a glance without opening anything.
 */
export const CategoryList = ({
  active,
  archived,
  all,
  budgets,
  scheduleCounts,
  selectedId,
  onSelect,
  onMove,
  onAdd,
  onSublogHelp,
}: CategoryListProps) => {
  const [newName, setNewName] = useState("");
  const addError = newName.trim() ? categoryNameError(newName, all) : undefined;
  const atCap = all.length >= MAX_CATEGORIES;

  const add = () => {
    if (!newName.trim() || addError || atCap) return;
    onAdd(newName);
    setNewName("");
  };

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
    onMove(
      String(dragged.id),
      active.findIndex((c) => c.id === over.id),
    );
  };

  const summary = (category: LedgerCategory) => {
    const budget = budgets.get(category.id);
    const scheduled = scheduleCounts?.get(category.id) ?? 0;
    return (
      <>
        {!category.archived && isFixedCategory(category) && (
          <small
            className="CategoryManager__tag"
            aria-label={scheduled ? `fixed, ${scheduled} scheduled` : undefined}
          >
            {scheduled ? `fixed · ${scheduled}↻` : "fixed"}
          </small>
        )}
        {!category.archived && budget && Object.keys(budget).length > 0 && (
          <small className="CategoryManager__tag keep-case">{formatTotals(budget)}/mo</small>
        )}
      </>
    );
  };

  return (
    <div className="CategoryManager__listPane">
      <p className="CategoryManager__hint">
        Tap a category to edit it. Drag <span aria-hidden="true">⋮⋮</span> to reorder.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={active.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="CategoryManager__list" aria-label="Active categories">
            {active.map((category) => (
              <SortableRow
                key={category.id}
                id={category.id}
                name={category.name}
                selected={selectedId === category.id}
              >
                <SelectButton
                  category={category}
                  selected={selectedId === category.id}
                  onSelect={onSelect}
                >
                  {summary(category)}
                </SelectButton>
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <form
        className="CategoryManager__add"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          add();
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
          variant="secondary"
          disabled={!newName.trim() || !!addError || atCap}
          onClick={add}
        />
        {addError && <small className="CategoryManager__error">{addError}</small>}
      </form>
      {onSublogHelp && (
        <p className="CategoryManager__hint">
          Want one category to have its own log, with its own categories?{" "}
          <button type="button" className="SublogHelp" onClick={onSublogHelp}>
            make it a sublog
          </button>
        </p>
      )}

      {archived.length > 0 && (
        <>
          <h4 className="CategoryManager__subheading">archived</h4>
          <ul
            className="CategoryManager__list CategoryManager__list--archived"
            aria-label="Archived categories"
          >
            {archived.map((category) => (
              <li
                key={category.id}
                className={cx("CategoryManager__row", {
                  "CategoryManager__row--selected": selectedId === category.id,
                })}
              >
                <SelectButton
                  category={category}
                  selected={selectedId === category.id}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export const SelectButton = ({
  category,
  selected,
  onSelect,
  children,
}: {
  category: LedgerCategory;
  selected: boolean;
  onSelect: (id: string) => void;
  children?: ReactNode;
}) => (
  <button
    type="button"
    className="CategoryManager__select"
    aria-current={selected || undefined}
    onClick={() => onSelect(category.id)}
  >
    <span
      className={cx("CategoryManager__nameText keep-case", {
        "CategoryManager__nameText--archived": category.archived,
      })}
    >
      {isActiveSublog(category) ? (
        <>
          <SublogMark /> <SublogName name={category.name} />
        </>
      ) : (
        category.name
      )}
    </span>
    {children}
    <span className="CategoryManager__chevron" aria-hidden="true">
      ›
    </span>
  </button>
);

const SortableRow = ({
  id,
  name,
  selected,
  children,
}: {
  id: string;
  name: string;
  selected: boolean;
  children: ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      className={cx("CategoryManager__row", {
        "CategoryManager__row--dragging": isDragging,
        "CategoryManager__row--selected": selected,
      })}
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

export default CategoryList;
