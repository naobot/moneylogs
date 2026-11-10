import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  DocumentReference,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { Currency } from "@/types/user";
import { LedgerCategory } from "@/types/ledger";
import { DEFAULT_CATEGORIES } from "@/utils/ledger";
import {
  PERSONAL_LEDGER_MAX_PARTICIPANTS,
  PERSONAL_LEDGER_TITLE,
  personalLedgerId,
  planPersonalLedger,
} from "@/utils/personalLedger";
import { useMutation } from "./useFirebase";

export type LedgerMember = {
  uid: string; // auth uid
  userDocId: string; // users/{docId}
};

type CreateLedgerArgs = {
  title: string;
  max_participants: number;
  defaultCurrency: Currency;
  member: LedgerMember;
};

type JoinLedgerArgs = {
  ledgerId: string;
  member: LedgerMember;
};

/**
 * The document written for a new ledger. Kept pure (refs/timestamps injected) so the
 * shape that firestore.rules validates on create is unit-testable.
 */
export const buildNewLedgerDoc = <TRef, TTime>({
  title,
  max_participants,
  defaultCurrency,
  member,
  userDocRef,
  createdAt,
  categories = DEFAULT_CATEGORIES,
}: CreateLedgerArgs & {
  userDocRef: TRef;
  createdAt: TTime;
  categories?: ReadonlyArray<LedgerCategory>;
}) => ({
  title: title.trim(),
  max_participants,
  defaultCurrency,
  members: [userDocRef],
  memberUids: [member.uid],
  createdBy: member.uid,
  categories: categories.map((c) => ({ ...c })),
  createdAt,
});

// Create the user's solo "personal" ledger unless they've had one before (see
// utils/personalLedger). Reads the user doc inside the transaction, so a stale cached
// profile can't resurrect a personal log the user has since deleted.
export const ensurePersonalLedger = async ({
  member,
  defaultCurrency,
}: {
  member: LedgerMember;
  defaultCurrency: Currency;
}): Promise<string | null> => {
  const userDocRef = doc(db, "users", member.userDocId);
  const ledgerId = personalLedgerId(member.uid);
  const ledgerRef = doc(db, "ledgers", ledgerId);
  return runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userDocRef);
    const ledgerSnap = await tx.get(ledgerRef);
    const plan = planPersonalLedger({
      userMarked: !!userSnap.data()?.personalLedgerId,
      ledgerExists: ledgerSnap.exists(),
    });
    if (plan.createLedger) {
      tx.set(
        ledgerRef,
        buildNewLedgerDoc({
          title: PERSONAL_LEDGER_TITLE,
          max_participants: PERSONAL_LEDGER_MAX_PARTICIPANTS,
          defaultCurrency,
          member,
          userDocRef,
          createdAt: serverTimestamp(),
        }),
      );
    }
    if (plan.markUser) tx.update(userDocRef, { personalLedgerId: ledgerId });
    return plan.createLedger ? ledgerId : null;
  });
};

export const useLedgerQuery = () => {
  const createLedgerFn = async (args: CreateLedgerArgs): Promise<string> => {
    const userDocRef = doc(db, "users", args.member.userDocId);
    const res = await addDoc(
      collection(db, "ledgers"),
      buildNewLedgerDoc({ ...args, userDocRef, createdAt: serverTimestamp() }),
    );
    if (!res?.id) throw new Error("Failed to create financial log");
    return res.id;
  };

  // A non-member can't read the ledger (rules), so joining is a blind arrayUnion that the
  // rules accept only if it adds exactly the caller and there's still room. Once in, the
  // title is readable; it's returned for the "you joined" notification.
  const joinLedgerFn = async ({ ledgerId, member }: JoinLedgerArgs): Promise<string> => {
    const userDocRef: DocumentReference = doc(db, "users", member.userDocId);
    await updateDoc(doc(db, "ledgers", ledgerId), {
      members: arrayUnion(userDocRef),
      memberUids: arrayUnion(member.uid),
    });
    try {
      const snap = await getDoc(doc(db, "ledgers", ledgerId));
      return (snap.data()?.title as string | undefined) ?? "";
    } catch {
      return "";
    }
  };

  const updateLedgerTitleFn = async ({
    ledgerId,
    title,
  }: {
    ledgerId: string;
    title: string;
  }): Promise<boolean> => {
    await updateDoc(doc(db, "ledgers", ledgerId), { title: title.trim() });
    return true;
  };

  return {
    createLedger: useMutation(createLedgerFn),
    joinLedger: useMutation(joinLedgerFn),
    updateLedgerTitle: useMutation(updateLedgerTitleFn),
    createLedgerFn,
    joinLedgerFn,
    updateLedgerTitleFn,
  };
};
