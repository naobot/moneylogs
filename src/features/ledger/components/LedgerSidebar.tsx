import { Link } from "react-router-dom";

import { LedgerView } from "@/utils/ledger";
import {
  ledgerPeriodPath,
  Period,
  PERIOD_KINDS,
  periodOf,
  PeriodKind,
  periodMonths,
} from "@/utils/ledgerPeriods";
import { track } from "@/utils/analytics";
import { useLedgerTour } from "@/features/ledger/tour/LedgerTour";

type LedgerSidebarProps = {
  ledgerId: string;
  view: LedgerView;
  period: Period;
  currentMonth: string;
};

const VIEW_LABELS: Record<LedgerView, string> = { entries: "entries", stats: "stats" };
const PERIOD_LABELS: Record<PeriodKind, string> = {
  month: "monthly",
  quarter: "quarterly",
  year: "yearly",
};

/**
 * The financial log's left column: which view (entries or stats) and, for stats, how much
 * time to look at (a month, a quarter or a year). Quarters and years are stats-only, so on
 * the entries view picking one moves to stats. Below the md breakpoint it's a strip that
 * scrolls sideways, like the social log's member list.
 */
export const LedgerSidebar = ({ ledgerId, view, period, currentMonth }: LedgerSidebarProps) => {
  const { tip } = useLedgerTour();
  // Switching period keeps your place: the quarter or year around the month you're on.
  const anchor = periodMonths(period).includes(currentMonth)
    ? currentMonth
    : periodMonths(period)[0];

  const item = (active: boolean, extra = "") =>
    `LogsMenu__item LedgerSidebar__item${active ? " LogsMenu__item--active" : ""}${extra}`;

  return (
    <nav className="LogsMenu LedgerSidebar" aria-label="Log views">
      <div className="LedgerSidebar__group" role="group" aria-label="View">
        {(["entries", "stats"] as const).map((v) => (
          <Link
            key={v}
            className={item(view === v)}
            to={ledgerPeriodPath(ledgerId, v, period, currentMonth)}
            aria-current={view === v ? "page" : undefined}
          >
            <span className="LogsMenu__item__content LogsMenu__item__title">{VIEW_LABELS[v]}</span>
            {v === "stats" && tip("stats")}
          </Link>
        ))}
      </div>
      <div className="LedgerSidebar__group" role="group" aria-label="Period">
        {PERIOD_KINDS.map((kind) => {
          const active = view === "stats" ? period.kind === kind : kind === "month";
          const to =
            view === "entries" && kind === "month"
              ? ledgerPeriodPath(ledgerId, "entries", period, currentMonth)
              : ledgerPeriodPath(ledgerId, "stats", periodOf(anchor, kind), currentMonth);
          return (
            <Link
              key={kind}
              className={item(active, " LedgerSidebar__item--period")}
              to={to}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                if (!active) track("stats_period", { period: kind });
              }}
            >
              <span className="LogsMenu__item__content LogsMenu__item__title">
                {PERIOD_LABELS[kind]}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default LedgerSidebar;
