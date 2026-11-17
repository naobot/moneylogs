import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";
import { IMPORT_CHUNK_SIZE, MappedRow, chunk } from "./plan";
import { ImportSource } from "./types";

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
