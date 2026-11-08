import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { LedgerEntryInput } from "@/types/ledger";
import { monthKeyOf } from "@/utils/ledger";
import { useMutation } from "./useFirebase";

export type EntryAuthor = {
  uid: string;
  userDocId: string;
  displayName: string;
};

/** Normalise user input into the stored entry fields (month derived, note trimmed). */
export const entryFields = (input: LedgerEntryInput) => {
  const note = input.note?.trim();
  return {
    amount: input.amount,
    currency: input.currency,
    categoryId: input.categoryId,
    date: input.date,
    month: monthKeyOf(input.date),
    ...(note ? { note } : {}),
  };
};

export const useLedgerEntryQuery = () => {
  const addEntryFn = async ({
    ledgerId,
    input,
    author,
  }: {
    ledgerId: string;
    input: LedgerEntryInput;
    author: EntryAuthor;
  }): Promise<string> => {
    const res = await addDoc(collection(db, "ledgers", ledgerId, "entries"), {
      ...entryFields(input),
      author: doc(db, "users", author.userDocId),
      authorUid: author.uid,
      authorName: author.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return res.id;
  };

  const editEntryFn = async ({
    ledgerId,
    entryId,
    input,
  }: {
    ledgerId: string;
    entryId: string;
    input: LedgerEntryInput;
  }): Promise<boolean> => {
    const fields = entryFields(input);
    await updateDoc(doc(db, "ledgers", ledgerId, "entries", entryId), {
      ...fields,
      // Clearing the note removes the field rather than storing "".
      ...(fields.note ? {} : { note: deleteField() }),
      updatedAt: serverTimestamp(),
    });
    return true;
  };

  const deleteEntryFn = async ({
    ledgerId,
    entryId,
  }: {
    ledgerId: string;
    entryId: string;
  }): Promise<boolean> => {
    await deleteDoc(doc(db, "ledgers", ledgerId, "entries", entryId));
    return true;
  };

  return {
    addEntry: useMutation(addEntryFn),
    editEntry: useMutation(editEntryFn),
    deleteEntry: useMutation(deleteEntryFn),
  };
};
