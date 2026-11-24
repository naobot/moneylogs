import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { ScheduleInput } from "@/utils/schedules";
import { useMutation } from "./useFirebase";

export type ScheduleOwner = { uid: string; userDocId: string };

/** What the owner can change; categoryId stays put (rules). */
export type ScheduleChanges = Partial<Omit<ScheduleInput, "categoryId">> & { paused?: boolean };

/**
 * Scheduled payments on a fixed category. Writes only what the owner sets: the functions
 * book its next due day (nextDue / nextDueAt) and log its entries.
 */
export const useLedgerScheduleQuery = () => {
  const addScheduleFn = async ({
    ledgerId,
    input,
    owner,
  }: {
    ledgerId: string;
    input: ScheduleInput;
    owner: ScheduleOwner;
  }): Promise<string> => {
    const res = await addDoc(collection(db, "ledgers", ledgerId, "schedules"), {
      categoryId: input.categoryId,
      label: input.label.trim(),
      amount: input.amount,
      currency: input.currency,
      repeat: input.repeat,
      ownerUid: owner.uid,
      ownerDocId: owner.userDocId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return res.id;
  };

  const updateScheduleFn = async ({
    ledgerId,
    scheduleId,
    changes,
  }: {
    ledgerId: string;
    scheduleId: string;
    changes: ScheduleChanges;
  }): Promise<boolean> => {
    await updateDoc(doc(db, "ledgers", ledgerId, "schedules", scheduleId), {
      ...changes,
      ...(changes.label !== undefined ? { label: changes.label.trim() } : {}),
      updatedAt: serverTimestamp(),
    });
    return true;
  };

  const deleteScheduleFn = async ({
    ledgerId,
    scheduleId,
  }: {
    ledgerId: string;
    scheduleId: string;
  }): Promise<boolean> => {
    await deleteDoc(doc(db, "ledgers", ledgerId, "schedules", scheduleId));
    return true;
  };

  return {
    addSchedule: useMutation(addScheduleFn),
    updateSchedule: useMutation(updateScheduleFn),
    deleteSchedule: useMutation(deleteScheduleFn),
  };
};
