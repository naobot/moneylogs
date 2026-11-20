import { useState } from "react";
import cx from "classnames";

import { Currency } from "@/types/user";
import { CurrencyAmounts, Ledger } from "@/types/ledger";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { useBudgetSnapshots } from "@/hooks/useBudgetSnapshots";
import { formatMonth, monthKeyOf } from "@/utils/ledger";
import { formatAmount } from "@/utils/ledgerEntries";
import { hasAnyBudget } from "@/utils/ledgerCategories";
import { formatPeriod, Period, periodMonths, shiftPeriod } from "@/utils/ledgerPeriods";
import {
  categoryBarSegments,
  categoryBudgetRows,
  categoryShares,
  monthlySeries,
} from "@/utils/ledgerStats";
import {
  aggregatePeriod,
  busiestMonth,
  monthsSoFar,
  PeriodBudget,
  periodBudget,
  periodCurrencies,
  periodElapsedShare,
  vsPreviousPeriod,
} from "@/utils/periodStats";

import Button from "@/components/Button";
import RowButton from "@/components/RowButton";
import SpendingChart from "@/features/moneylog/components/LogsSummary/SpendingChart";
import Totals from "./Totals";
import { CategoryBar, CategorySection } from "./LedgerStats";

const pct = (share: number) => `${Math.round(share * 100)}%`;

type PeriodStatsProps = {
  ledger: Ledger;
  period: Period;
  today: string;
  onEditBudget: () => void;
};

/**
 * Stats for a quarter or a year, added up from the derived month docs: totals, budget
 * kept month by month (each month judged by the budgets it had), categories and a
 * month-by-month chart. There's no live entry query here, so a year costs at most
 * 24 small month docs (this period and the last). Keyed by period by its parent, so a
 * currency picked in one period doesn't carry over.
 */
export const PeriodStats = ({ ledger, period, today, onEditBudget }: PeriodStatsProps) => {
  const months = periodMonths(period);
  const previousMonths = periodMonths(shiftPeriod(period, -1));
  const currentMonth = monthKeyOf(today);
  const label = formatPeriod(period);
  const previousLabel = period.kind === "year" ? "last year" : "last quarter";

  const { byMonth, isLoading: monthsLoading } = useLedgerMonths({
    ledgerId: ledger.id,
    from: previousMonths[0],
    to: months[months.length - 1],
  });
  const { snapshots, isLoading: snapshotsLoading } = useBudgetSnapshots({
    ledgerId: ledger.id,
    from: months[0],
  });

  const [picked, setPicked] = useState<Currency | null>(null);
  const currencies = periodCurrencies(months, byMonth);
  const currency: Currency =
    picked && currencies.includes(picked) ? picked : (currencies[0] ?? ledger.defaultCurrency);

  if (monthsLoading || snapshotsLoading) return <p className="Ledger__empty">...</p>;

  const agg = aggregatePeriod(months, byMonth);
  const hasEntries = Object.values(agg.totals).some((n) => (n ?? 0) > 0);
  const standing = ledger.categories ?? [];
  const budget = periodBudget({
    months,
    currentMonth,
    byMonth,
    categories: standing,
    totals: ledger.monthlyBudget,
    snapshots,
    currency,
  });
  const categories = budget?.categories ?? standing;
  const catShares = categoryShares(agg, currency, categories);
  const catRows = categoryBudgetRows(agg, currency, categories);

  const totalsByMonth: Record<string, CurrencyAmounts | undefined> = {};
  for (const m of months) totalsByMonth[m] = byMonth[m]?.totals;

  const insights: string[] = [];
  if (catShares[0]) {
    insights.push(
      `Most spent on ${catShares[0].name} (${pct(catShares[0].share)} of ${currency}).`,
    );
  }
  const busiest = busiestMonth(months, byMonth, currency);
  const spentMonths = monthsSoFar(months, currentMonth).filter(
    (m) => (byMonth[m]?.totals?.[currency] ?? 0) > 0,
  );
  if (busiest && spentMonths.length > 1) {
    const average = (agg.totals[currency] ?? 0) / spentMonths.length;
    insights.push(
      `Biggest month: ${formatMonth(busiest.month)} (${formatAmount(busiest.amount, currency)}). About ${formatAmount(average, currency)} a month on average.`,
    );
  }
  const vs = vsPreviousPeriod({ months, previousMonths, currentMonth, byMonth, currency });
  if (vs && vs.change !== null) {
    const change = Math.round(Math.abs(vs.change) * 100);
    const when = monthsSoFar(months, currentMonth).length < months.length ? " at this point" : "";
    insights.push(
      change === 0
        ? `Same as ${previousLabel}${when} (${formatAmount(vs.previous, currency)}).`
        : `${change}% ${vs.change > 0 ? "more" : "less"} than ${previousLabel}${when} (${formatAmount(vs.previous, currency)}).`,
    );
  }

  return (
    <section className="LedgerStats LedgerStats__panel" aria-label={`${label} stats`}>
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

      {!hasEntries ? (
        <p className="Ledger__empty">Nothing logged in {label} yet.</p>
      ) : (
        <>
          {budget ? (
            <PeriodBudgetSection budget={budget} currency={currency} onEdit={onEditBudget} />
          ) : (
            <p className="LedgerStats__noBudget">
              {hasAnyBudget(standing, ledger.monthlyBudget)
                ? `No ${currency} budget in ${label}.`
                : "No monthly budget yet. Set one to see how each month measures up."}{" "}
              <RowButton onClick={onEditBudget}>
                {hasAnyBudget(standing, ledger.monthlyBudget) ? "edit budgets" : "set a budget"}
              </RowButton>
            </p>
          )}

          {insights.length > 0 && (
            <ul className="LedgerStats__insights">
              {insights.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}

          <h4 className="LedgerStats__heading">
            Month by month · <span className="keep-case">{currency}</span>
          </h4>
          <SpendingChart
            series={monthlySeries(months, totalsByMonth, currency)}
            mode="bars"
            currency={currency}
            barRadius={0}
            axisFormat="month"
          />

          <CategorySection
            rows={catRows}
            currency={currency}
            categories={categories}
            segmentOf={categoryBarSegments(catShares, categories).segmentOf}
            elapsedShare={periodElapsedShare(months, today)}
            note={
              budget &&
              "Budgets add up each month's budget so far; categories without one show their share of spending."
            }
          />
        </>
      )}
    </section>
  );
};

const PeriodBudgetSection = ({
  budget,
  currency,
  onEdit,
}: {
  budget: PeriodBudget;
  currency: Currency;
  onEdit: () => void;
}) => {
  const lines: string[] = [];
  lines.push(
    budget.over
      ? `Over budget by ${formatAmount(budget.spent - budget.budget, currency)}.`
      : `${formatAmount(budget.budget - budget.spent, currency)} under budget.`,
  );
  if (budget.finished > 0) {
    lines.push(
      `${budget.within} of ${budget.finished} finished month${budget.finished === 1 ? "" : "s"} within budget.`,
    );
  }
  const overMonths = budget.months.filter((m) => m.over).map((m) => formatMonth(m.month));
  if (overMonths.length > 0 && overMonths.length < budget.months.length) {
    lines.push(`Over in ${overMonths.join(", ")}.`);
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
          {formatAmount(budget.spent, currency)} / {formatAmount(budget.budget, currency)} (
          {pct(budget.used)})
        </strong>
      </div>
      <ul className="LedgerStats__insights">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="LedgerStats__note">
        Each month counts against the {currency} budgets it had, for the months so far.
      </p>
    </div>
  );
};

export default PeriodStats;
