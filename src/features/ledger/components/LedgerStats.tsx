import { useEffect, useMemo, useState } from "react";
import cx from "classnames";
import { Link } from "react-router-dom";

import { Currency } from "@/types/user";
import { CurrencyAmounts, Ledger, LedgerCategory, LedgerEntry } from "@/types/ledger";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { useBudgetSnapshots } from "@/hooks/useBudgetSnapshots";
import { categoriesForMonth, totalsForMonth } from "@/utils/budgetHistory";
import {
  formatMonth,
  ledgerViewPath,
  monthKeyOf,
  shiftMonth,
  trailingMonths,
} from "@/utils/ledger";
import { formatAmount } from "@/utils/ledgerEntries";
import Totals from "./Totals";
import { hasAnyBudget } from "@/utils/ledgerCategories";
import { canEditTotal } from "@/utils/monthlyBudget";
import {
  aggregateEntries,
  BudgetRow,
  BudgetSummary,
  budgetSummary,
  buildInsights,
  categoryBudgetRows,
  BarSegment,
  categoryBarSegments,
  categoryShares,
  currenciesByUse,
  dailySeries,
  memberShares,
  monthlySeries,
  Share,
} from "@/utils/ledgerStats";

import Button from "@/components/Button";
import Icon from "@/components/Icon";
import RowButton from "@/components/RowButton";
import SpendingChart from "@/features/moneylog/components/LogsSummary/SpendingChart";

const TREND_MONTHS = 6;

type LedgerStatsProps = {
  ledger: Ledger;
  month: string;
  today: string;
  entries: ReadonlyArray<LedgerEntry>;
  isLoading: boolean;
  /** Opens the budgets editor. */
  onEditBudget: () => void;
  /** Opens the month's total budget on one currency (stats page only). */
  onEditTotal?: (currency: Currency) => void;
};

/** Pick the currency to show: an explicit choice if still used, else the most-used one. */
const useStatsCurrency = (ledger: Ledger, month: string, entries: ReadonlyArray<LedgerEntry>) => {
  const [picked, setPicked] = useState<Currency | null>(null);
  const currencies = useMemo(() => currenciesByUse(entries), [entries]);
  // Reset an explicit pick when changing month (the new month may not use it).
  useEffect(() => setPicked(null), [month]);
  const currency: Currency =
    picked && currencies.includes(picked) ? picked : (currencies[0] ?? ledger.defaultCurrency);
  return { currency, currencies, setPicked };
};

/**
 * Compact, always-visible indicator on the entries page: this month's totals and a
 * category bar, linking to the full stats page for the same month, plus the budget
 * status (or a prompt to set one), which opens the budgets editor.
 */
export const LedgerStatsStrip = ({
  ledger,
  month,
  today,
  entries,
  isLoading,
  onEditBudget,
}: LedgerStatsProps) => {
  const agg = useMemo(() => aggregateEntries([...entries]), [entries]);
  const { currency } = useStatsCurrency(ledger, month, entries);
  const catShares = categoryShares(agg, currency, ledger.categories ?? []);
  const hasEntries = agg.entryCount > 0;
  const currentMonth = monthKeyOf(today);
  const budget = budgetSummary({
    month,
    today,
    currency,
    agg,
    categories: ledger.categories ?? [],
    totals: ledger.monthlyBudget,
  });

  const statsPath = ledgerViewPath(ledger.id, "stats", month, currentMonth);
  const noBudget = !hasAnyBudget(ledger.categories ?? [], ledger.monthlyBudget);

  return (
    <div className="LedgerStats LedgerStats__strip">
      <Link
        className="LedgerStats__strip__link"
        to={statsPath}
        aria-label={`${formatMonth(month)} stats`}
      >
        <span className="LedgerStats__strip__totals">
          {isLoading ? "…" : hasEntries ? <Totals totals={agg.totals} /> : "Nothing spent yet"}
        </span>
        {hasEntries && !isLoading && (
          <CategoryBar
            shares={catShares}
            currency={currency}
            categories={ledger.categories ?? []}
          />
        )}
      </Link>
      {!isLoading && budget && (
        <button
          type="button"
          className={cx("LedgerStats__strip__budget", {
            "LedgerStats__strip__budget--over": budget.over,
          })}
          title="Edit budgets"
          onClick={onEditBudget}
        >
          {budget.over
            ? `over budget by ${formatAmount(-budget.remaining, currency)}`
            : `${pct(budget.used)} of ${formatAmount(budget.budget, currency)} budget`}
        </button>
      )}
      {!isLoading && noBudget && (
        <button type="button" className="LedgerStats__strip__cta" onClick={onEditBudget}>
          <Icon type="wallet" size={20} />
          set budget
        </button>
      )}
      <Link className="LedgerStats__strip__toggle" to={statsPath} tabIndex={-1} aria-hidden>
        ›
      </Link>
    </div>
  );
};

/**
 * Full stats for the viewed month. The viewed month is aggregated live from its loaded
 * entries (same aggregator as the backend, so it can't drift); earlier months come from
 * the derived month summaries written by the recomputeLedgerMonth function.
 */
export const LedgerStatsPanel = ({
  ledger,
  month,
  today,
  entries,
  isLoading,
  onEditBudget,
  onEditTotal,
}: LedgerStatsProps) => {
  const [chartMode, setChartMode] = useState<"bars" | "cumulative">("bars");
  const agg = useMemo(() => aggregateEntries([...entries]), [entries]);
  const { currency, currencies, setPicked } = useStatsCurrency(ledger, month, entries);

  const trend = trailingMonths(month, TREND_MONTHS);
  const { byMonth, isLoading: monthsLoading } = useLedgerMonths({
    ledgerId: ledger.id,
    from: trend[0],
    to: month,
  });

  // A finished month is judged by the budgets it had, not today's.
  const { snapshots, isLoading: snapshotsLoading } = useBudgetSnapshots({
    ledgerId: ledger.id,
    from: month,
  });
  const categories = categoriesForMonth(month, ledger.categories ?? [], snapshots);
  const totals = totalsForMonth(month, ledger.monthlyBudget, snapshots);
  const catShares = categoryShares(agg, currency, categories);
  const catRows = categoryBudgetRows(agg, currency, categories);
  const budget = budgetSummary({ month, today, currency, agg, categories, totals });
  const editTotal =
    onEditTotal && canEditTotal(month, today) ? () => onEditTotal(currency) : undefined;
  const isShared = (ledger.memberUids?.length ?? 0) > 1;
  const names: Record<string, string> = {};
  for (const e of entries) names[e.authorUid] = e.authorName;
  const people = isShared ? memberShares(agg, currency, names) : [];

  const insights = buildInsights({
    month,
    today,
    currency,
    agg,
    previous: byMonth[shiftMonth(month, -1)] ?? null,
    categories,
  });

  const totalsByMonth: Record<string, CurrencyAmounts | undefined> = {};
  for (const m of trend) totalsByMonth[m] = m === month ? agg.totals : byMonth[m]?.totals;

  const hasEntries = agg.entryCount > 0;

  // The trend and "vs last month" need the month summaries: before they're in, earlier
  // months would draw as nothing spent.
  if (isLoading || monthsLoading || snapshotsLoading) return <p className="Ledger__empty">...</p>;

  return (
    <section className="LedgerStats LedgerStats__panel" aria-label={`${formatMonth(month)} stats`}>
      <div className="LedgerStats__summary">
        <strong className="LedgerStats__summary__totals">
          {hasEntries ? <Totals totals={agg.totals} /> : "Nothing spent yet"}
        </strong>
        {hasEntries && (
          <CategoryBar shares={catShares} currency={currency} categories={categories} />
        )}
      </div>

      {currencies.length > 1 && (
        <div className="Segmented" role="group" aria-label="Currency">
          {currencies.map((c) => (
            <Button
              key={c}
              text={c}
              size="sm"
              variant="toggle"
              isSelected={c === currency}
              onClick={() => setPicked(c)}
            />
          ))}
        </div>
      )}

      {budget ? (
        <BudgetSection
          budget={budget}
          currency={currency}
          onEdit={onEditBudget}
          onEditTotal={editTotal}
        />
      ) : (
        <p className="LedgerStats__noBudget">
          {hasAnyBudget(categories, totals)
            ? `No ${currency} budget set.`
            : "No monthly budget yet. Set a total for the month, or budgets per category, to see how much is left and where the month is heading."}{" "}
          {editTotal && <RowButton onClick={editTotal}>set a total</RowButton>}{" "}
          <RowButton onClick={onEditBudget}>
            {hasAnyBudget(categories) ? "edit budgets" : "category budgets"}
          </RowButton>
        </p>
      )}

      {!hasEntries ? (
        <p className="Ledger__empty">No entries in {formatMonth(month)} yet.</p>
      ) : (
        <>
          <Insights insights={insights} currency={currency} />
        </>
      )}

      {(hasEntries || catRows.length > 0) && (
        <>
          <h4 className="LedgerStats__heading">
            By category · <span className="keep-case">{currency}</span>
          </h4>
          {budget && (
            <p className="LedgerStats__note">
              Categories with a budget show progress toward it; the rest show their share of
              spending.
            </p>
          )}
          <ShareRows
            rows={catRows}
            currency={currency}
            label="Spending by category"
            segmentOf={categoryBarSegments(catShares, categories).segmentOf}
          />
        </>
      )}

      {hasEntries && (
        <>
          <div className="LedgerStats__chartHeader">
            <h4 className="LedgerStats__heading">
              Day by day · <span className="keep-case">{currency}</span>
            </h4>
            <div className="Segmented" role="group" aria-label="Graph type">
              <Button
                text="daily"
                size="sm"
                variant="toggle"
                isSelected={chartMode === "bars"}
                onClick={() => setChartMode("bars")}
              />
              <Button
                text="running total"
                size="sm"
                variant="toggle"
                isSelected={chartMode === "cumulative"}
                onClick={() => setChartMode("cumulative")}
              />
            </div>
          </div>
          <SpendingChart
            series={dailySeries(month, agg.byDay, currency, today)}
            mode={chartMode}
            currency={currency}
            barRadius={0}
            weekdays
          />

          {isShared && people.length > 0 && (
            <>
              <h4 className="LedgerStats__heading">
                By person · <span className="keep-case">{currency}</span>
              </h4>
              <ShareRows rows={people} currency={currency} label="Spending by person" />
            </>
          )}
        </>
      )}

      <h4 className="LedgerStats__heading">
        Last {TREND_MONTHS} months · {currency}
      </h4>
      <SpendingChart
        series={monthlySeries(trend, totalsByMonth, currency)}
        mode="bars"
        currency={currency}
        barRadius={0}
        axisFormat="month"
      />
    </section>
  );
};

const pct = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Horizontal bars. Rows with a budget show progress toward it (capped fill, heavy border
 * when over); rows without show their share of the month's spending.
 */
export const ShareRows = ({
  rows,
  currency,
  label,
  segmentOf,
}: {
  rows: Array<Share & Partial<Pick<BudgetRow, "budget" | "over">>>;
  currency: Currency;
  label: string;
  /** Category rows: each row's fill in the stacked bar, shown as a key swatch. */
  segmentOf?: ReadonlyMap<string, BarSegment>;
}) => (
  <ul className="LedgerStats__shares" aria-label={label}>
    {rows.map((row) => {
      const budgeted = row.budget !== undefined;
      const ratio = budgeted ? row.amount / row.budget! : row.share;
      return (
        <li key={row.id} className={cx({ "LedgerStats__shares--over": row.over })}>
          <span className="LedgerStats__shares__name">
            {segmentOf?.has(row.id) && (
              <span
                className={`LedgerStats__swatch LedgerStats__bar__seg--${segmentOf.get(row.id)}`}
                aria-hidden="true"
              />
            )}
            <span className="LedgerStats__shares__label">{row.name}</span>
          </span>
          <span
            className={cx("Meter__track LedgerStats__shares__track", {
              "Meter__track--budget": budgeted,
              "Meter__track--over": row.over,
            })}
            aria-hidden="true"
          >
            <span className="Meter__fill" style={{ width: pct(Math.min(ratio, 1)) }} />
          </span>
          <span className="LedgerStats__shares__amount">
            {formatAmount(row.amount, currency)}
            {budgeted && <small> / {formatAmount(row.budget!, currency)}</small>}
          </span>
          <span className="LedgerStats__shares__pct" title={budgeted ? "of budget" : "of spending"}>
            {pct(ratio)}
          </span>
        </li>
      );
    })}
  </ul>
);

const BudgetSection = ({
  budget,
  currency,
  onEdit,
  onEditTotal,
}: {
  budget: BudgetSummary;
  currency: Currency;
  onEdit: () => void;
  /** Makes the budget amount a button that opens the monthly total (current month). */
  onEditTotal?: () => void;
}) => {
  const lines: string[] = [];
  if (budget.over) {
    lines.push(`Over budget by ${formatAmount(-budget.remaining, currency)}.`);
  } else {
    lines.push(`${formatAmount(budget.remaining, currency)} left.`);
    if (budget.perDayLeft !== null && budget.daysLeft) {
      lines.push(
        `About ${formatAmount(budget.perDayLeft, currency)} a day for the remaining ${budget.daysLeft} day${budget.daysLeft === 1 ? "" : "s"}.`,
      );
    }
  }
  if (budget.projected !== null) {
    const diff = budget.projected - budget.budget;
    lines.push(
      `At this pace: about ${formatAmount(budget.projected, currency)} by month end${
        Math.abs(diff) < 0.01
          ? ", right on budget."
          : diff > 0
            ? ` (${formatAmount(diff, currency)} over).`
            : ` (${formatAmount(-diff, currency)} under).`
      }`,
    );
  }
  return (
    <div className={cx("LedgerStats__budget", { "LedgerStats__budget--over": budget.over })}>
      <div className="LedgerStats__chartHeader">
        <h4 className="LedgerStats__heading">
          Budget · <span className="keep-case">{currency}</span>
        </h4>
        <RowButton onClick={onEdit}>edit</RowButton>
      </div>
      <div className="LedgerStats__budget__meter">
        <span
          className={cx("Meter__track Meter__track--budget LedgerStats__budget__track", {
            "Meter__track--over": budget.over,
          })}
          role="meter"
          aria-label={`${currency} budget used`}
          aria-valuemin={0}
          aria-valuemax={budget.budget}
          aria-valuenow={budget.spent}
        >
          <span className="Meter__fill" style={{ width: pct(Math.min(budget.used, 1)) }} />
        </span>
        <strong>
          {formatAmount(budget.spent, currency)} /{" "}
          {onEditTotal ? (
            <button
              type="button"
              className="LedgerStats__budget__total"
              aria-label={`edit the monthly total (${formatAmount(budget.budget, currency)})`}
              onClick={onEditTotal}
            >
              {formatAmount(budget.budget, currency)}
            </button>
          ) : (
            formatAmount(budget.budget, currency)
          )}{" "}
          ({pct(budget.used)})
        </strong>
      </div>
      <ul className="LedgerStats__insights">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="LedgerStats__note">
        {budget.isTotal
          ? `Counts all ${currency} spending against the month's total.`
          : `Counts spending in categories that have a ${currency} budget.`}
        {onEditTotal && " Tap the budget to change the month's total."}
      </p>
    </div>
  );
};

/**
 * A monochrome stacked bar: largest categories as distinct fills (drawn in the order set
 * in the Categories panel), the rest grouped at the end.
 */
export const CategoryBar = ({
  shares,
  currency,
  categories,
}: {
  shares: Share[];
  currency: Currency;
  categories: ReadonlyArray<LedgerCategory>;
}) => {
  const { top, rest } = categoryBarSegments(shares, categories);
  const segments =
    rest > 0 ? [...top, { id: "__rest", name: "Other", share: rest, amount: 0 }] : top;
  const summary = top.map((s) => `${s.name} ${pct(s.share)}`).join(", ");
  return (
    <span
      className="LedgerStats__bar"
      role="img"
      aria-label={`${currency} by category: ${summary}${rest > 0 ? `, others ${pct(rest)}` : ""}`}
    >
      {segments.map((s, i) => (
        <span
          key={s.id}
          className={`LedgerStats__bar__seg LedgerStats__bar__seg--${s.id === "__rest" ? "rest" : i}`}
          style={{ width: pct(s.share) }}
          title={`${s.name} ${pct(s.share)}`}
        />
      ))}
    </span>
  );
};

const Insights = ({
  insights,
  currency,
}: {
  insights: ReturnType<typeof buildInsights>;
  currency: Currency;
}) => {
  const { topCategory, vsLastMonth, noSpendDays, elapsed } = insights;
  const items: string[] = [];
  if (topCategory) {
    items.push(`Most spent on ${topCategory.name} (${pct(topCategory.share)} of ${currency}).`);
  }
  if (vsLastMonth && vsLastMonth.change !== null) {
    const change = Math.round(Math.abs(vsLastMonth.change) * 100);
    items.push(
      change === 0
        ? `Same as this point last month (${formatAmount(vsLastMonth.previous, currency)}).`
        : `${change}% ${vsLastMonth.change > 0 ? "more" : "less"} than this point last month (${formatAmount(vsLastMonth.previous, currency)}).`,
    );
  }
  if (elapsed > 0) {
    items.push(
      noSpendDays === 0
        ? "Something logged every day so far."
        : `${noSpendDays} of ${elapsed} day${elapsed === 1 ? "" : "s"} with nothing logged.`,
    );
  }
  if (items.length === 0) return null;
  return (
    <ul className="LedgerStats__insights">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
};

export default LedgerStatsPanel;
