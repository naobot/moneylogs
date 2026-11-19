import { formatMonth, isValidMonthKey, LedgerView, monthKeyOf, shiftMonth } from "@/utils/ledger";

/**
 * Stats periods for a financial log: a month ("2026-11"), a quarter ("2026-Q4") or a year
 * ("2026"). The entries view is always monthly; quarters and years are stats-only.
 */
export type PeriodKind = "month" | "quarter" | "year";
export type Period = { kind: PeriodKind; key: string };

export const PERIOD_KINDS: readonly PeriodKind[] = ["month", "quarter", "year"];

const QUARTER_RE = /^(\d{4})-Q([1-4])$/;
const YEAR_RE = /^\d{4}$/;

export const isValidPeriod = ({ kind, key }: Period): boolean =>
  kind === "month"
    ? isValidMonthKey(key)
    : kind === "quarter"
      ? QUARTER_RE.test(key)
      : YEAR_RE.test(key);

/** The period of a kind that contains a month ("YYYY-MM") or day ("YYYY-MM-DD"). */
export const periodOf = (monthOrDate: string, kind: PeriodKind): Period => {
  const month = monthKeyOf(monthOrDate);
  const year = month.slice(0, 4);
  if (kind === "year") return { kind, key: year };
  if (kind === "quarter") {
    return { kind, key: `${year}-Q${Math.ceil(Number(month.slice(5, 7)) / 3)}` };
  }
  return { kind, key: month };
};

/** The period's months, oldest first. */
export const periodMonths = ({ kind, key }: Period): string[] => {
  if (kind === "month") return [key];
  const year = key.slice(0, 4);
  const first =
    kind === "quarter"
      ? `${year}-${String((Number(key.slice(-1)) - 1) * 3 + 1).padStart(2, "0")}`
      : `${year}-01`;
  const count = kind === "quarter" ? 3 : 12;
  return Array.from({ length: count }, (_, i) => shiftMonth(first, i));
};

const MONTHS_IN: Record<PeriodKind, number> = { month: 1, quarter: 3, year: 12 };

/** Shift a period by `delta` of its own kind. */
export const shiftPeriod = (period: Period, delta: number): Period =>
  periodOf(shiftMonth(periodMonths(period)[0], delta * MONTHS_IN[period.kind]), period.kind);

export const formatPeriod = ({ kind, key }: Period): string => {
  if (kind === "month") return formatMonth(key);
  if (kind === "quarter") return `Q${key.slice(-1)} ${key.slice(0, 4)}`;
  return key;
};

/** "this month" / "this quarter" / "this year". */
export const currentPeriodLabel = (kind: PeriodKind): string => `this ${kind}`;

export const samePeriod = (a: Period, b: Period): boolean => a.kind === b.kind && a.key === b.key;

/**
 * The month of a period to show on the monthly entries view: the current month while the
 * period is under way, otherwise its last month (or its first, if it's still to come).
 */
export const monthWithin = (period: Period, currentMonth: string): string => {
  const months = periodMonths(period);
  if (months.includes(currentMonth)) return currentMonth;
  return months[0] > currentMonth ? months[0] : months[months.length - 1];
};

/**
 * The period a page's search params ask for. ?quarter= and ?year= are honoured on the
 * stats view only; the entries view always shows a month.
 */
export const parsePeriod = (
  params: URLSearchParams,
  currentMonth: string,
  view: LedgerView = "stats",
): Period => {
  const asked: Period[] = [
    { kind: "quarter", key: params.get("quarter") ?? "" },
    { kind: "year", key: params.get("year") ?? "" },
    { kind: "month", key: params.get("month") ?? "" },
  ];
  const period = asked.find(isValidPeriod) ?? { kind: "month", key: currentMonth };
  if (view === "entries" && period.kind !== "month") {
    return { kind: "month", key: monthWithin(period, currentMonth) };
  }
  return period;
};

/** Search params for a period. The current month needs none. */
export const periodSearchParams = (period: Period, currentMonth: string): Record<string, string> =>
  period.kind === "month" && period.key === currentMonth ? {} : { [period.kind]: period.key };

/** Path for a ledger view at a period (entries views fall back to a month within it). */
export const ledgerPeriodPath = (
  ledgerId: string,
  view: LedgerView,
  period: Period,
  currentMonth: string,
): string => {
  const base = view === "stats" ? `/l/${ledgerId}/stats` : `/l/${ledgerId}`;
  const shown: Period =
    view === "entries" && period.kind !== "month"
      ? { kind: "month", key: monthWithin(period, currentMonth) }
      : period;
  const search = new URLSearchParams(periodSearchParams(shown, currentMonth)).toString();
  return search ? `${base}?${search}` : base;
};
