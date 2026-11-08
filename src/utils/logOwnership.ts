import { Group } from "@/types/user";
import { Ledger } from "@/types/ledger";

/**
 * Auth uid of a log's creator, or undefined when it can't be known.
 * - Ledgers: `createdBy`, else `memberUids[0]` (rules force the creator to be the only
 *   member at creation, and joins append, so the first uid is always the creator).
 * - Social groups: `createdBy` only. Older groups need the backfill script; until then
 *   nobody can delete them.
 */
export const creatorUid = (
  log: Pick<Group, "createdBy"> | Pick<Ledger, "createdBy" | "memberUids">,
  kind: "social" | "financial",
): string | undefined => {
  if (log.createdBy) return log.createdBy;
  if (kind === "financial") return (log as Pick<Ledger, "memberUids">).memberUids?.[0];
  return undefined;
};

/** Whether `title` typed by the user confirms deleting the log (trim/case-insensitive). */
export const confirmsDeletion = (typed: string, title: string): boolean =>
  typed.trim().length > 0 && typed.trim().toLowerCase() === title.trim().toLowerCase();
