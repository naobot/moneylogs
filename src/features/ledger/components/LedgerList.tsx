import { Link } from "react-router-dom";

import { useCurrentUser } from "@/contexts";
import { useLedgerMonthTotals } from "@/hooks/useLedgerMonthTotals";
import { Ledger } from "@/types/ledger";
import { formatMonth, monthKeyOf, todayInTz } from "@/utils/ledger";
import { formatTotals } from "@/utils/ledgerEntries";
import { ManageLogButton } from "@/features/logActions/ManageLogButton";
import { ManageTarget, manageTargetForLedger } from "@/features/logActions/manageTarget";

import "./Ledger.scss";

type LedgerListProps = {
  ledgers: Array<Ledger>;
  /** When given, each row gets a "manage" button (archive / delete). */
  onManage?: (target: ManageTarget) => void;
};

export const LedgerList = ({ ledgers, onManage }: LedgerListProps) => {
  const { user } = useCurrentUser();
  const month = monthKeyOf(todayInTz(user?.timezone));
  const totals = useLedgerMonthTotals(
    ledgers.map((l) => l.id),
    month,
  );

  return (
    <ul className="LedgerList">
      {ledgers.map((ledger) => {
        const monthTotals = totals[ledger.id];
        const spent = monthTotals ? formatTotals(monthTotals) : "";
        return (
          <li key={ledger.id}>
            <span className="LedgerList__title">
              <Link to={`/l/${ledger.id}`}>{ledger.title}</Link>{" "}
              <small>
                {(ledger.memberUids?.length ?? 0) > 1
                  ? `shared · ${ledger.memberUids.length} members`
                  : "personal"}
              </small>
            </span>
            <span className="LogRowActions">
              <small className="LedgerList__month">
                {monthTotals === undefined
                  ? "…"
                  : monthTotals === null
                    ? ""
                    : `${formatMonth(month)}: ${spent || "nothing yet"}`}
              </small>
              {onManage && (
                <ManageLogButton target={manageTargetForLedger(ledger)} onManage={onManage} />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default LedgerList;
