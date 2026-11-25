import { Link } from "react-router-dom";

import { LedgerCategory } from "@/types/ledger";
import { LedgerView } from "@/utils/ledger";
import { isActiveSublog } from "@/utils/sublogs";
import { useSublogLinks } from "@/features/ledger/sublogs/useSublogLinks";
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
  /** The log's categories: its live sublogs are listed under the periods. */
  categories?: ReadonlyArray<LedgerCategory>;
  view: LedgerView;
  period: Period;
  currentMonth: string;
  /** When set and the log has no sublogs, a "+ sublog" item that calls it. */
  onAddSublog?: () => void;
};

const NO_CATEGORIES: ReadonlyArray<LedgerCategory> = [];

const VIEW_LABELS: Record<LedgerView, string> = { entries: "entries", stats: "stats" };
const PERIOD_LABELS: Record<PeriodKind, string> = {
  month: "monthly",
  quarter: "quarterly",
  year: "yearly",
};

/**
 * The financial log's left column: which view (entries or stats) and, for stats, how much
 * time to look at (a month, a quarter or a year). Quarters and years are stats-only, so on
 * the entries view picking one moves to stats. A parent log then lists its sublogs, each
 * opening the sublog when you're in it; a log that could have sublogs but has none gets a
 * "+ sublog" item instead, so the idea is findable. Below the md breakpoint it's a strip that
 * scrolls sideways, like the social log's member list.
 */
export const LedgerSidebar = ({
  ledgerId,
  categories = NO_CATEGORIES,
  view,
  period,
  currentMonth,
  onAddSublog,
}: LedgerSidebarProps) => {
  const { tip } = useLedgerTour();
  const sublogs = categories.filter(isActiveSublog);
  const sublogIds = useSublogLinks(categories);
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
      {sublogs.length > 0 && (
        <div
          className="LedgerSidebar__group LedgerSidebar__group--sublogs"
          role="group"
          aria-label="Sublogs"
        >
          <span className="LedgerSidebar__heading">sublogs</span>
          {sublogs.map((c) => {
            const childId = sublogIds.get(c.id);
            const label = (
              <span className="LogsMenu__item__content LogsMenu__item__title keep-case">
                <span className="LedgerSidebar__glyph" aria-hidden="true">
                  ↳
                </span>{" "}
                {c.name}
              </span>
            );
            return childId ? (
              <Link
                key={c.id}
                className={item(false, " LedgerSidebar__item--sublog")}
                to={`/l/${childId}`}
              >
                {label}
              </Link>
            ) : (
              // A sublog you're not in: its line counts here, but there's nothing to open.
              <span
                key={c.id}
                className={item(false, " LedgerSidebar__item--sublog LedgerSidebar__item--closed")}
                title="A sublog you're not a member of"
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
      {sublogs.length === 0 && onAddSublog && (
        <div
          className="LedgerSidebar__group LedgerSidebar__group--sublogs"
          role="group"
          aria-label="Sublogs"
        >
          <button
            type="button"
            className={item(false, " LedgerSidebar__item--add")}
            onClick={onAddSublog}
          >
            <span className="LogsMenu__item__content LogsMenu__item__title">+ sublog</span>
          </button>
        </div>
      )}
    </nav>
  );
};

export default LedgerSidebar;
