import { useEffect, useMemo, useState } from "react";
import cx from "classnames";

import { Currency } from "@/types/user";
import { CurrencyAmounts, Ledger, LedgerEntry } from "@/types/ledger";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { formatMonth, shiftMonth, trailingMonths } from "@/utils/ledger";
import { formatAmount, formatTotals } from "@/utils/ledgerEntries";
import {
  aggregateEntries,
  buildInsights,
  categoryShares,
  currenciesByUse,
  dailySeries,
  memberShares,
  monthlySeries,
  Share,
} from "@/utils/ledgerStats";

import Button from "@/components/Button";
import SpendingChart from "@/features/moneylog/components/LogsSummary/SpendingChart";

const OPEN_KEY = "ML__ledgerStatsOpen";
const TREND_MONTHS = 6;
const BAR_SEGMENTS = 4; // top categories drawn individually; the rest are grouped

const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
};

type LedgerStatsProps = {
  ledger: Ledger;
  month: string;
  today: string;
  entries: ReadonlyArray<LedgerEntry>;
  isLoading: boolean;
};

/**
 * Always-visible stats for the viewed month. The viewed month is aggregated live from its
 * loaded entries (same aggregator as the backend, so it can't drift); earlier months come
 * from the derived month summaries written by the recomputeLedgerMonth function.
 */
export const LedgerStats = ({ ledger, month, today, entries, isLoading }: LedgerStatsProps) => {
  const [open, setOpen] = useState(readOpen);
  const [chartMode, setChartMode] = useState<"bars" | "cumulative">("bars");
  const [pickedCurrency, setPickedCurrency] = useState<Currency | null>(null);

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {
        // Per-viewer convenience only.
      }
      return !o;
    });
  };

  const agg = useMemo(() => aggregateEntries([...entries]), [entries]);
  const currencies = useMemo(() => currenciesByUse(entries), [entries]);
  const currency: Currency =
    pickedCurrency && currencies.includes(pickedCurrency)
      ? pickedCurrency
      : (currencies[0] ?? ledger.defaultCurrency);

  // Reset an explicit pick when changing month (the new month may not use it).
  useEffect(() => setPickedCurrency(null), [month]);

  const trend = trailingMonths(month, TREND_MONTHS);
  const { byMonth } = useLedgerMonths({ ledgerId: ledger.id, from: trend[0], to: month });

  const categories = ledger.categories ?? [];
  const catShares = categoryShares(agg, currency, categories);
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
  const panelId = `ledger-stats-${ledger.id}`;

  return (
    <section className={cx("LedgerStats", { "LedgerStats--open": open })}>
      <button
        type="button"
        className="LedgerStats__strip"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span className="LedgerStats__strip__totals">
          {isLoading ? "…" : hasEntries ? formatTotals(agg.totals) : "Nothing spent yet"}
        </span>
        {hasEntries && !isLoading && <CategoryBar shares={catShares} currency={currency} />}
        <span className="LedgerStats__strip__toggle">{open ? "hide stats ▴" : "stats ▾"}</span>
      </button>

      {open && (
        <div className="LedgerStats__panel" id={panelId}>
          {currencies.length > 1 && (
            <div className="Segmented" role="group" aria-label="Currency">
              {currencies.map((c) => (
                <Button
                  key={c}
                  text={c}
                  size="sm"
                  buttonStyle="primary-border"
                  isSelected={c === currency}
                  onClick={() => setPickedCurrency(c)}
                />
              ))}
            </div>
          )}

          {!hasEntries ? (
            <p className="Ledger__empty">No entries in {formatMonth(month)} yet.</p>
          ) : (
            <>
              <Insights insights={insights} currency={currency} />

              <h4 className="LedgerStats__heading">By category · {currency}</h4>
              <ShareRows rows={catShares} currency={currency} label="Spending by category" />

              <div className="LedgerStats__chartHeader">
                <h4 className="LedgerStats__heading">Day by day · {currency}</h4>
                <div className="Segmented" role="group" aria-label="Graph type">
                  <Button
                    text="daily"
                    size="sm"
                    buttonStyle="primary-border"
                    isSelected={chartMode === "bars"}
                    onClick={() => setChartMode("bars")}
                  />
                  <Button
                    text="running total"
                    size="sm"
                    buttonStyle="primary-border"
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
              />

              {isShared && people.length > 0 && (
                <>
                  <h4 className="LedgerStats__heading">By person · {currency}</h4>
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
            axisFormat="MMM YY"
          />
        </div>
      )}
    </section>
  );
};

const pct = (share: number) => `${Math.round(share * 100)}%`;

const ShareRows = ({
  rows,
  currency,
  label,
}: {
  rows: Share[];
  currency: Currency;
  label: string;
}) => (
  <ul className="LedgerStats__shares" aria-label={label}>
    {rows.map((row) => (
      <li key={row.id}>
        <span className="LedgerStats__shares__name">{row.name}</span>
        <span className="LedgerStats__shares__track" aria-hidden="true">
          <span className="LedgerStats__shares__fill" style={{ width: pct(row.share) }} />
        </span>
        <span className="LedgerStats__shares__amount">{formatAmount(row.amount, currency)}</span>
        <span className="LedgerStats__shares__pct">{pct(row.share)}</span>
      </li>
    ))}
  </ul>
);

/** A monochrome stacked bar: largest categories as distinct fills, the rest grouped. */
const CategoryBar = ({ shares, currency }: { shares: Share[]; currency: Currency }) => {
  const top = shares.slice(0, BAR_SEGMENTS);
  const rest = shares.slice(BAR_SEGMENTS).reduce((sum, s) => sum + s.share, 0);
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

export default LedgerStats;
