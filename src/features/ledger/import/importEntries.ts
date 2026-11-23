import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";
import { IMPORT_CHUNK_SIZE, ImportCheck, MappedRow, PossibleDuplicate } from "./plan";
import { chunk } from "@/utils/chunk";
import { ImportRow, ImportSource } from "./types";

type ImportRequest = { ledgerId: string; source: ImportSource; rows: MappedRow[] };
type ImportResponse = { created: number; skippedDuplicates: number };

const importCallable = httpsCallable<ImportRequest, ImportResponse>(
  functions,
  "importLedgerEntries",
  { timeout: 150_000 },
);

export type ImportProgress = { done: number; total: number };

/**
 * Send mapped rows to importLedgerEntries in chunks, one at a time, reporting progress.
 * Stops at the first failed chunk; rows already sent stay imported, and importing the file
 * again skips them, so a retry is always safe.
 */
export const importEntries = async (
  { ledgerId, source, rows }: ImportRequest,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportResponse> => {
  const total = rows.length;
  let done = 0;
  const result: ImportResponse = { created: 0, skippedDuplicates: 0 };
  onProgress({ done, total });
  for (const part of chunk(rows, IMPORT_CHUNK_SIZE)) {
    const { data } = await importCallable({ ledgerId, source, rows: part });
    result.created += data.created;
    result.skippedDuplicates += data.skippedDuplicates;
    done += part.length;
    onProgress({ done, total });
  }
  return result;
};

type CheckRow = Pick<ImportRow, "externalId" | "date" | "amount" | "currency">;
type CheckRequest = { ledgerId: string; source: ImportSource; rows: CheckRow[] };
type CheckResponse = {
  alreadyImported: string[];
  possibleDuplicates: Record<string, PossibleDuplicate>;
};

const checkCallable = httpsCallable<CheckRequest, CheckResponse>(functions, "checkLedgerImport");

/**
 * Ask checkLedgerImport which of a file's rows are already in the ledger, in chunks. Rows
 * from different chunks can't be matched to the same existing entry: the first keeps it.
 */
export const checkImport = async ({
  ledgerId,
  source,
  rows,
}: {
  ledgerId: string;
  source: ImportSource;
  rows: ReadonlyArray<ImportRow>;
}): Promise<ImportCheck> => {
  const alreadyImported = new Set<string>();
  const possibleDuplicates: Record<string, PossibleDuplicate> = {};
  const claimed = new Set<string>();
  for (const part of chunk(rows, IMPORT_CHUNK_SIZE)) {
    const { data } = await checkCallable({
      ledgerId,
      source,
      rows: part.map(({ externalId, date, amount, currency }) => ({
        externalId,
        date,
        amount,
        currency,
      })),
    });
    for (const id of data.alreadyImported) alreadyImported.add(id);
    for (const [externalId, match] of Object.entries(data.possibleDuplicates)) {
      if (claimed.has(match.entryId)) continue;
      claimed.add(match.entryId);
      possibleDuplicates[externalId] = match;
    }
  }
  return { alreadyImported, possibleDuplicates };
};
