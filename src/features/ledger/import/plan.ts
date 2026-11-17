import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { activeCategories } from "@/utils/ledger";
import { sumByCurrency } from "@/utils/ledgerEntries";
import { ImportRow, ImportSource } from "./types";

/** Rows per importLedgerEntries call; mirrors MAX_IMPORT_ROWS in functions/src/ledgerImportPlan.ts. */
export const IMPORT_CHUNK_SIZE = 500;

/** A mapping value meaning "leave these rows out". */
export const SKIP = "";

/** Source category → ledger category id (or SKIP). */
export type CategoryMapping = Record<string, string>;

export type SourceCategory = { name: string; count: number };

/** The file's distinct categories, most rows first (ties by name), for the mapping list. */
export const sourceCategories = (rows: ReadonlyArray<ImportRow>): SourceCategory[] => {
  const counts = new Map<string, number>();
  for (const { sourceCategory } of rows) {
    counts.set(sourceCategory, (counts.get(sourceCategory) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const normalise = (name: string) => name.trim().toLowerCase();

/**
 * A starting mapping: what this ledger used last time for the same source, else a ledger
 * category with the same name (ignoring case), else skip, so nothing lands in a category
 * the user didn't choose. Only active categories are offered.
 */
export const initialMapping = (
  sources: ReadonlyArray<SourceCategory>,
  categories: ReadonlyArray<LedgerCategory>,
  saved: CategoryMapping = {},
): CategoryMapping => {
  const active = activeCategories(categories);
  const activeIds = new Set(active.map((c) => c.id));
  const byName = new Map(active.map((c) => [normalise(c.name), c.id]));
  return Object.fromEntries(
    sources.map(({ name }) => {
      const remembered = saved[name];
      if (remembered !== undefined && (remembered === SKIP || activeIds.has(remembered))) {
        return [name, remembered];
      }
      return [name, byName.get(normalise(name)) ?? SKIP];
    }),
  );
};

export type MappedRow = Omit<ImportRow, "sourceCategory"> & { categoryId: string };

/** Rows ready for the callable: mapped to a category, skipped ones dropped. */
export const mapRows = (rows: ReadonlyArray<ImportRow>, mapping: CategoryMapping): MappedRow[] =>
  rows.flatMap(({ sourceCategory, ...row }) => {
    const categoryId = mapping[sourceCategory] ?? SKIP;
    return categoryId === SKIP ? [] : [{ ...row, categoryId }];
  });

export type MonthPreview = { month: string; count: number; totals: CurrencyAmounts };

/** Per-month counts and totals for the preview, oldest month first. */
export const previewByMonth = (rows: ReadonlyArray<MappedRow>): MonthPreview[] => {
  const months = new Map<string, MappedRow[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), row]);
  }
  return [...months]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, list]) => ({ month, count: list.length, totals: sumByCurrency(list) }));
};

export const chunk = <T>(items: ReadonlyArray<T>, size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const mappingKey = (ledgerId: string, source: ImportSource) =>
  `ML__importMapping_${ledgerId}_${source}`;

/** The mapping used last time for this ledger and source, on this device. */
export const readSavedMapping = (ledgerId: string, source: ImportSource): CategoryMapping => {
  try {
    const raw = window.localStorage.getItem(mappingKey(ledgerId, source));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
  } catch {
    return {};
  }
};

export const saveMapping = (
  ledgerId: string,
  source: ImportSource,
  mapping: CategoryMapping,
): void => {
  try {
    window.localStorage.setItem(mappingKey(ledgerId, source), JSON.stringify(mapping));
  } catch {
    // A convenience only: next time the user maps again.
  }
};
