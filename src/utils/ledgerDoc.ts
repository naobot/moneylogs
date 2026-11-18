import { Currency } from "@/types/user";
import { LedgerCategory } from "@/types/ledger";
import { DEFAULT_CATEGORIES } from "@/utils/ledger";

// Free of the Firebase app config, so scripts running outside the browser (the emulator
// seed and test personas) build ledgers exactly as the app does.

export type LedgerMember = {
  uid: string; // auth uid
  userDocId: string; // users/{docId}
};

export type CreateLedgerArgs = {
  title: string;
  max_participants: number;
  defaultCurrency: Currency;
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
