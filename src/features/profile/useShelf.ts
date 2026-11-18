import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";
import { ShelfSlot, shelfSlots } from "@/features/ledger/buddy/knickknacks/provenance";

const NO_SLOTS: ShelfSlot[] = [];

/** Someone's public knick-knack shelf (shelves/{userDocId}), live. */
export const useShelf = (userDocId?: string) => {
  // Kept with whose shelf it is, so another person's reads as loading, not as the last one.
  const [result, setResult] = useState<{
    userDocId: string;
    slots: ShelfSlot[];
    isError: boolean;
  } | null>(null);

  useEffect(() => {
    if (!userDocId) return;
    return onSnapshot(
      doc(db, "shelves", userDocId),
      (snap) => setResult({ userDocId, slots: shelfSlots(snap.get("items")), isError: false }),
      (error) => {
        reportError(error, { feature: "profile", action: "load_knickknack_shelf" });
        setResult({ userDocId, slots: [], isError: true });
      },
    );
  }, [userDocId]);

  const current = userDocId && result?.userDocId === userDocId ? result : null;
  return {
    slots: current?.slots ?? NO_SLOTS,
    isLoading: !!userDocId && !current,
    isError: !!current?.isError,
  };
};
