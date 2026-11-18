import { useEffect } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { useFirebaseCollection } from "@/hooks/useFirebase";
import { reportError } from "@/utils/reportError";
import type { KnickKnackFind } from "@/features/ledger/buddy/knickknacks/useUnseenFinds";
import { inTransitGifts } from "@/features/ledger/buddy/knickknacks/provenance";

/**
 * Knick-knacks the viewer gave this person that they haven't opened yet, live. Reads only
 * the viewer's own wrapped gifts (giftedBy == viewer, seenAt == null), the one slice of
 * someone's finds firestore.rules lets a giver read.
 */
export const useGiftsInTransit = (toUserDocId?: string, viewerDocId?: string) => {
  const enabled = !!toUserDocId && !!viewerDocId && toUserDocId !== viewerDocId;
  const { data, isLoading, isError, error } = useFirebaseCollection<KnickKnackFind>({
    queryBuilder: () =>
      enabled
        ? query(
            collection(db, "users", toUserDocId, "knickknacks"),
            where("giftedBy", "==", viewerDocId),
            where("seenAt", "==", null),
          )
        : null,
    dataTransformer: (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as KnickKnackFind),
    dependencies: [toUserDocId, viewerDocId],
    enabled,
  });

  useEffect(() => {
    if (isError) reportError(error, { feature: "profile", action: "load_gifts_in_transit" });
  }, [isError, error]);

  return {
    gifts: enabled && viewerDocId ? inTransitGifts(data, viewerDocId) : [],
    isLoading,
  };
};
