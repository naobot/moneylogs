import { useEffect, useRef, useState } from "react";

import { Link } from "react-router-dom";
import { LedgerCategory, LedgerEntry, LedgerEntryInput, LedgerRollup } from "@/types/ledger";
import { resolveCategory } from "@/utils/ledger";
import { formatAmount, groupEntriesByDay } from "@/utils/ledgerEntries";
import Totals from "./Totals";

import { IconText } from "@/components/Icon";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import EntryForm from "./EntryForm";
import { reportError } from "@/utils/reportError";
import { SublogDayRow, SublogPaths, withSublogDays } from "@/utils/sublogs";
import { SublogMark, SublogName } from "@/features/ledger/sublogs/SublogName";

type EntryListProps = {
  entries: ReadonlyArray<LedgerEntry>;
  categories: ReadonlyArray<LedgerCategory>;
  /** Each sublog's month here: one row per sublog per day, never its entries. */
  rollups?: ReadonlyArray<LedgerRollup>;
  /** Linked category id → path into its sublog (null: the viewer can't open it). */
  sublogs?: SublogPaths;
  currentUid?: string;
  showAuthors: boolean;
  isSavingEdit: boolean;
  isDeleting: boolean;
  onEdit: (entryId: string, input: LedgerEntryInput) => Promise<unknown>;
  onDelete: (entryId: string) => Promise<unknown>;
};

export const EntryList = ({
  entries,
  categories,
  rollups = [],
  sublogs,
  currentUid,
  showAuthors,
  isSavingEdit,
  isDeleting,
  onEdit,
  onDelete,
}: EntryListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  // Phones: the entry whose "…" drawer (edit / delete) is open.
  const [actionsId, setActionsId] = useState<string | null>(null);
  const editingRowRef = useRef<HTMLLIElement>(null);

  // Bring the entry being edited to the top of the log. scrollIntoView stops wherever the
  // scroller runs out of room, so near the bottom of a short list it only dims.
  useEffect(() => {
    if (!editingId) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    editingRowRef.current?.scrollIntoView?.({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [editingId]);

  const days = withSublogDays(groupEntriesByDay([...entries]), rollups, categories);

  const confirmDelete = async () => {
    if (!deletingEntry) return;
    try {
      await onDelete(deletingEntry.id);
      setDeletingEntry(null);
    } catch (err) {
      reportError(err, { feature: "ledger_entry", action: "delete_entry" });
    }
  };

  return (
    <>
      {/* While editing, dim everything but the entry, so the add form above doesn't
          read as a second editor. Clicking the dimmed area cancels, like a modal. */}
      {editingId && (
        <div
          className="EntryList__scrim"
          aria-hidden="true"
          onClick={() => !isSavingEdit && setEditingId(null)}
        />
      )}
      <div className="EntryList">
        {days.map((day) => (
          <section key={day.date} className="EntryList__day" aria-label={day.label}>
            <header className="EntryList__day__header">
              <span>{day.label}</span>
              <Totals totals={day.subtotals} />
            </header>
            <ul>
              {day.entries.map((entry) => {
                const isMine = !!currentUid && entry.authorUid === currentUid;
                if (editingId === entry.id) {
                  return (
                    <li
                      key={entry.id}
                      ref={editingRowRef}
                      className="EntryList__row EntryList__row--editing"
                    >
                      <EntryForm
                        mode="edit"
                        categories={categories}
                        isSaving={isSavingEdit}
                        initial={{
                          amount: String(entry.amount),
                          currency: entry.currency,
                          categoryId: entry.categoryId,
                          date: entry.date,
                          note: entry.note ?? "",
                        }}
                        onSubmit={async (input) => {
                          await onEdit(entry.id, input);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </li>
                  );
                }
                return (
                  <li key={entry.id} className="EntryList__row">
                    <span className="EntryList__category">
                      {resolveCategory(entry.categoryId, categories).name}
                    </span>
                    <span className="EntryList__note">
                      {entry.scheduleId && (
                        <span
                          className="EntryList__scheduled"
                          role="img"
                          aria-label="scheduled"
                          title="logged by a scheduled payment"
                        >
                          ↻{" "}
                        </span>
                      )}
                      {entry.note}
                      {showAuthors && (
                        <small>
                          {entry.note ? " · " : ""}
                          {entry.authorName}
                        </small>
                      )}
                    </span>
                    <span className="EntryList__amount">
                      {formatAmount(entry.amount, entry.currency)}
                    </span>
                    <span className="EntryList__menu">
                      {isMine && (
                        <>
                          <IconText
                            className="handler"
                            type="pencil"
                            size={16}
                            onClick={() => setEditingId(entry.id)}
                          />
                          <IconText
                            className="handler"
                            type="trash"
                            onClick={() => setDeletingEntry(entry)}
                          />
                        </>
                      )}
                    </span>
                    {/* Phones: the actions fold into a drawer under the row, so a long
                        note or a big amount never collides with them. */}
                    {isMine && (
                      <RowButton
                        glyph
                        className="EntryList__more"
                        aria-label="entry actions"
                        aria-expanded={actionsId === entry.id}
                        aria-controls={`entry-actions-${entry.id}`}
                        onClick={() => setActionsId(actionsId === entry.id ? null : entry.id)}
                      >
                        …
                      </RowButton>
                    )}
                    {isMine && actionsId === entry.id && (
                      <div className="EntryList__drawer" id={`entry-actions-${entry.id}`}>
                        <RowButton
                          onClick={() => {
                            setActionsId(null);
                            setEditingId(entry.id);
                          }}
                        >
                          edit
                        </RowButton>
                        <RowButton
                          onClick={() => {
                            setActionsId(null);
                            setDeletingEntry(entry);
                          }}
                        >
                          delete
                        </RowButton>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {day.sublogs.map((row) => (
              <SublogRow
                key={row.categoryId}
                row={row}
                to={sublogs?.get(row.categoryId) ?? undefined}
              />
            ))}
          </section>
        ))}
      </div>
      <Modal isOpen={!!deletingEntry} onClose={() => setDeletingEntry(null)} disabled={isDeleting}>
        <Modal.Header title={"Delete entry"}>Delete entry</Modal.Header>
        <Modal.Body>
          {deletingEntry && (
            <p>
              Delete{" "}
              <strong>
                {formatAmount(deletingEntry.amount, deletingEntry.currency)} ·{" "}
                {resolveCategory(deletingEntry.categoryId, categories).name}
              </strong>
              {deletingEntry.note ? ` (${deletingEntry.note})` : ""}?
            </p>
          )}
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Nevermind" />
          <Button
            onClick={() => void confirmDelete()}
            text="Delete"
            variant="primary"
            loading={isDeleting}
          />
        </Modal.Actions>
      </Modal>
    </>
  );
};

/**
 * A sublog's spending on one day: its total and how many entries made it, opening the
 * sublog. Read-only here; the entries themselves live in the sublog.
 */
const SublogRow = ({ row, to }: { row: SublogDayRow; to?: string }) => {
  const content = (
    <>
      <span className="SublogRow__name">
        <SublogMark />
        <SublogName name={row.name} />
      </span>
      <span className="SublogRow__count">
        {row.count} {row.count === 1 ? "entry" : "entries"}
      </span>
      <span className="SublogRow__amount">
        <Totals totals={row.amounts} />
      </span>
      <span className="SublogRow__open" aria-hidden="true">
        {to ? "›" : ""}
      </span>
    </>
  );
  return to ? (
    <Link className="SublogRow" to={to} aria-label={`${row.name}: open this sublog`}>
      {content}
    </Link>
  ) : (
    <div className="SublogRow">{content}</div>
  );
};

export default EntryList;
