import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { functions } from "@/config/firebase-config";

/** Making and ending sublogs (functions/src/sublogs.ts). */

export type LinkSublogRequest = {
  childId: string;
  parentId: string;
  /** "YYYY-MM": the first month that counts in the parent. */
  since: string;
  /** The parent's line for it; defaults to the sublog's title. */
  name?: string;
};

const linkCallable = httpsCallable<LinkSublogRequest, { categoryId: string; linkId: string }>(
  functions,
  "linkSublog",
);
const unlinkCallable = httpsCallable<{ linkId: string }, { unlinked: boolean }>(
  functions,
  "unlinkSublog",
);

export const linkSublog = async (req: LinkSublogRequest) => (await linkCallable(req)).data;
/** End a link, by its id: the sublog's parentLink.linkId, or the parent's line's sublog.linkId. */
export const unlinkSublog = async (linkId: string) => (await unlinkCallable({ linkId })).data;

/** The month that includes everything a log has logged: "include past months". */
export const ALL_MONTHS = "1970-01";

/**
 * A message to show for a failed link or unlink. The server explains refusals it
 * expects (not a member, one level only…) in its own words; anything else is a bug.
 */
export const sublogErrorMessage = (err: unknown): { message: string; expected: boolean } => {
  if (err instanceof FirebaseError) {
    const code = err.code.replace("functions/", "");
    if (["permission-denied", "failed-precondition", "not-found"].includes(code)) {
      return { message: err.message, expected: true };
    }
  }
  return {
    message: "That didn't work. Nothing has changed, so please try again.",
    expected: false,
  };
};
