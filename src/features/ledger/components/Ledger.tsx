import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useGetLedgerEntries } from "@/hooks/useGetLedgerEntries";
import { useLedgerEntryQuery } from "@/hooks/useLedgerEntryQuery";
import { useLedgerCategoryQuery } from "@/hooks/useLedgerCategoryQuery";
import { Ledger as LedgerType, LedgerEntryInput } from "@/types/ledger";
import {
  activeCategories,
  formatMonth,
  isValidMonthKey,
  monthKeyOf,
  shiftMonth,
  spotsLeft,
  todayInTz,
} from "@/utils/ledger";
import { defaultEntryDate, formatTotals, sumByCurrency } from "@/utils/ledgerEntries";
import CopyTextArea from "@/features/layout/components/CopyTextArea";
import { IconText } from "@/components/Icon";
import Modal from "@/components/Modal";
import EntryForm from "./EntryForm";
import EntryList from "./EntryList";
import CategoryManager from "./CategoryManager";

import "./Ledger.scss";

type LedgerProps = {
  ledger: LedgerType;
};

export const Ledger = ({ ledger }: LedgerProps) => {
  const { user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const spots = spotsLeft(ledger);
  const isShared = (ledger.memberUids?.length ?? 0) > 1;

  // The viewed month lives in ?month= so refresh/back keep your place.
  const today = todayInTz(user?.timezone);
  const currentMonth = monthKeyOf(today);
  const requestedMonth = searchParams.get("month") ?? "";
  const month = isValidMonthKey(requestedMonth) ? requestedMonth : currentMonth;
  const setMonth = (next: string) => setSearchParams(next === currentMonth ? {} : { month: next });

  const { entries, isLoading, isError } = useGetLedgerEntries({ ledgerId: ledger.id, month });
  const { addEntry, editEntry, deleteEntry } = useLedgerEntryQuery();
  const { saveCategoryOps, isCategoryUsed } = useLedgerCategoryQuery();

  const categories = ledger.categories ?? [];
  const firstCategory = activeCategories(categories)[0]?.id ?? "";
  const monthTotals = sumByCurrency(entries);

  const handleAdd = async (input: LedgerEntryInput) => {
    if (!user) throw new Error("Not signed in");
    await addEntry.mutate({
      ledgerId: ledger.id,
      input,
      author: { uid: user.userId, userDocId: user.id, displayName: user.displayName },
    });
    // Logged into another month (e.g. a late receipt): jump there so it's visible.
    if (monthKeyOf(input.date) !== month) setMonth(monthKeyOf(input.date));
  };

  return (
    <>
      <div className="Group Ledger">
        <div className="Group__header">
          <div className="Group__header__left">
            <div className="Group__header__item">
              {isShared ? `shared · ${ledger.memberUids.length} members` : "personal"}
            </div>
          </div>
          <div className="Group__header__center">
            <div className="Group__header__item Group__header__title">{ledger.title}</div>
          </div>
          <div className="Group__header__right">
            <div className="handler Group__header__item" onClick={() => setShowCategories(true)}>
              <IconText type={"pencil"} fill={"white"} text="categories" />
            </div>
            {spots > 0 && (
              <>
                <div
                  className="handler Group__header__item"
                  onClick={() => setShowInviteModal(true)}
                >
                  <IconText type={"plus"} fill={"white"} text="invite" />
                </div>
                <div className="Group__header__item">
                  <small>
                    ({spots} spot{spots > 1 && "s"} left)
                  </small>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="Ledger__body">
          <nav className="Ledger__month" aria-label="Month">
            <button
              type="button"
              className="Ledger__month__step"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </button>
            <strong className="Ledger__month__label">{formatMonth(month)}</strong>
            <button
              type="button"
              className="Ledger__month__step"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </button>
            {month !== currentMonth && (
              <button
                type="button"
                className="Ledger__month__today"
                onClick={() => setMonth(currentMonth)}
              >
                this month
              </button>
            )}
            <span className="Ledger__month__total">
              {!isLoading && entries.length > 0 ? formatTotals(monthTotals) : ""}
            </span>
          </nav>

          <EntryForm
            mode="add"
            categories={categories}
            isSaving={addEntry.isLoading}
            initial={{
              amount: "",
              currency: ledger.defaultCurrency,
              categoryId: firstCategory,
              date: defaultEntryDate(month, today),
              note: "",
            }}
            onSubmit={handleAdd}
          />

          {isLoading && <p className="Ledger__empty">...</p>}
          {isError && (
            <p className="error-message">Couldn't load entries for {formatMonth(month)}.</p>
          )}
          {!isLoading && !isError && entries.length === 0 && (
            <p className="Ledger__empty">No entries in {formatMonth(month)} yet.</p>
          )}
          {!isLoading && entries.length > 0 && (
            <EntryList
              entries={entries}
              categories={categories}
              currentUid={user?.userId}
              showAuthors={isShared}
              isSavingEdit={editEntry.isLoading}
              isDeleting={deleteEntry.isLoading}
              onEdit={(entryId, input) => editEntry.mutate({ ledgerId: ledger.id, entryId, input })}
              onDelete={(entryId) => deleteEntry.mutate({ ledgerId: ledger.id, entryId })}
            />
          )}
        </div>
      </div>
      <CategoryManager
        isOpen={showCategories}
        categories={categories}
        onClose={() => setShowCategories(false)}
        isSaving={saveCategoryOps.isLoading}
        onSave={(ops) => saveCategoryOps.mutate({ ledgerId: ledger.id, ops })}
        checkInUse={(categoryId) => isCategoryUsed.mutate({ ledgerId: ledger.id, categoryId })}
      />
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header title={"Invite"}>Invite</Modal.Header>
        <Modal.Body>
          <p>Send the following URL to anyone you want to share this financial log with.</p>
          <p>Members can see every entry in this log, and add their own.</p>
          <CopyTextArea value={`${window.location.host}/l/${ledger.id}/invite`} />
        </Modal.Body>
        <Modal.Actions>
          <Modal.CancelButton text="Close" />
        </Modal.Actions>
      </Modal>
    </>
  );
};

export default Ledger;
