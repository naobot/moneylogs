import { useGetLedgerEntries } from "@/hooks/useGetLedgerEntries";
import { Ledger } from "@/types/ledger";
import { formatMonth } from "@/utils/ledger";
import LedgerShell, { LedgerShellContext } from "./LedgerShell";
import { LedgerStatsPanel } from "./LedgerStats";
import PeriodStats from "./PeriodStats";
import MonthReviewCard from "./MonthReviewCard";

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
  const { entries, isLoading, isError } = useGetLedgerEntries({ ledgerId: ledger.id, month });
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
    </>
  );
};

export default LedgerStatsView;
