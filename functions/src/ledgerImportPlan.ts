/**
 * Pure helpers for the importLedgerEntries callable (bulk import from MoneyForward / YNAB).
 * Kept free of firebase imports so they run in the root Vitest suite.
 */
import { createHash } from "node:crypto";

export const IMPORT_SOURCES = ["moneyforward", "ynab"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

/** Rows per call. The client splits bigger files; this keeps one call well under timeouts. */
export const MAX_IMPORT_ROWS = 500;

/** Mirrors MAX_NOTE_LENGTH in src/utils/ledger.ts and validEntry in firestore.rules. */
const MAX_NOTE_LENGTH = 140;
const MAX_EXTERNAL_ID_LENGTH = 512;

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export type ImportEntryRow = {
  externalId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  categoryId: string;
  note?: string;
};

export type ImportRequest = {
  ledgerId: string;
  source: ImportSource;
  /** Still untrusted: check with parseImportRows once the ledger's categories are known. */
  rows: unknown[];
};

const isRealDate = (date: string): boolean => {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCDate() === Number(m[3]);
};

const parseRow = (raw: unknown, categoryIds: ReadonlySet<string>): ImportEntryRow | null => {
  if (!raw || typeof raw !== "object") return null;
  const { externalId, date, amount, currency, categoryId, note } = raw as Record<string, unknown>;
  if (
    typeof externalId !== "string" ||
    externalId.length === 0 ||
    externalId.length > MAX_EXTERNAL_ID_LENGTH
  ) {
    return null;
  }
  if (typeof date !== "string" || !isRealDate(date)) return null;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) return null;
  if (typeof categoryId !== "string" || !categoryIds.has(categoryId)) return null;
  if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) {
    return null;
  }
  const trimmed = typeof note === "string" ? note.trim() : "";
  return {
    externalId,
    date,
    amount: Math.round(amount * 100) / 100,
    currency,
    categoryId,
    ...(trimmed ? { note: trimmed } : {}),
  };
};

/** Validate the shape of untrusted callable input. Returns an error message on failure. */
export const parseImportRequest = (data: unknown): ImportRequest | string => {
  if (!data || typeof data !== "object") return "Expected { ledgerId, source, rows }.";
  const { ledgerId, source, rows } = data as Record<string, unknown>;
  if (typeof ledgerId !== "string" || !ID_RE.test(ledgerId)) return "Invalid ledgerId.";
  if (!IMPORT_SOURCES.includes(source as ImportSource)) return "Unknown import source.";
  if (!Array.isArray(rows) || rows.length === 0) return "No rows to import.";
  if (rows.length > MAX_IMPORT_ROWS) return `At most ${MAX_IMPORT_ROWS} rows per call.`;
  return { ledgerId, source: source as ImportSource, rows };
};

/**
 * Validate rows against the ledger's category ids. All-or-nothing: the client already parsed
 * and previewed the file, so a bad row means a bug, and a partial import would be confusing.
 */
export const parseImportRows = (
  rows: ReadonlyArray<unknown>,
  categoryIds: ReadonlySet<string>,
): ImportEntryRow[] | string => {
  const parsed: ImportEntryRow[] = [];
  for (const [i, raw] of rows.entries()) {
    const row = parseRow(raw, categoryIds);
    if (!row) return `Row ${i + 1} is invalid.`;
    parsed.push(row);
  }
  return parsed;
};

/**
 * Deterministic entry id, so importing the same row twice hits the same document and the
 * second create is skipped. Scoped to the importer's uid: two members importing their own
 * exports never collide, even if the source app reuses ids across accounts.
 */
export const importEntryId = (source: ImportSource, uid: string, externalId: string): string =>
  `imp_${source}_${createHash("sha1").update(`${uid}\n${externalId}`).digest("hex")}`;

/** YYYY-MM months touched by a batch, sorted. */
export const importMonths = (rows: ReadonlyArray<Pick<ImportEntryRow, "date">>): string[] =>
  [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort();

/**
 * Should recomputeLedgerMonth skip this write? Only the creation of an imported entry: the
 * callable recomputes each month once for the whole batch, and imports never earn check-ins,
 * knick-knacks or budget alerts. Later edits to an imported entry recompute as usual.
 */
export const isImportCreate = (
  before: unknown,
  after: { importBatchId?: unknown } | undefined,
): boolean => !before && typeof after?.importBatchId === "string";
