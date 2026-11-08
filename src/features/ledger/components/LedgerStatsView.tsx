import { useGetLedgerEntries } from "@/hooks/useGetLedgerEntries";
import { Ledger } from "@/types/ledger";
import { formatMonth } from "@/utils/ledger";
import LedgerShell, { LedgerShellContext } from "./LedgerShell";
import { LedgerStatsPanel } from "./LedgerStats";

type LedgerStatsViewProps = {
  ledger: Ledger;
};

/** The stats view of a financial log (/l/:ledgerId/stats). */
export const LedgerStatsView = ({ ledger }: LedgerStatsViewProps) => (
  <LedgerShell ledger={ledger} view="stats">
    {(ctx) => <MonthStats ledger={ledger} {...ctx} />}
  </LedgerShell>
);

const MonthStats = ({ ledger, month, today }: LedgerStatsViewProps & LedgerShellContext) => {
  const { entries, isLoading, isError } = useGetLedgerEntries({ ledgerId: ledger.id, month });
  if (isError) {
    return <p className="error-message">Couldn't load stats for {formatMonth(month)}.</p>;
  }
  return (
    <LedgerStatsPanel
      ledger={ledger}
      month={month}
      today={today}
      entries={entries}
      isLoading={isLoading}
    />
  );
};

export default LedgerStatsView;
