import { useCurrentUser } from "@/contexts";
import { Link } from "react-router-dom";
import { useGetLedgerEntries } from "@/hooks/useGetLedgerEntries";
import { useLedgerRollups } from "@/hooks/useLedgerRollups";
import { useLedgerEntryQuery } from "@/hooks/useLedgerEntryQuery";
import { Ledger as LedgerType, LedgerEntryInput } from "@/types/ledger";
import { entryCategories, formatMonth, monthKeyOf } from "@/utils/ledger";
import { defaultEntryDate } from "@/utils/ledgerEntries";
import EntryForm from "./EntryForm";
import EntryList from "./EntryList";
import LedgerShell, { LedgerShellContext } from "./LedgerShell";
import { LedgerStatsStrip } from "./LedgerStats";
import { sublogPaths } from "@/utils/sublogs";
import { useSublogLinks } from "@/features/ledger/sublogs/useSublogLinks";
import { NoSpendDay } from "@/features/ledger/noSpend/NoSpendDay";
import { useLedgerTour } from "@/features/ledger/tour/LedgerTour";
import { track } from "@/utils/analytics";

type LedgerProps = {
  ledger: LedgerType;
};

/** The entries view of a financial log (/l/:ledgerId). */
export const Ledger = ({ ledger }: LedgerProps) => (
  <LedgerShell ledger={ledger} view="entries">
    {(ctx) => <LedgerEntries ledger={ledger} {...ctx} />}
  </LedgerShell>
);

const LedgerEntries = ({
  ledger,
  month,
  today,
  setMonth,
  openBudgets,
}: LedgerProps & LedgerShellContext) => {
  const { user } = useCurrentUser();
  const entriesQuery = useGetLedgerEntries({ ledgerId: ledger.id, month });
  const rollupsQuery = useLedgerRollups({ ledger, month });
  const { entries } = entriesQuery;
  const { rollups } = rollupsQuery;
  const isLoading = entriesQuery.isLoading || rollupsQuery.isLoading;
  const isError = entriesQuery.isError || rollupsQuery.isError;
  const { addEntry, editEntry, deleteEntry } = useLedgerEntryQuery();
  const tour = useLedgerTour();

  const isShared = (ledger.memberUids?.length ?? 0) > 1;
  const categories = ledger.categories ?? [];
  const firstCategory = entryCategories(categories)[0]?.id ?? "";
  const sublogLinks = useSublogLinks(categories);
  const sublogs = sublogPaths(sublogLinks, month, monthKeyOf(today));
  const openableSublogs = categories.filter((c) => sublogs.get(c.id));

  const handleAdd = async (input: LedgerEntryInput) => {
    if (!user) throw new Error("Not signed in");
    await addEntry.mutate({
      ledgerId: ledger.id,
      input,
      author: { uid: user.userId, userDocId: user.id, displayName: user.displayName },
    });
    track("add_entry", { shared_log: isShared, has_note: !!input.note?.trim() });
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
        rollups={rollups}
        isLoading={isLoading}
        onEditBudget={openBudgets}
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

      {openableSublogs.length > 0 && (
        <p className="SublogHint">
          For{" "}
          {openableSublogs.map((c, i) => (
            <span key={c.id}>
              {i > 0 && (i === openableSublogs.length - 1 ? " or " : ", ")}
              <Link to={sublogs.get(c.id)!}>{c.name} ›</Link>
            </span>
          ))}
          , add it in that log.
        </p>
      )}

      {month === monthKeyOf(today) && !isLoading && (
        <NoSpendDay
          today={today}
          loggedToday={entries.some((e) => e.authorUid === user?.userId && e.date === today)}
        />
      )}

      {isLoading && <p className="Ledger__empty">...</p>}
      {isError && <p className="error-message">Couldn't load entries for {formatMonth(month)}.</p>}
      {!isLoading && !isError && entries.length === 0 && rollups.length === 0 && (
        <p className="Ledger__empty">No entries in {formatMonth(month)} yet.</p>
      )}
      {!isLoading && (entries.length > 0 || rollups.length > 0) && (
        <EntryList
          entries={entries}
          categories={categories}
          rollups={rollups}
          sublogs={sublogs}
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
