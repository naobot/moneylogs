import { CurrencyAmounts, LedgerCategory } from "@/types/ledger";
import { activeCategories } from "@/utils/ledger";
import { sumByCurrency } from "@/utils/ledgerEntries";
import { storage } from "@/platform";
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

/** An existing entry an incoming row may duplicate (same day, currency and amount). */
export type PossibleDuplicate = { entryId: string; note?: string; authorName?: string };

/** What checkLedgerImport found for a file. */
export type ImportCheck = {
  /** External ids of rows this user already imported into the ledger. */
  alreadyImported: ReadonlySet<string>;
  possibleDuplicates: Readonly<Record<string, PossibleDuplicate>>;
};

export type CheckedRows = {
  /** Rows not imported before: the ones to map and decide on. */
  fresh: ImportRow[];
  /** Fresh rows that look like spending already in the ledger. */
  flagged: ImportRow[];
  /** Fresh rows going ahead: unflagged ones, plus flagged ones the user ticked. */
  toImport: ImportRow[];
  alreadyImported: number;
};

/**
 * Split a file's rows using the duplicate check. Flagged rows stay out unless the user ticks
 * them (`included`), since a match on day and amount is likely, not certain. Without a check
 * (it failed) every row goes ahead; the import still skips this user's earlier imports.
 */
export const splitChecked = (
  rows: ReadonlyArray<ImportRow>,
  check: ImportCheck | undefined,
  included: ReadonlySet<string>,
): CheckedRows => {
  const fresh = check ? rows.filter((r) => !check.alreadyImported.has(r.externalId)) : [...rows];
  const isFlagged = (r: ImportRow) => check?.possibleDuplicates[r.externalId] !== undefined;
  return {
    fresh,
    flagged: fresh.filter(isFlagged),
    toImport: fresh.filter((r) => !isFlagged(r) || included.has(r.externalId)),
    alreadyImported: rows.length - fresh.length,
  };
};

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
  const parsed = storage.getJSON(mappingKey(ledgerId, source));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
};

export const saveMapping = (
  ledgerId: string,
  source: ImportSource,
  mapping: CategoryMapping,
): void => {
  // A convenience only: if it doesn't stick, next time the user maps again.
  storage.setJSON(mappingKey(ledgerId, source), mapping);
};
