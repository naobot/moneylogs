import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db } from "@/config/firebase-config";

/**
 * Whether the signed-in person can read a financial log: "member" if they can, and
 * "not-member" if the rules deny it. Rules allow reading a log that doesn't exist, so that
 * reads as "not-found".
 */
export type LedgerAccess = "checking" | "member" | "not-member" | "not-found" | "error";

export const ledgerAccessFromRead = (
  read: { exists: boolean } | { error: unknown },
): LedgerAccess => {
  if ("exists" in read) return read.exists ? "member" : "not-found";
  return read.error instanceof FirebaseError && read.error.code === "permission-denied"
    ? "not-member"
    : "error";
};

/**
 * A one-time check of whether `uid` can read the log, re-run when the person changes.
 *
 * The invite page uses this, not a live listener (useGetLedger): a listener on a log the
 * rules deny, which the join then makes readable, trips a Firestore SDK race (internal
 * assertion "ca9", fixed upstream after 11.10) and the join fails or the page goes blank.
 */
export const useLedgerAccess = (ledgerId?: string, uid?: string): LedgerAccess => {
  // Each answer is kept with the log and person it's for, so a change of either reads as
  // "checking" until the new answer arrives.
  const key = ledgerId && uid ? `${ledgerId}/${uid}` : null;
  const [result, setResult] = useState<{ key: string; access: LedgerAccess } | null>(null);

  useEffect(() => {
    if (!key || !ledgerId) return;
    let current = true;
    const settle = (access: LedgerAccess) => current && setResult({ key, access });
    getDoc(doc(db, "ledgers", ledgerId)).then(
      (snap) => settle(ledgerAccessFromRead({ exists: snap.exists() })),
      (error: unknown) => settle(ledgerAccessFromRead({ error })),
    );
    return () => {
      current = false;
    };
  }, [key, ledgerId]);

  return result && result.key === key ? result.access : "checking";
};
