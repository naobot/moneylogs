import { useState } from "react";
import { useGetLedgerEntries } from "@/hooks/useGetLedgerEntries";
import { Ledger } from "@/types/ledger";
import { formatMonth } from "@/utils/ledger";
import LedgerShell, { LedgerShellContext } from "./LedgerShell";
import { LedgerStatsPanel } from "./LedgerStats";
import PeriodStats from "./PeriodStats";
import MonthReviewCard from "./MonthReviewCard";
import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import ShareCardModal from "@/features/share/ShareCardModal";
import { monthName } from "@/features/ledger/buddy/monthReview";

type LedgerStatsViewProps = {
  ledger: Ledger;
};

/** The stats view of a financial log (/l/:ledgerId/stats). */
export const LedgerStatsView = ({ ledger }: LedgerStatsViewProps) => (
  <LedgerShell ledger={ledger} view="stats">
    {(ctx) =>
      ctx.period.kind === "month" ? (
        <MonthStats ledger={ledger} {...ctx} />
      ) : (
        <PeriodStats
          key={ctx.period.key}
          ledger={ledger}
          period={ctx.period}
          today={ctx.today}
          onEditBudget={ctx.openBudgets}
        />
      )
    }
  </LedgerShell>
);

const MonthStats = ({
  ledger,
  month,
  today,
  openBudgets,
}: LedgerStatsViewProps & LedgerShellContext) => {
  const { user } = useCurrentUser();
  const { entries, isLoading, isError } = useGetLedgerEntries({ ledgerId: ledger.id, month });
  const [sharing, setSharing] = useState(false);
  const hasMine = entries.some((e) => e.authorUid === user?.userId);
  if (isError) {
    return <p className="error-message">Couldn't load stats for {formatMonth(month)}.</p>;
  }
  return (
    <>
      <MonthReviewCard ledger={ledger} month={month} today={today} onEditBudget={openBudgets} />
      <LedgerStatsPanel
        ledger={ledger}
        month={month}
        today={today}
        entries={entries}
        isLoading={isLoading}
        onEditBudget={openBudgets}
      />
      {hasMine && (
        <div className="LedgerStats__share">
          <RowButton onClick={() => setSharing(true)}>share {monthName(month)}</RowButton>
        </div>
      )}
      {sharing && (
        <ShareCardModal
          card="breakdown"
          ledger={ledger}
          month={month}
          today={today}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
};

export default LedgerStatsView;
