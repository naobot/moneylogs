import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  DocumentReference,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { Currency } from "@/types/user";
import { LedgerCategory } from "@/types/ledger";
import { DEFAULT_CATEGORIES } from "@/utils/ledger";
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
  // rules accept only if it adds exactly the caller and there's still room.
  const joinLedgerFn = async ({ ledgerId, member }: JoinLedgerArgs): Promise<boolean> => {
    const userDocRef: DocumentReference = doc(db, "users", member.userDocId);
    await updateDoc(doc(db, "ledgers", ledgerId), {
      members: arrayUnion(userDocRef),
      memberUids: arrayUnion(member.uid),
    });
    return true;
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
