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

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The fields every row needs, whether it's being checked or imported. */
export type ImportCheckRow = Pick<ImportEntryRow, "externalId" | "date" | "amount" | "currency">;

const parseCheckRow = (raw: unknown): ImportCheckRow | null => {
  if (!raw || typeof raw !== "object") return null;
  const { externalId, date, amount, currency } = raw as Record<string, unknown>;
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
  return { externalId, date, amount: round2(amount), currency };
};

const parseRow = (raw: unknown, categoryIds: ReadonlySet<string>): ImportEntryRow | null => {
  const base = parseCheckRow(raw);
  if (!base) return null;
  const { categoryId, note } = raw as Record<string, unknown>;
  if (typeof categoryId !== "string" || !categoryIds.has(categoryId)) return null;
  if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) {
    return null;
  }
  const trimmed = typeof note === "string" ? note.trim() : "";
  return { ...base, categoryId, ...(trimmed ? { note: trimmed } : {}) };
};

/**
 * Validate the shape of untrusted callable input (for both checkLedgerImport and
 * importLedgerEntries). Returns an error message on failure.
 */
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
 * callable recomputes, alerts and rewards once for the whole batch instead of once per
 * entry. Later edits to an imported entry recompute as usual.
 */
export const isImportCreate = (
  before: unknown,
  after: { importBatchId?: unknown } | undefined,
): boolean => !before && typeof after?.importBatchId === "string";

/** Validate rows for checkLedgerImport, which runs before categories are mapped. */
export const parseCheckRows = (rows: ReadonlyArray<unknown>): ImportCheckRow[] | string => {
  const parsed: ImportCheckRow[] = [];
  for (const [i, raw] of rows.entries()) {
    const row = parseCheckRow(raw);
    if (!row) return `Row ${i + 1} is invalid.`;
    parsed.push(row);
  }
  return parsed;
};

/** An existing ledger entry, as far as duplicate matching needs it. */
export type ExistingEntry = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  note?: string;
  authorName?: string;
};

/** What the import preview shows for a row that may already be in the ledger. */
export type DuplicateMatch = { entryId: string; note?: string; authorName?: string };

/**
 * Rows that look like spending already in the ledger: same day, currency and amount as an
 * existing entry that isn't this row's own earlier import (those are matched by id and
 * skipped outright). Catches a hand-logged copy of a bank row, another member's import of
 * the same receipt, and a YNAB row whose payee or memo was edited after it was imported.
 *
 * One-to-one, in file order: two coffees in the file against one logged coffee flags only
 * the first, so a genuine second purchase isn't hidden.
 */
export const findPossibleDuplicates = (
  rows: ReadonlyArray<ImportCheckRow>,
  existing: ReadonlyArray<ExistingEntry>,
  ownEntryIds: ReadonlySet<string>,
): Record<string, DuplicateMatch> => {
  const key = (e: { date: string; currency: string; amount: number }) =>
    `${e.date}|${e.currency}|${round2(e.amount)}`;
  const pool = new Map<string, ExistingEntry[]>();
  for (const entry of existing) {
    if (ownEntryIds.has(entry.id)) continue;
    const k = key(entry);
    pool.set(k, [...(pool.get(k) ?? []), entry]);
  }
  const matches: Record<string, DuplicateMatch> = {};
  for (const row of rows) {
    const candidate = pool.get(key(row))?.shift();
    if (!candidate) continue;
    matches[row.externalId] = {
      entryId: candidate.id,
      ...(candidate.note ? { note: candidate.note } : {}),
      ...(candidate.authorName ? { authorName: candidate.authorName } : {}),
    };
  }
  return matches;
};
