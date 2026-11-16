import { useEffect, useRef, useState } from "react";

import { LedgerCategory, LedgerEntry, LedgerEntryInput } from "@/types/ledger";
import { resolveCategory } from "@/utils/ledger";
import { formatAmount, formatTotals, groupEntriesByDay } from "@/utils/ledgerEntries";

import { IconText } from "@/components/Icon";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import EntryForm from "./EntryForm";
import { reportError } from "@/utils/reportError";

type EntryListProps = {
  entries: ReadonlyArray<LedgerEntry>;
  categories: ReadonlyArray<LedgerCategory>;
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
  currentUid,
  showAuthors,
  isSavingEdit,
  isDeleting,
  onEdit,
  onDelete,
}: EntryListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
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

  const days = groupEntriesByDay([...entries]);

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
              <span>{formatTotals(day.subtotals)}</span>
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
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <Modal isOpen={!!deletingEntry} onClose={() => setDeletingEntry(null)}>
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
          <Button
            onClick={() => void confirmDelete()}
            text="Delete"
            buttonStyle="primary-border"
            loading={isDeleting}
          />
          <Modal.CancelButton text="Nevermind" />
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default EntryList;
