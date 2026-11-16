import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";
import { ShelfSlot, shelfSlots } from "@/features/ledger/buddy/knickknacks/provenance";

/** Someone's public knick-knack shelf (shelves/{userDocId}), live. */
export const useShelf = (userDocId?: string) => {
  const [state, setState] = useState<{ slots: ShelfSlot[]; isLoading: boolean; isError: boolean }>({
    slots: [],
    isLoading: !!userDocId,
    isError: false,
  });

  useEffect(() => {
    if (!userDocId) return;
    return onSnapshot(
      doc(db, "shelves", userDocId),
      (snap) =>
        setState({ slots: shelfSlots(snap.get("items")), isLoading: false, isError: false }),
      (error) => {
        reportError(error, { feature: "profile", action: "load_knickknack_shelf" });
        setState({ slots: [], isLoading: false, isError: true });
      },
    );
  }, [userDocId]);

  return state;
};
