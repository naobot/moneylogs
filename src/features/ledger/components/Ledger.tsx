import { useCurrentUser } from "@/contexts";
import { useGetLedgerEntries } from "@/hooks/useGetLedgerEntries";
import { useLedgerEntryQuery } from "@/hooks/useLedgerEntryQuery";
import { Ledger as LedgerType, LedgerEntryInput } from "@/types/ledger";
import { activeCategories, formatMonth, monthKeyOf } from "@/utils/ledger";
import { defaultEntryDate } from "@/utils/ledgerEntries";
import EntryForm from "./EntryForm";
import EntryList from "./EntryList";
import LedgerShell, { LedgerShellContext } from "./LedgerShell";
import { LedgerStatsStrip } from "./LedgerStats";
import { useLedgerTour } from "@/features/ledger/tour/LedgerTour";

type LedgerProps = {
  ledger: LedgerType;
};

/** The entries view of a financial log (/l/:ledgerId). */
export const Ledger = ({ ledger }: LedgerProps) => (
  <LedgerShell ledger={ledger} view="entries">
    {(ctx) => <LedgerEntries ledger={ledger} {...ctx} />}
  </LedgerShell>
);

const LedgerEntries = ({ ledger, month, today, setMonth }: LedgerProps & LedgerShellContext) => {
  const { user } = useCurrentUser();
  const { entries, isLoading, isError } = useGetLedgerEntries({ ledgerId: ledger.id, month });
  const { addEntry, editEntry, deleteEntry } = useLedgerEntryQuery();
  const tour = useLedgerTour();

  const isShared = (ledger.memberUids?.length ?? 0) > 1;
  const categories = ledger.categories ?? [];
  const firstCategory = activeCategories(categories)[0]?.id ?? "";

  const handleAdd = async (input: LedgerEntryInput) => {
    if (!user) throw new Error("Not signed in");
    await addEntry.mutate({
      ledgerId: ledger.id,
      input,
      author: { uid: user.userId, userDocId: user.id, displayName: user.displayName },
    });
    // A first entry means they've got the hang of it.
    if (tour.activeTarget) tour.complete();
    // Logged into another month (e.g. a late receipt): jump there so it's visible.
    if (monthKeyOf(input.date) !== month) setMonth(monthKeyOf(input.date));
  };

  return (
    <>
      <LedgerStatsStrip
        ledger={ledger}
        month={month}
        today={today}
        entries={entries}
        isLoading={isLoading}
      />

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
      {isError && <p className="error-message">Couldn't load entries for {formatMonth(month)}.</p>}
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
    </>
  );
};

export default Ledger;
